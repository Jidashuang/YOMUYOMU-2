from __future__ import annotations

import csv
import logging
from functools import lru_cache
from pathlib import Path

from app.core.config import get_settings

logger = logging.getLogger(__name__)

# Bundled copy of the JLPT wordlist so the API can colour difficult words even when the
# NLP service is fully unavailable. Only N1/N2/N3 entries matter — those are the only
# levels the reader highlights. This is a *degraded* path: plain longest-match substring
# colouring with no morphology/reading/lemmatisation, so it can over- or under-match.
_DEFAULT_MAP_PATH = Path(__file__).resolve().parents[1] / "data" / "jlpt_map.csv"
_HIGHLIGHT_LEVELS = {"N1", "N2", "N3"}
_MAX_TERM_LEN = 16  # cap the greedy match window; JLPT lemmas are short


def _load_map(path: Path) -> dict[str, str]:
    mapping: dict[str, str] = {}
    try:
        with open(path, "r", encoding="utf-8") as file:
            reader = csv.DictReader(file)
            for row in reader:
                lemma = (row.get("lemma") or "").strip()
                level = (row.get("jlpt_level") or "").strip()
                if lemma and level in _HIGHLIGHT_LEVELS:
                    mapping[lemma] = level
    except FileNotFoundError:
        logger.warning("fallback jlpt map not found: %s — fallback annotation will be empty", path)
    return mapping


@lru_cache
def get_fallback_jlpt_map() -> dict[str, str]:
    settings = get_settings()
    path = Path(settings.fallback_jlpt_map_path) if settings.fallback_jlpt_map_path else _DEFAULT_MAP_PATH
    mapping = _load_map(path)
    logger.info("fallback_jlpt_map_loaded entries=%s path=%s", len(mapping), path)
    return mapping


def annotate_text_fallback(text: str, jlpt_map: dict[str, str]) -> list[dict]:
    """Greedy longest-match colouring against the JLPT wordlist.

    Returns tokens shaped like ``nlp_client.annotate`` output (so the same
    ``_add_chunk_tokens`` storage path consumes them) for N1/N2/N3 terms only, with
    non-overlapping spans and absolute offsets within ``text``. Empty map or text → [].
    """
    if not text or not jlpt_map:
        return []

    tokens: list[dict] = []
    index = 0
    length_total = len(text)
    while index < length_total:
        matched_surface: str | None = None
        matched_level = ""
        upper = min(_MAX_TERM_LEN, length_total - index)
        for window in range(upper, 0, -1):
            candidate = text[index : index + window]
            level = jlpt_map.get(candidate)
            if level is not None:
                matched_surface = candidate
                matched_level = level
                break
        if matched_surface is None:
            index += 1
            continue
        end = index + len(matched_surface)
        tokens.append(
            {
                "surface": matched_surface,
                "lemma": matched_surface,
                "reading": "",
                "pos": "unknown",
                "start": index,
                "end": end,
                "jlpt_level": matched_level,
                "frequency_band": "Unknown",
            }
        )
        index = end
    return tokens
