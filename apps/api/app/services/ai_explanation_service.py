from __future__ import annotations

import hashlib
import json
import re
from threading import Lock
from time import perf_counter
from typing import Any

from app.core.cache import get_redis_client
from app.core.config import get_settings
from app.schemas.ai_explanation import AIExplanationJSON, SuggestedVocabItem
from app.services.ai_provider import AIProviderError, MockAIProvider, get_ai_provider
from app.services.nlp_client import nlp_client

SKIP_POS = {"助詞", "助動詞", "補助記号", "記号"}
CONTENT_POS_KEYWORDS = ("名詞", "動詞", "形容詞", "副詞", "接頭辞", "接尾辞", "verb", "noun", "adjective", "adverb")

_cache_lock = Lock()
_cache_requests = 0
_cache_hits = 0


def record_cache_lookup(is_hit: bool) -> None:
    global _cache_requests, _cache_hits
    with _cache_lock:
        _cache_requests += 1
        if is_hit:
            _cache_hits += 1


def get_cache_stats() -> dict[str, float]:
    with _cache_lock:
        if _cache_requests == 0:
            hit_rate = 0.0
        else:
            hit_rate = _cache_hits / _cache_requests
        return {
            "requests": float(_cache_requests),
            "hits": float(_cache_hits),
            "hit_rate": hit_rate,
        }


def build_cache_key(
    sentence: str,
    previous_sentence: str,
    next_sentence: str,
    user_level: str,
    prompt_version: str,
) -> str:
    payload = json.dumps(
        {
            "sentence": sentence,
            "previous_sentence": previous_sentence,
            "next_sentence": next_sentence,
            "user_level": user_level,
            "prompt_version": prompt_version,
        },
        ensure_ascii=False,
        sort_keys=True,
    )
    digest = hashlib.sha256(payload.encode("utf-8")).hexdigest()
    return f"ai_explain:{digest}"


def prepare_preprocessed_inputs(sentence: str) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    tokenized_result = nlp_client.tokenize(sentence)

    dictionary_hints: list[dict[str, Any]] = []
    seen_pairs: set[tuple[str, str]] = set()
    for token in tokenized_result:
        lemma = str(token.get("lemma", ""))
        reading = str(token.get("reading", ""))
        pos = str(token.get("pos", ""))
        key = (lemma, reading)

        if not lemma or key in seen_pairs or pos in SKIP_POS:
            continue
        seen_pairs.add(key)

        entries = nlp_client.lookup(
            surface=str(token.get("surface", "")),
            lemma=lemma,
            reading=reading,
            context=sentence,
        )
        if entries:
            dictionary_hints.append(entries[0])
        if len(dictionary_hints) >= 12:
            break

    return tokenized_result, dictionary_hints


def _is_content_word_pos(pos: str) -> bool:
    if not pos or pos in SKIP_POS:
        return False
    lowered = pos.lower()
    return any(keyword in pos or keyword in lowered for keyword in CONTENT_POS_KEYWORDS)


def extract_suggested_vocab(
    tokenized_result: list[dict[str, Any]],
    dictionary_hints: list[dict[str, Any]],
    max_items: int = 8,
) -> list[dict[str, Any]]:
    hints_by_lemma: dict[str, dict[str, Any]] = {}
    for hint in dictionary_hints:
        lemma = str(hint.get("lemma", "")).strip()
        if lemma and lemma not in hints_by_lemma:
            hints_by_lemma[lemma] = hint

    seen: set[tuple[str, str]] = set()
    candidates: list[dict[str, Any]] = []

    for token in tokenized_result:
        pos = str(token.get("pos", "")).strip()
        if not _is_content_word_pos(pos):
            continue

        surface = str(token.get("surface", "")).strip()
        lemma = str(token.get("lemma", "")).strip() or surface
        reading = str(token.get("reading", "")).strip()
        if not surface or not lemma:
            continue
        dedup_key = (lemma, pos)
        if dedup_key in seen:
            continue
        seen.add(dedup_key)

        hint = hints_by_lemma.get(lemma, {})
        meanings = hint.get("meanings", [])
        primary_meaning = str(hint.get("primary_meaning") or "")
        if not primary_meaning and isinstance(meanings, list) and meanings:
            primary_meaning = str(meanings[0])

        candidate = SuggestedVocabItem(
            surface=surface,
            lemma=lemma,
            reading=reading or str(hint.get("reading", "") or surface),
            pos=pos,
            meaning=primary_meaning or "pending meaning",
            jlpt_level=str(hint.get("jlpt_level", token.get("jlpt_level", "Unknown"))),
            frequency_band=str(hint.get("frequency_band", token.get("frequency_band", "Unknown"))),
        ).model_dump()
        candidates.append(candidate)
        if len(candidates) >= max_items:
            break

    return candidates


def _deterministic_grammar_points(sentence: str) -> list[dict[str, str]]:
    checks: list[tuple[str, str, str]] = [
        ("はず", r"はず", "表示说话人的预期、判断或应当如此。"),
        ("のに", r"のに", "表达与预期相反的转折，常带遗憾语气。"),
        ("ている", r"ている", "表示进行、结果状态或习惯性的动作。"),
        ("だろう", r"だろう|でしょう", "表示推测、判断或不完全肯定。"),
        ("ことになる", r"ことになる", "表示结果归结为某种决定或安排。"),
        ("てしまう", r"てしまう", "表示动作完成，常含遗憾/无奈语气。"),
    ]
    points: list[dict[str, str]] = []
    for name, pattern, explanation in checks:
        if re.search(pattern, sentence):
            points.append({"name": name, "explanation": explanation})
    return points


def _stabilize_explanation_json(response_json: dict[str, Any], sentence: str) -> dict[str, Any]:
    validated = AIExplanationJSON.model_validate(response_json).model_dump()

    existing = {
        str(item.get("name", "")).strip(): item
        for item in validated.get("grammar_points", [])
        if isinstance(item, dict)
    }
    for point in _deterministic_grammar_points(sentence):
        if point["name"] not in existing:
            validated["grammar_points"].append(point)

    if not validated.get("why_this_expression"):
        if validated["grammar_points"]:
            names = "、".join(point["name"] for point in validated["grammar_points"][:3])
            validated["why_this_expression"] = f"句子使用了 {names}，用于表达语气与语义层次。"
        else:
            validated["why_this_expression"] = "该表达在上下文中更自然，兼顾语气与信息密度。"

    if not validated.get("alternative_expressions"):
        validated["alternative_expressions"] = [
            {
                "jp": sentence.replace("のに", "けど") if "のに" in sentence else sentence,
                "zh": "语气更口语、更弱转折。",
                "note": "更接近日常会话语气。",
            },
            {
                "jp": sentence.replace("はず", "べき") if "はず" in sentence else sentence,
                "zh": "语义更偏义务或应然判断。",
                "note": "语气更强，主观判断更明显。",
            },
        ]

    return AIExplanationJSON.model_validate(validated).model_dump()


def load_cached_explanation(cache_key: str) -> tuple[dict[str, Any], dict[str, Any]] | None:
    redis_client = get_redis_client()
    try:
        raw = redis_client.get(cache_key)
        if not raw:
            return None

        payload = json.loads(raw)
        if not isinstance(payload, dict):
            return None

        response_json = payload.get("response_json", {})
        if not isinstance(response_json, dict):
            return None

        validated = _stabilize_explanation_json(response_json, str(payload.get("sentence", "")))
        meta: dict[str, Any] = {
            "model": str(payload.get("model", "cache")),
            "provider": str(payload.get("provider", "cache")),
            "prompt_version": str(payload.get("prompt_version", get_settings().ai_prompt_version)),
            "error_type": str(payload.get("error_type")) if payload.get("error_type") else None,
            "provider_latency_ms": float(payload["provider_latency_ms"])
            if payload.get("provider_latency_ms") is not None
            else None,
            "prompt_tokens": int(payload["prompt_tokens"]) if payload.get("prompt_tokens") is not None else None,
            "completion_tokens": int(payload["completion_tokens"])
            if payload.get("completion_tokens") is not None
            else None,
            "total_tokens": int(payload["total_tokens"]) if payload.get("total_tokens") is not None else None,
        }
        return validated, meta
    except Exception:  # noqa: BLE001
        return None


def save_cached_explanation(cache_key: str, response_json: dict[str, Any], meta: dict[str, Any]) -> None:
    settings = get_settings()
    redis_client = get_redis_client()

    cache_payload = json.dumps(
        {
            "response_json": response_json,
            "model": meta.get("model", "unknown"),
            "provider": meta.get("provider", "unknown"),
            "prompt_version": meta.get("prompt_version", settings.ai_prompt_version),
            "error_type": meta.get("error_type"),
            "provider_latency_ms": meta.get("provider_latency_ms"),
            "prompt_tokens": meta.get("prompt_tokens"),
            "completion_tokens": meta.get("completion_tokens"),
            "total_tokens": meta.get("total_tokens"),
        },
        ensure_ascii=False,
    )

    try:
        redis_client.setex(cache_key, settings.ai_cache_ttl_seconds, cache_payload)
    except Exception:  # noqa: BLE001
        return


def _safe_fallback_explanation(sentence: str) -> dict[str, Any]:
    return {
        "translation_zh": sentence,
        "literal_translation": sentence,
        "grammar_points": [],
        "token_breakdown": [],
        "omissions": [],
        "nuance": "系统兜底解释：上游模型暂时不可用。",
        "examples": [{"jp": sentence, "zh": sentence}],
        "why_this_expression": "系统兜底：优先保证结构化可读性。",
        "alternative_expressions": [],
    }


def generate_explanation(
    sentence: str,
    previous_sentence: str,
    next_sentence: str,
    user_level: str,
    tokenized_result: list[dict[str, Any]],
    dictionary_hints: list[dict[str, Any]],
) -> tuple[dict[str, Any], dict[str, Any]]:
    settings = get_settings()
    prompt_version = settings.ai_prompt_version

    payload = {
        "sentence": sentence,
        "previous_sentence": previous_sentence,
        "next_sentence": next_sentence,
        "user_level": user_level,
        "tokenized_result": tokenized_result,
        "dictionary_hints": dictionary_hints,
    }

    provider = get_ai_provider(settings)
    requested_provider_name = provider.provider_name
    requested_model_name = str(getattr(provider, "model", requested_provider_name))
    upstream_error_type: str | None = None
    provider_latency_ms: float | None = None
    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    total_tokens: int | None = None

    started_at = perf_counter()
    try:
        provider_result = provider.generate(payload, prompt_version)
        provider_latency_ms = (perf_counter() - started_at) * 1000
        raw_response = provider_result.response_json
        model = provider_result.model
        provider_name = provider_result.provider_name
        prompt_tokens = provider_result.prompt_tokens
        completion_tokens = provider_result.completion_tokens
        total_tokens = provider_result.total_tokens
    except AIProviderError as exc:
        provider_latency_ms = (perf_counter() - started_at) * 1000
        upstream_error_type = exc.error_type
        fallback = MockAIProvider().generate(payload, prompt_version)
        raw_response = fallback.response_json
        model = requested_model_name
        provider_name = requested_provider_name
    except Exception:  # noqa: BLE001
        provider_latency_ms = (perf_counter() - started_at) * 1000
        upstream_error_type = "provider_unexpected"
        fallback = MockAIProvider().generate(payload, prompt_version)
        raw_response = fallback.response_json
        model = requested_model_name
        provider_name = requested_provider_name

    try:
        validated = _stabilize_explanation_json(raw_response, sentence)
    except Exception:  # noqa: BLE001
        try:
            fallback = MockAIProvider().generate(payload, prompt_version)
            validated = _stabilize_explanation_json(fallback.response_json, sentence)
            upstream_error_type = upstream_error_type or "parse_or_schema_error"
        except Exception:  # noqa: BLE001
            validated = _stabilize_explanation_json(_safe_fallback_explanation(sentence), sentence)
            upstream_error_type = upstream_error_type or "safe_fallback"

    suggested_vocab = extract_suggested_vocab(
        tokenized_result=tokenized_result,
        dictionary_hints=dictionary_hints,
    )

    return validated, {
        "model": model,
        "provider": provider_name,
        "prompt_version": prompt_version,
        "error_type": upstream_error_type,
        "provider_latency_ms": round(provider_latency_ms, 2) if provider_latency_ms is not None else None,
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "total_tokens": total_tokens,
        "suggested_vocab": suggested_vocab,
    }
