from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import delete, or_, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db_session
from app.models.entities import User, VocabItem
from app.schemas.vocab import (
    DeleteResponse,
    VocabItemCreateRequest,
    VocabItemResponse,
    VocabReviewRequest,
    VocabStatusUpdateRequest,
)
from app.services.vocab_export import export_vocab_csv, export_vocab_json
from app.services.vocab_service import apply_review_result, apply_status_schedule, create_vocab_item

router = APIRouter(prefix="/vocab", tags=["vocab"])


def _to_response(item: VocabItem) -> VocabItemResponse:
    return VocabItemResponse(
        id=item.id,
        surface=item.surface,
        lemma=item.lemma,
        reading=item.reading or "",
        pos=item.pos,
        meaning_snapshot=item.meaning_snapshot,
        jlpt_level=item.jlpt_level or "Unknown",
        frequency_band=item.frequency_band or "Unknown",
        source_article_id=item.source_article_id,
        source_sentence=item.source_sentence,
        status=item.status or "new",
        next_review_at=item.next_review_at,
        review_count=item.review_count or 0,
        created_at=item.created_at,
    )


@router.post("", response_model=VocabItemResponse, status_code=status.HTTP_201_CREATED)
def create_vocab(
    payload: VocabItemCreateRequest,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> VocabItemResponse:
    return _to_response(create_vocab_item(db, current_user.id, payload))


@router.get("", response_model=list[VocabItemResponse])
def list_vocab(
    bucket: str | None = None,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> list[VocabItemResponse]:
    statement = select(VocabItem).where(VocabItem.user_id == current_user.id)

    if bucket == "today_new":
        now = datetime.now(timezone.utc)
        start_of_day = datetime(
            year=now.year,
            month=now.month,
            day=now.day,
            tzinfo=timezone.utc,
        )
        end_of_day = start_of_day + timedelta(days=1)
        statement = statement.where(
            VocabItem.status == "new",
            VocabItem.created_at >= start_of_day,
            VocabItem.created_at < end_of_day,
        )
    elif bucket == "unmastered":
        statement = statement.where(VocabItem.status.in_(["new", "learning"]))
    elif bucket == "review_due":
        now = datetime.now(timezone.utc)
        statement = statement.where(
            VocabItem.status.in_(["new", "learning"]),
            or_(VocabItem.next_review_at.is_(None), VocabItem.next_review_at <= now),
        )

    rows = db.scalars(statement.order_by(VocabItem.created_at.desc())).all()
    return [_to_response(row) for row in rows]


@router.patch("/{vocab_id}/status", response_model=VocabItemResponse)
def update_vocab_status(
    vocab_id: str,
    payload: VocabStatusUpdateRequest,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> VocabItemResponse:
    try:
        vocab_uuid = UUID(vocab_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vocab item not found") from exc

    row = db.scalar(select(VocabItem).where(VocabItem.id == vocab_uuid, VocabItem.user_id == current_user.id))
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vocab item not found")

    apply_status_schedule(row, payload.status)
    db.commit()
    db.refresh(row)
    return _to_response(row)


@router.patch("/{vocab_id}/review", response_model=VocabItemResponse)
def review_vocab(
    vocab_id: str,
    payload: VocabReviewRequest,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> VocabItemResponse:
    try:
        vocab_uuid = UUID(vocab_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vocab item not found") from exc

    row = db.scalar(select(VocabItem).where(VocabItem.id == vocab_uuid, VocabItem.user_id == current_user.id))
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vocab item not found")

    apply_review_result(row, payload.result)
    db.commit()
    db.refresh(row)
    return _to_response(row)


@router.delete("/{vocab_id}", response_model=DeleteResponse)
def delete_vocab(
    vocab_id: str,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> DeleteResponse:
    try:
        vocab_uuid = UUID(vocab_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vocab item not found") from exc

    row = db.scalar(select(VocabItem).where(VocabItem.id == vocab_uuid, VocabItem.user_id == current_user.id))
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vocab item not found")

    db.execute(delete(VocabItem).where(VocabItem.id == row.id))
    db.commit()
    return DeleteResponse(ok=True)


@router.get("/export.csv")
def export_vocab_as_csv(
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> Response:
    rows = db.scalars(
        select(VocabItem)
        .where(VocabItem.user_id == current_user.id)
        .order_by(VocabItem.created_at.desc())
    ).all()
    csv_content = export_vocab_csv(rows)
    return Response(
        content=csv_content,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="vocab-export.csv"'},
    )


@router.get("/export.json")
def export_vocab_as_json(
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> Response:
    rows = db.scalars(
        select(VocabItem)
        .where(VocabItem.user_id == current_user.id)
        .order_by(VocabItem.created_at.desc())
    ).all()
    json_content = export_vocab_json(rows)
    return Response(
        content=json_content,
        media_type="application/json; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="vocab-export.json"'},
    )
