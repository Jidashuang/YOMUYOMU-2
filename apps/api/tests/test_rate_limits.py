from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from fastapi import HTTPException
from redis.exceptions import ConnectionError as RedisConnectionError
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.api.routes.ai_explanations import _enforce_daily_quota
from app.core import rate_limit
from app.models.entities import AIExplanation


class FakeRedis:
    def __init__(self) -> None:
        self.counts: dict[str, int] = {}
        self.ttls: dict[str, int] = {}

    def incr(self, key: str) -> int:
        self.counts[key] = self.counts.get(key, 0) + 1
        return self.counts[key]

    def expire(self, key: str, seconds: int) -> None:
        self.ttls[key] = seconds


class BrokenRedis:
    def incr(self, key: str) -> int:
        raise RedisConnectionError("down")


def test_rate_limit_blocks_after_limit(monkeypatch: pytest.MonkeyPatch) -> None:
    fake = FakeRedis()
    monkeypatch.setattr(rate_limit, "get_redis_client", lambda: fake)

    for _ in range(3):
        rate_limit.enforce_rate_limit("login:ip:1.2.3.4", limit=3, window_seconds=900, message="太多了")

    with pytest.raises(HTTPException) as excinfo:
        rate_limit.enforce_rate_limit("login:ip:1.2.3.4", limit=3, window_seconds=900, message="太多了")
    assert excinfo.value.status_code == 429
    assert excinfo.value.detail == "太多了"
    assert fake.ttls["ratelimit:login:ip:1.2.3.4"] == 900

    # 另一个 key 不受影响
    rate_limit.enforce_rate_limit("login:ip:5.6.7.8", limit=3, window_seconds=900, message="太多了")


def test_rate_limit_allows_when_redis_is_down(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(rate_limit, "get_redis_client", lambda: BrokenRedis())
    rate_limit.enforce_rate_limit("login:ip:1.2.3.4", limit=1, window_seconds=60, message="x")
    rate_limit.enforce_rate_limit("login:ip:1.2.3.4", limit=1, window_seconds=60, message="x")


def _explanation(user_id, *, from_cache: bool, created_at: datetime) -> AIExplanation:
    return AIExplanation(
        user_id=user_id,
        article_id=uuid4(),
        sentence="猫が好きだ。",
        response_json={},
        model="m",
        provider="p",
        prompt_version="v",
        from_cache=from_cache,
        created_at=created_at,
    )


def test_daily_quota_counts_only_fresh_generations_in_last_24h() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    AIExplanation.__table__.create(engine)
    user_id = uuid4()
    now = datetime.now(timezone.utc)

    with Session(engine) as db:
        db.add_all(
            [
                _explanation(user_id, from_cache=False, created_at=now - timedelta(hours=1)),
                _explanation(user_id, from_cache=False, created_at=now - timedelta(hours=2)),
                # 以下三条都不该占额度：命中缓存、超过 24 小时、别人的
                _explanation(user_id, from_cache=True, created_at=now - timedelta(hours=1)),
                _explanation(user_id, from_cache=False, created_at=now - timedelta(hours=30)),
                _explanation(uuid4(), from_cache=False, created_at=now - timedelta(hours=1)),
            ]
        )
        db.commit()

        _enforce_daily_quota(db, user_id, 3)  # 用了 2 次，上限 3：放行

        with pytest.raises(HTTPException) as excinfo:
            _enforce_daily_quota(db, user_id, 2)  # 用了 2 次，上限 2：拦住
        assert excinfo.value.status_code == 429
