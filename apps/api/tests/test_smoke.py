from __future__ import annotations

from fastapi.testclient import TestClient

from app.core.config import get_settings

get_settings.cache_clear()
from app.main import app  # noqa: E402


def test_api_root_and_health() -> None:
    client = TestClient(app)

    root_response = client.get("/")
    assert root_response.status_code == 200
    assert root_response.json()["message"] == "Yomuyomu API"

    health_response = client.get("/health")
    assert health_response.status_code == 200
    payload = health_response.json()
    assert payload["service"] == "api"
    assert payload["status"] in {"ok", "degraded"}
