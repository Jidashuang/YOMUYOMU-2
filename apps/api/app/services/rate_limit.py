from __future__ import annotations

import time
from collections import deque
from threading import Lock

from app.core.cache import get_redis_client

_memory_buckets: dict[str, deque[float]] = {}
_memory_lock = Lock()


def _memory_hit(key: str, limit: int, window_seconds: int) -> bool:
    now = time.time()
    with _memory_lock:
        bucket = _memory_buckets.setdefault(key, deque())
        while bucket and bucket[0] <= now - window_seconds:
            bucket.popleft()
        bucket.append(now)
        return len(bucket) > limit


def is_rate_limited(namespace: str, key: str, limit: int, window_seconds: int) -> bool:
    scoped_key = f"ratelimit:{namespace}:{key}"
    try:
        redis_client = get_redis_client()
        count = redis_client.incr(scoped_key)
        if count == 1:
            redis_client.expire(scoped_key, window_seconds)
        return int(count) > limit
    except Exception:  # noqa: BLE001
        return _memory_hit(scoped_key, limit, window_seconds)


def clear_rate_limit(namespace: str, key: str) -> None:
    scoped_key = f"ratelimit:{namespace}:{key}"
    try:
        get_redis_client().delete(scoped_key)
        return
    except Exception:  # noqa: BLE001
        pass

    with _memory_lock:
        _memory_buckets.pop(scoped_key, None)
