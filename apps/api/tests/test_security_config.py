from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.core.config import Settings


def test_settings_reject_default_jwt_secret() -> None:
    with pytest.raises(ValidationError, match="JWT_SECRET"):
        Settings(
            database_url="sqlite+pysqlite:///:memory:",
            redis_url="redis://localhost:6379/0",
            jwt_secret="change-me-in-production",
        )


def test_settings_default_cookie_policy_supports_cross_origin_browser_sessions() -> None:
    settings = Settings(
        database_url="sqlite+pysqlite:///:memory:",
        redis_url="redis://localhost:6379/0",
        jwt_secret="test-secret-value-with-minimum-32-bytes",
    )

    assert settings.auth_cookie_secure is True
    assert settings.auth_cookie_samesite == "none"


def test_settings_default_cors_origins_include_readme_local_web_port() -> None:
    settings = Settings(
        database_url="sqlite+pysqlite:///:memory:",
        redis_url="redis://localhost:6379/0",
        jwt_secret="test-secret-value-with-minimum-32-bytes",
    )

    assert "http://localhost:3001" in settings.cors_origins_list
    assert "http://127.0.0.1:3001" in settings.cors_origins_list


def test_settings_require_secure_cookie_when_samesite_none() -> None:
    with pytest.raises(ValidationError, match="AUTH_COOKIE_SECURE"):
        Settings(
            database_url="sqlite+pysqlite:///:memory:",
            redis_url="redis://localhost:6379/0",
            jwt_secret="test-secret-value-with-minimum-32-bytes",
            auth_cookie_secure=False,
            auth_cookie_samesite="none",
        )
