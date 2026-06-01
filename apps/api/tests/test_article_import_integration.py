from __future__ import annotations

import uuid

from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app.models.entities import Article, ArticleBlock, ProductEvent, TokenOccurrence, User
from app.db import session as db_session
from app.services import article_processing


def test_sqlite_session_is_configured_for_background_worker() -> None:
    assert db_session.connect_args == {"check_same_thread": False}


def test_article_processing_worker_flow(monkeypatch) -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    for table in [User.__table__, Article.__table__, ArticleBlock.__table__, TokenOccurrence.__table__, ProductEvent.__table__]:
        table.create(engine)

    testing_session_local = sessionmaker(bind=engine)
    monkeypatch.setattr(article_processing, "SessionLocal", testing_session_local)
    monkeypatch.setattr(
        article_processing.nlp_client,
        "annotate",
        lambda text: [
            {
                "surface": "彼",
                "lemma": "彼",
                "reading": "カレ",
                "pos": "名詞",
                "start": 0,
                "end": 1,
                "jlpt_level": "N5",
                "frequency_band": "top-5k",
            }
        ],
    )

    with testing_session_local() as db:
        user = User(id=uuid.uuid4(), email="tester@example.com", password_hash="hash")
        article = Article(
            id=uuid.uuid4(),
            user_id=user.id,
            title="test",
            source_type="text",
            status="processing",
            raw_content="彼は来る。",
            normalized_content="彼は来る。",
        )
        db.add(user)
        db.add(article)
        db.commit()
        article_id = article.id

    article_processing._process_article(article_id)

    with testing_session_local() as db:
        article = db.scalar(select(Article).where(Article.id == article_id))
        assert article is not None
        assert article.status == "ready"

        blocks = db.scalars(select(ArticleBlock).where(ArticleBlock.article_id == article_id)).all()
        tokens = db.scalars(select(TokenOccurrence).where(TokenOccurrence.article_id == article_id)).all()
        assert len(blocks) == 1
        assert len(tokens) == 1
        assert article.processed_block_count == 1
        assert article.total_block_count == 1


def test_article_processing_keeps_completed_blocks_when_later_block_fails(monkeypatch) -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    for table in [User.__table__, Article.__table__, ArticleBlock.__table__, TokenOccurrence.__table__, ProductEvent.__table__]:
        table.create(engine)

    testing_session_local = sessionmaker(bind=engine)
    monkeypatch.setattr(article_processing, "SessionLocal", testing_session_local)

    def annotate(text: str) -> list[dict[str, object]]:
        if "二段目" in text:
            raise RuntimeError("tokenizer unavailable")
        return [
            {
                "surface": "一",
                "lemma": "一",
                "reading": "イチ",
                "pos": "名詞",
                "start": 0,
                "end": 1,
                "jlpt_level": "N5",
                "frequency_band": "top-5k",
            }
        ]

    monkeypatch.setattr(article_processing.nlp_client, "annotate", annotate)

    with testing_session_local() as db:
        user = User(id=uuid.uuid4(), email="partial@example.com", password_hash="hash")
        article = Article(
            id=uuid.uuid4(),
            user_id=user.id,
            title="partial",
            source_type="text",
            status="processing",
            raw_content="一段目。\n二段目。",
            normalized_content=None,
        )
        db.add(user)
        db.add(article)
        db.commit()
        article_id = article.id

    article_processing._process_article(article_id)

    with testing_session_local() as db:
        article = db.scalar(select(Article).where(Article.id == article_id))
        assert article is not None
        assert article.status == "failed"
        assert "tokenizer unavailable" in (article.processing_error or "")
        assert article.processed_block_count == 1
        assert article.total_block_count == 2

        blocks = db.scalars(select(ArticleBlock).where(ArticleBlock.article_id == article_id)).all()
        tokens = db.scalars(select(TokenOccurrence).where(TokenOccurrence.article_id == article_id)).all()
        assert len(blocks) == 1
        assert blocks[0].text == "一段目。"
        assert len(tokens) == 1
