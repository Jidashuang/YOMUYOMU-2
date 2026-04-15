from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_JWT_SECRET = "change-me-in-production"
MIN_JWT_SECRET_LENGTH = 32


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Yomuyomu API"
    app_version: str = "0.1.0"
    api_cors_origins: str = ",".join(
        [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:3001",
            "http://127.0.0.1:3001",
            "http://localhost:3100",
            "http://127.0.0.1:3100",
            "http://localhost:3104",
            "http://127.0.0.1:3104",
            "http://localhost:3105",
            "http://127.0.0.1:3105",
        ]
    )

    database_url: str
    redis_url: str
    nlp_service_url: str = "http://localhost:8001"

    jwt_secret: str
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 30
    auth_cookie_name: str = "yomuyomu_session"
    auth_cookie_secure: bool = True
    auth_cookie_samesite: Literal["lax", "strict", "none"] = "none"
    auth_rate_limit_window_seconds: int = 300
    auth_rate_limit_max_attempts_per_ip: int = 50
    auth_rate_limit_max_attempts_per_identity: int = 5
    article_text_max_chars: int = 200_000
    article_epub_max_chars: int = 3_000_000
    article_epub_max_archive_bytes: int = 2_000_000
    article_epub_max_entry_bytes: int = 500_000
    article_epub_max_file_count: int = 200

    llm_provider: str = "openai"
    openai_api_key: str | None = None
    openai_model: str = "gpt-4.1-mini"
    openai_timeout_seconds: float = 30.0
    openai_max_retries: int = 2
    ai_prompt_version: str = "v2"
    ai_cache_ttl_seconds: int = 86400
    free_ai_explanations_monthly_limit: int = 20
    pro_ai_explanations_monthly_limit: int = 200
    web_base_url: str = "http://127.0.0.1:3104"
    stripe_secret_key: str | None = None
    stripe_webhook_secret: str | None = None
    stripe_pro_price_id: str | None = None

    @field_validator("api_cors_origins")
    @classmethod
    def normalize_origins(cls, value: str) -> str:
        return ",".join([item.strip() for item in value.split(",") if item.strip()])

    @field_validator("jwt_secret")
    @classmethod
    def validate_jwt_secret(cls, value: str) -> str:
        secret = value.strip()
        if secret == DEFAULT_JWT_SECRET:
            raise ValueError("JWT_SECRET must not use the default placeholder value")
        if len(secret) < MIN_JWT_SECRET_LENGTH:
            raise ValueError(f"JWT_SECRET must be at least {MIN_JWT_SECRET_LENGTH} characters long")
        return secret

    @model_validator(mode="after")
    def validate_cookie_policy(self) -> "Settings":
        if self.auth_cookie_samesite == "none" and not self.auth_cookie_secure:
            raise ValueError("AUTH_COOKIE_SECURE must be true when AUTH_COOKIE_SAMESITE=none")
        return self

    @property
    def cors_origins_list(self) -> list[str]:
        return [item.strip() for item in self.api_cors_origins.split(",") if item.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
