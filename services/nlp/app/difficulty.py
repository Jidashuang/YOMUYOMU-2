from __future__ import annotations

import csv

from app.schemas import FrequencyBand, JlptLevel

NO_HIGHLIGHT_POS = {"助詞", "助動詞", "補助記号", "記号"}


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
        return "Unknown", freq, "frequency"
    return "Unknown", "Unknown", "unknown"
