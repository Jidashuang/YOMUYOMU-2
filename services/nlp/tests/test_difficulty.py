from __future__ import annotations

from app.difficulty import load_map, resolve_difficulty


def test_resolves_difficulty_from_jlpt_and_frequency_maps() -> None:
    assert resolve_difficulty("洒落", "名詞", {"洒落": "N2"}, {})[0] == "N2"
    assert resolve_difficulty("親戚", "名詞", {"親戚": "N3"}, {})[0] == "N3"
    assert resolve_difficulty("不可思議", "名詞", {}, {"不可思議": "outside-10k"})[0] == "N1"
    assert resolve_difficulty("頬", "名詞", {}, {"頬": "top-10k"})[0] == "N2"
    assert resolve_difficulty("特徴", "名詞", {}, {"特徴": "top-5k"})[0] == "N3"


def test_does_not_highlight_particles_or_guess_unknown_words() -> None:
    assert resolve_difficulty("は", "助詞", {}, {})[0] == "Unknown"
    assert resolve_difficulty("不可思議", "名詞", {}, {})[0] == "Unknown"
    assert resolve_difficulty("結局", "副詞", {}, {"結局": "top-1k"})[0] == "Unknown"


def test_packaged_difficulty_maps_cover_core_levels() -> None:
    jlpt_map = load_map("services/nlp/data/jlpt_map.csv", "lemma", "jlpt_level")
    frequency_map = load_map("services/nlp/data/frequency_map.csv", "lemma", "frequency_band")

    assert len(jlpt_map) > 7_000
    assert jlpt_map["会う"] == "N5"
    assert jlpt_map["親戚"] == "N3"
    assert jlpt_map["洒落"] == "N2"
    assert jlpt_map["心得る"] == "N2"
    assert frequency_map["武家"] == "outside-10k"
    assert frequency_map["百姓"] == "outside-10k"
    assert frequency_map["不可思議"] == "outside-10k"
