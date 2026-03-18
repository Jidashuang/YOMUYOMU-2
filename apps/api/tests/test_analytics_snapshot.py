from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.entities import Article, ProductEvent, User
from app.services.analytics_snapshot import build_daily_snapshot
from app.services.product_analytics import (
    EVENT_AI_EXPLANATION_REQUESTED,
    EVENT_HIGHLIGHT_CREATED,
    EVENT_TOKEN_LOOKUP,
    EVENT_VOCAB_ADDED,
)


def test_build_daily_snapshot() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    for table in [User.__table__, Article.__table__, ProductEvent.__table__]:
        table.create(engine)

    SessionLocal = sessionmaker(bind=engine)

    target_date = date(2026, 3, 17)
    target_dt = datetime(2026, 3, 17, 8, 0, tzinfo=timezone.utc)
    prev_dt = target_dt - timedelta(days=1)

    user_id = uuid.uuid4()
    article_id = uuid.uuid4()

    with SessionLocal() as db:
        db.add(User(id=user_id, email="snapshot@example.com", password_hash="hash"))
        db.add(
            Article(
                id=article_id,
                user_id=user_id,
                title="a",
                source_type="text",
                status="ready",
                raw_content="x",
                normalized_content="x",
            )
        )
        db.add_all(
            [
                ProductEvent(
                    user_id=user_id,
                    article_id=article_id,
                    event_name=EVENT_TOKEN_LOOKUP,
                    payload=None,
                    created_at=target_dt,
                ),
                ProductEvent(
                    user_id=user_id,
                    article_id=article_id,
                    event_name=EVENT_TOKEN_LOOKUP,
                    payload=None,
                    created_at=target_dt,
                ),
                ProductEvent(
                    user_id=user_id,
                    article_id=article_id,
                    event_name=EVENT_VOCAB_ADDED,
                    payload=None,
                    created_at=target_dt,
                ),
                ProductEvent(
                    user_id=user_id,
                    article_id=article_id,
                    event_name=EVENT_HIGHLIGHT_CREATED,
                    payload=None,
                    created_at=target_dt,
                ),
                ProductEvent(
                    user_id=user_id,
                    article_id=article_id,
                    event_name=EVENT_AI_EXPLANATION_REQUESTED,
                    payload=None,
                    created_at=target_dt,
                ),
                ProductEvent(
                    user_id=user_id,
                    article_id=article_id,
                    event_name=EVENT_TOKEN_LOOKUP,
                    payload=None,
                    created_at=prev_dt,
                ),
            ]
        )
        db.commit()

        snapshot = build_daily_snapshot(db, snapshot_date=target_date)

    totals = snapshot["totals"]
    assert totals["event_counts"][EVENT_TOKEN_LOOKUP] == 2
    assert totals["usage_counts"]["lookup_count"] == 2
    assert totals["usage_counts"]["vocab_added_count"] == 1
    assert totals["usage_counts"]["highlight_count"] == 1
    assert totals["usage_counts"]["ai_explanation_count"] == 1
    assert totals["metrics"]["lookup_to_vocab_rate"] == 0.5
    assert totals["metrics"]["highlight_to_ai_rate"] == 1.0
    assert totals["metrics"]["ai_requests_per_article"] == 1.0

    assert len(snapshot["users"]) == 1
    assert snapshot["users"][0]["user_id"] == str(user_id)
