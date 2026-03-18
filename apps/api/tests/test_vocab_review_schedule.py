from __future__ import annotations

import uuid
from datetime import datetime, timezone

from app.models.entities import VocabItem
from app.services.vocab_service import apply_review_result, apply_status_schedule


def _build_item(status: str = "new") -> VocabItem:
    return VocabItem(
        id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        surface="来る",
        lemma="来る",
        reading="くる",
        pos="verb",
        meaning_snapshot={"meanings": ["to come"]},
        jlpt_level="N5",
        frequency_band="top-1k",
        status=status,
        review_count=0,
    )


def test_review_pass_promotes_to_known_after_multiple_successes() -> None:
    now = datetime(2026, 3, 18, tzinfo=timezone.utc)
    item = _build_item(status="new")

    apply_review_result(item, "pass", now=now)
    assert item.status == "learning"
    assert item.review_count == 1
    assert item.next_review_at is not None

    apply_review_result(item, "pass", now=now)
    apply_review_result(item, "pass", now=now)
    apply_review_result(item, "pass", now=now)
    assert item.status == "known"
    assert item.review_count == 4
    assert item.next_review_at is None


def test_review_fail_resets_to_learning_and_near_term_retry() -> None:
    now = datetime(2026, 3, 18, 8, 0, tzinfo=timezone.utc)
    item = _build_item(status="learning")
    item.review_count = 2

    apply_review_result(item, "fail", now=now)
    assert item.status == "learning"
    assert item.review_count == 0
    assert item.next_review_at == datetime(2026, 3, 18, 20, 0, tzinfo=timezone.utc)


def test_status_schedule_new_is_due_immediately() -> None:
    now = datetime(2026, 3, 18, tzinfo=timezone.utc)
    item = _build_item(status="known")
    item.review_count = 3

    apply_status_schedule(item, "new", now=now)
    assert item.status == "new"
    assert item.review_count == 0
    assert item.next_review_at == now
