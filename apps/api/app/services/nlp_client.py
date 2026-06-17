from __future__ import annotations

import logging
import time

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)


class NLPClient:
    def __init__(self, base_url: str | None = None, timeout: float = 30.0, retries: int = 2):
        settings = get_settings()
        self.base_url = (base_url or settings.nlp_service_url).rstrip("/")
        self.timeout = timeout
        self.retries = retries

    def annotate(self, text: str) -> list[dict]:
        tokens = self._post_json("/annotate", {"text": text}).get("tokens")
        if not isinstance(tokens, list):
            raise RuntimeError("NLP annotate failed")
        return tokens

    def tokenize(self, text: str) -> list[dict]:
        return self._post_json("/tokenize", {"text": text}).get("tokens", [])

    def lookup(self, surface: str, lemma: str, context: str = "", reading: str = "") -> list[dict]:
        payload = {"surface": surface, "lemma": lemma, "reading": reading, "context": context}
        return self._post_json("/lookup", payload).get("entries", [])

    def _post_json(self, path: str, payload: dict) -> dict:
        last_error: Exception | None = None
        for attempt in range(self.retries + 1):
            try:
                response = httpx.post(
                    f"{self.base_url}{path}",
                    json=payload,
                    timeout=self.timeout,
                )
                response.raise_for_status()
                result = response.json()
                if isinstance(result, dict):
                    return result
            except Exception as exc:  # noqa: BLE001
                last_error = exc
                if attempt < self.retries:
                    time.sleep(0.5 * (attempt + 1))
                    continue
        if last_error is not None:
            logger.warning("NLP request %s failed after %s attempts: %s", path, self.retries + 1, last_error)
        return {}


nlp_client = NLPClient()
