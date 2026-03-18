from __future__ import annotations

import json
import logging
import re
import sqlite3
from dataclasses import dataclass
from pathlib import Path

try:
    from sudachipy import dictionary as sudachi_dictionary
except Exception:  # noqa: BLE001
    sudachi_dictionary = None

from app.schemas import LookupEntry

logger = logging.getLogger(__name__)

JLPT_SCORE = {
    "N5": 5,
    "N4": 4,
    "N3": 3,
    "N2": 2,
    "N1": 1,
    "Unknown": 0,
}

FREQUENCY_SCORE = {
    "top-1k": 4,
    "top-5k": 3,
    "top-10k": 2,
    "outside-10k": 1,
    "Unknown": 0,
}


@dataclass(frozen=True)
class LookupCandidate:
    field: str
    value: str
    priority: int
    source: str


class DictionaryLookup:
    def __init__(
        self,
        jmdict_db_path: str,
        seed_path: str,
        jlpt_map: dict[str, str],
        frequency_map: dict[str, str],
        allow_seed_fallback: bool = False,
    ):
        self.jmdict_db_path = Path(jmdict_db_path)
        self.seed_path = Path(seed_path)
        self.jlpt_map = jlpt_map
        self.frequency_map = frequency_map
        self.allow_seed_fallback = allow_seed_fallback

        self._seed_data = self._load_seed() if allow_seed_fallback else {}
        self._db_columns: set[str] | None = None

        self._sudachi = None
        if sudachi_dictionary is not None:
            try:
                self._sudachi = sudachi_dictionary.Dictionary().create()
            except Exception as exc:  # noqa: BLE001
                logger.warning("Sudachi tokenizer unavailable for lookup normalization: %s", exc)

    def _load_seed(self) -> dict[str, dict]:
        try:
            with self.seed_path.open("r", encoding="utf-8") as file:
                return json.load(file)
        except FileNotFoundError:
            return {}

    def _get_db_columns(self) -> set[str]:
        if self._db_columns:
            return self._db_columns
        if not self.jmdict_db_path.exists():
            self._db_columns = set()
            return self._db_columns

        try:
            with sqlite3.connect(self.jmdict_db_path) as conn:
                rows = conn.execute("PRAGMA table_info(entries)").fetchall()
            self._db_columns = {str(row[1]) for row in rows}
            return self._db_columns
        except sqlite3.Error:
            self._db_columns = set()
            return self._db_columns

    def _db_available(self) -> bool:
        if not self.jmdict_db_path.exists():
            return False
        columns = self._get_db_columns()
        required = {"surface", "lemma", "reading", "pos_json", "meanings_json"}
        return required.issubset(columns)

    def _context_example_sentence(self, context: str | None, surface: str, lemma: str) -> str:
        if not context:
            return ""
        chunks = [chunk.strip() for chunk in re.split(r"[。！？!?]", context) if chunk.strip()]
        for chunk in chunks:
            if surface and surface in chunk:
                return f"{chunk}。"
            if lemma and lemma in chunk:
                return f"{chunk}。"
        return ""

    def _normalize_with_sudachi(self, text: str) -> tuple[str, str] | None:
        if not text or self._sudachi is None:
            return None
        try:
            tokens = self._sudachi.tokenize(text)
        except Exception:  # noqa: BLE001
            return None
        if len(tokens) != 1:
            return None

        token = tokens[0]
        base = token.dictionary_form()
        reading = token.reading_form()
        if not base:
            return None
        return base, reading

    def _heuristic_base_forms(self, surface: str) -> list[str]:
        candidates: list[str] = []
        rules = [
            ("ました", "る"),
            ("ません", "る"),
            ("ない", "る"),
            ("かった", "い"),
            ("くない", "い"),
            ("かったです", "い"),
            ("ている", "る"),
            ("てる", "る"),
            ("だ", ""),
        ]
        for suffix, replacement in rules:
            if surface.endswith(suffix) and len(surface) > len(suffix):
                stem = surface[: -len(suffix)]
                candidates.append(stem + replacement)
        return candidates

    def _build_lookup_candidates(self, surface: str, lemma: str, reading: str | None) -> list[LookupCandidate]:
        candidates: list[LookupCandidate] = []
        seen: set[tuple[str, str]] = set()

        def add(field: str, value: str | None, priority: int, source: str) -> None:
            normalized = (value or "").strip()
            if not normalized:
                return
            key = (field, normalized)
            if key in seen:
                return
            seen.add(key)
            candidates.append(LookupCandidate(field=field, value=normalized, priority=priority, source=source))

        # Explicit query priority: lemma > surface > reading.
        add("lemma", lemma, 0, "lemma_exact")
        add("surface", surface, 1, "surface_exact")
        add("reading", reading, 2, "reading_exact")

        normalized_surface = self._normalize_with_sudachi(surface)
        if normalized_surface:
            add("lemma", normalized_surface[0], 3, "surface_normalized")
            add("reading", normalized_surface[1], 4, "surface_normalized")

        normalized_lemma = self._normalize_with_sudachi(lemma)
        if normalized_lemma:
            add("lemma", normalized_lemma[0], 5, "lemma_normalized")
            add("reading", normalized_lemma[1], 6, "lemma_normalized")

        for guessed in self._heuristic_base_forms(surface):
            add("lemma", guessed, 7, "surface_heuristic")

        return candidates

    def _fetch_rows_for_candidate(self, candidate: LookupCandidate, limit: int = 12) -> list[sqlite3.Row]:
        if candidate.field not in {"lemma", "surface", "reading"}:
            return []
        if candidate.field not in self._get_db_columns():
            return []

        columns = self._get_db_columns()
        primary_meaning_sql = "primary_meaning" if "primary_meaning" in columns else "'' AS primary_meaning"
        entry_priority_sql = "entry_priority" if "entry_priority" in columns else "999 AS entry_priority"
        sense_index_sql = "sense_index" if "sense_index" in columns else "999 AS sense_index"
        is_common_sql = "is_common" if "is_common" in columns else "0 AS is_common"
        example_sentence_sql = "example_sentence" if "example_sentence" in columns else "'' AS example_sentence"
        usage_note_sql = "usage_note" if "usage_note" in columns else "'' AS usage_note"

        query = f"""
            SELECT
                lemma,
                reading,
                pos_json,
                meanings_json,
                {primary_meaning_sql},
                jlpt_level,
                frequency_band,
                {entry_priority_sql},
                {sense_index_sql},
                {is_common_sql},
                {example_sentence_sql},
                {usage_note_sql}
            FROM entries
            WHERE {candidate.field} = ?
            LIMIT ?
        """

        with sqlite3.connect(self.jmdict_db_path) as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute(query, (candidate.value, limit)).fetchall()
        return rows

    def _row_to_lookup_entry(
        self,
        row: sqlite3.Row,
        fallback_lemma: str,
        surface: str,
        context: str | None,
    ) -> LookupEntry:
        pos_raw = row["pos_json"]
        meanings_raw = row["meanings_json"]

        try:
            pos = json.loads(pos_raw or "[]")
        except json.JSONDecodeError:
            pos = []
        if not isinstance(pos, list) or not pos:
            pos = ["unknown"]

        try:
            meanings = json.loads(meanings_raw or "[]")
        except json.JSONDecodeError:
            meanings = []
        if not isinstance(meanings, list) or not meanings:
            meanings = ["No meaning"]

        primary_meaning = str(row["primary_meaning"] or "").strip() or str(meanings[0])
        lemma = str(row["lemma"] or fallback_lemma)
        reading = str(row["reading"] or lemma)
        example_sentence = str(row["example_sentence"] or "").strip() if "example_sentence" in row.keys() else ""
        usage_note = str(row["usage_note"] or "").strip() if "usage_note" in row.keys() else ""

        if not example_sentence:
            example_sentence = self._context_example_sentence(context=context, surface=surface, lemma=lemma)
        if not example_sentence:
            example_sentence = f"{surface or lemma}。"
        if not usage_note:
            usage_note = f"Common {pos[0]} usage."

        jlpt_level = str(row["jlpt_level"] or self.jlpt_map.get(lemma, "Unknown"))
        frequency_band = str(row["frequency_band"] or self.frequency_map.get(lemma, "Unknown"))

        return LookupEntry(
            lemma=lemma,
            reading=reading,
            pos=[str(item) for item in pos],
            meanings=[str(item) for item in meanings],
            primary_meaning=primary_meaning,
            example_sentence=example_sentence,
            usage_note=usage_note,
            jlpt_level=jlpt_level,
            frequency_band=frequency_band,
        )

    def _sort_rank(
        self,
        *,
        entry: LookupEntry,
        match_priority: int,
        reading_input: str | None,
        is_common: int,
        entry_priority: int,
        sense_index: int,
    ) -> tuple[int, int, int, int, int, int, int]:
        reading_penalty = 0
        if reading_input:
            reading_penalty = 0 if reading_input == entry.reading else 1

        return (
            match_priority,
            reading_penalty,
            0 if is_common else 1,
            entry_priority,
            sense_index,
            len(entry.primary_meaning),
            -FREQUENCY_SCORE.get(entry.frequency_band, 0),
            -JLPT_SCORE.get(entry.jlpt_level, 0),
        )

    def _lookup_db(
        self,
        surface: str,
        lemma: str,
        reading: str | None,
        context: str | None,
    ) -> list[LookupEntry]:
        if not self._db_available():
            return []

        candidates = self._build_lookup_candidates(surface=surface, lemma=lemma, reading=reading)
        if not candidates:
            return []

        ranked: dict[
            tuple[str, str, str, tuple[str, ...]],
            tuple[tuple[int, int, int, int, int, int, int], LookupEntry],
        ] = {}

        for candidate in candidates:
            rows = self._fetch_rows_for_candidate(candidate)
            for row in rows:
                entry = self._row_to_lookup_entry(
                    row,
                    fallback_lemma=lemma,
                    surface=surface,
                    context=context,
                )
                key = (
                    entry.lemma,
                    entry.reading,
                    entry.primary_meaning,
                    tuple(entry.pos),
                )
                rank = self._sort_rank(
                    entry=entry,
                    match_priority=candidate.priority,
                    reading_input=reading,
                    is_common=int(row["is_common"] or 0),
                    entry_priority=int(row["entry_priority"] or 999),
                    sense_index=int(row["sense_index"] or 999),
                )
                previous = ranked.get(key)
                if previous is None or rank < previous[0]:
                    ranked[key] = (rank, entry)

        ordered = sorted(ranked.values(), key=lambda item: item[0])
        return [entry for _, entry in ordered[:10]]

    def _lookup_seed(self, surface: str, lemma: str) -> list[LookupEntry]:
        candidate = self._seed_data.get(lemma) or self._seed_data.get(surface)
        if not candidate:
            return []

        meanings = [str(item) for item in candidate.get("meanings", ["No meaning"])]
        primary_meaning = str(candidate.get("primary_meaning") or (meanings[0] if meanings else "No meaning"))

        return [
            LookupEntry(
                lemma=lemma,
                reading=str(candidate.get("reading", surface)),
                pos=[str(item) for item in candidate.get("pos", ["unknown"])],
                meanings=meanings,
                primary_meaning=primary_meaning,
                example_sentence=str(candidate.get("example_sentence") or f"{surface or lemma}。"),
                usage_note=str(candidate.get("usage_note") or "Seed fallback usage note."),
                jlpt_level=str(candidate.get("jlpt_level", self.jlpt_map.get(lemma, "Unknown"))),
                frequency_band=str(candidate.get("frequency_band", self.frequency_map.get(lemma, "Unknown"))),
            )
        ]

    def lookup(self, surface: str, lemma: str, reading: str | None = None, context: str | None = None) -> list[LookupEntry]:
        entries = self._lookup_db(surface=surface, lemma=lemma, reading=reading, context=context)
        if entries:
            return entries

        if self.allow_seed_fallback:
            seed_entries = self._lookup_seed(surface=surface, lemma=lemma)
            if seed_entries:
                return seed_entries

        fallback_lemma = lemma or surface
        return [
            LookupEntry(
                lemma=fallback_lemma,
                reading=reading or surface,
                pos=["unknown"],
                meanings=["No dictionary match"],
                primary_meaning="No dictionary match",
                example_sentence=self._context_example_sentence(
                    context=context,
                    surface=surface,
                    lemma=fallback_lemma,
                )
                or f"{surface or fallback_lemma}。",
                usage_note="No usage note available.",
                jlpt_level=self.jlpt_map.get(fallback_lemma, "Unknown"),
                frequency_band=self.frequency_map.get(fallback_lemma, "Unknown"),
            )
        ]
