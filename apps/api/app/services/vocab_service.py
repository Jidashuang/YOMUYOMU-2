from __future__ import annotations

from uuid import UUID

from sqlalchemy.orm import Session

from app.models.entities import VocabItem
from app.schemas.vocab import VocabItemCreateRequest
from app.services.product_analytics import EVENT_VOCAB_ADDED, record_product_event


def create_vocab_item(db: Session, user_id: UUID, payload: VocabItemCreateRequest) -> VocabItem:
    item = VocabItem(
        user_id=user_id,
        surface=payload.surface,
        lemma=payload.lemma,
        reading=payload.reading,
        pos=payload.pos,
        meaning_snapshot=payload.meaning_snapshot,
        jlpt_level=payload.jlpt_level,
        frequency_band=payload.frequency_band,
        status=payload.status,
        source_article_id=payload.source_article_id,
        source_sentence=payload.source_sentence,
    )
    db.add(item)
    record_product_event(
        db,
        user_id=user_id,
        article_id=payload.source_article_id,
        event_name=EVENT_VOCAB_ADDED,
        payload={"lemma": payload.lemma, "surface": payload.surface},
    )
    db.commit()
    db.refresh(item)
    return item
