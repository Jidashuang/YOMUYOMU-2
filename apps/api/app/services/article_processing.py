from __future__ import annotations

import logging
import re
import threading
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from time import perf_counter
from uuid import UUID

from sqlalchemy import delete, func, insert, or_, select, update

from app.db.session import SessionLocal
from app.models.entities import Article, ArticleBlock, TokenOccurrence
from app.services.epub_parser import extract_text_from_epub_payload
from app.services.fallback_annotator import annotate_text_fallback, get_fallback_jlpt_map
from app.services.nlp_client import nlp_client
from app.services.product_analytics import EVENT_ARTICLE_PROCESSED, record_product_event

logger = logging.getLogger(__name__)

_recovery_started = False
_recovery_lock = threading.Lock()
MAX_TEXT_BLOCK_CHARS = 1200
MAX_NLP_CHUNK_CHARS = 8000
TOKEN_INSERT_BATCH_SIZE = 500

# Annotation runs as a durable, resumable job tracked on the Article row. A worker that
# dies mid-annotation leaves annotation_status in {pending, processing}; the startup scan
# reclaims rows whose heartbeat (annotation_updated_at) is older than this, up to the
# retry cap. The DB-level claim (UPDATE ... WHERE stale) is the lease — no task queue.
STALE_ANNOTATION_TIMEOUT = timedelta(minutes=10)
MAX_ANNOTATION_RETRIES = 3

_FALLBACK_ANNOTATION_MESSAGE = "NLP 标注暂不可用，已用基础词库标注，精度较低，可重试。"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def normalize_content(raw_content: str) -> str:
    return "\n".join(line.rstrip() for line in raw_content.replace("\r\n", "\n").split("\n")).strip()


def split_text_blocks(content: str) -> list[str]:
    lines = []
    for line in [line.strip() for line in content.split("\n") if line.strip()]:
        lines.extend(_split_long_block(line))
    if lines:
        return lines
    return _split_long_block(content) if content else []


def _split_long_block(text: str) -> list[str]:
    if len(text) <= MAX_TEXT_BLOCK_CHARS:
        return [text]

    parts: list[str] = []
    current = ""
    for sentence in re.findall(r".+?[。！？!?]|.+$", text):
        if len(sentence) > MAX_TEXT_BLOCK_CHARS:
            if current:
                parts.append(current)
                current = ""
            parts.extend(sentence[i : i + MAX_TEXT_BLOCK_CHARS] for i in range(0, len(sentence), MAX_TEXT_BLOCK_CHARS))
            continue
        if current and len(current) + len(sentence) > MAX_TEXT_BLOCK_CHARS:
            parts.append(current)
            current = sentence
        else:
            current += sentence
    if current:
        parts.append(current)
    return [part for part in parts if part]


def _parse_article_content(source_type: str, raw_content: str) -> str:
    if source_type == "text":
        return normalize_content(raw_content)
    if source_type == "epub":
        extracted = extract_text_from_epub_payload(raw_content)
        return normalize_content(extracted)
    raise ValueError(f"Unsupported source_type={source_type}")


def _safe_int(value: object, fallback: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return fallback


def _article_block_count(db, article_id: UUID) -> int:  # noqa: ANN001
    return int(
        db.scalar(select(func.count(ArticleBlock.id)).where(ArticleBlock.article_id == article_id))
        or 0
    )


def _article_token_count(db, article_id: UUID) -> int:  # noqa: ANN001
    return int(
        db.scalar(select(func.count(TokenOccurrence.id)).where(TokenOccurrence.article_id == article_id))
        or 0
    )


def _annotation_error_message(reason: str) -> str:
    if "NLP annotation produced no tokens" in reason:
        return "NLP 标注暂时没有生成结果，正文已可阅读。"
    if "OperationalError" in reason or "server closed" in reason or "consuming input failed" in reason:
        return "NLP 标注写入暂时失败，正文已可阅读，可重试。"
    if "NLP annotate failed" in reason:
        return "NLP 标注暂时失败，正文已可阅读，可重试。"
    return f"NLP 标注暂时失败，正文已可阅读，可重试：{reason[:180]}"


def _iter_annotation_chunks(blocks: list[ArticleBlock]) -> list[list[ArticleBlock]]:
    chunks: list[list[ArticleBlock]] = []
    current: list[ArticleBlock] = []
    current_len = 0
    for block in blocks:
        block_len = len(block.text)
        separator_len = 1 if current else 0
        if current and current_len + separator_len + block_len > MAX_NLP_CHUNK_CHARS:
            chunks.append(current)
            current = [block]
            current_len = block_len
            continue
        current.append(block)
        current_len += separator_len + block_len
    if current:
        chunks.append(current)
    return chunks


def _build_annotation_text(blocks: list[ArticleBlock]) -> tuple[str, list[tuple[ArticleBlock, int, int]]]:
    parts: list[str] = []
    offsets: list[tuple[ArticleBlock, int, int]] = []
    cursor = 0
    for block in blocks:
        if parts:
            parts.append("\n")
            cursor += 1
        start = cursor
        parts.append(block.text)
        cursor += len(block.text)
        offsets.append((block, start, cursor))
    return "".join(parts), offsets


def _add_chunk_tokens(db, article: Article, blocks: list[ArticleBlock], tokens: list[dict]) -> int:  # noqa: ANN001
    rows: list[dict[str, object]] = []
    block_token_indexes = {block.id: 0 for block in blocks}
    _, offsets = _build_annotation_text(blocks)
    offset_index = 0

    for token in tokens:
        start = _safe_int(token.get("start"))
        end = _safe_int(token.get("end"))
        while offset_index < len(offsets) and start >= offsets[offset_index][2]:
            offset_index += 1
        if offset_index >= len(offsets):
            continue

        block, block_start, block_end = offsets[offset_index]
        if start < block_start or end > block_end:
            continue

        rows.append(
            {
                "article_id": article.id,
                "block_id": block.id,
                "token_index": block_token_indexes[block.id],
                "surface": str(token.get("surface", "")),
                "lemma": str(token.get("lemma", "")),
                "reading": str(token.get("reading", "")),
                "pos": str(token.get("pos", "unknown")),
                "start_offset": start - block_start,
                "end_offset": end - block_start,
                "jlpt_level": str(token.get("jlpt_level") or "Unknown"),
                "frequency_band": str(token.get("frequency_band") or "Unknown"),
            }
        )
        block_token_indexes[block.id] += 1

    for index in range(0, len(rows), TOKEN_INSERT_BATCH_SIZE):
        db.execute(insert(TokenOccurrence), rows[index : index + TOKEN_INSERT_BATCH_SIZE])
    return len(rows)


@dataclass
class _ChunkResult:
    token_count: int = 0
    ok_blocks: int = 0          # blocks annotated by the real NLP service (incl. legit empty)
    fallback_blocks: int = 0    # blocks coloured by the degraded fallback (NLP was down)
    failed_blocks: list[int] = field(default_factory=list)  # block_index with no tokens at all
    last_error: str | None = None


def _merge_chunk_results(left: _ChunkResult, right: _ChunkResult) -> _ChunkResult:
    return _ChunkResult(
        token_count=left.token_count + right.token_count,
        ok_blocks=left.ok_blocks + right.ok_blocks,
        fallback_blocks=left.fallback_blocks + right.fallback_blocks,
        failed_blocks=left.failed_blocks + right.failed_blocks,
        last_error=right.last_error or left.last_error,
    )


def _annotate_and_store_chunk(db, article: Article, chunk: list[ArticleBlock]) -> _ChunkResult:  # noqa: ANN001
    """Annotate one chunk. Failures are ISOLATED, never raised to the caller:

    - NLP failure on a multi-block chunk → recursively split to find the toxic block.
    - NLP failure on a single block → try the degraded fallback annotator.
    - Fallback also empty → record the block as failed and move on (text stays readable).
    """
    annotation_text, _ = _build_annotation_text(chunk)
    try:
        tokens = nlp_client.annotate(annotation_text)
    except Exception as exc:  # noqa: BLE001
        if len(chunk) > 1:
            midpoint = max(1, len(chunk) // 2)
            logger.warning(
                "article_processing_chunk_split article_id=%s blocks=%s-%s reason=%s",
                article.id,
                chunk[0].block_index,
                chunk[-1].block_index,
                exc,
            )
            left = _annotate_and_store_chunk(db, article, chunk[:midpoint])
            right = _annotate_and_store_chunk(db, article, chunk[midpoint:])
            return _merge_chunk_results(left, right)

        block = chunk[0]
        fallback_tokens = annotate_text_fallback(block.text, get_fallback_jlpt_map())
        if not fallback_tokens:
            logger.warning(
                "article_annotation_block_failed article_id=%s block=%s reason=%s",
                article.id,
                block.block_index,
                exc,
            )
            article.processed_block_count = block.block_index + 1
            article.annotation_updated_at = _utcnow()
            db.commit()
            return _ChunkResult(failed_blocks=[block.block_index], last_error=str(exc))

        token_count = _add_chunk_tokens(db, article, chunk, fallback_tokens)
        article.processed_block_count = block.block_index + 1
        article.annotation_updated_at = _utcnow()
        db.commit()
        return _ChunkResult(token_count=token_count, fallback_blocks=1)

    token_count = _add_chunk_tokens(db, article, chunk, tokens)
    article.processed_block_count = chunk[-1].block_index + 1
    article.annotation_updated_at = _utcnow()
    db.commit()
    return _ChunkResult(token_count=token_count, ok_blocks=len(chunk))


def process_article(article_id: UUID) -> None:
    """Parse source → commit blocks → mark text READABLE. Annotation is handed off after.

    `status` only reflects text readability (processing/ready/failed); it flips to `ready`
    as soon as blocks are committed so the reader can open immediately. Annotation health
    is tracked separately and filled in by `annotate_article`.
    """
    started_at = perf_counter()
    db = SessionLocal()
    blocks_ready = False
    try:
        article = db.scalar(select(Article).where(Article.id == article_id))
        if article is None:
            return

        logger.info("article_processing_start article_id=%s source_type=%s", article_id, article.source_type)

        try:
            normalized_content = _parse_article_content(article.source_type, article.raw_content)
            block_texts = split_text_blocks(normalized_content)
            if not block_texts:
                raise ValueError("Article content is empty after parsing")
        except ValueError as exc:
            article.status = "failed"
            article.processing_error = str(exc)
            article.annotation_status = "failed"
            article.annotation_error = str(exc)
            article.annotation_updated_at = _utcnow()
            record_product_event(
                db,
                user_id=article.user_id,
                article_id=article.id,
                event_name=EVENT_ARTICLE_PROCESSED,
                payload={"status": "failed", "reason": article.processing_error},
            )
            db.commit()
            logger.warning(
                "article_processing_failed article_id=%s reason=%s latency_ms=%.2f",
                article_id,
                article.processing_error,
                (perf_counter() - started_at) * 1000,
            )
            return

        article.status = "ready"
        article.processing_error = None
        article.normalized_content = normalized_content
        article.processed_block_count = 0
        article.total_block_count = len(block_texts)
        article.annotation_status = "pending"
        article.annotation_error = None
        article.annotation_updated_at = _utcnow()

        db.execute(delete(TokenOccurrence).where(TokenOccurrence.article_id == article.id))
        db.execute(delete(ArticleBlock).where(ArticleBlock.article_id == article.id))
        db.flush()
        # Bulk insert so a 4000+ block book lands in one round-trip, not 4000 ORM flushes.
        db.execute(
            insert(ArticleBlock),
            [
                {"article_id": article.id, "block_index": block_index, "text": block_text}
                for block_index, block_text in enumerate(block_texts)
            ],
        )
        record_product_event(
            db,
            user_id=article.user_id,
            article_id=article.id,
            event_name=EVENT_ARTICLE_PROCESSED,
            payload={"status": "ready", "annotation_status": "pending", "block_count": len(block_texts)},
        )
        db.commit()
        blocks_ready = True
        logger.info("article_blocks_ready article_id=%s blocks=%s", article_id, len(block_texts))
    except Exception as exc:  # noqa: BLE001
        logger.exception("article_processing_exception article_id=%s error=%s", article_id, exc)
        try:
            db.rollback()
        except Exception:  # noqa: BLE001
            db.close()
            db = SessionLocal()
        article = db.scalar(select(Article).where(Article.id == article_id))
        if article and _article_block_count(db, article.id) == 0:
            article.status = "failed"
            article.processing_error = str(exc)[:3000]
            article.annotation_status = "failed"
            article.annotation_error = article.processing_error
            article.annotation_updated_at = _utcnow()
            db.commit()
        return
    finally:
        db.close()

    if blocks_ready:
        annotate_article(article_id)


def annotate_article(article_id: UUID) -> None:
    """Resumable, chunk-isolated annotation. Never marks the article unreadable.

    Resumes from `processed_block_count` (the contiguous high-water mark of *attempted*
    blocks — not "blocks lacking tokens", because heading/punctuation blocks legitimately
    have none). Final annotation_status is decided by chunk outcomes:
    ready (all NLP ok) / partial (some failed or fallback used) / failed (nothing produced).
    """
    started_at = perf_counter()
    db = SessionLocal()
    try:
        article = db.scalar(select(Article).where(Article.id == article_id))
        if article is None or article.status != "ready":
            return

        article.annotation_status = "processing"
        article.annotation_updated_at = _utcnow()
        db.commit()

        resume_from = article.processed_block_count or 0
        if resume_from == 0:
            # Fresh run or explicit retry: drop any stale tokens so we never duplicate rows.
            db.execute(delete(TokenOccurrence).where(TokenOccurrence.article_id == article.id))
            db.commit()

        total_block_count = article.total_block_count or _article_block_count(db, article.id)
        blocks = db.scalars(
            select(ArticleBlock)
            .where(ArticleBlock.article_id == article.id, ArticleBlock.block_index >= resume_from)
            .order_by(ArticleBlock.block_index.asc())
        ).all()

        result = _ChunkResult()
        for chunk in _iter_annotation_chunks(blocks):
            result = _merge_chunk_results(result, _annotate_and_store_chunk(db, article, chunk))

        article.processed_block_count = total_block_count
        article.total_block_count = total_block_count
        article.annotation_updated_at = _utcnow()

        produced = result.ok_blocks or result.fallback_blocks
        if result.failed_blocks and not produced and _article_token_count(db, article.id) == 0:
            article.annotation_status = "failed"
            article.annotation_error = _annotation_error_message(result.last_error or "NLP annotate failed")
        elif result.failed_blocks:
            article.annotation_status = "partial"
            article.annotation_error = _annotation_error_message(result.last_error or "NLP annotate failed")
        elif result.fallback_blocks:
            article.annotation_status = "partial"
            article.annotation_error = _FALLBACK_ANNOTATION_MESSAGE
        else:
            article.annotation_status = "ready"
            article.annotation_error = None

        record_product_event(
            db,
            user_id=article.user_id,
            article_id=article.id,
            event_name=EVENT_ARTICLE_PROCESSED,
            payload={
                "status": "ready",
                "annotation_status": article.annotation_status,
                "token_count": _article_token_count(db, article.id),
                "failed_blocks": len(result.failed_blocks),
                "fallback_blocks": result.fallback_blocks,
            },
        )
        db.commit()
        logger.info(
            "article_annotation_done article_id=%s annotation_status=%s tokens=%s failed_blocks=%s fallback_blocks=%s latency_ms=%.2f",
            article_id,
            article.annotation_status,
            _article_token_count(db, article.id),
            len(result.failed_blocks),
            result.fallback_blocks,
            (perf_counter() - started_at) * 1000,
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("article_annotation_exception article_id=%s error=%s", article_id, exc)
        try:
            db.rollback()
        except Exception:  # noqa: BLE001
            db.close()
            db = SessionLocal()
        article = db.scalar(select(Article).where(Article.id == article_id))
        if article:
            has_tokens = _article_token_count(db, article.id) > 0
            article.annotation_status = "partial" if has_tokens else "failed"
            article.annotation_error = _annotation_error_message(str(exc))
            article.annotation_updated_at = _utcnow()
            db.commit()
    finally:
        db.close()


def _process_article(article_id: UUID) -> None:
    process_article(article_id)


def _load_recoverable_article_ids() -> tuple[list[UUID], list[UUID]]:
    """Return (unparsed_ids, stuck_annotation_ids) that the startup worker should resume."""
    db = SessionLocal()
    try:
        unparsed = list(db.scalars(select(Article.id).where(Article.status == "processing")).all())
        stale_before = _utcnow() - STALE_ANNOTATION_TIMEOUT
        stuck = list(
            db.scalars(
                select(Article.id).where(
                    Article.status == "ready",
                    Article.annotation_status.in_(["pending", "processing"]),
                    Article.annotation_retry_count < MAX_ANNOTATION_RETRIES,
                    or_(
                        Article.annotation_updated_at.is_(None),
                        Article.annotation_updated_at < stale_before,
                    ),
                )
            ).all()
        )
        return unparsed, stuck
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed to load recoverable article jobs: %s", exc)
        return [], []
    finally:
        db.close()


def _claim_annotation(article_id: UUID) -> bool:
    """Atomically lease a stuck annotation job so two workers can't double-process it.

    The WHERE clause only matches rows that are still pending/processing AND stale, so the
    first claimer wins (rowcount == 1) and bumps the heartbeat + retry_count; later claimers
    see a fresh heartbeat and match nothing.
    """
    db = SessionLocal()
    try:
        stale_before = _utcnow() - STALE_ANNOTATION_TIMEOUT
        result = db.execute(
            update(Article)
            .where(
                Article.id == article_id,
                Article.annotation_status.in_(["pending", "processing"]),
                Article.annotation_retry_count < MAX_ANNOTATION_RETRIES,
                or_(
                    Article.annotation_updated_at.is_(None),
                    Article.annotation_updated_at < stale_before,
                ),
            )
            .values(
                annotation_status="processing",
                annotation_updated_at=_utcnow(),
                annotation_retry_count=Article.annotation_retry_count + 1,
            )
        )
        db.commit()
        return (result.rowcount or 0) == 1
    finally:
        db.close()


def _recover_articles(unparsed_ids: list[UUID], stuck_ids: list[UUID]) -> None:
    for article_id in unparsed_ids:
        process_article(article_id)
    for article_id in stuck_ids:
        if _claim_annotation(article_id):
            annotate_article(article_id)


def start_article_worker() -> None:
    global _recovery_started

    with _recovery_lock:
        if _recovery_started:
            return
        _recovery_started = True

    unparsed, stuck = _load_recoverable_article_ids()
    if not unparsed and not stuck:
        return

    thread = threading.Thread(
        target=_recover_articles,
        args=(unparsed, stuck),
        name="article-processing-recovery",
        daemon=True,
    )
    thread.start()
