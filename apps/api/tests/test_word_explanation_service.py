from __future__ import annotations

from types import SimpleNamespace

from app.services import word_explanation_service


class FakeResponse:
    def raise_for_status(self) -> None:
        return

    def json(self) -> dict:
        return {
            "choices": [
                {
                    "message": {
                        "content": (
                            '{"meaning_zh":"中心；核心","usage_zh":"在句中表示拍摄对象的核心位置",'
                            '"example_ja":"町の中心に図書館がある。","example_zh":"镇中心有一座图书馆。"}'
                        )
                    }
                }
            ]
        }


def test_generate_word_explanation_returns_none_without_openai_key(monkeypatch) -> None:
    monkeypatch.setattr(
        word_explanation_service,
        "get_settings",
        lambda: SimpleNamespace(llm_provider="openai", openai_api_key=None),
    )

    result = word_explanation_service.generate_word_explanation(
        surface="中心",
        lemma="中心",
        reading="ちゅうしん",
        pos=["noun"],
        meanings=["center"],
        primary_meaning="center",
        context="父は海を中心に写真を撮っていた。",
    )

    assert result is None


def test_generate_word_explanation_uses_real_provider_result(monkeypatch) -> None:
    settings = SimpleNamespace(
        llm_provider="openai",
        openai_api_key="test-key",
        openai_model="gpt-test",
        openai_timeout_seconds=30,
        ai_cache_ttl_seconds=60,
    )
    monkeypatch.setattr(word_explanation_service, "get_settings", lambda: settings)
    monkeypatch.setattr(word_explanation_service, "_load_cached", lambda key: None)
    monkeypatch.setattr(word_explanation_service, "_save_cached", lambda key, value: None)
    monkeypatch.setattr(word_explanation_service.httpx, "post", lambda *args, **kwargs: FakeResponse())

    result = word_explanation_service.generate_word_explanation(
        surface="中心",
        lemma="中心",
        reading="ちゅうしん",
        pos=["noun"],
        meanings=["center"],
        primary_meaning="center",
        context="父は海を中心に写真を撮っていた。",
    )

    assert result is not None
    assert result.meaning_zh == "中心；核心"
    assert result.example_ja != "父は海を中心に写真を撮っていた。"
