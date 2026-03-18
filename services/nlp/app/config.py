from __future__ import annotations

from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Yomuyomu NLP"
    app_version: str = "0.1.0"
    api_cors_origins: str = "http://localhost:3000"

    jlpt_map_path: str = "services/nlp/data/jlpt_sample.csv"
    frequency_map_path: str = "services/nlp/data/frequency_sample.csv"
    jmdict_db_path: str = "services/nlp/data/jmdict.sqlite"
    lookup_seed_path: str = "services/nlp/data/lookup_seed.json"
    allow_seed_fallback: bool = False

    @property
    def cors_origins_list(self) -> list[str]:
        return [item.strip() for item in self.api_cors_origins.split(",") if item.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
