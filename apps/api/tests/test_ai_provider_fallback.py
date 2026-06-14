from __future__ import annotations

from app.core.config import get_settings
from app.services import ai_explanation_service
from app.services import ai_provider
from app.services.ai_provider import AIProviderError, GeminiProvider


class BrokenProvider:
    provider_name = "openai"

    def generate(self, payload, prompt_version):
        del payload, prompt_version
        raise AIProviderError("parse_error", "malformed json", retryable=False)


class AliasShapeProvider:
    provider_name = "gemini"
    model = "google/gemini-3.5-flash"

    def generate(self, payload, prompt_version):
        del payload, prompt_version
        return ai_provider.AIProviderResult(
            response_json={
                "translation_zh": "很荣幸，我被选中了。",
                "literal_translation": "白羽之箭落到了我身上。",
                "grammar_points": [{"grammar": "白羽の矢が立つ", "explanation": "表示被选中。"}],
                "token_breakdown": [
                    {
                        "surface": "白羽",
                        "lemma": "白羽",
                        "reading": "シラハ",
                        "pos": "名詞",
                        "explanation": "白羽；惯用语的一部分。",
                    }
                ],
                "omissions": "没有明显省略。",
                "nuance": "语气正式。",
                "examples": [{"japanese": "彼に白羽の矢が立った。", "translation": "他被选中了。"}],
                "why_this_expression": "比普通的「選ばれる」更有仪式感。",
                "alternative_expressions": [{"expression": "私が選ばれた。", "explanation": "更直接。"}],
            },
            model=self.model,
            provider_name=self.provider_name,
            error_type=None,
            prompt_tokens=1,
            completion_tokens=1,
            total_tokens=2,
        )


def test_ai_provider_parse_failure_falls_back_to_no_key_explanation(monkeypatch) -> None:
    monkeypatch.setattr(ai_explanation_service, "get_ai_provider", lambda settings: BrokenProvider())
    monkeypatch.setattr(
        ai_provider.httpx,
        "post",
        lambda *args, **kwargs: type(
            "FakeResponse",
            (),
            {"raise_for_status": lambda self: None, "json": lambda self: {"translation": "他"}},
        )(),
    )

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


def test_ai_provider_accepts_gemini_alias_shaped_json(monkeypatch) -> None:
    monkeypatch.setattr(ai_explanation_service, "get_ai_provider", lambda settings: AliasShapeProvider())

    response, meta = ai_explanation_service.generate_explanation(
        sentence="私に白羽の矢が立った。",
        previous_sentence="",
        next_sentence="",
        user_level="N3",
        tokenized_result=[],
        dictionary_hints=[],
    )

    assert response["grammar_points"][0]["name"] == "白羽の矢が立つ"
    assert response["token_breakdown"][0]["meaning"] == "白羽；惯用语的一部分。"
    assert response["token_breakdown"][0]["role"] == "名詞"
    assert response["examples"][0]["jp"] == "彼に白羽の矢が立った。"
    assert response["alternative_expressions"][0]["jp"] == "私が選ばれた。"
    assert meta["provider"] == "gemini"
    assert meta["error_type"] is None


def test_openai_provider_disabled_uses_no_key_explanation(monkeypatch) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "openai")
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    get_settings.cache_clear()
    monkeypatch.setattr(
        ai_provider.httpx,
        "post",
        lambda *args, **kwargs: type(
            "FakeResponse",
            (),
            {"raise_for_status": lambda self: None, "json": lambda self: {"translation": "他本来应该来的。"}},
        )(),
    )

    response, meta = ai_explanation_service.generate_explanation(
        sentence="彼は来るはずだったのに",
        previous_sentence="",
        next_sentence="",
        user_level="N3",
        tokenized_result=[],
        dictionary_hints=[],
    )

    assert response["translation_zh"]
    assert "示例译文" not in response["translation_zh"]
    assert "why_this_expression" in response
    assert "alternative_expressions" in response
    assert meta["provider"] == "wikimedia-mint-rules"
    assert meta["model"] == "rules-mint-v1"
    assert meta["error_type"] is None
    get_settings.cache_clear()


def test_gemini_provider_uses_google_cloud_chat_completions(monkeypatch) -> None:
    seen = {}

    def fake_post(url, headers, json, timeout):
        seen["url"] = url
        seen["headers"] = headers
        seen["json"] = json
        seen["timeout"] = timeout
        return type(
            "FakeResponse",
            (),
            {
                "raise_for_status": lambda self: None,
                "json": lambda self: {
                    "choices": [
                        {
                            "message": {
                                "content": '{"translation_zh":"他本来应该来的。","literal_translation":"他 / 来 / 应该 / 但是","grammar_points":[],"token_breakdown":[],"omissions":[],"nuance":"","examples":[],"why_this_expression":"","alternative_expressions":[]}'
                            }
                        }
                    ],
                    "usage": {"prompt_tokens": 3, "completion_tokens": 5, "total_tokens": 8},
                },
            },
        )()

    monkeypatch.setattr(GeminiProvider, "_get_access_token", lambda self: "test-token")
    monkeypatch.setattr(ai_provider.httpx, "post", fake_post)

    provider = GeminiProvider(
        project_id="project-yomuyomu",
        location="global",
        model="google/gemini-3.5-flash",
        timeout_seconds=30,
        max_retries=0,
    )
    result = provider.generate({"sentence": "彼は来るはずだったのに"}, "v2")

    assert seen["url"] == "https://aiplatform.googleapis.com/v1/projects/project-yomuyomu/locations/global/endpoints/openapi/chat/completions"
    assert seen["headers"]["Authorization"] == "Bearer test-token"
    assert seen["json"]["model"] == "google/gemini-3.5-flash"
    assert seen["json"]["response_format"] == {"type": "json_object"}
    assert result.provider_name == "gemini"
    assert result.prompt_tokens == 3


def test_no_key_provider_explains_shirahane_sentence(monkeypatch) -> None:
    monkeypatch.setattr(
        ai_provider.httpx,
        "post",
        lambda *args, **kwargs: type(
            "FakeResponse",
            (),
            {"raise_for_status": lambda self: None, "json": lambda self: {"translation": "荣誉"}},
        )(),
    )

    response, meta = ai_explanation_service.generate_explanation(
        sentence="光栄なことに、写真家というジャンルの中から、私に白羽の矢が立った。",
        previous_sentence="",
        next_sentence="",
        user_level="N3",
        tokenized_result=[
            {"surface": "光栄", "lemma": "光栄", "reading": "コウエイ", "pos": "名詞", "start": 0, "end": 2},
            {"surface": "な", "lemma": "だ", "reading": "ナ", "pos": "助動詞", "start": 2, "end": 3},
            {"surface": "こと", "lemma": "こと", "reading": "コト", "pos": "名詞", "start": 3, "end": 5},
            {"surface": "に", "lemma": "に", "reading": "ニ", "pos": "助詞", "start": 5, "end": 6},
            {"surface": "写真家", "lemma": "写真家", "reading": "シャシンカ", "pos": "名詞", "start": 7, "end": 10},
            {"surface": "という", "lemma": "いう", "reading": "イウ", "pos": "動詞", "start": 10, "end": 13},
            {"surface": "中", "lemma": "中", "reading": "ナカ", "pos": "名詞", "start": 18, "end": 19},
            {"surface": "白羽", "lemma": "白羽", "reading": "シラハ", "pos": "名詞", "start": 25, "end": 27},
        ],
        dictionary_hints=[
            {
                "lemma": "光栄",
                "reading": "こうえい",
                "pos": ["noun"],
                "meanings": ["honour", "honor", "glory"],
                "primary_meaning": "honour",
                "jlpt_level": "Unknown",
                "frequency_band": "outside-10k",
            }
        ],
    )

    assert response["translation_zh"] == "很荣幸，在摄影家这个类别中，我被选中了。"
    assert any(point["name"] == "白羽の矢が立つ" for point in response["grammar_points"])
    assert any(item["surface"] == "こと" and "形式名词" in item["meaning"] for item in response["token_breakdown"])
    assert meta["provider"] == "wikimedia-mint-rules"
    assert meta["suggested_vocab"][0]["meaning"] == "荣誉"
