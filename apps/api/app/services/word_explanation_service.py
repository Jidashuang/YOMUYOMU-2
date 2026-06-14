from __future__ import annotations

import hashlib
import json
from typing import Any

import httpx
from pydantic import BaseModel, Field

from app.core.cache import get_redis_client
from app.core.config import get_settings


class WordExplanation(BaseModel):
    meaning_zh: str = Field(min_length=1)
    usage_zh: str = Field(min_length=1)
    example_ja: str = Field(min_length=1)
    example_zh: str = Field(min_length=1)


def _cache_key(surface: str, lemma: str, primary_meaning: str, context: str) -> str:
    value = json.dumps(
        {
            "surface": surface,
            "lemma": lemma,
            "primary_meaning": primary_meaning,
            "context": context,
        },
        ensure_ascii=False,
        sort_keys=True,
    )
    return f"word_explain:{hashlib.sha256(value.encode('utf-8')).hexdigest()}"


def _load_cached(key: str) -> WordExplanation | None:
    try:
        raw = get_redis_client().get(key)
        return WordExplanation.model_validate_json(raw) if raw else None
    except Exception:  # noqa: BLE001
        return None


def _save_cached(key: str, value: WordExplanation) -> None:
    try:
        get_redis_client().setex(key, get_settings().ai_cache_ttl_seconds, value.model_dump_json())
    except Exception:  # noqa: BLE001
        return


def _parse_content(response_json: dict[str, Any]) -> WordExplanation:
    content = response_json.get("choices", [{}])[0].get("message", {}).get("content", "")
    if not isinstance(content, str):
        raise ValueError("OpenAI response content is not a string")
    return WordExplanation.model_validate(json.loads(content))


def generate_word_explanation(
    *,
    surface: str,
    lemma: str,
    reading: str,
    pos: list[str],
    meanings: list[str],
    primary_meaning: str,
    context: str,
) -> WordExplanation | None:
    settings = get_settings()
    if settings.llm_provider.strip().lower() != "openai" or not settings.openai_api_key:
        return None

    key = _cache_key(surface, lemma, primary_meaning, context)
    cached = _load_cached(key)
    if cached:
        return cached

    request_payload = {
        "model": settings.openai_model,
        "temperature": 0.1,
        "response_format": {"type": "json_object"},
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are a Japanese-Chinese learner dictionary. Return strict JSON with exactly these keys: "
                    "meaning_zh, usage_zh, example_ja, example_zh. Use concise Simplified Chinese. "
                    "Base meaning_zh on the supplied dictionary senses. Explain the word's exact role in the context. "
                    "Create a new natural Japanese example sentence; do not copy the supplied context."
                ),
            },
            {
                "role": "user",
                "content": json.dumps(
                    {
                        "surface": surface,
                        "lemma": lemma,
                        "reading": reading,
                        "part_of_speech": pos,
                        "dictionary_senses": meanings,
                        "primary_dictionary_sense": primary_meaning,
                        "context": context,
                    },
                    ensure_ascii=False,
                ),
            },
        ],
    }

    try:
        response = httpx.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.openai_api_key}",
                "Content-Type": "application/json",
            },
            json=request_payload,
            timeout=min(settings.openai_timeout_seconds, 12.0),
        )
        response.raise_for_status()
        explanation = _parse_content(response.json())
    except Exception:  # noqa: BLE001
        return None

    _save_cached(key, explanation)
    return explanation
