#!/usr/bin/env python3

"""Import frequency list into normalized csv map.

Output schema:
  lemma,frequency_band
"""

from __future__ import annotations

import argparse
import csv
from pathlib import Path

VALID_BANDS = {"top-1k", "top-5k", "top-10k", "outside-10k"}
LEMMA_KEYS = {"lemma", "word", "vocab", "surface", "term"}
BAND_KEYS = {"frequency_band", "band", "frequency"}
RANK_KEYS = {"rank", "frequency_rank", "freq_rank", "順位", "rank_in_corpus"}


def _normalize_key(value: str) -> str:
    return value.strip().lower().replace(" ", "_")


def _resolve_column(fieldnames: list[str], candidates: set[str]) -> str | None:
    for name in fieldnames:
        if _normalize_key(name) in candidates:
            return name
    return None


def _band_from_rank(rank_text: str) -> str | None:
    try:
        rank = int(rank_text.strip())
    except (TypeError, ValueError, AttributeError):
        return None
    if rank <= 0:
        return None
    if rank <= 1000:
        return "top-1k"
    if rank <= 5000:
        return "top-5k"
    if rank <= 10000:
        return "top-10k"
    return "outside-10k"


def _normalize_band(value: str) -> str | None:
    normalized = value.strip().lower().replace(" ", "").replace("_", "-")
    if not normalized:
        return None

    alias = {
        "top1k": "top-1k",
        "top-1k": "top-1k",
        "top5k": "top-5k",
        "top-5k": "top-5k",
        "top10k": "top-10k",
        "top-10k": "top-10k",
        "outside10k": "outside-10k",
        "outside-10k": "outside-10k",
        "other": "outside-10k",
        "unknown": None,
    }
    resolved = alias.get(normalized, normalized if normalized in VALID_BANDS else None)
    if resolved in VALID_BANDS:
        return resolved
    return None


def import_frequency(input_path: Path, output_path: Path, delimiter: str | None = None) -> tuple[int, int]:
    if delimiter is None:
        delimiter = "\t" if input_path.suffix.lower() == ".tsv" else ","

    with input_path.open("r", encoding="utf-8-sig", newline="") as source:
        reader = csv.DictReader(source, delimiter=delimiter)
        if not reader.fieldnames:
            raise ValueError("Input file must contain a header row")

        lemma_col = _resolve_column(reader.fieldnames, LEMMA_KEYS)
        band_col = _resolve_column(reader.fieldnames, BAND_KEYS)
        rank_col = _resolve_column(reader.fieldnames, RANK_KEYS)
        if not lemma_col or (not band_col and not rank_col):
            raise ValueError(
                "Unable to detect columns. Required: lemma/word and either frequency_band or rank."
            )

        band_score = {"top-1k": 4, "top-5k": 3, "top-10k": 2, "outside-10k": 1}
        mapping: dict[str, str] = {}
        processed_rows = 0
        for row in reader:
            processed_rows += 1
            lemma = (row.get(lemma_col) or "").strip()
            if not lemma:
                continue

            band: str | None = None
            if band_col:
                band = _normalize_band(row.get(band_col) or "")
            if band is None and rank_col:
                band = _band_from_rank(row.get(rank_col) or "")
            if band is None:
                continue

            existing = mapping.get(lemma)
            if existing is None or band_score[band] > band_score[existing]:
                mapping[lemma] = band

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8", newline="") as target:
        writer = csv.writer(target)
        writer.writerow(["lemma", "frequency_band"])
        for lemma in sorted(mapping.keys()):
            writer.writerow([lemma, mapping[lemma]])

    return processed_rows, len(mapping)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Import frequency list into normalized csv map.")
    parser.add_argument("--input", required=True, help="Input CSV/TSV path")
    parser.add_argument("--output", default="services/nlp/data/frequency_map.csv", help="Output CSV path")
    parser.add_argument("--delimiter", default=None, help="Optional delimiter override, e.g. ',' or '\\t'")
    return parser.parse_args()

def main() -> None:
    args = parse_args()
    input_path = Path(args.input)
    output_path = Path(args.output)

    if not input_path.exists():
        raise SystemExit(f"Input file not found: {input_path}")

    processed_rows, imported = import_frequency(
        input_path=input_path,
        output_path=output_path,
        delimiter=args.delimiter,
    )
    print(f"Processed rows: {processed_rows}")
    print(f"Imported lemmas: {imported}")
    print(f"Output csv: {output_path}")


if __name__ == "__main__":
    main()
