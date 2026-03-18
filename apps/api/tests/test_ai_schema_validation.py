from __future__ import annotations

from app.schemas.ai_explanation import AIExplanationJSON
from app.services.ai_explanation_service import generate_explanation


def test_ai_explanation_schema_validation() -> None:
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
