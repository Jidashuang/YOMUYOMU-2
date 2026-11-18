from __future__ import annotations

import logging

from fastapi import HTTPException, Request, status
from redis.exceptions import RedisError

from app.core.cache import get_redis_client

logger = logging.getLogger(__name__)


def client_ip(request: Request) -> str:
    # 线上所有请求都经过 Caddy，它会把真实访客 IP 写进 X-Forwarded-For；
    # API 端口不对外开放，所以这个头可以信任。本地直连时没有这个头，用连接地址。
    forwarded = request.headers.get("x-forwarded-for", "")
    first = forwarded.split(",")[0].strip()
    if first:
        return first
    return request.client.host if request.client else "unknown"


def enforce_rate_limit(key: str, *, limit: int, window_seconds: int, message: str) -> None:
    """同一个 key 在 window_seconds 内超过 limit 次就返回 429。

    Redis 出故障时放行并记日志：宁可暂时不限流，也不要让所有人都登录不了。
    """
    redis_key = f"ratelimit:{key}"
    try:
        client = get_redis_client()
        count = client.incr(redis_key)
        if count == 1:
            client.expire(redis_key, window_seconds)
    except RedisError:
        logger.warning("rate limit skipped, redis unavailable key=%s", key, exc_info=True)
        return

    if count > limit:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=message)
