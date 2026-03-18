#!/usr/bin/env python3

"""Import JLPT word list into normalized csv map.

Output schema:
  lemma,jlpt_level
"""

from __future__ import annotations

import argparse
import csv
from pathlib import Path

VALID_LEVELS = {"N1", "N2", "N3", "N4", "N5"}
LEMMA_KEYS = {"lemma", "word", "vocab", "surface", "term"}
LEVEL_KEYS = {"jlpt_level", "level", "jlpt", "n_level", "n-level"}


def _normalize_key(value: str) -> str:
    return value.strip().lower().replace(" ", "_")


def _resolve_column(fieldnames: list[str], candidates: set[str]) -> str | None:
    for name in fieldnames:
        if _normalize_key(name) in candidates:
            return name
    return None


def _normalize_level(raw: str) -> str | None:
    value = raw.strip().upper().replace(" ", "")
    if not value:
        return None
    if value in VALID_LEVELS:
        return value
    if value.isdigit() and value in {"1", "2", "3", "4", "5"}:
        return f"N{value}"
    if value.startswith("N") and value[1:] in {"1", "2", "3", "4", "5"}:
        return value
    return None


def import_jlpt(input_path: Path, output_path: Path, delimiter: str | None = None) -> tuple[int, int]:
    if delimiter is None:
        delimiter = "\t" if input_path.suffix.lower() == ".tsv" else ","

    with input_path.open("r", encoding="utf-8-sig", newline="") as source:
        reader = csv.DictReader(source, delimiter=delimiter)
        if not reader.fieldnames:
            raise ValueError("Input file must contain a header row")

        lemma_col = _resolve_column(reader.fieldnames, LEMMA_KEYS)
        level_col = _resolve_column(reader.fieldnames, LEVEL_KEYS)
        if not lemma_col or not level_col:
            raise ValueError(
                "Unable to detect columns. Required columns include lemma/word and jlpt level."
            )

        level_rank = {"N1": 1, "N2": 2, "N3": 3, "N4": 4, "N5": 5}
        mapping: dict[str, str] = {}
        processed_rows = 0
        for row in reader:
            processed_rows += 1
            lemma = (row.get(lemma_col) or "").strip()
            level = _normalize_level(row.get(level_col) or "")
            if not lemma or not level:
                continue

            existing = mapping.get(lemma)
            if existing is None or level_rank[level] < level_rank[existing]:
                mapping[lemma] = level

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8", newline="") as target:
        writer = csv.writer(target)
        writer.writerow(["lemma", "jlpt_level"])
        for lemma in sorted(mapping.keys()):
            writer.writerow([lemma, mapping[lemma]])

    return processed_rows, len(mapping)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Import JLPT word list into normalized csv map.")
    parser.add_argument("--input", required=True, help="Input CSV/TSV path")
    parser.add_argument("--output", default="services/nlp/data/jlpt_map.csv", help="Output CSV path")
    parser.add_argument("--delimiter", default=None, help="Optional delimiter override, e.g. ',' or '\\t'")
    return parser.parse_args()

def main() -> None:
    args = parse_args()
    input_path = Path(args.input)
    output_path = Path(args.output)

    if not input_path.exists():
        raise SystemExit(f"Input file not found: {input_path}")

    processed_rows, imported = import_jlpt(
        input_path=input_path,
        output_path=output_path,
        delimiter=args.delimiter,
    )
    print(f"Processed rows: {processed_rows}")
    print(f"Imported lemmas: {imported}")
    print(f"Output csv: {output_path}")


if __name__ == "__main__":
    main()
