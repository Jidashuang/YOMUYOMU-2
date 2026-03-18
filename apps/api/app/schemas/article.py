from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


SourceType = Literal["text", "epub"]
ArticleStatus = Literal["processing", "ready", "failed"]


class ArticleCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    source_type: SourceType = "text"
    raw_content: str = Field(min_length=1)


class ArticleTokenResponse(BaseModel):
    surface: str
    lemma: str
    reading: str
    pos: str
    start_offset: int
    end_offset: int
    jlpt_level: str = "Unknown"
    frequency_band: str = "Unknown"


class ArticleBlockResponse(BaseModel):
    id: UUID
    block_index: int
    text: str
    tokens: list[ArticleTokenResponse]


class ArticleSummaryResponse(BaseModel):
    id: UUID
    title: str
    source_type: SourceType
    status: ArticleStatus
    processing_error: str | None = None
    created_at: datetime


class ArticleDetailResponse(ArticleSummaryResponse):
    raw_content: str
    normalized_content: str
    blocks: list[ArticleBlockResponse]


class DeleteResponse(BaseModel):
    ok: bool
