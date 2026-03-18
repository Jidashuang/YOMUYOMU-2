from __future__ import annotations

import uuid

from app.services.product_analytics import (
    EVENT_AI_EXPLANATION_REQUESTED,
    EVENT_HIGHLIGHT_CREATED,
    EVENT_TOKEN_LOOKUP,
    EVENT_VOCAB_ADDED,
    compute_business_metrics,
    get_event_counts,
    get_event_counts_by_article,
    get_usage_stats,
    get_usage_stats_in_range,
    record_product_event,
)


class _Result:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return self._rows


class _FakeSession:
    def __init__(self, rows_by_call=None):
        self.rows_by_call = rows_by_call or []
        self._execute_calls = 0
        self.added = []
        self.commit_called = False

    def add(self, row):
        self.added.append(row)

    def commit(self):
        self.commit_called = True

    def execute(self, statement):  # noqa: ARG002
        if self._execute_calls >= len(self.rows_by_call):
            return _Result([])
        rows = self.rows_by_call[self._execute_calls]
        self._execute_calls += 1
        return _Result(rows)


def test_product_event_write() -> None:
    db = _FakeSession()
    user_id = uuid.uuid4()
    article_id = uuid.uuid4()

    row = record_product_event(
        db,
        user_id=user_id,
        article_id=article_id,
        event_name=EVENT_TOKEN_LOOKUP,
        payload={"lemma": "来る"},
        commit=True,
    )

    assert len(db.added) == 1
    assert db.commit_called is True
    assert row.user_id == user_id
    assert row.article_id == article_id
    assert row.event_name == EVENT_TOKEN_LOOKUP


def test_product_stats_aggregation() -> None:
    user_id = uuid.uuid4()
    article_id = uuid.uuid4()
    db = _FakeSession(
        rows_by_call=[
            [
                (EVENT_TOKEN_LOOKUP, 5),
                (EVENT_VOCAB_ADDED, 2),
                (EVENT_HIGHLIGHT_CREATED, 1),
                (EVENT_AI_EXPLANATION_REQUESTED, 3),
            ],
            [
                (article_id, EVENT_TOKEN_LOOKUP, 4),
                (article_id, EVENT_VOCAB_ADDED, 1),
            ],
        ]
    )

    usage, raw_counts = get_usage_stats(db, user_id=user_id)
    by_article = get_event_counts_by_article(db, user_id=user_id)
    metrics = compute_business_metrics(usage=usage, ai_distinct_article_count=2)

    assert raw_counts[EVENT_TOKEN_LOOKUP] == 5
    assert usage.lookup_count == 5
    assert usage.vocab_added_count == 2
    assert usage.highlight_count == 1
    assert usage.ai_explanation_count == 3
    assert metrics.lookup_to_vocab_rate == 0.4
    assert metrics.highlight_to_ai_rate == 3.0
    assert metrics.ai_requests_per_article == 1.5
    assert metrics.ai_requests_per_user == 3.0
    assert by_article[str(article_id)][EVENT_TOKEN_LOOKUP] == 4
    assert by_article[str(article_id)][EVENT_VOCAB_ADDED] == 1


def test_get_event_counts_with_article_filter() -> None:
    user_id = uuid.uuid4()
    article_id = uuid.uuid4()
    db = _FakeSession(rows_by_call=[[(EVENT_TOKEN_LOOKUP, 7)]])

    counts = get_event_counts(db, user_id=user_id, article_id=article_id)
    assert counts[EVENT_TOKEN_LOOKUP] == 7


def test_get_usage_stats_in_range() -> None:
    user_id = uuid.uuid4()
    db = _FakeSession(rows_by_call=[[(EVENT_TOKEN_LOOKUP, 3), (EVENT_VOCAB_ADDED, 1)]])
    usage, raw_counts = get_usage_stats_in_range(db, user_id=user_id)
    assert raw_counts[EVENT_TOKEN_LOOKUP] == 3
    assert usage.lookup_count == 3
    assert usage.vocab_added_count == 1
