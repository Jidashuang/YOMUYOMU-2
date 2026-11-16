from __future__ import annotations

from functools import lru_cache
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Yomuyomu API"
    app_version: str = "0.1.0"
    api_cors_origins: str = "http://localhost:3000"

    database_url: str
    redis_url: str
    nlp_service_url: str = "http://localhost:8001"

    # Path to a bundled JLPT wordlist used for degraded fallback annotation when the NLP
    # service is unavailable. Empty → use the copy packaged at app/data/jlpt_map.csv.
    fallback_jlpt_map_path: str | None = None

    jwt_secret: str
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7

    llm_provider: str = "gemini"
    openai_api_key: str | None = None
    openai_model: str = "gpt-4.1-mini"
    openai_timeout_seconds: float = 30.0
    openai_max_retries: int = 2
    gemini_project_id: str | None = None
    gemini_location: str = "global"
    gemini_model: str = "google/gemini-3.5-flash"
    ai_prompt_version: str = "v2"
    ai_cache_ttl_seconds: int = 86400

    # 防刷与成本保护。数字都可以用同名环境变量覆盖（如 AI_DAILY_LIMIT=50）。
    ai_daily_limit: int = 30  # 每个账号 24 小时内可新生成的 AI 解释次数（命中缓存不计）
    ai_per_minute_limit: int = 10
    lookup_per_minute_limit: int = 120
    login_per_15min_limit: int = 10
    register_per_hour_limit: int = 5
    article_create_per_hour_limit: int = 30
    max_text_chars: int = 1_000_000  # 粘贴文本上限；书架里最长的《こころ》约 48 万字

    @field_validator("api_cors_origins")
    @classmethod
    def normalize_origins(cls, value: str) -> str:
        return ",".join([item.strip() for item in value.split(",") if item.strip()])

    @property
    def cors_origins_list(self) -> list[str]:
        return [item.strip() for item in self.api_cors_origins.split(",") if item.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
