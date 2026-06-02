from __future__ import annotations

import logging
import threading
from time import perf_counter
from uuid import UUID

from sqlalchemy import delete, select

from app.db.session import SessionLocal
from app.models.entities import Article, ArticleBlock, TokenOccurrence
from app.services.epub_parser import extract_text_from_epub_payload
from app.services.nlp_client import nlp_client
from app.services.product_analytics import EVENT_ARTICLE_PROCESSED, record_product_event

logger = logging.getLogger(__name__)

_recovery_started = False
_recovery_lock = threading.Lock()


def normalize_content(raw_content: str) -> str:
    return "\n".join(line.rstrip() for line in raw_content.replace("\r\n", "\n").split("\n")).strip()


def split_text_blocks(content: str) -> list[str]:
    lines = [line.strip() for line in content.split("\n") if line.strip()]
    if lines:
        return lines
    return [content] if content else []


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
        db.commit()

        block_count = 0
        token_count = 0
        for block_index, block_text in enumerate(block_texts):
            block = ArticleBlock(article_id=article.id, block_index=block_index, text=block_text)
            db.add(block)
            db.flush()
            block_count += 1

            for token_index, token in enumerate(nlp_client.annotate(block_text)):
                db.add(
                    TokenOccurrence(
                        article_id=article.id,
                        block_id=block.id,
                        token_index=token_index,
                        surface=str(token.get("surface", "")),
                        lemma=str(token.get("lemma", "")),
                        reading=str(token.get("reading", "")),
                        pos=str(token.get("pos", "unknown")),
                        start_offset=_safe_int(token.get("start")),
                        end_offset=_safe_int(token.get("end")),
                        jlpt_level=str(token.get("jlpt_level") or "Unknown"),
                        frequency_band=str(token.get("frequency_band") or "Unknown"),
                    )
                )
                token_count += 1
            article.processed_block_count = block_index + 1
            db.commit()

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
        db.rollback()

        article = db.scalar(select(Article).where(Article.id == article_id))
        if article:
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
