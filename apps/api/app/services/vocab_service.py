from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entities import VocabItem
from app.schemas.vocab import VocabItemCreateRequest, VocabReviewResult, VocabStatus
from app.services.product_analytics import EVENT_VOCAB_ADDED, record_product_event

_REVIEW_INTERVAL_DAYS = [1, 2, 4, 7, 14, 30]


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _next_interval_days(review_count: int) -> int:
    index = max(0, min(review_count - 1, len(_REVIEW_INTERVAL_DAYS) - 1))
    return _REVIEW_INTERVAL_DAYS[index]


def _initial_next_review_at(status: VocabStatus, now: datetime) -> datetime | None:
    if status == "known":
        return None
    return now


def apply_status_schedule(item: VocabItem, status: VocabStatus, now: datetime | None = None) -> None:
    current = now or _utc_now()
    item.status = status
    if status == "known":
        item.next_review_at = None
        return
    if status == "new":
        item.review_count = 0
        item.next_review_at = current
        return

    if item.review_count <= 0:
        item.review_count = 1
    item.next_review_at = current + timedelta(days=1)


def apply_review_result(item: VocabItem, result: VocabReviewResult, now: datetime | None = None) -> None:
    current = now or _utc_now()
    if result == "fail":
        item.status = "learning"
        item.review_count = 0
        item.next_review_at = current + timedelta(hours=12)
        return

    item.review_count = max(item.review_count, 0) + 1
    if item.review_count >= 4:
        item.status = "known"
        item.next_review_at = None
        return

    item.status = "learning"
    item.next_review_at = current + timedelta(days=_next_interval_days(item.review_count))


def create_vocab_item(db: Session, user_id: UUID, payload: VocabItemCreateRequest) -> VocabItem:
    now = _utc_now()
    # Dedupe by (user_id, lemma, pos): saving the same word again is idempotent — return the
    # existing item (don't reset its review schedule), just backfill a reading/meaning if the
    # earlier save lacked one. This keeps the review list and the "已收录" indicator honest.
    existing = db.scalar(
        select(VocabItem).where(
            VocabItem.user_id == user_id,
            VocabItem.lemma == payload.lemma,
            VocabItem.pos == payload.pos,
        )
    )
    if existing is not None:
        changed = False
        if not existing.reading and payload.reading:
            existing.reading = payload.reading
            changed = True
        if not existing.meaning_snapshot and payload.meaning_snapshot:
            existing.meaning_snapshot = payload.meaning_snapshot
            changed = True
        if changed:
            db.commit()
            db.refresh(existing)
        return existing

    item = VocabItem(
        user_id=user_id,
        surface=payload.surface,
        lemma=payload.lemma,
        reading=payload.reading,
        pos=payload.pos,
        meaning_snapshot=payload.meaning_snapshot,
        jlpt_level=payload.jlpt_level,
        frequency_band=payload.frequency_band,
        status=payload.status,
        next_review_at=_initial_next_review_at(payload.status, now),
        review_count=0,
        source_article_id=payload.source_article_id,
        source_sentence=payload.source_sentence,
    )
    db.add(item)
    record_product_event(
        db,
        user_id=user_id,
        article_id=payload.source_article_id,
        event_name=EVENT_VOCAB_ADDED,
        payload={"lemma": payload.lemma, "surface": payload.surface},
    )
    db.commit()
    db.refresh(item)
    return item
