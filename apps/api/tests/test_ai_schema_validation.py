from __future__ import annotations

from app.schemas.ai_explanation import AIExplanationJSON
from app.services import ai_provider
from app.services.ai_explanation_service import generate_explanation


def test_ai_explanation_schema_validation(monkeypatch) -> None:
    monkeypatch.setattr(
        ai_provider.httpx,
        "post",
        lambda *args, **kwargs: type(
            "FakeResponse",
            (),
            {"raise_for_status": lambda self: None, "json": lambda self: {"translation": "他本来应该来的。"}},
        )(),
    )

    response, meta = generate_explanation(
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

    validated = AIExplanationJSON.model_validate(response)
    assert validated.translation_zh
    assert validated.literal_translation
    assert isinstance(validated.grammar_points, list)
    assert isinstance(validated.token_breakdown, list)
    assert isinstance(validated.examples, list)
    assert isinstance(validated.why_this_expression, str)
    assert isinstance(validated.alternative_expressions, list)
    assert meta["provider"]
    assert meta["prompt_version"]
    assert isinstance(meta.get("suggested_vocab"), list)


def test_gemini_style_field_names_are_normalized() -> None:
    """Gemini 3.5 Flash returned grammar_point/meaning keys and object omissions (genbun.live, 2026-11-18)."""
    from app.services.ai_explanation_service import _stabilize_explanation_json

    sentence = "そんな阿呆らしい夢みたいな情景を想像しながら、あたりを窺うことが何遍もあったほどです。"
    raw = {
        "translation_zh": "我甚至曾多次一边想象着那样荒诞如梦境般的场景，一边窥视着四周。",
        "literal_translation": "一边想象……一边窥视四周的事情发生过好多次。",
        "grammar_points": [
            {"grammar_point": "〜ながら", "meaning": "一边……一边……", "explanation": "表示两个动作同时进行。"},
            {"pattern": "〜ほどです", "meaning": "到了……的程度"},
        ],
        "token_breakdown": [
            {"surface": "夢", "lemma": "夢", "pos": "名詞", "reading": "ユメ", "meaning": "梦"},
        ],
        "omissions": [{"omitted_element": "主语「わたし」", "explanation": "上下文已明确，省略。"}],
        "nuance": "带自嘲语气。",
        "examples": [],
    }

    result = _stabilize_explanation_json(raw, sentence)

    names = [point["name"] for point in result["grammar_points"]]
    assert "〜ながら" in names and "〜ほどです" in names
    nagara = next(point for point in result["grammar_points"] if point["name"] == "〜ながら")
    assert "一边" in nagara["explanation"]
    assert result["omissions"] == ["主语「わたし」：上下文已明确，省略。"]
    assert result["token_breakdown"][0]["role"] == "名詞"
    assert result["translation_zh"].startswith("我甚至")
