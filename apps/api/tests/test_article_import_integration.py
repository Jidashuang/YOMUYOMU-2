from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import create_engine, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import sessionmaker

from app.api.routes.articles import delete_article
from app.db import session as db_session
from app.models.entities import (
    AIExplanation,
    Article,
    ArticleBlock,
    Highlight,
    ProductEvent,
    ReadingProgress,
    TokenOccurrence,
    User,
    VocabItem,
)
from app.services import article_processing


@compiles(JSONB, "sqlite")
def _compile_jsonb_for_sqlite(_type, _compiler, **_kwargs) -> str:  # noqa: ANN001
    return "JSON"


def test_sqlite_session_is_configured_for_background_worker() -> None:
    assert db_session.connect_args == {"check_same_thread": False}


def test_annotation_chunks_batch_large_epub_runs() -> None:
    blocks = [
        ArticleBlock(block_index=0, text="一" * 4000),
        ArticleBlock(block_index=1, text="二" * 4000),
        ArticleBlock(block_index=2, text="三" * 3998),
        ArticleBlock(block_index=3, text="四"),
    ]

    chunks = article_processing._iter_annotation_chunks(blocks)

    assert [[block.block_index for block in chunk] for chunk in chunks] == [[0], [1, 2], [3]]


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
        assert article.annotation_status == "ready"

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
    monkeypatch.setattr(article_processing, "MAX_NLP_CHUNK_CHARS", 4)
    # No fallback wordlist → the failing block truly fails (deterministic partial state).
    monkeypatch.setattr(article_processing, "get_fallback_jlpt_map", lambda: {})

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
        assert article.status == "ready"
        assert article.annotation_status == "partial"
        assert "tokenizer unavailable" in (article.annotation_error or "")
        assert article.processing_error is None
        assert article.processed_block_count == 2
        assert article.total_block_count == 2

        blocks = db.scalars(select(ArticleBlock).where(ArticleBlock.article_id == article_id)).all()
        tokens = db.scalars(select(TokenOccurrence).where(TokenOccurrence.article_id == article_id)).all()
        assert len(blocks) == 2
        assert blocks[0].text == "一段目。"
        assert blocks[1].text == "二段目。"
        assert len(tokens) == 1


def test_article_processing_splits_annotation_chunk_after_timeout(monkeypatch) -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    for table in [User.__table__, Article.__table__, ArticleBlock.__table__, TokenOccurrence.__table__, ProductEvent.__table__]:
        table.create(engine)

    testing_session_local = sessionmaker(bind=engine)
    monkeypatch.setattr(article_processing, "SessionLocal", testing_session_local)
    calls: list[str] = []

    def annotate(text: str) -> list[dict[str, object]]:
        calls.append(text)
        if "\n" in text:
            raise RuntimeError("NLP annotate failed")
        return [
            {
                "surface": text[0],
                "lemma": text[0],
                "reading": text[0],
                "pos": "名詞",
                "start": 0,
                "end": 1,
                "jlpt_level": "N5",
                "frequency_band": "top-5k",
            }
        ]

    monkeypatch.setattr(article_processing.nlp_client, "annotate", annotate)

    with testing_session_local() as db:
        user = User(id=uuid.uuid4(), email="retry@example.com", password_hash="hash")
        article = Article(
            id=uuid.uuid4(),
            user_id=user.id,
            title="retry",
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
        assert article.status == "ready"
        assert article.annotation_status == "ready"
        assert article.annotation_error is None
        assert article.processed_block_count == 2
        assert article.total_block_count == 2
        assert len(db.scalars(select(TokenOccurrence).where(TokenOccurrence.article_id == article_id)).all()) == 2
        assert calls == ["一段目。\n二段目。", "一段目。", "二段目。"]


def test_article_processing_keeps_text_readable_when_annotation_has_no_tokens(monkeypatch) -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    for table in [User.__table__, Article.__table__, ArticleBlock.__table__, TokenOccurrence.__table__, ProductEvent.__table__]:
        table.create(engine)

    testing_session_local = sessionmaker(bind=engine)
    monkeypatch.setattr(article_processing, "SessionLocal", testing_session_local)
    monkeypatch.setattr(article_processing.nlp_client, "annotate", lambda text: [])

    with testing_session_local() as db:
        user = User(id=uuid.uuid4(), email="zero-token@example.com", password_hash="hash")
        article = Article(
            id=uuid.uuid4(),
            user_id=user.id,
            title="zero token",
            source_type="text",
            status="processing",
            raw_content="彼は来る。",
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
        assert article.status == "ready"
        assert article.annotation_status == "ready"
        assert article.annotation_error is None
        assert article.processed_block_count == 1
        assert article.total_block_count == 1

        blocks = db.scalars(select(ArticleBlock).where(ArticleBlock.article_id == article_id)).all()
        tokens = db.scalars(select(TokenOccurrence).where(TokenOccurrence.article_id == article_id)).all()
        assert len(blocks) == 1
        assert tokens == []


def test_add_chunk_tokens_batches_large_insert(monkeypatch) -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    for table in [User.__table__, Article.__table__, ArticleBlock.__table__, TokenOccurrence.__table__]:
        table.create(engine)

    testing_session_local = sessionmaker(bind=engine)
    monkeypatch.setattr(article_processing, "TOKEN_INSERT_BATCH_SIZE", 2)

    with testing_session_local() as db:
        user = User(id=uuid.uuid4(), email="batch@example.com", password_hash="hash")
        article = Article(
            id=uuid.uuid4(),
            user_id=user.id,
            title="batch",
            source_type="text",
            status="processing",
            raw_content="abcde",
            normalized_content="abcde",
        )
        block = ArticleBlock(article_id=article.id, block_index=0, text="abcde")
        db.add(user)
        db.add(article)
        db.add(block)
        db.commit()
        db.refresh(block)

        token_count = article_processing._add_chunk_tokens(
            db,
            article,
            [block],
            [
                {
                    "surface": char,
                    "lemma": char,
                    "reading": char,
                    "pos": "名詞",
                    "start": index,
                    "end": index + 1,
                    "jlpt_level": "N5",
                    "frequency_band": "top-5k",
                }
                for index, char in enumerate("abcde")
            ],
        )
        db.commit()

        tokens = db.scalars(select(TokenOccurrence).where(TokenOccurrence.article_id == article.id)).all()
        assert token_count == 5
        assert len(tokens) == 5


def _memory_session():
    engine = create_engine("sqlite+pysqlite:///:memory:")
    for table in [
        User.__table__,
        Article.__table__,
        ArticleBlock.__table__,
        TokenOccurrence.__table__,
        ProductEvent.__table__,
    ]:
        table.create(engine)
    return sessionmaker(bind=engine)


def _token(surface: str) -> dict[str, object]:
    return {
        "surface": surface,
        "lemma": surface,
        "reading": "",
        "pos": "名詞",
        "start": 0,
        "end": 1,
        "jlpt_level": "N5",
        "frequency_band": "top-5k",
    }


def test_process_article_marks_ready_before_annotation_completes(monkeypatch) -> None:
    testing_session_local = _memory_session()
    monkeypatch.setattr(article_processing, "SessionLocal", testing_session_local)

    observed: dict[str, str] = {}

    def annotate(text: str) -> list[dict[str, object]]:
        with testing_session_local() as inner:
            current = inner.scalar(select(Article).where(Article.id == article_id))
            observed["status"] = current.status
            observed["annotation_status"] = current.annotation_status
        return [_token("彼")]

    monkeypatch.setattr(article_processing.nlp_client, "annotate", annotate)

    with testing_session_local() as db:
        user = User(id=uuid.uuid4(), email="ready-first@example.com", password_hash="hash")
        article = Article(
            id=uuid.uuid4(),
            user_id=user.id,
            title="ready first",
            source_type="text",
            status="processing",
            raw_content="彼は来る。",
            normalized_content=None,
        )
        db.add(user)
        db.add(article)
        db.commit()
        article_id = article.id

    article_processing._process_article(article_id)

    # Text was readable (status=ready) while annotation was still running.
    assert observed["status"] == "ready"
    assert observed["annotation_status"] == "processing"

    with testing_session_local() as db:
        article = db.scalar(select(Article).where(Article.id == article_id))
        assert article.status == "ready"
        assert article.annotation_status == "ready"


def test_annotation_isolates_failing_single_block_and_marks_partial(monkeypatch) -> None:
    testing_session_local = _memory_session()
    monkeypatch.setattr(article_processing, "SessionLocal", testing_session_local)
    monkeypatch.setattr(article_processing, "get_fallback_jlpt_map", lambda: {})

    def annotate(text: str) -> list[dict[str, object]]:
        if "二" in text:
            raise RuntimeError("NLP annotate failed")
        return [_token(text[0])]

    monkeypatch.setattr(article_processing.nlp_client, "annotate", annotate)

    with testing_session_local() as db:
        user = User(id=uuid.uuid4(), email="isolate@example.com", password_hash="hash")
        article = Article(
            id=uuid.uuid4(),
            user_id=user.id,
            title="isolate",
            source_type="text",
            status="processing",
            raw_content="一\n二\n三",
            normalized_content=None,
        )
        db.add(user)
        db.add(article)
        db.commit()
        article_id = article.id

    article_processing._process_article(article_id)

    with testing_session_local() as db:
        article = db.scalar(select(Article).where(Article.id == article_id))
        assert article.status == "ready"
        assert article.annotation_status == "partial"
        assert article.processed_block_count == 3
        assert article.total_block_count == 3

        blocks = db.scalars(
            select(ArticleBlock).where(ArticleBlock.article_id == article_id).order_by(ArticleBlock.block_index.asc())
        ).all()
        assert [block.text for block in blocks] == ["一", "二", "三"]
        token_block_ids = {
            token.block_id
            for token in db.scalars(select(TokenOccurrence).where(TokenOccurrence.article_id == article_id)).all()
        }
        assert blocks[0].id in token_block_ids
        assert blocks[2].id in token_block_ids
        assert blocks[1].id not in token_block_ids  # the failed block kept the text but got no tokens


def test_annotation_all_chunks_fail_marks_failed_but_text_readable(monkeypatch) -> None:
    testing_session_local = _memory_session()
    monkeypatch.setattr(article_processing, "SessionLocal", testing_session_local)
    monkeypatch.setattr(article_processing, "get_fallback_jlpt_map", lambda: {})

    def annotate(text: str) -> list[dict[str, object]]:
        raise RuntimeError("NLP annotate failed")

    monkeypatch.setattr(article_processing.nlp_client, "annotate", annotate)

    with testing_session_local() as db:
        user = User(id=uuid.uuid4(), email="all-fail@example.com", password_hash="hash")
        article = Article(
            id=uuid.uuid4(),
            user_id=user.id,
            title="all fail",
            source_type="text",
            status="processing",
            raw_content="一\n二",
            normalized_content=None,
        )
        db.add(user)
        db.add(article)
        db.commit()
        article_id = article.id

    article_processing._process_article(article_id)

    with testing_session_local() as db:
        article = db.scalar(select(Article).where(Article.id == article_id))
        assert article.status == "ready"  # text stays readable even when annotation is fully down
        assert article.annotation_status == "failed"
        assert article.annotation_error
        blocks = db.scalars(select(ArticleBlock).where(ArticleBlock.article_id == article_id)).all()
        tokens = db.scalars(select(TokenOccurrence).where(TokenOccurrence.article_id == article_id)).all()
        assert len(blocks) == 2
        assert tokens == []


def test_annotation_uses_fallback_when_nlp_down_marks_partial(monkeypatch) -> None:
    testing_session_local = _memory_session()
    monkeypatch.setattr(article_processing, "SessionLocal", testing_session_local)
    monkeypatch.setattr(article_processing, "get_fallback_jlpt_map", lambda: {"来る": "N3"})

    def annotate(text: str) -> list[dict[str, object]]:
        raise RuntimeError("NLP annotate failed")

    monkeypatch.setattr(article_processing.nlp_client, "annotate", annotate)

    with testing_session_local() as db:
        user = User(id=uuid.uuid4(), email="fallback@example.com", password_hash="hash")
        article = Article(
            id=uuid.uuid4(),
            user_id=user.id,
            title="fallback",
            source_type="text",
            status="processing",
            raw_content="彼は来る。",
            normalized_content=None,
        )
        db.add(user)
        db.add(article)
        db.commit()
        article_id = article.id

    article_processing._process_article(article_id)

    with testing_session_local() as db:
        article = db.scalar(select(Article).where(Article.id == article_id))
        assert article.status == "ready"
        assert article.annotation_status == "partial"
        tokens = db.scalars(select(TokenOccurrence).where(TokenOccurrence.article_id == article_id)).all()
        assert len(tokens) == 1
        assert tokens[0].surface == "来る"
        assert tokens[0].jlpt_level == "N3"


def test_annotate_article_resumes_from_processed_block_count(monkeypatch) -> None:
    testing_session_local = _memory_session()
    monkeypatch.setattr(article_processing, "SessionLocal", testing_session_local)

    calls: list[str] = []

    def annotate(text: str) -> list[dict[str, object]]:
        calls.append(text)
        return []

    monkeypatch.setattr(article_processing.nlp_client, "annotate", annotate)

    with testing_session_local() as db:
        user = User(id=uuid.uuid4(), email="resume@example.com", password_hash="hash")
        article = Article(
            id=uuid.uuid4(),
            user_id=user.id,
            title="resume",
            source_type="text",
            status="ready",
            annotation_status="processing",
            raw_content="x",
            normalized_content="x",
            processed_block_count=3,
            total_block_count=5,
        )
        db.add(user)
        db.add(article)
        for index in range(5):
            db.add(ArticleBlock(article_id=article.id, block_index=index, text=f"ブロック{index}"))
        db.commit()
        article_id = article.id

    article_processing.annotate_article(article_id)

    joined = "".join(calls)
    assert "ブロック3" in joined and "ブロック4" in joined
    assert "ブロック0" not in joined and "ブロック1" not in joined and "ブロック2" not in joined

    with testing_session_local() as db:
        article = db.scalar(select(Article).where(Article.id == article_id))
        assert article.annotation_status == "ready"
        assert article.processed_block_count == 5


def test_recovery_claims_stale_annotation_without_double_processing(monkeypatch) -> None:
    testing_session_local = _memory_session()
    monkeypatch.setattr(article_processing, "SessionLocal", testing_session_local)
    stale = datetime(2020, 1, 1, tzinfo=timezone.utc)

    with testing_session_local() as db:
        user = User(id=uuid.uuid4(), email="claim@example.com", password_hash="hash")
        article = Article(
            id=uuid.uuid4(),
            user_id=user.id,
            title="claim",
            source_type="text",
            status="ready",
            annotation_status="processing",
            annotation_updated_at=stale,
            annotation_retry_count=0,
            raw_content="x",
            normalized_content="x",
            processed_block_count=0,
            total_block_count=1,
        )
        db.add(user)
        db.add(article)
        db.commit()
        article_id = article.id

    first = article_processing._claim_annotation(article_id)
    second = article_processing._claim_annotation(article_id)

    assert first is True
    assert second is False  # the fresh heartbeat from the first claim blocks the second

    with testing_session_local() as db:
        article = db.scalar(select(Article).where(Article.id == article_id))
        assert article.annotation_retry_count == 1


def test_recovery_skips_when_retry_cap_reached(monkeypatch) -> None:
    testing_session_local = _memory_session()
    monkeypatch.setattr(article_processing, "SessionLocal", testing_session_local)
    stale = datetime(2020, 1, 1, tzinfo=timezone.utc)

    with testing_session_local() as db:
        user = User(id=uuid.uuid4(), email="cap@example.com", password_hash="hash")
        article = Article(
            id=uuid.uuid4(),
            user_id=user.id,
            title="cap",
            source_type="text",
            status="ready",
            annotation_status="processing",
            annotation_updated_at=stale,
            annotation_retry_count=article_processing.MAX_ANNOTATION_RETRIES,
            raw_content="x",
            normalized_content="x",
            total_block_count=1,
        )
        db.add(user)
        db.add(article)
        db.commit()
        article_id = article.id

    unparsed, stuck = article_processing._load_recoverable_article_ids()

    assert unparsed == []
    assert article_id not in stuck


def test_failed_article_can_be_deleted() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    for table in [
        User.__table__,
        Article.__table__,
        ArticleBlock.__table__,
        TokenOccurrence.__table__,
        Highlight.__table__,
        VocabItem.__table__,
        AIExplanation.__table__,
        ReadingProgress.__table__,
        ProductEvent.__table__,
    ]:
        table.create(engine)

    testing_session_local = sessionmaker(bind=engine)
    with testing_session_local() as db:
        user = User(id=uuid.uuid4(), email="delete@example.com", password_hash="hash")
        article = Article(
            id=uuid.uuid4(),
            user_id=user.id,
            title="failed",
            source_type="epub",
            status="failed",
            raw_content="bad",
            normalized_content=None,
            processing_error="NLP annotate failed",
        )
        db.add(user)
        db.add(article)
        db.add(ProductEvent(user_id=user.id, article_id=article.id, event_name="article_processed", payload={}))
        db.commit()
        article_id = article.id

        response = delete_article(str(article_id), db=db, current_user=user)

        assert response.ok is True
        assert db.scalar(select(Article).where(Article.id == article_id)) is None


def test_create_article_response_omits_heavy_raw_content() -> None:
    from fastapi import BackgroundTasks

    from app.api.routes.articles import create_article
    from app.schemas.article import ArticleCreateRequest

    testing_session_local = _memory_session()
    with testing_session_local() as db:
        user = User(id=uuid.uuid4(), email="create-light@example.com", password_hash="hash")
        db.add(user)
        db.commit()

        background_tasks = BackgroundTasks()
        payload = ArticleCreateRequest(title="light", source_type="text", raw_content="彼は来る。")
        detail = create_article(payload, background_tasks=background_tasks, db=db, current_user=user)

        # The client only needs the id; the multi-MB raw_content must not be echoed back.
        assert detail.raw_content == ""
        assert detail.normalized_content == ""
        assert detail.blocks == []
        assert detail.status == "processing"
        assert detail.annotation_status == "pending"
        assert len(background_tasks.tasks) == 1


def test_process_article_bulk_inserts_all_blocks(monkeypatch) -> None:
    testing_session_local = _memory_session()
    monkeypatch.setattr(article_processing, "SessionLocal", testing_session_local)
    monkeypatch.setattr(article_processing.nlp_client, "annotate", lambda text: [])

    raw = "\n".join(f"第{index}段。" for index in range(50))
    with testing_session_local() as db:
        user = User(id=uuid.uuid4(), email="bulk@example.com", password_hash="hash")
        article = Article(
            id=uuid.uuid4(),
            user_id=user.id,
            title="bulk",
            source_type="text",
            status="processing",
            raw_content=raw,
            normalized_content=None,
        )
        db.add(user)
        db.add(article)
        db.commit()
        article_id = article.id

    article_processing._process_article(article_id)

    with testing_session_local() as db:
        blocks = db.scalars(
            select(ArticleBlock).where(ArticleBlock.article_id == article_id).order_by(ArticleBlock.block_index.asc())
        ).all()
        assert len(blocks) == 50
        assert blocks[0].text == "第0段。"
        assert blocks[49].text == "第49段。"
        assert [block.block_index for block in blocks] == list(range(50))


def test_retry_annotation_endpoint_resets_and_reenqueues() -> None:
    from fastapi import BackgroundTasks

    from app.api.routes.articles import retry_annotation

    testing_session_local = _memory_session()
    with testing_session_local() as db:
        user = User(id=uuid.uuid4(), email="retry-ep@example.com", password_hash="hash")
        article = Article(
            id=uuid.uuid4(),
            user_id=user.id,
            title="retry endpoint",
            source_type="text",
            status="ready",
            annotation_status="failed",
            annotation_error="boom",
            annotation_retry_count=2,
            raw_content="x",
            normalized_content="x",
            processed_block_count=5,
            total_block_count=5,
        )
        db.add(user)
        db.add(article)
        db.commit()
        article_id = article.id

        background_tasks = BackgroundTasks()
        detail = retry_annotation(str(article_id), background_tasks=background_tasks, db=db, current_user=user)

        assert detail.annotation_status == "pending"
        assert len(background_tasks.tasks) == 1

        refreshed = db.scalar(select(Article).where(Article.id == article_id))
        assert refreshed.annotation_status == "pending"
        assert refreshed.annotation_error is None
        assert refreshed.annotation_retry_count == 0
        assert refreshed.processed_block_count == 0


def test_retry_annotation_rejects_when_text_not_ready() -> None:
    from fastapi import BackgroundTasks, HTTPException

    from app.api.routes.articles import retry_annotation

    testing_session_local = _memory_session()
    with testing_session_local() as db:
        user = User(id=uuid.uuid4(), email="retry-409@example.com", password_hash="hash")
        article = Article(
            id=uuid.uuid4(),
            user_id=user.id,
            title="retry 409",
            source_type="epub",
            status="failed",
            raw_content="bad",
            normalized_content=None,
            processing_error="Invalid EPUB zip archive",
        )
        db.add(user)
        db.add(article)
        db.commit()
        article_id = article.id

        try:
            retry_annotation(str(article_id), background_tasks=BackgroundTasks(), db=db, current_user=user)
        except HTTPException as exc:
            assert exc.status_code == 409
        else:
            raise AssertionError("expected 409 when status is not ready")


def test_article_search_finds_matches_across_blocks() -> None:
    from app.api.routes.articles import search_article

    testing_session_local = _memory_session()
    with testing_session_local() as db:
        user = User(id=uuid.uuid4(), email="search@example.com", password_hash="hash")
        article = Article(
            id=uuid.uuid4(),
            user_id=user.id,
            title="search",
            source_type="text",
            status="ready",
            annotation_status="ready",
            raw_content="x",
            normalized_content="x",
            total_block_count=3,
        )
        db.add(user)
        db.add(article)
        db.add(ArticleBlock(article_id=article.id, block_index=0, text="これは最初の段落。"))
        db.add(ArticleBlock(article_id=article.id, block_index=1, text="ここに目的の言葉がある。"))
        db.add(ArticleBlock(article_id=article.id, block_index=2, text="最後の段落。目的をもう一度。"))
        db.commit()
        article_id = article.id

        result = search_article(str(article_id), q="目的", db=db, current_user=user)
        assert [hit.block_index for hit in result.hits] == [1, 2]
        assert all("目的" in hit.snippet for hit in result.hits)
        assert all(hit.count == 1 for hit in result.hits)

        empty = search_article(str(article_id), q="存在しない言葉", db=db, current_user=user)
        assert empty.hits == []
