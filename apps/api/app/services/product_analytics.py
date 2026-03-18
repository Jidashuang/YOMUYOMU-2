from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.entities import ProductEvent

EVENT_ARTICLE_CREATED = "article_created"
EVENT_ARTICLE_PROCESSED = "article_processed"
EVENT_TOKEN_LOOKUP = "token_lookup"
EVENT_VOCAB_ADDED = "vocab_added"
EVENT_HIGHLIGHT_CREATED = "highlight_created"
EVENT_AI_EXPLANATION_REQUESTED = "ai_explanation_requested"
EVENT_AI_EXPLANATION_SUCCEEDED = "ai_explanation_succeeded"
EVENT_AI_EXPLANATION_FAILED = "ai_explanation_failed"

ALL_EVENT_NAMES = {
    EVENT_ARTICLE_CREATED,
    EVENT_ARTICLE_PROCESSED,
    EVENT_TOKEN_LOOKUP,
    EVENT_VOCAB_ADDED,
    EVENT_HIGHLIGHT_CREATED,
    EVENT_AI_EXPLANATION_REQUESTED,
    EVENT_AI_EXPLANATION_SUCCEEDED,
    EVENT_AI_EXPLANATION_FAILED,
}


@dataclass
class UsageCounts:
    lookup_count: int = 0
    vocab_added_count: int = 0
    highlight_count: int = 0
    ai_explanation_count: int = 0


@dataclass
class BusinessMetrics:
    lookup_to_vocab_rate: float = 0.0
    highlight_to_ai_rate: float = 0.0
    ai_requests_per_article: float = 0.0
    ai_requests_per_user: float = 0.0


def _build_usage_counts(event_counts: dict[str, int]) -> UsageCounts:
    return UsageCounts(
        lookup_count=event_counts.get(EVENT_TOKEN_LOOKUP, 0),
        vocab_added_count=event_counts.get(EVENT_VOCAB_ADDED, 0),
        highlight_count=event_counts.get(EVENT_HIGHLIGHT_CREATED, 0),
        ai_explanation_count=event_counts.get(EVENT_AI_EXPLANATION_REQUESTED, 0),
    )


def _safe_rate(numerator: int, denominator: int) -> float:
    if denominator <= 0:
        return 0.0
    return round(float(numerator) / float(denominator), 4)


def record_product_event(
    db: Session,
    *,
    user_id: UUID,
    event_name: str,
    article_id: UUID | None = None,
    payload: dict | None = None,
    commit: bool = False,
) -> ProductEvent:
    if event_name not in ALL_EVENT_NAMES:
        raise ValueError(f"Unsupported product event: {event_name}")

    row = ProductEvent(
        user_id=user_id,
        article_id=article_id,
        event_name=event_name,
        payload=payload,
    )
    db.add(row)
    if commit:
        db.commit()
    return row


def get_event_counts(db: Session, *, user_id: UUID, article_id: UUID | None = None) -> dict[str, int]:
    statement = (
        select(ProductEvent.event_name, func.count(ProductEvent.id))
        .where(ProductEvent.user_id == user_id)
        .group_by(ProductEvent.event_name)
    )

    if article_id:
        statement = statement.where(ProductEvent.article_id == article_id)

    rows = db.execute(statement).all()
    return {str(event_name): int(count) for event_name, count in rows}


def get_event_counts_in_range(
    db: Session,
    *,
    user_id: UUID,
    article_id: UUID | None = None,
    start_at: datetime | None = None,
    end_at: datetime | None = None,
) -> dict[str, int]:
    statement = (
        select(ProductEvent.event_name, func.count(ProductEvent.id))
        .where(ProductEvent.user_id == user_id)
        .group_by(ProductEvent.event_name)
    )
    if article_id:
        statement = statement.where(ProductEvent.article_id == article_id)
    if start_at:
        statement = statement.where(ProductEvent.created_at >= start_at)
    if end_at:
        statement = statement.where(ProductEvent.created_at < end_at)

    rows = db.execute(statement).all()
    return {str(event_name): int(count) for event_name, count in rows}


def get_event_counts_by_article(db: Session, *, user_id: UUID) -> dict[str, dict[str, int]]:
    statement = (
        select(ProductEvent.article_id, ProductEvent.event_name, func.count(ProductEvent.id))
        .where(ProductEvent.user_id == user_id, ProductEvent.article_id.is_not(None))
        .group_by(ProductEvent.article_id, ProductEvent.event_name)
    )
    rows = db.execute(statement).all()

    grouped: dict[str, dict[str, int]] = defaultdict(dict)
    for article_id, event_name, count in rows:
        grouped[str(article_id)][str(event_name)] = int(count)
    return dict(grouped)


def get_usage_stats(db: Session, *, user_id: UUID, article_id: UUID | None = None) -> tuple[UsageCounts, dict[str, int]]:
    raw_event_counts = get_event_counts(db, user_id=user_id, article_id=article_id)
    return _build_usage_counts(raw_event_counts), raw_event_counts


def get_usage_stats_in_range(
    db: Session,
    *,
    user_id: UUID,
    article_id: UUID | None = None,
    start_at: datetime | None = None,
    end_at: datetime | None = None,
) -> tuple[UsageCounts, dict[str, int]]:
    raw_event_counts = get_event_counts_in_range(
        db,
        user_id=user_id,
        article_id=article_id,
        start_at=start_at,
        end_at=end_at,
    )
    return _build_usage_counts(raw_event_counts), raw_event_counts


def get_ai_distinct_article_count(db: Session, *, user_id: UUID, article_id: UUID | None = None) -> int:
    statement = select(func.count(func.distinct(ProductEvent.article_id))).where(
        ProductEvent.user_id == user_id,
        ProductEvent.event_name == EVENT_AI_EXPLANATION_REQUESTED,
        ProductEvent.article_id.is_not(None),
    )
    if article_id:
        statement = statement.where(ProductEvent.article_id == article_id)
    value = db.scalar(statement)
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


def compute_business_metrics(
    *, usage: UsageCounts, ai_distinct_article_count: int
) -> BusinessMetrics:
    return BusinessMetrics(
        lookup_to_vocab_rate=_safe_rate(usage.vocab_added_count, usage.lookup_count),
        highlight_to_ai_rate=_safe_rate(usage.ai_explanation_count, usage.highlight_count),
        ai_requests_per_article=_safe_rate(usage.ai_explanation_count, ai_distinct_article_count),
        ai_requests_per_user=float(usage.ai_explanation_count),
    )
