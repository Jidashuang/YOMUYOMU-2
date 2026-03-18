from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field

VocabStatus = Literal["new", "learning", "known"]
VocabReviewResult = Literal["fail", "pass"]


class VocabItemCreateRequest(BaseModel):
    surface: str = Field(min_length=1, max_length=255)
    lemma: str = Field(min_length=1, max_length=255)
    reading: str = Field(default="")
    pos: str = Field(min_length=1, max_length=128)
    meaning_snapshot: dict[str, Any] | None = None
    jlpt_level: str = "Unknown"
    frequency_band: str = "Unknown"
    source_article_id: UUID | None = None
    source_sentence: str | None = None
    status: VocabStatus = "new"


class VocabItemResponse(BaseModel):
    id: UUID
    surface: str
    lemma: str
    reading: str
    pos: str
    meaning_snapshot: dict[str, Any] | None
    jlpt_level: str
    frequency_band: str
    source_article_id: UUID | None
    source_sentence: str | None
    status: VocabStatus
    next_review_at: datetime | None = None
    review_count: int = 0
    created_at: datetime


class VocabStatusUpdateRequest(BaseModel):
    status: VocabStatus


class VocabReviewRequest(BaseModel):
    result: VocabReviewResult


class DeleteResponse(BaseModel):
    ok: bool
