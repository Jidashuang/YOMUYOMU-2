from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db_session
from app.models.entities import Article, User
from app.schemas.analytics import (
    ArticleUsageStatsResponse,
    BusinessMetricsResponse,
    ProductAnalyticsStatsResponse,
    TodayLearningStatsResponse,
    UsageCountsResponse,
)
from app.services.product_analytics import (
    compute_business_metrics,
    get_ai_distinct_article_count,
    get_event_counts_by_article,
    get_usage_stats,
    get_usage_stats_in_range,
)

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/today", response_model=TodayLearningStatsResponse)
def get_today_learning_stats(
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> TodayLearningStatsResponse:
    now = datetime.now(timezone.utc)
    start_of_day = datetime(
        year=now.year,
        month=now.month,
        day=now.day,
        tzinfo=timezone.utc,
    )
    end_of_day = start_of_day + timedelta(days=1)

    usage, _ = get_usage_stats_in_range(
        db,
        user_id=current_user.id,
        start_at=start_of_day,
        end_at=end_of_day,
    )
    return TodayLearningStatsResponse(
        date=start_of_day.date().isoformat(),
        lookup_count=usage.lookup_count,
        vocab_added_count=usage.vocab_added_count,
        ai_explanation_count=usage.ai_explanation_count,
    )


@router.get("/stats", response_model=ProductAnalyticsStatsResponse)
def get_product_analytics_stats(
    article_id: str | None = None,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> ProductAnalyticsStatsResponse:
    article_uuid: UUID | None = None

    if article_id:
        try:
            article_uuid = UUID(article_id)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid article_id") from exc

        article = db.scalar(select(Article).where(Article.id == article_uuid, Article.user_id == current_user.id))
        if article is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")

    totals, raw_event_counts = get_usage_stats(db, user_id=current_user.id, article_id=article_uuid)
    ai_distinct_article_count = get_ai_distinct_article_count(db, user_id=current_user.id, article_id=article_uuid)
    total_metrics = compute_business_metrics(usage=totals, ai_distinct_article_count=ai_distinct_article_count)

    by_article_rows: list[ArticleUsageStatsResponse] = []
    if article_uuid:
        by_article_rows = [
            ArticleUsageStatsResponse(
                article_id=article_uuid,
                counts=UsageCountsResponse(
                    lookup_count=totals.lookup_count,
                    vocab_added_count=totals.vocab_added_count,
                    highlight_count=totals.highlight_count,
                    ai_explanation_count=totals.ai_explanation_count,
                ),
                metrics=BusinessMetricsResponse(
                    lookup_to_vocab_rate=total_metrics.lookup_to_vocab_rate,
                    highlight_to_ai_rate=total_metrics.highlight_to_ai_rate,
                    ai_requests_per_article=total_metrics.ai_requests_per_article,
                    ai_requests_per_user=total_metrics.ai_requests_per_user,
                ),
                raw_event_counts=raw_event_counts,
            )
        ]
    else:
        grouped = get_event_counts_by_article(db, user_id=current_user.id)
        for grouped_article_id, event_counts in grouped.items():
            usage, _ = get_usage_stats(db, user_id=current_user.id, article_id=UUID(grouped_article_id))
            metrics = compute_business_metrics(
                usage=usage,
                ai_distinct_article_count=get_ai_distinct_article_count(
                    db, user_id=current_user.id, article_id=UUID(grouped_article_id)
                ),
            )
            by_article_rows.append(
                ArticleUsageStatsResponse(
                    article_id=UUID(grouped_article_id),
                    counts=UsageCountsResponse(
                        lookup_count=usage.lookup_count,
                        vocab_added_count=usage.vocab_added_count,
                        highlight_count=usage.highlight_count,
                        ai_explanation_count=usage.ai_explanation_count,
                    ),
                    metrics=BusinessMetricsResponse(
                        lookup_to_vocab_rate=metrics.lookup_to_vocab_rate,
                        highlight_to_ai_rate=metrics.highlight_to_ai_rate,
                        ai_requests_per_article=metrics.ai_requests_per_article,
                        ai_requests_per_user=metrics.ai_requests_per_user,
                    ),
                    raw_event_counts=event_counts,
                )
            )

    by_article_rows.sort(key=lambda row: str(row.article_id))

    return ProductAnalyticsStatsResponse(
        user_id=current_user.id,
        article_id=article_uuid,
        totals=UsageCountsResponse(
            lookup_count=totals.lookup_count,
            vocab_added_count=totals.vocab_added_count,
            highlight_count=totals.highlight_count,
            ai_explanation_count=totals.ai_explanation_count,
        ),
        metrics=BusinessMetricsResponse(
            lookup_to_vocab_rate=total_metrics.lookup_to_vocab_rate,
            highlight_to_ai_rate=total_metrics.highlight_to_ai_rate,
            ai_requests_per_article=total_metrics.ai_requests_per_article,
            ai_requests_per_user=total_metrics.ai_requests_per_user,
        ),
        raw_event_counts=raw_event_counts,
        by_article=by_article_rows,
    )
