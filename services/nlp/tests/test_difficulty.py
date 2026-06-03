from __future__ import annotations

from app.difficulty import resolve_difficulty


def test_estimates_difficulty_for_unmapped_content_words() -> None:
    assert resolve_difficulty("結局", "副詞", {}, {})[0] == "N3"
    assert resolve_difficulty("分際", "名詞", {}, {})[0] == "N2"
    assert resolve_difficulty("不可思議", "名詞", {}, {})[0] == "N1"


def test_does_not_highlight_particles_or_common_words() -> None:
    assert resolve_difficulty("は", "助詞", {}, {})[0] == "Unknown"
    assert resolve_difficulty("今日", "名詞", {}, {})[0] == "N5"
