from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.entities import User
from app.services.product_analytics import get_usage_stats_in_range

FREE_PLAN = "free"
PRO_PLAN = "pro"


@dataclass
class AIExplanationQuota:
    used_this_month: int
    monthly_limit: int
    remaining: int


@dataclass
class BillingSummary:
    plan: str
    billing_status: str | None
    ai_explanations: AIExplanationQuota


def _current_month_window(now: datetime | None = None) -> tuple[datetime, datetime]:
    current = now.astimezone(UTC) if now else datetime.now(UTC)
    start = datetime(current.year, current.month, 1, tzinfo=UTC)
    if current.month == 12:
        end = datetime(current.year + 1, 1, 1, tzinfo=UTC)
    else:
        end = datetime(current.year, current.month + 1, 1, tzinfo=UTC)
    return start, end


def get_plan_ai_monthly_limit(plan: str) -> int:
    settings = get_settings()
    if plan == PRO_PLAN:
        return settings.pro_ai_explanations_monthly_limit
    return settings.free_ai_explanations_monthly_limit


def get_ai_explanations_used_this_month(
    db: Session,
    *,
    user_id: UUID,
    now: datetime | None = None,
) -> int:
    start_at, end_at = _current_month_window(now)
    usage, _ = get_usage_stats_in_range(db, user_id=user_id, start_at=start_at, end_at=end_at)
    return usage.ai_explanation_count


def get_billing_summary(db: Session, *, user: User, now: datetime | None = None) -> BillingSummary:
    monthly_limit = get_plan_ai_monthly_limit(user.plan)
    used_this_month = get_ai_explanations_used_this_month(db, user_id=user.id, now=now)
    remaining = max(monthly_limit - used_this_month, 0)
    return BillingSummary(
        plan=user.plan,
        billing_status=user.billing_status,
        ai_explanations=AIExplanationQuota(
            used_this_month=used_this_month,
            monthly_limit=monthly_limit,
            remaining=remaining,
        ),
    )


def is_ai_explanation_limit_reached(db: Session, *, user: User, now: datetime | None = None) -> bool:
    summary = get_billing_summary(db, user=user, now=now)
    return summary.ai_explanations.used_this_month >= summary.ai_explanations.monthly_limit
