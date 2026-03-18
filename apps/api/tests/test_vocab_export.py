from __future__ import annotations

import uuid
from datetime import datetime, timezone

from app.models.entities import VocabItem
from app.services.vocab_export import export_vocab_csv, export_vocab_json


def _build_item() -> VocabItem:
    item = VocabItem(
        id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        surface="来る",
        lemma="来る",
        reading="くる",
        pos="verb",
        meaning_snapshot={"meanings": ["to come", "to arrive"]},
        jlpt_level="N5",
        frequency_band="top-1k",
        status="learning",
        source_article_id=None,
        source_sentence="彼は来るはずだったのに",
        created_at=datetime.now(timezone.utc),
    )
    return item


def test_vocab_export_csv_and_json() -> None:
    item = _build_item()

    csv_text = export_vocab_csv([item])
    assert "surface,lemma,reading,pos,meaning,jlpt_level,frequency_band,status,source_sentence" in csv_text
    assert "来る" in csv_text

    json_text = export_vocab_json([item])
    assert '"surface": "来る"' in json_text
    assert '"jlpt_level": "N5"' in json_text
    assert '"status": "learning"' in json_text
