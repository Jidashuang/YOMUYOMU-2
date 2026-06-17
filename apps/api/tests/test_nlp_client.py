from __future__ import annotations

import httpx

from app.services.nlp_client import NLPClient


def test_annotate_raises_when_nlp_request_fails(monkeypatch) -> None:
    def fail_post(*args, **kwargs):
        raise httpx.ConnectError("connection refused")

    monkeypatch.setattr(httpx, "post", fail_post)

    monkeypatch.setattr("time.sleep", lambda _seconds: None)

    client = NLPClient(base_url="http://nlp.example", retries=1)
    try:
        client.annotate("彼は来る。")
    except RuntimeError as exc:
        assert "NLP annotate failed" in str(exc)
    else:
        raise AssertionError("Expected annotate to fail when NLP request fails")


def test_annotate_retries_transient_nlp_failure(monkeypatch) -> None:
    calls = 0
    request = httpx.Request("POST", "http://nlp.example/annotate")

    def flaky_post(*args, **kwargs):
        nonlocal calls
        calls += 1
        if calls == 1:
            raise httpx.ReadTimeout("cold start")
        return httpx.Response(200, request=request, json={"tokens": [{"surface": "彼"}]})

    monkeypatch.setattr(httpx, "post", flaky_post)
    monkeypatch.setattr("time.sleep", lambda _seconds: None)

    client = NLPClient(base_url="http://nlp.example", retries=1)
    assert client.annotate("彼は来る。") == [{"surface": "彼"}]
    assert calls == 2
