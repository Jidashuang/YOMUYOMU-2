from __future__ import annotations

from app.services.fallback_annotator import annotate_text_fallback, get_fallback_jlpt_map


def test_fallback_greedy_match_emits_offsets_and_levels() -> None:
    jlpt_map = {"来る": "N3", "曖昧": "N2"}
    tokens = annotate_text_fallback("彼は来る。曖昧だ。", jlpt_map)

    by_surface = {token["surface"]: token for token in tokens}
    assert by_surface["来る"]["start"] == 2
    assert by_surface["来る"]["end"] == 4
    assert by_surface["来る"]["jlpt_level"] == "N3"
    assert by_surface["曖昧"]["jlpt_level"] == "N2"
    # token shape matches nlp_client.annotate output so _add_chunk_tokens can consume it
    assert set(by_surface["来る"].keys()) >= {"surface", "lemma", "reading", "pos", "start", "end", "jlpt_level", "frequency_band"}


def test_fallback_prefers_longest_match() -> None:
    jlpt_map = {"心": "N3", "心得る": "N2"}
    tokens = annotate_text_fallback("心得る", jlpt_map)

    assert len(tokens) == 1
    assert tokens[0]["surface"] == "心得る"
    assert tokens[0]["jlpt_level"] == "N2"


def test_fallback_empty_map_or_text_returns_empty() -> None:
    assert annotate_text_fallback("彼は来る。", {}) == []
    assert annotate_text_fallback("", {"来る": "N3"}) == []


def test_bundled_fallback_map_only_keeps_highlight_levels() -> None:
    mapping = get_fallback_jlpt_map()

    assert len(mapping) > 5000
    assert mapping.get("あくどい") == "N1"
    # N5/N4 entries are not highlighted, so the fallback map must exclude them.
    assert "ああ" not in mapping
    assert all(level in {"N1", "N2", "N3"} for level in mapping.values())
