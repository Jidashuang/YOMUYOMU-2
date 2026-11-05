#!/usr/bin/env python3

"""Import JMdict XML into a sqlite lookup index.

Usage:
  python scripts/import_jmdict/import_jmdict.py \
    --input /path/to/JMdict_e.xml \
    --output services/nlp/data/jmdict.sqlite
"""

from __future__ import annotations

import argparse
import gzip
import json
import sqlite3
from collections.abc import Iterator
from pathlib import Path
from xml.etree import ElementTree as ET


COMMON_TAG_PREFIXES = ("ichi", "news", "spec", "gai", "nf")


def _clean_text(value: str) -> str:
    return value.strip()


def _clean_pos(value: str) -> str:
    return value.strip().strip("&;") or "unknown"


XML_LANG = "{http://www.w3.org/XML/1998/namespace}lang"


def _extract_text_list(parent: ET.Element, path: str) -> list[str]:
    values: list[str] = []
    for node in parent.findall(path):
        text = (node.text or "").strip()
        if text:
            values.append(text)
    return values


def _extract_glosses(sense: ET.Element, languages: set[str]) -> list[str]:
    values: list[str] = []
    for node in sense.findall("gloss"):
        lang = node.attrib.get(XML_LANG, "eng")
        if lang not in languages:
            continue
        text = (node.text or "").strip()
        if text:
            values.append(text)
    return values


def _extract_usage_note(sense: ET.Element, fallback_pos: list[str]) -> str:
    infos = _extract_text_list(sense, "s_inf")
    misc = _extract_text_list(sense, "misc")
    parts = [item.strip() for item in (infos + misc) if item.strip()]
    if parts:
        return " / ".join(dict.fromkeys(parts))
    return ""


def _extract_example_sentence(sense: ET.Element) -> str:
    candidates = (
        _extract_text_list(sense, "example/ex_text")
        + _extract_text_list(sense, "example/ex_sent")
        + _extract_text_list(sense, "example")
    )
    for value in candidates:
        cleaned = value.strip()
        if cleaned:
            return cleaned
    return ""


def _entry_priority(priority_tags: list[str]) -> tuple[int, int]:
    is_common = int(any(tag.startswith(COMMON_TAG_PREFIXES) for tag in priority_tags))

    score = 999
    for tag in priority_tags:
        normalized = tag.strip()
        if normalized.startswith("nf") and len(normalized) >= 4:
            try:
                score = min(score, int(normalized[2:]))
            except ValueError:
                continue
        elif normalized.endswith("1"):
            score = min(score, 1)
        elif normalized.endswith("2"):
            score = min(score, 2)
        elif normalized.startswith(("ichi", "news", "spec", "gai")):
            score = min(score, 3)

    return is_common, score


def _build_records(entry: ET.Element, languages: set[str]) -> list[dict]:
    kanji_forms = _extract_text_list(entry, "k_ele/keb")
    reading_forms = _extract_text_list(entry, "r_ele/reb")

    lemma_candidates = kanji_forms or reading_forms
    if not lemma_candidates:
        return []

    primary_lemma = lemma_candidates[0]
    primary_reading = reading_forms[0] if reading_forms else primary_lemma

    priority_tags = _extract_text_list(entry, "k_ele/ke_pri") + _extract_text_list(entry, "r_ele/re_pri")
    is_common, entry_priority = _entry_priority(priority_tags)

    surfaces = list(dict.fromkeys(kanji_forms + reading_forms + [primary_lemma]))
    senses = entry.findall("sense")

    records: list[dict] = []
    inherited_pos: list[str] = ["unknown"]

    for sense_index, sense in enumerate(senses, start=1):
        sense_pos_raw = _extract_text_list(sense, "pos")
        if sense_pos_raw:
            inherited_pos = [_clean_pos(item) for item in sense_pos_raw]

        glosses = [_clean_text(item) for item in _extract_glosses(sense, languages) if _clean_text(item)]
        if not glosses:
            continue

        primary_meaning = glosses[0]
        pos_json = json.dumps(list(dict.fromkeys(inherited_pos)), ensure_ascii=False)
        meanings_json = json.dumps(glosses[:12], ensure_ascii=False)
        usage_note = _extract_usage_note(sense, inherited_pos)
        example_sentence = _extract_example_sentence(sense)

        for surface in surfaces:
            records.append(
                {
                    "surface": surface,
                    "lemma": primary_lemma,
                    "reading": primary_reading,
                    "pos_json": pos_json,
                    "meanings_json": meanings_json,
                    "primary_meaning": primary_meaning,
                    "sense_index": sense_index,
                    "is_common": is_common,
                    "entry_priority": entry_priority,
                    "jlpt_level": None,
                    "frequency_band": None,
                    "example_sentence": example_sentence,
                    "usage_note": usage_note,
                }
            )

    return records


def _init_db(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        DROP TABLE IF EXISTS entries;

        CREATE TABLE entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            surface TEXT NOT NULL,
            lemma TEXT NOT NULL,
            reading TEXT NOT NULL,
            pos_json TEXT NOT NULL,
            meanings_json TEXT NOT NULL,
            primary_meaning TEXT NOT NULL,
            sense_index INTEGER NOT NULL,
            is_common INTEGER NOT NULL DEFAULT 0,
            entry_priority INTEGER NOT NULL DEFAULT 999,
            jlpt_level TEXT,
            frequency_band TEXT,
            example_sentence TEXT NOT NULL DEFAULT '',
            usage_note TEXT NOT NULL DEFAULT '',
            UNIQUE(surface, lemma, reading, sense_index, primary_meaning)
        );

        CREATE INDEX idx_entries_surface ON entries(surface);
        CREATE INDEX idx_entries_lemma ON entries(lemma);
        CREATE INDEX idx_entries_reading ON entries(reading);
        CREATE INDEX idx_entries_lemma_rank ON entries(lemma, entry_priority, sense_index);
        CREATE INDEX idx_entries_reading_rank ON entries(reading, entry_priority, sense_index);
        """
    )


def _iter_entries(input_path: Path) -> Iterator[ET.Element]:
    if input_path.suffix == ".gz":
        with gzip.open(input_path, "rb") as file:
            for _, elem in ET.iterparse(file, events=("end",)):
                if elem.tag == "entry":
                    yield elem
    else:
        for _, elem in ET.iterparse(input_path, events=("end",)):
            if elem.tag == "entry":
                yield elem


def import_jmdict(input_path: Path, output_path: Path, limit: int | None, languages: set[str]) -> tuple[int, int]:
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with sqlite3.connect(output_path) as conn:
        conn.execute("PRAGMA journal_mode = WAL")
        conn.execute("PRAGMA synchronous = NORMAL")
        conn.execute("PRAGMA temp_store = MEMORY")
        _init_db(conn)

        inserted_rows = 0
        parsed_entries = 0

        for elem in _iter_entries(input_path):
            parsed_entries += 1
            for record in _build_records(elem, languages):
                conn.execute(
                    """
                    INSERT OR IGNORE INTO entries (
                        surface,
                        lemma,
                        reading,
                        pos_json,
                        meanings_json,
                        primary_meaning,
                        sense_index,
                        is_common,
                        entry_priority,
                        jlpt_level,
                        frequency_band,
                        example_sentence,
                        usage_note
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        record["surface"],
                        record["lemma"],
                        record["reading"],
                        record["pos_json"],
                        record["meanings_json"],
                        record["primary_meaning"],
                        record["sense_index"],
                        record["is_common"],
                        record["entry_priority"],
                        record["jlpt_level"],
                        record["frequency_band"],
                        record["example_sentence"],
                        record["usage_note"],
                    ),
                )
                inserted_rows += 1

            elem.clear()

            if limit and parsed_entries >= limit:
                break

        conn.commit()

    return parsed_entries, inserted_rows


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Import JMdict XML into sqlite lookup index.")
    parser.add_argument("--input", required=True, help="Path to JMdict XML file")
    parser.add_argument("--output", default="services/nlp/data/jmdict.sqlite", help="Output sqlite path")
    parser.add_argument("--limit", type=int, default=None, help="Optional limit for quick dev import")
    parser.add_argument(
        "--languages",
        default="eng",
        help="Comma-separated gloss languages to import; JMdict uses eng when xml:lang is omitted.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    input_path = Path(args.input)
    output_path = Path(args.output)

    if not input_path.exists():
        raise SystemExit(f"Input file not found: {input_path}")

    languages = {item.strip() for item in args.languages.split(",") if item.strip()}
    parsed_entries, inserted_rows = import_jmdict(input_path, output_path, args.limit, languages)
    print(f"Parsed entries: {parsed_entries}")
    print(f"Inserted rows: {inserted_rows}")
    print(f"Output sqlite: {output_path}")


if __name__ == "__main__":
    main()
