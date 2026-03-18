from __future__ import annotations

import json
import sqlite3

from app.dictionary_lookup import DictionaryLookup


def _create_entries_table(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            surface TEXT NOT NULL,
            lemma TEXT NOT NULL,
            reading TEXT NOT NULL,
            pos_json TEXT NOT NULL,
            meanings_json TEXT NOT NULL,
            primary_meaning TEXT NOT NULL,
            sense_index INTEGER NOT NULL DEFAULT 1,
            is_common INTEGER NOT NULL DEFAULT 0,
            entry_priority INTEGER NOT NULL DEFAULT 999,
            jlpt_level TEXT,
            frequency_band TEXT,
            example_sentence TEXT NOT NULL DEFAULT '',
            usage_note TEXT NOT NULL DEFAULT ''
        );
        CREATE INDEX idx_entries_surface ON entries(surface);
        CREATE INDEX idx_entries_lemma ON entries(lemma);
        CREATE INDEX idx_entries_reading ON entries(reading);
        """
    )


def _make_lookup(db_path, tmp_path) -> DictionaryLookup:
    return DictionaryLookup(
        jmdict_db_path=str(db_path),
        seed_path=str(tmp_path / "missing_seed.json"),
        jlpt_map={},
        frequency_map={},
        allow_seed_fallback=False,
    )


def test_lookup_uses_jmdict_sqlite(tmp_path) -> None:
    db_path = tmp_path / "jmdict.sqlite"

    with sqlite3.connect(db_path) as conn:
        _create_entries_table(conn)
        conn.execute(
            """
            INSERT INTO entries (
                surface, lemma, reading, pos_json, meanings_json, primary_meaning,
                sense_index, is_common, entry_priority, jlpt_level, frequency_band
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "来る",
                "来る",
                "くる",
                json.dumps(["verb"], ensure_ascii=False),
                json.dumps(["to come", "to arrive"], ensure_ascii=False),
                "to come",
                1,
                1,
                1,
                "N5",
                "top-1k",
            ),
        )
        conn.commit()

    lookup = _make_lookup(db_path, tmp_path)

    entries = lookup.lookup(surface="来る", lemma="来る", reading="くる")
    assert len(entries) >= 1
    assert entries[0].primary_meaning == "to come"
    assert entries[0].meanings[0] == "to come"
    assert entries[0].example_sentence
    assert entries[0].usage_note


def test_lookup_no_seed_fallback_by_default(tmp_path) -> None:
    lookup = DictionaryLookup(
        jmdict_db_path=str(tmp_path / "missing.sqlite"),
        seed_path=str(tmp_path / "missing_seed.json"),
        jlpt_map={},
        frequency_map={},
        allow_seed_fallback=False,
    )

    entries = lookup.lookup(surface="未知", lemma="未知")
    assert entries[0].meanings == ["No dictionary match"]
    assert entries[0].primary_meaning == "No dictionary match"


def test_lookup_sorting_prefers_common_primary_sense(tmp_path) -> None:
    db_path = tmp_path / "jmdict.sqlite"

    with sqlite3.connect(db_path) as conn:
        _create_entries_table(conn)
        rows = [
            (
                "見る",
                "見る",
                "みる",
                json.dumps(["verb"], ensure_ascii=False),
                json.dumps(["to see", "to watch"], ensure_ascii=False),
                "to see",
                1,
                1,
                1,
                "N5",
                "top-1k",
            ),
            (
                "見る",
                "見る",
                "みる",
                json.dumps(["verb"], ensure_ascii=False),
                json.dumps(["to try", "to test"], ensure_ascii=False),
                "to try",
                2,
                1,
                2,
                "N4",
                "top-5k",
            ),
            (
                "見る",
                "見る",
                "みる",
                json.dumps(["noun"], ensure_ascii=False),
                json.dumps(["a look"], ensure_ascii=False),
                "a look",
                3,
                0,
                50,
                "Unknown",
                "outside-10k",
            ),
        ]
        conn.executemany(
            """
            INSERT INTO entries (
                surface, lemma, reading, pos_json, meanings_json, primary_meaning,
                sense_index, is_common, entry_priority, jlpt_level, frequency_band
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            rows,
        )
        conn.commit()

    lookup = _make_lookup(db_path, tmp_path)
    entries = lookup.lookup(surface="見る", lemma="見る", reading="みる")

    assert len(entries) >= 3
    assert entries[0].primary_meaning == "to see"
    assert entries[1].primary_meaning == "to try"


def test_lookup_inflected_form_hits_base_lemma(tmp_path) -> None:
    db_path = tmp_path / "jmdict.sqlite"

    with sqlite3.connect(db_path) as conn:
        _create_entries_table(conn)
        conn.execute(
            """
            INSERT INTO entries (
                surface, lemma, reading, pos_json, meanings_json, primary_meaning,
                sense_index, is_common, entry_priority, jlpt_level, frequency_band
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "食べる",
                "食べる",
                "たべる",
                json.dumps(["verb"], ensure_ascii=False),
                json.dumps(["to eat"], ensure_ascii=False),
                "to eat",
                1,
                1,
                1,
                "N5",
                "top-1k",
            ),
        )
        conn.commit()

    lookup = _make_lookup(db_path, tmp_path)
    entries = lookup.lookup(surface="食べました", lemma="食べました", reading="タベマシタ")

    assert entries[0].lemma == "食べる"
    assert entries[0].primary_meaning == "to eat"


def test_lookup_contract_contains_popup_fields(tmp_path) -> None:
    db_path = tmp_path / "jmdict.sqlite"

    with sqlite3.connect(db_path) as conn:
        _create_entries_table(conn)
        conn.execute(
            """
            INSERT INTO entries (
                surface, lemma, reading, pos_json, meanings_json, primary_meaning,
                sense_index, is_common, entry_priority, jlpt_level, frequency_band
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "歩く",
                "歩く",
                "あるく",
                json.dumps(["verb"], ensure_ascii=False),
                json.dumps(["to walk"], ensure_ascii=False),
                "to walk",
                1,
                1,
                1,
                "N5",
                "top-5k",
            ),
        )
        conn.commit()

    lookup = _make_lookup(db_path, tmp_path)
    entry = lookup.lookup(surface="歩く", lemma="歩く", reading="あるく")[0]

    payload = entry.model_dump()
    required = {
        "lemma",
        "reading",
        "pos",
        "meanings",
        "primary_meaning",
        "example_sentence",
        "usage_note",
        "jlpt_level",
        "frequency_band",
    }
    assert required.issubset(set(payload.keys()))
