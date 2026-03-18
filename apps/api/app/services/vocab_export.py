from __future__ import annotations

import csv
import json
from io import StringIO

from app.models.entities import VocabItem

CSV_FIELDS = [
    "surface",
    "lemma",
    "reading",
    "pos",
    "meaning",
    "jlpt_level",
    "frequency_band",
    "status",
    "source_sentence",
]


def _meaning_text(item: VocabItem) -> str:
    snapshot = item.meaning_snapshot or {}
    meanings = snapshot.get("meanings") if isinstance(snapshot, dict) else None
    if isinstance(meanings, list):
        return "; ".join(str(value) for value in meanings)
    return ""


def export_vocab_csv(items: list[VocabItem]) -> str:
    output = StringIO()
    writer = csv.DictWriter(output, fieldnames=CSV_FIELDS)
    writer.writeheader()
    for item in items:
        writer.writerow(
            {
                "surface": item.surface,
                "lemma": item.lemma,
                "reading": item.reading or "",
                "pos": item.pos,
                "meaning": _meaning_text(item),
                "jlpt_level": item.jlpt_level or "Unknown",
                "frequency_band": item.frequency_band or "Unknown",
                "status": item.status or "new",
                "source_sentence": item.source_sentence or "",
            }
        )
    return output.getvalue()


def export_vocab_json(items: list[VocabItem]) -> str:
    payload = [
        {
            "id": str(item.id),
            "surface": item.surface,
            "lemma": item.lemma,
            "reading": item.reading or "",
            "pos": item.pos,
            "meaning_snapshot": item.meaning_snapshot,
            "jlpt_level": item.jlpt_level or "Unknown",
            "frequency_band": item.frequency_band or "Unknown",
            "status": item.status or "new",
            "source_article_id": str(item.source_article_id) if item.source_article_id else None,
            "source_sentence": item.source_sentence,
            "created_at": item.created_at.isoformat(),
        }
        for item in items
    ]
    return json.dumps(payload, ensure_ascii=False, indent=2)
