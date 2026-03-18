from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from redis import Redis
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.deps import get_db_session
from app.core.config import get_settings
from app.schemas.health import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
def health_check(db: Session = Depends(get_db_session)) -> HealthResponse:
    settings = get_settings()

    dependencies = {"database": "ok", "redis": "ok"}

    try:
        db.execute(text("SELECT 1"))
    except Exception:
        dependencies["database"] = "error"

    try:
        Redis.from_url(settings.redis_url).ping()
    except Exception:
        dependencies["redis"] = "error"

    overall_status = "ok" if all(v == "ok" for v in dependencies.values()) else "degraded"

    return HealthResponse(
        service="api",
        status=overall_status,
        version=settings.app_version,
        dependencies=dependencies,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )
