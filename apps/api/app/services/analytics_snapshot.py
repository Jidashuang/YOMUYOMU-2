from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, time, timedelta, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.entities import ProductEvent
from app.services.product_analytics import (
    EVENT_AI_EXPLANATION_REQUESTED,
    UsageCounts,
    compute_business_metrics,
)


def _day_bounds(snapshot_date: date) -> tuple[datetime, datetime]:
    start_at = datetime.combine(snapshot_date, time.min).replace(tzinfo=timezone.utc)
    end_at = start_at + timedelta(days=1)
    return start_at, end_at


def _event_counts_for_window(db: Session, start_at: datetime, end_at: datetime) -> list[tuple[UUID, str, int]]:
    rows = db.execute(
        select(ProductEvent.user_id, ProductEvent.event_name, func.count(ProductEvent.id))
        .where(ProductEvent.created_at >= start_at, ProductEvent.created_at < end_at)
        .group_by(ProductEvent.user_id, ProductEvent.event_name)
    ).all()
    return [(user_id, str(event_name), int(count)) for user_id, event_name, count in rows]


def _ai_distinct_articles_for_window(db: Session, start_at: datetime, end_at: datetime) -> dict[UUID, int]:
    rows = db.execute(
        select(ProductEvent.user_id, func.count(func.distinct(ProductEvent.article_id)))
        .where(
            ProductEvent.created_at >= start_at,
            ProductEvent.created_at < end_at,
            ProductEvent.event_name == EVENT_AI_EXPLANATION_REQUESTED,
            ProductEvent.article_id.is_not(None),
        )
        .group_by(ProductEvent.user_id)
    ).all()
    return {user_id: int(count) for user_id, count in rows}


def _to_usage_counts(event_counts: dict[str, int]) -> dict[str, int]:
    return {
        "lookup_count": int(event_counts.get("token_lookup", 0)),
        "vocab_added_count": int(event_counts.get("vocab_added", 0)),
        "highlight_count": int(event_counts.get("highlight_created", 0)),
        "ai_explanation_count": int(event_counts.get("ai_explanation_requested", 0)),
    }


def build_daily_snapshot(db: Session, snapshot_date: date) -> dict:
    start_at, end_at = _day_bounds(snapshot_date)

    rows = _event_counts_for_window(db, start_at=start_at, end_at=end_at)
    ai_distinct_by_user = _ai_distinct_articles_for_window(db, start_at=start_at, end_at=end_at)

    by_user_event_counts: dict[UUID, dict[str, int]] = defaultdict(dict)
    total_event_counts: dict[str, int] = defaultdict(int)

    for user_id, event_name, count in rows:
        by_user_event_counts[user_id][event_name] = count
        total_event_counts[event_name] = int(total_event_counts[event_name]) + int(count)

    user_rows = []
    for user_id, event_counts in sorted(by_user_event_counts.items(), key=lambda item: str(item[0])):
        usage = _to_usage_counts(event_counts)
        metrics = compute_business_metrics(
            usage=UsageCounts(
                lookup_count=usage["lookup_count"],
                vocab_added_count=usage["vocab_added_count"],
                highlight_count=usage["highlight_count"],
                ai_explanation_count=usage["ai_explanation_count"],
            ),
            ai_distinct_article_count=ai_distinct_by_user.get(user_id, 0),
        )
        user_rows.append(
            {
                "user_id": str(user_id),
                "event_counts": event_counts,
                "usage_counts": usage,
                "metrics": {
                    "lookup_to_vocab_rate": metrics.lookup_to_vocab_rate,
                    "highlight_to_ai_rate": metrics.highlight_to_ai_rate,
                    "ai_requests_per_article": metrics.ai_requests_per_article,
                    "ai_requests_per_user": metrics.ai_requests_per_user,
                },
            }
        )

    total_usage = _to_usage_counts(dict(total_event_counts))
    total_metrics = compute_business_metrics(
        usage=UsageCounts(
            lookup_count=total_usage["lookup_count"],
            vocab_added_count=total_usage["vocab_added_count"],
            highlight_count=total_usage["highlight_count"],
            ai_explanation_count=total_usage["ai_explanation_count"],
        ),
        ai_distinct_article_count=sum(ai_distinct_by_user.values()),
    )

    return {
        "snapshot_date": snapshot_date.isoformat(),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "totals": {
            "event_counts": dict(total_event_counts),
            "usage_counts": total_usage,
            "metrics": {
                "lookup_to_vocab_rate": total_metrics.lookup_to_vocab_rate,
                "highlight_to_ai_rate": total_metrics.highlight_to_ai_rate,
                "ai_requests_per_article": total_metrics.ai_requests_per_article,
                "ai_requests_per_user": total_metrics.ai_requests_per_user,
            },
        },
        "users": user_rows,
    }
