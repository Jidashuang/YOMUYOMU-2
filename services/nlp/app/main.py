from __future__ import annotations

import logging
from functools import lru_cache
from time import perf_counter
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.difficulty import load_map
from app.dictionary_lookup import DictionaryLookup
from app.schemas import (
    AnnotateRequest,
    AnnotateResponse,
    HealthResponse,
    LookupRequest,
    LookupResponse,
    TokenizeRequest,
    TokenizeResponse,
)
from app.tokenizer_service import TokenizerService

settings = get_settings()
logger = logging.getLogger(__name__)

app = FastAPI(title=settings.app_name, version=settings.app_version)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@lru_cache
def get_jlpt_map() -> dict[str, str]:
    return load_map(settings.jlpt_map_path, "lemma", "jlpt_level")


@lru_cache
def get_frequency_map() -> dict[str, str]:
    return load_map(settings.frequency_map_path, "lemma", "frequency_band")


@lru_cache
def get_lookup() -> DictionaryLookup:
    return DictionaryLookup(
        jmdict_db_path=settings.jmdict_db_path,
        seed_path=settings.lookup_seed_path,
        jlpt_map=get_jlpt_map(),
        frequency_map=get_frequency_map(),
        allow_seed_fallback=settings.allow_seed_fallback,
    )


@lru_cache
def get_tokenizer_service() -> TokenizerService:
    return TokenizerService(jlpt_map=get_jlpt_map(), frequency_map=get_frequency_map())


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        service="nlp",
        status="ok",
        version=settings.app_version,
        dependencies={},
        timestamp=datetime.now(timezone.utc).isoformat(),
    )


@app.post("/tokenize", response_model=TokenizeResponse)
def tokenize(payload: TokenizeRequest) -> TokenizeResponse:
    return TokenizeResponse(tokens=get_tokenizer_service().tokenize(payload.text))


@app.post("/lookup", response_model=LookupResponse)
def lookup_entry(payload: LookupRequest) -> LookupResponse:
    started_at = perf_counter()
    entries = get_lookup().lookup(
        surface=payload.surface,
        lemma=payload.lemma,
        reading=payload.reading,
        context=payload.context,
    )
    latency_ms = (perf_counter() - started_at) * 1000
    logger.info(
        "lookup surface=%s lemma=%s reading=%s entries=%s latency_ms=%.2f",
        payload.surface,
        payload.lemma,
        payload.reading or "",
        len(entries),
        latency_ms,
    )
    return LookupResponse(entries=entries)


@app.post("/annotate", response_model=AnnotateResponse)
def annotate(payload: AnnotateRequest) -> AnnotateResponse:
    return AnnotateResponse(tokens=get_tokenizer_service().annotate(payload.text))
