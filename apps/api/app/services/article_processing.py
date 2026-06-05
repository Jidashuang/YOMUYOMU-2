from __future__ import annotations

import logging
import re
import threading
from time import perf_counter
from uuid import UUID

from sqlalchemy import delete, func, insert, select

from app.db.session import SessionLocal
from app.models.entities import Article, ArticleBlock, TokenOccurrence
from app.services.epub_parser import extract_text_from_epub_payload
from app.services.nlp_client import nlp_client
from app.services.product_analytics import EVENT_ARTICLE_PROCESSED, record_product_event

logger = logging.getLogger(__name__)

_recovery_started = False
_recovery_lock = threading.Lock()
MAX_TEXT_BLOCK_CHARS = 1200
MAX_NLP_CHUNK_CHARS = 8000
TOKEN_INSERT_BATCH_SIZE = 500


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


def _annotation_error_message(exc: Exception) -> str:
    reason = str(exc)
    if "NLP annotation produced no tokens" in reason:
        return "NLP 标注暂时没有生成结果，正文已可阅读。"
    if "OperationalError" in reason or "server closed" in reason or "consuming input failed" in reason:
        return "NLP 标注写入暂时失败，正文已可阅读。"
    if "NLP annotate failed" in reason:
        return "NLP 标注暂时失败，正文已可阅读。"
    return f"NLP 标注暂时失败，正文已可阅读：{reason[:180]}"


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


def _annotate_and_store_chunk(db, article: Article, chunk: list[ArticleBlock]) -> int:  # noqa: ANN001
    annotation_text, _ = _build_annotation_text(chunk)
    try:
        tokens = nlp_client.annotate(annotation_text)
    except Exception as exc:  # noqa: BLE001
        if len(chunk) <= 1:
            raise
        midpoint = max(1, len(chunk) // 2)
        logger.warning(
            "article_processing_chunk_split article_id=%s blocks=%s-%s reason=%s",
            article.id,
            chunk[0].block_index,
            chunk[-1].block_index,
            exc,
        )
        return _annotate_and_store_chunk(db, article, chunk[:midpoint]) + _annotate_and_store_chunk(
            db, article, chunk[midpoint:]
        )

    token_count = _add_chunk_tokens(db, article, chunk, tokens)
    article.processed_block_count = chunk[-1].block_index + 1
    db.commit()
    return token_count


def process_article(article_id: UUID) -> None:
    started_at = perf_counter()
    db = SessionLocal()
    try:
        article = db.scalar(select(Article).where(Article.id == article_id))
        if article is None:
            return

        logger.info("article_processing_start article_id=%s source_type=%s", article_id, article.source_type)

        try:
            normalized_content = _parse_article_content(article.source_type, article.raw_content)
        except ValueError as exc:
            article.status = "failed"
            article.processing_error = str(exc)
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

        block_texts = split_text_blocks(normalized_content)
        if not block_texts:
            raise ValueError("Article content is empty after parsing")

        article.status = "processing"
        article.processing_error = None
        article.normalized_content = normalized_content
        article.processed_block_count = 0
        article.total_block_count = len(block_texts)
        db.commit()

        db.execute(delete(TokenOccurrence).where(TokenOccurrence.article_id == article.id))
        db.execute(delete(ArticleBlock).where(ArticleBlock.article_id == article.id))
        db.flush()
        for block_index, block_text in enumerate(block_texts):
            db.add(ArticleBlock(article_id=article.id, block_index=block_index, text=block_text))
        db.commit()
        logger.info("article_blocks_ready article_id=%s blocks=%s", article_id, len(block_texts))

        blocks = db.scalars(
            select(ArticleBlock).where(ArticleBlock.article_id == article.id).order_by(ArticleBlock.block_index.asc())
        ).all()
        block_count = len(blocks)
        token_count = 0
        for chunk in _iter_annotation_chunks(blocks):
            token_count += _annotate_and_store_chunk(db, article, chunk)

        if token_count == 0:
            raise RuntimeError("NLP annotation produced no tokens")

        article.status = "ready"
        article.processing_error = None
        article.processed_block_count = block_count
        article.total_block_count = block_count
        record_product_event(
            db,
            user_id=article.user_id,
            article_id=article.id,
            event_name=EVENT_ARTICLE_PROCESSED,
            payload={"status": "ready", "block_count": block_count, "token_count": token_count},
        )
        db.commit()
        logger.info(
            "article_processing_ready article_id=%s blocks=%s tokens=%s latency_ms=%.2f",
            article_id,
            block_count,
            token_count,
            (perf_counter() - started_at) * 1000,
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("article_processing_exception article_id=%s error=%s", article_id, exc)
        try:
            db.rollback()
        except Exception:  # noqa: BLE001
            db.close()
            db = SessionLocal()

        article = db.scalar(select(Article).where(Article.id == article_id))
        if article:
            block_count = _article_block_count(db, article.id)
            if block_count > 0:
                article.status = "ready"
                article.processing_error = _annotation_error_message(exc)
                article.processed_block_count = min(article.processed_block_count or 0, block_count)
                article.total_block_count = article.total_block_count or block_count
                record_product_event(
                    db,
                    user_id=article.user_id,
                    article_id=article.id,
                    event_name=EVENT_ARTICLE_PROCESSED,
                    payload={
                        "status": "ready",
                        "annotation_status": "failed",
                        "reason": article.processing_error,
                        "block_count": block_count,
                    },
                )
                db.commit()
                logger.warning(
                    "article_annotation_failed_readable article_id=%s blocks=%s processed=%s reason=%s latency_ms=%.2f",
                    article_id,
                    block_count,
                    article.processed_block_count,
                    article.processing_error,
                    (perf_counter() - started_at) * 1000,
                )
                return

            article.status = "failed"
            article.processing_error = str(exc)[:3000]
            article.processed_block_count = article.processed_block_count or 0
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
    finally:
        db.close()


def _process_article(article_id: UUID) -> None:
    process_article(article_id)


def _load_pending_article_ids() -> list[UUID]:
    db = SessionLocal()
    try:
        return list(db.scalars(select(Article.id).where(Article.status == "processing")).all())
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed to load pending article jobs: %s", exc)
        return []
    finally:
        db.close()


def _process_pending_articles(article_ids: list[UUID]) -> None:
    for article_id in article_ids:
        process_article(article_id)


def start_article_worker() -> None:
    global _recovery_started

    with _recovery_lock:
        if _recovery_started:
            return
        _recovery_started = True

    pending_ids = _load_pending_article_ids()
    if not pending_ids:
        return

    thread = threading.Thread(
        target=_process_pending_articles,
        args=(pending_ids,),
        name="article-processing-recovery",
        daemon=True,
    )
    thread.start()
