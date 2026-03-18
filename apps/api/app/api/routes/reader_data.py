from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db_session
from app.models.entities import Article, ArticleBlock, Highlight, ReadingProgress, User
from app.schemas.reader_data import (
    HighlightCreateRequest,
    HighlightNoteUpdateRequest,
    HighlightResponse,
    ReaderLookupEntry,
    ReaderLookupRequest,
    ReaderLookupResponse,
    ReadingProgressResponse,
    ReadingProgressUpsertRequest,
)
from app.schemas.vocab import VocabItemCreateRequest, VocabItemResponse
from app.services.nlp_client import nlp_client
from app.services.product_analytics import (
    EVENT_HIGHLIGHT_CREATED,
    EVENT_TOKEN_LOOKUP,
    record_product_event,
)
from app.services.vocab_service import create_vocab_item

router = APIRouter(prefix="/reader-data", tags=["reader-data"])


def _highlight_to_response(row: Highlight) -> HighlightResponse:
    return HighlightResponse(
        id=row.id,
        article_id=row.article_id,
        block_id=row.block_id,
        start_offset_in_block=row.start_offset_in_block,
        end_offset_in_block=row.end_offset_in_block,
        text_quote=row.text_quote,
        note=row.note,
        created_at=row.created_at,
    )


def _progress_to_response(row: ReadingProgress) -> ReadingProgressResponse:
    return ReadingProgressResponse(
        id=row.id,
        article_id=row.article_id,
        progress_percent=row.progress_percent,
        last_position=row.last_position,
        updated_at=row.updated_at,
    )


def _vocab_to_response(row) -> VocabItemResponse:
    return VocabItemResponse(
        id=row.id,
        surface=row.surface,
        lemma=row.lemma,
        reading=row.reading or "",
        pos=row.pos,
        meaning_snapshot=row.meaning_snapshot,
        jlpt_level=row.jlpt_level or "Unknown",
        frequency_band=row.frequency_band or "Unknown",
        source_article_id=row.source_article_id,
        source_sentence=row.source_sentence,
        status=row.status or "new",
        created_at=row.created_at,
    )


@router.post("/highlights", response_model=HighlightResponse, status_code=status.HTTP_201_CREATED)
def create_highlight(
    payload: HighlightCreateRequest,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> HighlightResponse:
    article = db.scalar(select(Article).where(Article.id == payload.article_id, Article.user_id == current_user.id))
    if article is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")
    block = db.scalar(
        select(ArticleBlock).where(
            ArticleBlock.id == payload.block_id,
            ArticleBlock.article_id == payload.article_id,
        )
    )
    if block is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Block not found")
    if payload.start_offset_in_block >= payload.end_offset_in_block:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid highlight offsets")
    if payload.end_offset_in_block > len(block.text):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Highlight exceeds block length")

    row = Highlight(
        user_id=current_user.id,
        article_id=payload.article_id,
        block_id=payload.block_id,
        start_offset_in_block=payload.start_offset_in_block,
        end_offset_in_block=payload.end_offset_in_block,
        text_quote=payload.text_quote,
        note=payload.note,
    )
    db.add(row)
    record_product_event(
        db,
        user_id=current_user.id,
        article_id=payload.article_id,
        event_name=EVENT_HIGHLIGHT_CREATED,
        payload={"block_id": str(payload.block_id)},
    )
    db.commit()
    db.refresh(row)
    return _highlight_to_response(row)


@router.get("/highlights", response_model=list[HighlightResponse])
def list_highlights(
    article_id: str | None = None,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> list[HighlightResponse]:
    statement = select(Highlight).where(Highlight.user_id == current_user.id)
    if article_id:
        try:
            article_uuid = UUID(article_id)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid article_id") from exc
        statement = statement.where(Highlight.article_id == article_uuid)

    rows = db.scalars(statement.order_by(Highlight.created_at.desc())).all()
    return [_highlight_to_response(row) for row in rows]


@router.patch("/highlights/{highlight_id}/note", response_model=HighlightResponse)
def update_highlight_note(
    highlight_id: str,
    payload: HighlightNoteUpdateRequest,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> HighlightResponse:
    try:
        highlight_uuid = UUID(highlight_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Highlight not found") from exc

    row = db.scalar(select(Highlight).where(Highlight.id == highlight_uuid, Highlight.user_id == current_user.id))
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Highlight not found")

    row.note = payload.note
    db.commit()
    db.refresh(row)
    return _highlight_to_response(row)


@router.post("/progress", response_model=ReadingProgressResponse)
def upsert_progress(
    payload: ReadingProgressUpsertRequest,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> ReadingProgressResponse:
    article = db.scalar(select(Article).where(Article.id == payload.article_id, Article.user_id == current_user.id))
    if article is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")

    row = db.scalar(
        select(ReadingProgress).where(
            ReadingProgress.user_id == current_user.id,
            ReadingProgress.article_id == payload.article_id,
        )
    )
    if row is None:
        row = ReadingProgress(
            user_id=current_user.id,
            article_id=payload.article_id,
            progress_percent=payload.progress_percent,
            last_position=payload.last_position,
        )
        db.add(row)
    else:
        row.progress_percent = payload.progress_percent
        row.last_position = payload.last_position

    db.commit()
    db.refresh(row)
    return _progress_to_response(row)


@router.get("/progress/{article_id}", response_model=ReadingProgressResponse | None)
def get_progress(
    article_id: str,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> ReadingProgressResponse | None:
    try:
        article_uuid = UUID(article_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Progress not found") from exc

    row = db.scalar(
        select(ReadingProgress).where(
            ReadingProgress.user_id == current_user.id,
            ReadingProgress.article_id == article_uuid,
        )
    )
    if row is None:
        return None
    return _progress_to_response(row)


@router.post("/vocab", response_model=VocabItemResponse, status_code=status.HTTP_201_CREATED)
def save_vocab_from_reader(
    payload: VocabItemCreateRequest,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> VocabItemResponse:
    row = create_vocab_item(db, current_user.id, payload)
    return _vocab_to_response(row)


@router.post("/lookup", response_model=ReaderLookupResponse)
def lookup_from_reader(
    payload: ReaderLookupRequest,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> ReaderLookupResponse:
    article = db.scalar(select(Article).where(Article.id == payload.article_id, Article.user_id == current_user.id))
    if article is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")

    entries = nlp_client.lookup(
        surface=payload.surface,
        lemma=payload.lemma,
        reading=payload.reading or "",
        context=payload.context or "",
    )
    parsed_entries = [ReaderLookupEntry.model_validate(item) for item in entries]

    record_product_event(
        db,
        user_id=current_user.id,
        article_id=payload.article_id,
        event_name=EVENT_TOKEN_LOOKUP,
        payload={
            "surface": payload.surface,
            "lemma": payload.lemma,
        },
    )
    db.commit()
    return ReaderLookupResponse(entries=parsed_entries)
