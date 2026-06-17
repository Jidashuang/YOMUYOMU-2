from __future__ import annotations

import uuid

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.api.routes.articles import _build_article_detail
from app.models.entities import Article, ArticleBlock, TokenOccurrence, User


def test_article_detail_can_return_one_block_page_without_full_content() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    for table in [User.__table__, Article.__table__, ArticleBlock.__table__, TokenOccurrence.__table__]:
        table.create(engine)

    testing_session_local = sessionmaker(bind=engine)
    with testing_session_local() as db:
        user = User(id=uuid.uuid4(), email="paged@example.com", password_hash="hash")
        article = Article(
            id=uuid.uuid4(),
            user_id=user.id,
            title="paged",
            source_type="epub",
            status="ready",
            raw_content="raw epub payload",
            normalized_content="先頭\n中央\n末尾",
            processed_block_count=3,
            total_block_count=3,
        )
        blocks = [
            ArticleBlock(article_id=article.id, block_index=0, text="先頭"),
            ArticleBlock(article_id=article.id, block_index=1, text="中央"),
            ArticleBlock(article_id=article.id, block_index=2, text="末尾"),
        ]
        db.add(user)
        db.add(article)
        db.add_all(blocks)
        db.flush()
        db.add_all(
            [
                TokenOccurrence(
                    article_id=article.id,
                    block_id=blocks[0].id,
                    token_index=0,
                    surface="先頭",
                    lemma="先頭",
                    reading="セントウ",
                    pos="名詞",
                    start_offset=0,
                    end_offset=2,
                    jlpt_level="N3",
                    frequency_band="top-5k",
                ),
                TokenOccurrence(
                    article_id=article.id,
                    block_id=blocks[1].id,
                    token_index=0,
                    surface="中央",
                    lemma="中央",
                    reading="チュウオウ",
                    pos="名詞",
                    start_offset=0,
                    end_offset=2,
                    jlpt_level="N2",
                    frequency_band="top-10k",
                ),
                TokenOccurrence(
                    article_id=article.id,
                    block_id=blocks[2].id,
                    token_index=0,
                    surface="末尾",
                    lemma="末尾",
                    reading="マツビ",
                    pos="名詞",
                    start_offset=0,
                    end_offset=2,
                    jlpt_level="N1",
                    frequency_band="outside-10k",
                ),
            ]
        )
        db.commit()
        db.refresh(article)

        detail = _build_article_detail(db, article, block_offset=1, block_limit=1)

    assert detail.raw_content == ""
    assert detail.normalized_content == ""
    assert detail.total_block_count == 3
    assert [block.block_index for block in detail.blocks] == [1]
    assert [token.surface for token in detail.blocks[0].tokens] == ["中央"]
