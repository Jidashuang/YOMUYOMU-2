from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class GrammarPoint(BaseModel):
    name: str
    explanation: str


class TokenBreakdownItem(BaseModel):
    surface: str
    lemma: str
    reading: str
    meaning: str
    role: str


class ExamplePair(BaseModel):
    jp: str
    zh: str


class AlternativeExpression(BaseModel):
    jp: str
    zh: str
    note: str


class AIExplanationJSON(BaseModel):
    translation_zh: str
    literal_translation: str
    grammar_points: list[GrammarPoint] = Field(default_factory=list)
    token_breakdown: list[TokenBreakdownItem] = Field(default_factory=list)
    omissions: list[str] = Field(default_factory=list)
    nuance: str = ""
    examples: list[ExamplePair] = Field(default_factory=list)
    why_this_expression: str = ""
    alternative_expressions: list[AlternativeExpression] = Field(default_factory=list)


class TokenizedResultItem(BaseModel):
    surface: str
    lemma: str
    reading: str
    pos: str
    start: int
    end: int


class DictionaryHintItem(BaseModel):
    lemma: str
    reading: str
    pos: list[str]
    meanings: list[str]
    primary_meaning: str
    example_sentence: str = ""
    usage_note: str = ""
    jlpt_level: str = "Unknown"
    frequency_band: str = "Unknown"


class SuggestedVocabItem(BaseModel):
    surface: str
    lemma: str
    reading: str
    pos: str
    meaning: str
    jlpt_level: str = "Unknown"
    frequency_band: str = "Unknown"


class AIExplanationCreateRequest(BaseModel):
    article_id: UUID
    highlight_id: UUID | None = None
    sentence: str = Field(min_length=1)
    previous_sentence: str = ""
    next_sentence: str = ""
    user_level: str = "N3"


class AIExplanationResponse(BaseModel):
    id: UUID
    article_id: UUID
    highlight_id: UUID | None
    sentence: str
    model: str
    provider: str
    prompt_version: str
    error_type: str | None = None
    provider_latency_ms: float | None = None
    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    total_tokens: int | None = None
    from_cache: bool
    response_json: AIExplanationJSON
    tokenized_result: list[TokenizedResultItem]
    dictionary_hints: list[DictionaryHintItem]
    suggested_vocab: list[SuggestedVocabItem] = Field(default_factory=list)
    created_at: datetime


class AIExplanationHistoryItem(BaseModel):
    id: UUID
    article_id: UUID
    highlight_id: UUID | None
    sentence: str
    model: str
    provider: str
    prompt_version: str
    error_type: str | None = None
    provider_latency_ms: float | None = None
    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    total_tokens: int | None = None
    from_cache: bool
    response_json: AIExplanationJSON
    suggested_vocab: list[SuggestedVocabItem] = Field(default_factory=list)
    created_at: datetime
