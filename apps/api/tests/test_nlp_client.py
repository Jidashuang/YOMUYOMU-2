from __future__ import annotations

import httpx

from app.services.nlp_client import NLPClient


def test_annotate_raises_when_nlp_request_fails(monkeypatch) -> None:
    def fail_post(*args, **kwargs):
        raise httpx.ConnectError("connection refused")

    monkeypatch.setattr(httpx, "post", fail_post)

    client = NLPClient(base_url="http://nlp.example")
    try:
        client.annotate("彼は来る。")
    except RuntimeError as exc:
        assert "NLP annotate failed" in str(exc)
    else:
        raise AssertionError("Expected annotate to fail when NLP request fails")
