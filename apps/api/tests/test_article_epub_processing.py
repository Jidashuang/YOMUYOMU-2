from __future__ import annotations

import base64
import io
import uuid
import zipfile

from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app.models.entities import Article, ArticleBlock, ProductEvent, TokenOccurrence, User
from app.services import epub_parser
from app.services import article_processing


def _build_minimal_epub_payload() -> str:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, mode="w") as zf:
        zf.writestr(
            "mimetype",
            "application/epub+zip",
            compress_type=zipfile.ZIP_STORED,
        )
        zf.writestr(
            "META-INF/container.xml",
            """<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>
""",
        )
        zf.writestr(
            "OEBPS/content.opf",
            """<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="BookId">
  <manifest>
    <item id="chapter1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
    <item id="chapter2" href="chapter2.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="chapter1"/>
    <itemref idref="chapter2"/>
  </spine>
</package>
""",
        )
        zf.writestr(
            "OEBPS/chapter1.xhtml",
            """<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
  <body>
    <h1>第一章</h1>
    <p>彼は来るはずだったのに。</p>
    <p>今日は雨が降っている。</p>
  </body>
</html>
""",
        )
        zf.writestr(
            "OEBPS/chapter2.xhtml",
            """<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
  <body>
    <h1>第二章</h1>
    <p>彼女は返事を待っていた。</p>
  </body>
</html>
""",
        )

    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f"base64:{encoded}"


def _encode_epub(buffer: io.BytesIO) -> str:
    return "base64:" + base64.b64encode(buffer.getvalue()).decode("ascii")


def _build_empty_epub_payload() -> str:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, mode="w") as zf:
        zf.writestr("mimetype", "application/epub+zip", compress_type=zipfile.ZIP_STORED)
        zf.writestr(
            "META-INF/container.xml",
            """<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>
""",
        )
        zf.writestr(
            "OEBPS/content.opf",
            """<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
  <manifest>
    <item id="chapter1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="chapter1"/>
  </spine>
</package>
""",
        )
        zf.writestr("OEBPS/chapter1.xhtml", "<html><body><script>hidden()</script></body></html>")
    return _encode_epub(buffer)


def test_article_processing_supports_epub_source_type(monkeypatch) -> None:
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
        user = User(id=uuid.uuid4(), email="epub@example.com", password_hash="hash")
        article = Article(
            id=uuid.uuid4(),
            user_id=user.id,
            title="epub test",
            source_type="epub",
            status="processing",
            raw_content=_build_minimal_epub_payload(),
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
        assert article.processing_error is None
        assert article.normalized_content is not None
        assert "彼は来るはずだったのに" in article.normalized_content
        assert article.normalized_content.index("第一章") < article.normalized_content.index("第二章")

        blocks = db.scalars(
            select(ArticleBlock).where(ArticleBlock.article_id == article_id).order_by(ArticleBlock.block_index.asc())
        ).all()
        tokens = db.scalars(select(TokenOccurrence).where(TokenOccurrence.article_id == article_id)).all()
        assert len(blocks) >= 5
        assert blocks[0].text == "第一章"
        assert blocks[-2].text == "第二章"
        assert len(tokens) >= 1
        assert article.processed_block_count == len(blocks)
        assert article.total_block_count == len(blocks)


def test_article_processing_marks_invalid_epub_zip_failed(monkeypatch) -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    for table in [User.__table__, Article.__table__, ArticleBlock.__table__, TokenOccurrence.__table__, ProductEvent.__table__]:
        table.create(engine)

    testing_session_local = sessionmaker(bind=engine)
    monkeypatch.setattr(article_processing, "SessionLocal", testing_session_local)

    with testing_session_local() as db:
        user = User(id=uuid.uuid4(), email="bad-epub@example.com", password_hash="hash")
        article = Article(
            id=uuid.uuid4(),
            user_id=user.id,
            title="bad epub",
            source_type="epub",
            status="processing",
            raw_content="base64:" + base64.b64encode(b"not a zip").decode("ascii"),
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
        assert "Invalid EPUB zip archive" in (article.processing_error or "")
        assert article.processed_block_count == 0
        assert article.total_block_count is None

        blocks = db.scalars(select(ArticleBlock).where(ArticleBlock.article_id == article_id)).all()
        tokens = db.scalars(select(TokenOccurrence).where(TokenOccurrence.article_id == article_id)).all()
        assert blocks == []
        assert tokens == []


def test_article_processing_marks_epub_without_readable_text_failed(monkeypatch) -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    for table in [User.__table__, Article.__table__, ArticleBlock.__table__, TokenOccurrence.__table__, ProductEvent.__table__]:
        table.create(engine)

    testing_session_local = sessionmaker(bind=engine)
    monkeypatch.setattr(article_processing, "SessionLocal", testing_session_local)

    with testing_session_local() as db:
        user = User(id=uuid.uuid4(), email="empty-epub@example.com", password_hash="hash")
        article = Article(
            id=uuid.uuid4(),
            user_id=user.id,
            title="empty epub",
            source_type="epub",
            status="processing",
            raw_content=_build_empty_epub_payload(),
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
        assert "EPUB text extraction produced empty content" in (article.processing_error or "")
        assert article.processed_block_count == 0


def test_epub_payload_size_limit_rejects_oversized_file(monkeypatch) -> None:
    monkeypatch.setattr(epub_parser, "MAX_EPUB_BYTES", 1)

    payload = "base64:" + base64.b64encode(b"ab").decode("ascii")

    try:
        epub_parser.validate_epub_payload_size(payload)
    except ValueError as exc:
        assert "20MB" in str(exc)
    else:
        raise AssertionError("Expected EPUB size validation to fail")
