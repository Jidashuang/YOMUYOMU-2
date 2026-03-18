from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, Field


class UsageCountsResponse(BaseModel):
    lookup_count: int = 0
    vocab_added_count: int = 0
    highlight_count: int = 0
    ai_explanation_count: int = 0


class BusinessMetricsResponse(BaseModel):
    lookup_to_vocab_rate: float = 0.0
    highlight_to_ai_rate: float = 0.0
    ai_requests_per_article: float = 0.0
    ai_requests_per_user: float = 0.0


class ArticleUsageStatsResponse(BaseModel):
    article_id: UUID
    counts: UsageCountsResponse
    metrics: BusinessMetricsResponse
    raw_event_counts: dict[str, int] = Field(default_factory=dict)


class ProductAnalyticsStatsResponse(BaseModel):
    user_id: UUID
    article_id: UUID | None = None
    totals: UsageCountsResponse
    metrics: BusinessMetricsResponse
    raw_event_counts: dict[str, int] = Field(default_factory=dict)
    by_article: list[ArticleUsageStatsResponse] = Field(default_factory=list)


class TodayLearningStatsResponse(BaseModel):
    date: str
    lookup_count: int = 0
    vocab_added_count: int = 0
    ai_explanation_count: int = 0
