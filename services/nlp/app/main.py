from __future__ import annotations

import logging
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
jlpt_map = load_map(settings.jlpt_map_path, "lemma", "jlpt_level")
frequency_map = load_map(settings.frequency_map_path, "lemma", "frequency_band")
lookup = DictionaryLookup(
    jmdict_db_path=settings.jmdict_db_path,
    seed_path=settings.lookup_seed_path,
    jlpt_map=jlpt_map,
    frequency_map=frequency_map,
    allow_seed_fallback=settings.allow_seed_fallback,
)
tokenizer_service = TokenizerService(jlpt_map=jlpt_map, frequency_map=frequency_map)
logger = logging.getLogger(__name__)

app = FastAPI(title=settings.app_name, version=settings.app_version)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
    return TokenizeResponse(tokens=tokenizer_service.tokenize(payload.text))


@app.post("/lookup", response_model=LookupResponse)
def lookup_entry(payload: LookupRequest) -> LookupResponse:
    started_at = perf_counter()
    entries = lookup.lookup(
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
    return AnnotateResponse(tokens=tokenizer_service.annotate(payload.text))
