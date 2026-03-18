from __future__ import annotations

import json
import re
import time
from dataclasses import dataclass
from typing import Any, Protocol

import httpx

from app.core.config import Settings


@dataclass
class AIProviderResult:
    response_json: dict[str, Any]
    model: str
    provider_name: str
    error_type: str | None = None
    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    total_tokens: int | None = None


class AIProviderError(Exception):
    def __init__(self, error_type: str, message: str, retryable: bool = False):
        super().__init__(message)
        self.error_type = error_type
        self.retryable = retryable


class AIProvider(Protocol):
    provider_name: str

    def generate(self, payload: dict[str, Any], prompt_version: str) -> AIProviderResult:
        ...


class MockAIProvider:
    model = "mock-v1"
    provider_name = "mock"

    def generate(self, payload: dict[str, Any], prompt_version: str) -> AIProviderResult:
        sentence = str(payload.get("sentence", ""))
        tokenized_result = payload.get("tokenized_result", [])
        dictionary_hints = payload.get("dictionary_hints", [])

        hint_map: dict[str, str] = {}
        for hint in dictionary_hints:
            lemma = str(hint.get("lemma", ""))
            primary = str(hint.get("primary_meaning") or "")
            meanings = hint.get("meanings", [])
            if lemma and primary:
                hint_map[lemma] = primary
            elif lemma and isinstance(meanings, list) and meanings:
                hint_map[lemma] = str(meanings[0])

        token_breakdown = []
        for token in tokenized_result[:12]:
            lemma = str(token.get("lemma", ""))
            token_breakdown.append(
                {
                    "surface": str(token.get("surface", "")),
                    "lemma": lemma,
                    "reading": str(token.get("reading", "")),
                    "meaning": hint_map.get(lemma, "(pending dictionary meaning)"),
                    "role": str(token.get("pos", "unknown")),
                }
            )

        grammar_points = []
        if "はず" in sentence:
            grammar_points.append(
                {
                    "name": "はず",
                    "explanation": "表示说话人的推测、预期或应当如此。",
                }
            )
        if "のに" in sentence:
            grammar_points.append(
                {
                    "name": "のに",
                    "explanation": "表达转折、遗憾或与预期不符的语气。",
                }
            )

        response = {
            "translation_zh": f"{sentence}（示例译文）",
            "literal_translation": f"{sentence}（直译示例）",
            "grammar_points": grammar_points,
            "token_breakdown": token_breakdown,
            "omissions": [],
            "nuance": f"基于 {prompt_version} 提示词的示例解释。",
            "examples": [
                {
                    "jp": sentence,
                    "zh": "示例句子（占位）",
                }
            ],
            "why_this_expression": "该表达组合用于体现说话人的预期与现实落差。",
            "alternative_expressions": [
                {
                    "jp": "彼は来るべきだったのに。",
                    "zh": "他本该来的。",
                    "note": "语气更偏义务/应然判断。",
                }
            ],
        }
        return AIProviderResult(
            response_json=response,
            model=self.model,
            provider_name=self.provider_name,
            error_type=None,
        )


class OpenAIProvider:
    provider_name = "openai"

    def __init__(self, api_key: str, model: str, timeout_seconds: float, max_retries: int):
        self.api_key = api_key
        self.model = model
        self.timeout_seconds = max(timeout_seconds, 1.0)
        self.max_retries = max(max_retries, 0)

    def _build_payload(self, payload: dict[str, Any], prompt_version: str) -> dict[str, Any]:
        system_prompt = (
            "You are a Japanese learning assistant. "
            "Return strict JSON with keys: "
            "translation_zh, literal_translation, grammar_points, token_breakdown, omissions, nuance, examples, "
            "why_this_expression, alternative_expressions. "
            "Do not include markdown or extra keys. "
            f"Prompt version: {prompt_version}."
        )

        user_prompt = {
            "task": "Explain the Japanese sentence for a Chinese learner.",
            "constraints": {
                "language": "Chinese",
                "must_use_preprocessed_tokens": True,
                "must_use_dictionary_hints": True,
                "json_only": True,
            },
            "input": payload,
        }

        return {
            "model": self.model,
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": json.dumps(user_prompt, ensure_ascii=False)},
            ],
        }

    def _extract_content(self, response_json: dict[str, Any]) -> str:
        content = response_json.get("choices", [{}])[0].get("message", {}).get("content", "")
        if isinstance(content, str):
            return content
        raise AIProviderError("invalid_response", "OpenAI response content is not string", retryable=True)

    def _try_parse_json(self, text: str) -> dict[str, Any] | None:
        candidates = [text]

        stripped = text.strip()
        if stripped.startswith("```"):
            stripped = stripped.strip("`")
            stripped = stripped.replace("json", "", 1).strip()
            candidates.append(stripped)

        left = text.find("{")
        right = text.rfind("}")
        if left != -1 and right != -1 and right > left:
            candidates.append(text[left : right + 1])

        for candidate in list(candidates):
            candidates.append(re.sub(r",\s*([}\]])", r"\\1", candidate))

        for candidate in candidates:
            try:
                parsed = json.loads(candidate)
            except json.JSONDecodeError:
                continue
            if isinstance(parsed, dict):
                return parsed

        return None

    def _extract_usage_tokens(self, response_json: dict[str, Any]) -> tuple[int | None, int | None, int | None]:
        usage = response_json.get("usage", {})
        if not isinstance(usage, dict):
            return None, None, None

        def _as_int(value: Any) -> int | None:
            try:
                if value is None:
                    return None
                return int(value)
            except (TypeError, ValueError):
                return None

        prompt_tokens = _as_int(usage.get("prompt_tokens"))
        completion_tokens = _as_int(usage.get("completion_tokens"))
        total_tokens = _as_int(usage.get("total_tokens"))
        return prompt_tokens, completion_tokens, total_tokens

    def _request_once(self, payload: dict[str, Any], prompt_version: str) -> tuple[dict[str, Any], tuple[int | None, int | None, int | None]]:
        request_payload = self._build_payload(payload, prompt_version)

        try:
            response = httpx.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json=request_payload,
                timeout=self.timeout_seconds,
            )
            response.raise_for_status()
        except httpx.TimeoutException as exc:
            raise AIProviderError("timeout", str(exc), retryable=True) from exc
        except httpx.HTTPStatusError as exc:
            status_code = exc.response.status_code
            if status_code == 429:
                raise AIProviderError("rate_limit", str(exc), retryable=True) from exc
            if status_code >= 500:
                raise AIProviderError("http_5xx", str(exc), retryable=True) from exc
            raise AIProviderError("http_4xx", str(exc), retryable=False) from exc
        except httpx.RequestError as exc:
            raise AIProviderError("network_error", str(exc), retryable=True) from exc

        try:
            payload_json = response.json()
        except json.JSONDecodeError as exc:
            raise AIProviderError("invalid_response", str(exc), retryable=True) from exc

        if not isinstance(payload_json, dict):
            raise AIProviderError("invalid_response", "OpenAI response root must be object", retryable=True)

        content = self._extract_content(payload_json)
        parsed = self._try_parse_json(content)
        if parsed is None:
            raise AIProviderError("parse_error", "Failed to parse OpenAI JSON content", retryable=True)

        usage_tokens = self._extract_usage_tokens(payload_json)
        return parsed, usage_tokens

    def generate(self, payload: dict[str, Any], prompt_version: str) -> AIProviderResult:
        last_error: AIProviderError | None = None

        for attempt in range(self.max_retries + 1):
            try:
                response_json, usage_tokens = self._request_once(payload, prompt_version)
                return AIProviderResult(
                    response_json=response_json,
                    model=self.model,
                    provider_name=self.provider_name,
                    error_type=None,
                    prompt_tokens=usage_tokens[0],
                    completion_tokens=usage_tokens[1],
                    total_tokens=usage_tokens[2],
                )
            except AIProviderError as exc:
                last_error = exc
                if attempt >= self.max_retries or not exc.retryable:
                    break
                time.sleep(min(0.5 * (2**attempt), 2.0))

        assert last_error is not None
        raise last_error


def get_ai_provider(settings: Settings) -> AIProvider:
    provider_name = settings.llm_provider.strip().lower()
    if provider_name == "openai" and settings.openai_api_key:
        return OpenAIProvider(
            api_key=settings.openai_api_key,
            model=settings.openai_model,
            timeout_seconds=settings.openai_timeout_seconds,
            max_retries=settings.openai_max_retries,
        )
    return MockAIProvider()
