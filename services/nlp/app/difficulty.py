from __future__ import annotations

import csv
import logging

from app.schemas import FrequencyBand, JlptLevel

logger = logging.getLogger(__name__)

NO_HIGHLIGHT_POS = {"助詞", "助動詞", "補助記号", "記号"}

# Sanity floors for the packaged difficulty maps. Loading far fewer entries than this
# almost always means a path is wrong (e.g. pointing at the 4-row *_sample.csv files)
# or the data file is missing — which silently degrades N1/N2/N3 coloring to "Unknown".
JLPT_MAP_MIN_ENTRIES = 5000
FREQUENCY_MAP_MIN_ENTRIES = 50000


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
        logger.warning("difficulty map file not found: %s — difficulty lookups will be empty", path)
        return {}
    return mapping


def evaluate_difficulty_map_health(
    jlpt_map: dict[str, str],
    frequency_map: dict[str, str],
) -> list[str]:
    """Return human-readable warnings when the loaded maps look suspiciously small.

    Empty list means healthy. Used by the NLP service at startup so a misconfigured path
    (e.g. the *_sample.csv files) surfaces as a visible boot error instead of silently
    returning {} and making every word "Unknown".
    """
    warnings: list[str] = []
    if len(jlpt_map) < JLPT_MAP_MIN_ENTRIES:
        warnings.append(
            f"jlpt_map suspiciously small: {len(jlpt_map)} entries (expected >= {JLPT_MAP_MIN_ENTRIES})"
        )
    if len(frequency_map) < FREQUENCY_MAP_MIN_ENTRIES:
        warnings.append(
            f"frequency_map suspiciously small: {len(frequency_map)} entries (expected >= {FREQUENCY_MAP_MIN_ENTRIES})"
        )
    return warnings


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
    return "Unknown", "Unknown", "unknown"
