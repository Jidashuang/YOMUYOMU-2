from __future__ import annotations

from app.core.config import get_settings
from app.services import ai_explanation_service
from app.services.ai_provider import AIProviderError


class BrokenProvider:
    provider_name = "openai"

    def generate(self, payload, prompt_version):
        del payload, prompt_version
        raise AIProviderError("parse_error", "malformed json", retryable=False)


def test_ai_provider_parse_failure_falls_back_to_mock(monkeypatch) -> None:
    monkeypatch.setattr(ai_explanation_service, "get_ai_provider", lambda settings: BrokenProvider())

    response, meta = ai_explanation_service.generate_explanation(
        sentence="彼は来るはずだったのに",
        previous_sentence="昨日は連絡があった。",
        next_sentence="でも今は来ていない。",
        user_level="N3",
        tokenized_result=[
            {
                "surface": "彼",
                "lemma": "彼",
                "reading": "カレ",
                "pos": "名詞",
                "start": 0,
                "end": 1,
            }
        ],
        dictionary_hints=[
            {
                "lemma": "彼",
                "reading": "かれ",
                "pos": ["pronoun"],
                "meanings": ["he"],
                "primary_meaning": "he",
                "jlpt_level": "N5",
                "frequency_band": "top-5k",
            }
        ],
    )

    assert response["translation_zh"]
    assert "why_this_expression" in response
    assert "alternative_expressions" in response
    assert meta["provider"] == "openai"
    assert meta["error_type"] == "parse_error"


def test_openai_provider_disabled_falls_back_to_mock(monkeypatch) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "openai")
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    get_settings.cache_clear()

    response, meta = ai_explanation_service.generate_explanation(
        sentence="彼は来るはずだったのに",
        previous_sentence="",
        next_sentence="",
        user_level="N3",
        tokenized_result=[],
        dictionary_hints=[],
    )

    assert response["translation_zh"]
    assert "why_this_expression" in response
    assert "alternative_expressions" in response
    assert meta["provider"] == "mock"
    assert meta["error_type"] is None
    get_settings.cache_clear()
