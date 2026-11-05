from __future__ import annotations

import uuid

from sqlalchemy import create_engine, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import sessionmaker

from app.models.entities import ProductEvent, User, VocabItem
from app.schemas.vocab import VocabItemCreateRequest
from app.services.vocab_service import create_vocab_item


@compiles(JSONB, "sqlite")
def _compile_jsonb_for_sqlite(_type, _compiler, **_kwargs) -> str:  # noqa: ANN001
    return "JSON"


def _memory_session():
    engine = create_engine("sqlite+pysqlite:///:memory:")
    for table in [User.__table__, VocabItem.__table__, ProductEvent.__table__]:
        table.create(engine)
    return sessionmaker(bind=engine)


def test_create_vocab_item_dedupes_by_lemma_pos() -> None:
    testing_session_local = _memory_session()
    with testing_session_local() as db:
        user = User(id=uuid.uuid4(), email="vocab-dedupe@example.com", password_hash="hash")
        db.add(user)
        db.commit()

        first = create_vocab_item(
            db,
            user.id,
            VocabItemCreateRequest(surface="来る", lemma="来る", reading="", pos="動詞"),
        )
        # Saving the same lemma+pos again returns the existing row and backfills the reading.
        second = create_vocab_item(
            db,
            user.id,
            VocabItemCreateRequest(surface="来る", lemma="来る", reading="くる", pos="動詞"),
        )

        assert second.id == first.id
        rows = db.scalars(select(VocabItem).where(VocabItem.user_id == user.id)).all()
        assert len(rows) == 1
        assert rows[0].reading == "くる"

        # A different part of speech is a distinct word → separate row.
        third = create_vocab_item(
            db,
            user.id,
            VocabItemCreateRequest(surface="来る", lemma="来る", reading="くる", pos="名詞"),
        )
        assert third.id != first.id
        assert len(db.scalars(select(VocabItem).where(VocabItem.user_id == user.id)).all()) == 2


def test_create_vocab_item_does_not_reset_review_progress_on_resave() -> None:
    testing_session_local = _memory_session()
    with testing_session_local() as db:
        user = User(id=uuid.uuid4(), email="vocab-progress@example.com", password_hash="hash")
        db.add(user)
        db.commit()

        item = create_vocab_item(
            db,
            user.id,
            VocabItemCreateRequest(surface="曖昧", lemma="曖昧", reading="アイマイ", pos="名詞"),
        )
        item.status = "learning"
        item.review_count = 3
        db.commit()

        again = create_vocab_item(
            db,
            user.id,
            VocabItemCreateRequest(surface="曖昧", lemma="曖昧", reading="アイマイ", pos="名詞"),
        )
        assert again.id == item.id
        assert again.status == "learning"
        assert again.review_count == 3
