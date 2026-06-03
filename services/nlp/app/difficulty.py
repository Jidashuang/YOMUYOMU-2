from __future__ import annotations

import csv
import re

from app.schemas import FrequencyBand, JlptLevel

NO_HIGHLIGHT_POS = {"助詞", "助動詞", "補助記号", "記号"}
CONTENT_POS = {"名詞", "動詞", "形容詞", "形状詞", "副詞", "連体詞"}
COMMON_JLPT_FALLBACK: dict[str, JlptLevel] = {
    "今日": "N5",
    "明日": "N5",
    "昨日": "N5",
    "私": "N5",
    "自分": "N4",
    "男": "N5",
    "女": "N5",
    "人": "N5",
    "家": "N5",
    "雨": "N5",
    "話": "N5",
    "聞く": "N5",
    "思う": "N5",
    "見る": "N5",
    "見せる": "N4",
    "待つ": "N5",
    "返事": "N3",
    "連絡": "N3",
    "結局": "N3",
    "姿": "N3",
    "抜ける": "N3",
    "一言": "N3",
    "洒落": "N2",
    "分際": "N2",
    "心得る": "N2",
    "異風": "N1",
    "名主": "N1",
    "武家": "N2",
    "百姓": "N2",
    "親戚": "N2",
    "特徴": "N2",
    "頬かぶり": "N1",
}
KANJI_RE = re.compile(r"[\u3400-\u9fff\uf900-\ufaff々〆〤]")
KATAKANA_RE = re.compile(r"[\u30a0-\u30ff]")


def load_map(path: str, key_name: str, value_name: str) -> dict[str, str]:
    mapping: dict[str, str] = {}
    try:
        with open(path, "r", encoding="utf-8") as file:
            reader = csv.DictReader(file)
            for row in reader:
                key = (row.get(key_name) or "").strip()
                value = (row.get(value_name) or "").strip()
                if key and value:
                    mapping[key] = value
    except FileNotFoundError:
        return {}
    return mapping


def _estimated_level(lemma: str, pos: str) -> JlptLevel:
    if pos not in CONTENT_POS:
        return "Unknown"

    text = lemma.strip()
    if not text:
        return "Unknown"

    fallback = COMMON_JLPT_FALLBACK.get(text)
    if fallback:
        return fallback

    kanji_count = len(KANJI_RE.findall(text))
    if kanji_count >= 3:
        return "N1"
    if kanji_count == 2:
        return "N2"
    if kanji_count == 1 and len(text) >= 2:
        return "N3"
    if KATAKANA_RE.search(text) and len(text) >= 4:
        return "N2"
    if pos in {"副詞", "連体詞"} and len(text) >= 3:
        return "N3"
    return "Unknown"


def resolve_difficulty(
    lemma: str,
    pos: str,
    jlpt_map: dict[str, str],
    frequency_map: dict[str, str],
) -> tuple[JlptLevel, FrequencyBand, str]:
    if pos in NO_HIGHLIGHT_POS:
        return "Unknown", "Unknown", "unknown"

    jlpt = jlpt_map.get(lemma, "Unknown")
    freq = frequency_map.get(lemma, "Unknown")

    if jlpt != "Unknown":
        return jlpt, freq if freq != "Unknown" else "Unknown", "jlpt"
    if freq != "Unknown":
        if freq == "outside-10k":
            return "N1", freq, "frequency"
        if freq == "top-10k":
            return "N2", freq, "frequency"
        if freq == "top-5k":
            return "N3", freq, "frequency"
        return "Unknown", freq, "frequency"
    estimated = _estimated_level(lemma, pos)
    if estimated != "Unknown":
        return estimated, "Unknown", "unknown"
    return "Unknown", "Unknown", "unknown"
