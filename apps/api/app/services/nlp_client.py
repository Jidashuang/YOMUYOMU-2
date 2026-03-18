from __future__ import annotations

import logging

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)


class NLPClient:
    def __init__(self, base_url: str | None = None):
        settings = get_settings()
        self.base_url = (base_url or settings.nlp_service_url).rstrip("/")

    def annotate(self, text: str) -> list[dict]:
        return self._post_json("/annotate", {"text": text}).get("tokens", [])

    def tokenize(self, text: str) -> list[dict]:
        return self._post_json("/tokenize", {"text": text}).get("tokens", [])

    def lookup(self, surface: str, lemma: str, context: str = "", reading: str = "") -> list[dict]:
        payload = {"surface": surface, "lemma": lemma, "reading": reading, "context": context}
        return self._post_json("/lookup", payload).get("entries", [])

    def _post_json(self, path: str, payload: dict) -> dict:
        try:
            response = httpx.post(
                f"{self.base_url}{path}",
                json=payload,
                timeout=8.0,
            )
            response.raise_for_status()
            result = response.json()
            if isinstance(result, dict):
                return result
        except Exception as exc:  # noqa: BLE001
            logger.warning("NLP request %s failed: %s", path, exc)
        return {}


nlp_client = NLPClient()
