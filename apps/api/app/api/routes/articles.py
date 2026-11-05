from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db_session
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
from app.schemas.article import (
    ArticleBlockResponse,
    ArticleCreateRequest,
    ArticleDetailResponse,
    ArticleSearchHit,
    ArticleSearchResponse,
    ArticleSummaryResponse,
    ArticleTokenResponse,
    DeleteResponse,
)
from app.services.article_processing import annotate_article, normalize_content, process_article
from app.services.epub_parser import validate_epub_payload_size
from app.services.product_analytics import EVENT_ARTICLE_CREATED, record_product_event

router = APIRouter(prefix="/articles", tags=["articles"])


def _build_article_detail(
    db: Session,
    article: Article,
    *,
    block_offset: int = 0,
    block_limit: int | None = None,
) -> ArticleDetailResponse:
    block_query = (
        select(ArticleBlock)
        .where(ArticleBlock.article_id == article.id)
        .order_by(ArticleBlock.block_index.asc())
        .offset(block_offset)
    )
    if block_limit is not None:
        block_query = block_query.limit(block_limit)
    blocks = db.scalars(block_query).all()

    block_ids = [block.id for block in blocks]
    token_rows = []
    if block_ids:
        token_rows = db.scalars(
            select(TokenOccurrence)
            .where(TokenOccurrence.article_id == article.id, TokenOccurrence.block_id.in_(block_ids))
            .order_by(TokenOccurrence.block_id.asc(), TokenOccurrence.token_index.asc())
        ).all()

    tokens_by_block: dict[str, list[ArticleTokenResponse]] = {}
    for token in token_rows:
        block_key = str(token.block_id)
        tokens_by_block.setdefault(block_key, []).append(
            ArticleTokenResponse(
                surface=token.surface,
                lemma=token.lemma,
                reading=token.reading or "",
                pos=token.pos,
                start_offset=token.start_offset,
                end_offset=token.end_offset,
                jlpt_level=token.jlpt_level or "Unknown",
                frequency_band=token.frequency_band or "Unknown",
            )
        )

    block_responses = [
        ArticleBlockResponse(
            id=block.id,
            block_index=block.block_index,
            text=block.text,
            tokens=tokens_by_block.get(str(block.id), []),
        )
        for block in blocks
    ]

    if block_limit is None:
        raw_content = article.raw_content
        normalized_content = article.normalized_content
        if not normalized_content and article.source_type == "text":
            normalized_content = article.raw_content
    else:
        raw_content = ""
        normalized_content = ""

    return ArticleDetailResponse(
        id=article.id,
        title=article.title,
        source_type=article.source_type,
        status=article.status,
        processing_error=article.processing_error,
        annotation_status=article.annotation_status,
        annotation_error=article.annotation_error,
        created_at=article.created_at,
        processed_block_count=article.processed_block_count,
        total_block_count=article.total_block_count,
        raw_content=raw_content,
        normalized_content=normalized_content or "",
        blocks=block_responses,
    )


@router.post("", response_model=ArticleDetailResponse, status_code=status.HTTP_201_CREATED)
def create_article(
    payload: ArticleCreateRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> ArticleDetailResponse:
    if payload.source_type == "epub":
        try:
            validate_epub_payload_size(payload.raw_content)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    article = Article(
        user_id=current_user.id,
        title=payload.title,
        source_type=payload.source_type,
        status="processing",
        raw_content=payload.raw_content,
        normalized_content=normalize_content(payload.raw_content) if payload.source_type == "text" else None,
        processing_error=None,
        annotation_status="pending",
        annotation_error=None,
        processed_block_count=0,
        total_block_count=None,
    )
    db.add(article)
    record_product_event(
        db,
        user_id=current_user.id,
        article_id=article.id,
        event_name=EVENT_ARTICLE_CREATED,
        payload={"source_type": payload.source_type},
    )
    db.commit()
    db.refresh(article)

    background_tasks.add_task(process_article, article.id)
    # Return a lightweight payload — the client only needs the id to navigate to the reader.
    # Echoing the multi-MB base64 raw_content here is what made EPUB import feel slow.
    detail = _build_article_detail(db, article, block_limit=0)
    db.rollback()
    return detail


@router.get("", response_model=list[ArticleSummaryResponse])
def list_articles(
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> list[ArticleSummaryResponse]:
    rows = db.scalars(
        select(Article)
        .where(Article.user_id == current_user.id)
        .order_by(Article.created_at.desc())
    ).all()
    articles = [
        ArticleSummaryResponse(
            id=row.id,
            title=row.title,
            source_type=row.source_type,
            status=row.status,
            processing_error=row.processing_error,
            annotation_status=row.annotation_status,
            annotation_error=row.annotation_error,
            created_at=row.created_at,
            processed_block_count=row.processed_block_count,
            total_block_count=row.total_block_count,
        )
        for row in rows
    ]
    db.rollback()
    return articles


@router.get("/{article_id}", response_model=ArticleDetailResponse)
def get_article(
    article_id: str,
    block_offset: int = Query(default=0, ge=0),
    block_limit: int | None = Query(default=None, ge=0, le=100),
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> ArticleDetailResponse:
    try:
        article_uuid = UUID(article_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found") from exc

    article = db.scalar(select(Article).where(Article.id == article_uuid, Article.user_id == current_user.id))
    if article is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")
    detail = _build_article_detail(db, article, block_offset=block_offset, block_limit=block_limit)
    db.rollback()
    return detail


@router.get("/{article_id}/search", response_model=ArticleSearchResponse)
def search_article(
    article_id: str,
    q: str = Query(min_length=1, max_length=100),
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> ArticleSearchResponse:
    try:
        article_uuid = UUID(article_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found") from exc

    article = db.scalar(select(Article).where(Article.id == article_uuid, Article.user_id == current_user.id))
    if article is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")

    needle = q.strip()
    if not needle:
        db.rollback()
        return ArticleSearchResponse(hits=[])

    # Escape LIKE wildcards so a literal % / _ in the query isn't treated as a pattern.
    pattern = "%" + needle.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
    rows = db.scalars(
        select(ArticleBlock)
        .where(ArticleBlock.article_id == article.id, ArticleBlock.text.ilike(pattern, escape="\\"))
        .order_by(ArticleBlock.block_index.asc())
        .limit(200)
    ).all()

    lowered = needle.lower()
    hits: list[ArticleSearchHit] = []
    for block in rows:
        text = block.text or ""
        hay = text.lower()
        count = 0
        first = -1
        cursor = 0
        while True:
            idx = hay.find(lowered, cursor)
            if idx == -1:
                break
            if first == -1:
                first = idx
            count += 1
            cursor = idx + len(lowered)
        if count == 0:
            continue
        start = max(0, first - 24)
        end = min(len(text), first + len(needle) + 40)
        snippet = ("…" if start > 0 else "") + text[start:end] + ("…" if end < len(text) else "")
        hits.append(ArticleSearchHit(block_index=block.block_index, snippet=snippet, count=count))

    db.rollback()
    return ArticleSearchResponse(hits=hits)


@router.post("/{article_id}/retry-annotation", response_model=ArticleDetailResponse)
def retry_annotation(
    article_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> ArticleDetailResponse:
    try:
        article_uuid = UUID(article_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found") from exc

    article = db.scalar(select(Article).where(Article.id == article_uuid, Article.user_id == current_user.id))
    if article is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")
    if article.status != "ready":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="文章正文尚未就绪，暂时无法重试标注。",
        )

    # Reset to a clean pending state and re-annotate from the start. annotate_article deletes
    # existing tokens when resuming from 0, so this is idempotent and never duplicates rows.
    article.annotation_status = "pending"
    article.annotation_error = None
    article.annotation_retry_count = 0
    article.annotation_updated_at = datetime.now(timezone.utc)
    article.processed_block_count = 0
    db.commit()
    db.refresh(article)

    background_tasks.add_task(annotate_article, article.id)
    detail = _build_article_detail(db, article)
    db.rollback()
    return detail


@router.delete("/{article_id}", response_model=DeleteResponse)
def delete_article(
    article_id: str,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> DeleteResponse:
    try:
        article_uuid = UUID(article_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found") from exc

    article = db.scalar(select(Article).where(Article.id == article_uuid, Article.user_id == current_user.id))
    if article is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")

    db.execute(
        update(VocabItem)
        .where(VocabItem.user_id == current_user.id, VocabItem.source_article_id == article.id)
        .values(source_article_id=None)
    )
    db.execute(
        update(ProductEvent)
        .where(ProductEvent.user_id == current_user.id, ProductEvent.article_id == article.id)
        .values(article_id=None)
    )
    db.execute(delete(AIExplanation).where(AIExplanation.user_id == current_user.id, AIExplanation.article_id == article.id))
    db.execute(delete(ReadingProgress).where(ReadingProgress.user_id == current_user.id, ReadingProgress.article_id == article.id))
    db.execute(delete(Highlight).where(Highlight.user_id == current_user.id, Highlight.article_id == article.id))
    db.execute(delete(TokenOccurrence).where(TokenOccurrence.article_id == article.id))
    db.execute(delete(ArticleBlock).where(ArticleBlock.article_id == article.id))
    db.execute(delete(Article).where(Article.id == article.id, Article.user_id == current_user.id))
    db.commit()
    return DeleteResponse(ok=True)
