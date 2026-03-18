from __future__ import annotations

import logging
import queue
import threading
from time import perf_counter
from uuid import UUID

from sqlalchemy import delete, select

from app.db.session import SessionLocal
from app.models.entities import Article, ArticleBlock, TokenOccurrence
from app.services.nlp_client import nlp_client
from app.services.product_analytics import EVENT_ARTICLE_PROCESSED, record_product_event

logger = logging.getLogger(__name__)

_job_queue: queue.Queue[UUID] = queue.Queue()
_worker_started = False
_worker_lock = threading.Lock()


def normalize_content(raw_content: str) -> str:
    return "\n".join(line.rstrip() for line in raw_content.replace("\r\n", "\n").split("\n")).strip()


def split_text_blocks(content: str) -> list[str]:
    lines = [line.strip() for line in content.split("\n") if line.strip()]
    if lines:
        return lines
    return [content] if content else []


def _safe_int(value: object, fallback: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return fallback


def enqueue_article_processing(article_id: UUID) -> None:
    _job_queue.put(article_id)


def _process_article(article_id: UUID) -> None:
    started_at = perf_counter()
    db = SessionLocal()
    try:
        article = db.scalar(select(Article).where(Article.id == article_id))
        if article is None:
            return

        logger.info("article_processing_start article_id=%s source_type=%s", article_id, article.source_type)

        article.status = "processing"
        article.processing_error = None
        article.normalized_content = normalize_content(article.raw_content)
        db.commit()

        if article.source_type != "text":
            article.status = "failed"
            article.processing_error = "Only source_type=text is supported in current MVP"
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

        db.execute(delete(TokenOccurrence).where(TokenOccurrence.article_id == article.id))
        db.execute(delete(ArticleBlock).where(ArticleBlock.article_id == article.id))
        db.flush()

        block_count = 0
        token_count = 0
        for block_index, block_text in enumerate(split_text_blocks(article.normalized_content or "")):
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

        article.status = "ready"
        article.processing_error = None
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


def _worker_loop() -> None:
    while True:
        article_id = _job_queue.get()
        try:
            _process_article(article_id)
        finally:
            _job_queue.task_done()


def _enqueue_pending_articles() -> None:
    db = SessionLocal()
    try:
        rows = db.scalars(select(Article.id).where(Article.status == "processing")).all()
        for article_id in rows:
            enqueue_article_processing(article_id)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed to load pending article jobs: %s", exc)
    finally:
        db.close()


def start_article_worker() -> None:
    global _worker_started

    with _worker_lock:
        if _worker_started:
            return
        thread = threading.Thread(target=_worker_loop, name="article-processing-worker", daemon=True)
        thread.start()
        _worker_started = True

    _enqueue_pending_articles()
