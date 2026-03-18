from __future__ import annotations

from typing import Literal
from pydantic import BaseModel, Field

JlptLevel = Literal["N5", "N4", "N3", "N2", "N1", "Unknown"]
FrequencyBand = Literal["top-1k", "top-5k", "top-10k", "outside-10k", "Unknown"]


class HealthResponse(BaseModel):
    service: str
    status: str
    version: str
    dependencies: dict[str, str] = Field(default_factory=dict)
    timestamp: str


class TokenInfo(BaseModel):
    surface: str
    lemma: str
    reading: str
    pos: str
    start: int
    end: int
    jlpt_level: JlptLevel = "Unknown"
    frequency_band: FrequencyBand = "Unknown"


class TokenizeRequest(BaseModel):
    text: str = Field(min_length=1)


class TokenizeResponse(BaseModel):
    tokens: list[TokenInfo]


class LookupRequest(BaseModel):
    surface: str
    lemma: str
    reading: str | None = None
    context: str | None = None


class LookupEntry(BaseModel):
    lemma: str
    reading: str
    pos: list[str]
    meanings: list[str]
    primary_meaning: str
    example_sentence: str = ""
    usage_note: str = ""
    jlpt_level: JlptLevel = "Unknown"
    frequency_band: FrequencyBand = "Unknown"


class LookupResponse(BaseModel):
    entries: list[LookupEntry]


class AnnotatedToken(TokenInfo):
    difficulty_source: Literal["jlpt", "frequency", "unknown"]


class AnnotateRequest(BaseModel):
    text: str = Field(min_length=1)


class AnnotateResponse(BaseModel):
    tokens: list[AnnotatedToken]
