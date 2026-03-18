from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class HighlightCreateRequest(BaseModel):
    article_id: UUID
    block_id: UUID
    start_offset_in_block: int = Field(ge=0)
    end_offset_in_block: int = Field(ge=0)
    text_quote: str = Field(min_length=1)
    note: str | None = None


class HighlightNoteUpdateRequest(BaseModel):
    note: str


class HighlightResponse(BaseModel):
    id: UUID
    article_id: UUID
    block_id: UUID | None
    start_offset_in_block: int | None
    end_offset_in_block: int | None
    text_quote: str
    note: str | None
    created_at: datetime


class ReadingProgressUpsertRequest(BaseModel):
    article_id: UUID
    progress_percent: float = Field(ge=0, le=100)
    last_position: str | None = None


class ReadingProgressResponse(BaseModel):
    id: UUID
    article_id: UUID
    progress_percent: float
    last_position: str | None
    updated_at: datetime


class ReaderLookupRequest(BaseModel):
    article_id: UUID
    surface: str = Field(min_length=1)
    lemma: str = Field(min_length=1)
    reading: str | None = None
    context: str | None = None


class ReaderLookupEntry(BaseModel):
    lemma: str
    reading: str
    pos: list[str]
    meanings: list[str]
    primary_meaning: str
    example_sentence: str = ""
    usage_note: str = ""
    jlpt_level: str = "Unknown"
    frequency_band: str = "Unknown"


class ReaderLookupResponse(BaseModel):
    entries: list[ReaderLookupEntry]
