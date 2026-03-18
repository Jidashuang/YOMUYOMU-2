from __future__ import annotations

import logging
from time import perf_counter
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db_session
from app.core.config import get_settings
from app.models.entities import AIExplanation, Article, Highlight, User
from app.schemas.ai_explanation import (
    AIExplanationCreateRequest,
    AIExplanationHistoryItem,
    AIExplanationResponse,
    DictionaryHintItem,
    SuggestedVocabItem,
    TokenizedResultItem,
)
from app.services.ai_explanation_service import (
    build_cache_key,
    extract_suggested_vocab,
    get_cache_stats,
    generate_explanation,
    load_cached_explanation,
    prepare_preprocessed_inputs,
    record_cache_lookup,
    save_cached_explanation,
)
from app.services.product_analytics import (
    EVENT_AI_EXPLANATION_FAILED,
    EVENT_AI_EXPLANATION_REQUESTED,
    EVENT_AI_EXPLANATION_SUCCEEDED,
    record_product_event,
)

router = APIRouter(prefix="/ai-explanations", tags=["ai-explanations"])
logger = logging.getLogger(__name__)


def _validate_article_access(db: Session, article_id: UUID, user_id: UUID) -> Article:
    article = db.scalar(select(Article).where(Article.id == article_id, Article.user_id == user_id))
    if article is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")
    return article


def _validate_highlight_access(db: Session, highlight_id: UUID, article_id: UUID, user_id: UUID) -> Highlight:
    highlight = db.scalar(
        select(Highlight).where(
            Highlight.id == highlight_id,
            Highlight.article_id == article_id,
            Highlight.user_id == user_id,
        )
    )
    if highlight is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Highlight not found")
    return highlight


@router.post("", response_model=AIExplanationResponse, status_code=status.HTTP_201_CREATED)
def create_ai_explanation(
    payload: AIExplanationCreateRequest,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> AIExplanationResponse:
    started_at = perf_counter()
    _validate_article_access(db, payload.article_id, current_user.id)

    if payload.highlight_id:
        _validate_highlight_access(db, payload.highlight_id, payload.article_id, current_user.id)

    record_product_event(
        db,
        user_id=current_user.id,
        article_id=payload.article_id,
        event_name=EVENT_AI_EXPLANATION_REQUESTED,
        payload={"highlight_id": str(payload.highlight_id) if payload.highlight_id else None},
        commit=True,
    )

    tokenized_result, dictionary_hints = prepare_preprocessed_inputs(payload.sentence)

    cache_key = build_cache_key(
        sentence=payload.sentence,
        previous_sentence=payload.previous_sentence,
        next_sentence=payload.next_sentence,
        user_level=payload.user_level,
        prompt_version=get_settings().ai_prompt_version,
    )

    cached = load_cached_explanation(cache_key)
    from_cache = cached is not None
    record_cache_lookup(from_cache)
    if cached:
        response_json, meta = cached
    else:
        response_json, meta = generate_explanation(
            sentence=payload.sentence,
            previous_sentence=payload.previous_sentence,
            next_sentence=payload.next_sentence,
            user_level=payload.user_level,
            tokenized_result=tokenized_result,
            dictionary_hints=dictionary_hints,
        )
        save_cached_explanation(cache_key, response_json, meta)

    suggested_vocab_payload = meta.get("suggested_vocab")
    if not isinstance(suggested_vocab_payload, list):
        suggested_vocab_payload = extract_suggested_vocab(
            tokenized_result=tokenized_result,
            dictionary_hints=dictionary_hints,
        )

    row = AIExplanation(
        user_id=current_user.id,
        article_id=payload.article_id,
        highlight_id=payload.highlight_id,
        sentence=payload.sentence,
        response_json=response_json,
        model=meta["model"],
        provider=meta["provider"],
        prompt_version=meta["prompt_version"],
        error_type=meta.get("error_type"),
        provider_latency_ms=meta.get("provider_latency_ms"),
        prompt_tokens=meta.get("prompt_tokens"),
        completion_tokens=meta.get("completion_tokens"),
        total_tokens=meta.get("total_tokens"),
        from_cache=from_cache,
    )
    db.add(row)
    status_event_name = EVENT_AI_EXPLANATION_FAILED if (meta.get("error_type")) else EVENT_AI_EXPLANATION_SUCCEEDED
    record_product_event(
        db,
        user_id=current_user.id,
        article_id=payload.article_id,
        event_name=status_event_name,
        payload={
            "provider": meta["provider"],
            "model": meta["model"],
            "prompt_version": meta["prompt_version"],
            "error_type": meta.get("error_type"),
            "from_cache": from_cache,
            "provider_latency_ms": meta.get("provider_latency_ms"),
            "prompt_tokens": meta.get("prompt_tokens"),
            "completion_tokens": meta.get("completion_tokens"),
            "total_tokens": meta.get("total_tokens"),
        },
    )
    db.commit()
    db.refresh(row)

    response = AIExplanationResponse(
        id=row.id,
        article_id=row.article_id,
        highlight_id=row.highlight_id,
        sentence=row.sentence,
        model=row.model,
        provider=row.provider,
        prompt_version=row.prompt_version,
        error_type=row.error_type,
        provider_latency_ms=row.provider_latency_ms,
        prompt_tokens=row.prompt_tokens,
        completion_tokens=row.completion_tokens,
        total_tokens=row.total_tokens,
        from_cache=row.from_cache,
        response_json=row.response_json,
        tokenized_result=[TokenizedResultItem.model_validate(item) for item in tokenized_result],
        dictionary_hints=[DictionaryHintItem.model_validate(item) for item in dictionary_hints],
        suggested_vocab=[SuggestedVocabItem.model_validate(item) for item in suggested_vocab_payload],
        created_at=row.created_at,
    )
    cache_stats = get_cache_stats()
    latency_ms = (perf_counter() - started_at) * 1000
    logger.info(
        "ai_explanation user_id=%s article_id=%s from_cache=%s provider=%s model=%s prompt_version=%s error_type=%s latency_ms=%.2f cache_hit_rate=%.3f",
        current_user.id,
        payload.article_id,
        from_cache,
        response.provider,
        response.model,
        response.prompt_version,
        response.error_type or "",
        latency_ms,
        cache_stats["hit_rate"],
    )
    return response


@router.get("", response_model=list[AIExplanationHistoryItem])
def list_ai_explanations(
    article_id: str | None = None,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> list[AIExplanationHistoryItem]:
    statement = select(AIExplanation).where(AIExplanation.user_id == current_user.id)

    if article_id:
        try:
            article_uuid = UUID(article_id)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid article_id") from exc
        statement = statement.where(AIExplanation.article_id == article_uuid)

    rows = db.scalars(statement.order_by(AIExplanation.created_at.desc()).limit(100)).all()
    return [
        AIExplanationHistoryItem(
            id=row.id,
            article_id=row.article_id,
            highlight_id=row.highlight_id,
            sentence=row.sentence,
            model=row.model,
            provider=row.provider,
            prompt_version=row.prompt_version,
            error_type=row.error_type,
            provider_latency_ms=row.provider_latency_ms,
            prompt_tokens=row.prompt_tokens,
            completion_tokens=row.completion_tokens,
            total_tokens=row.total_tokens,
            from_cache=row.from_cache,
            response_json=row.response_json,
            suggested_vocab=[],
            created_at=row.created_at,
        )
        for row in rows
    ]
