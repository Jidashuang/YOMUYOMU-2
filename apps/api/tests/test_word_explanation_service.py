from __future__ import annotations

from types import SimpleNamespace

from app.services import word_explanation_service


class FakeResponse:
    def __init__(self, payload: dict):
        self.payload = payload

    def raise_for_status(self) -> None:
        return

    def json(self) -> dict:
        return self.payload


def test_generate_word_explanation_uses_wiktionary_without_openai_key(monkeypatch) -> None:
    html = """
    <h2 id="日语">日语</h2>
    <h3 id="名詞">名詞</h3>
    <ol>
      <li>中间，正中。</li>
      <li>事物的中心，重点。
        <dl><dd>文化の中心</dd><dd>文化中心。</dd></dl>
      </li>
    </ol>
    """
    monkeypatch.setattr(
        word_explanation_service,
        "get_settings",
        lambda: SimpleNamespace(
            llm_provider="openai",
            openai_api_key=None,
            openai_timeout_seconds=30,
            ai_cache_ttl_seconds=60,
        ),
    )
    monkeypatch.setattr(word_explanation_service, "_load_cached", lambda key: None)
    monkeypatch.setattr(word_explanation_service, "_save_cached", lambda key, value: None)
    monkeypatch.setattr(
        word_explanation_service.httpx,
        "get",
        lambda *args, **kwargs: FakeResponse({"parse": {"text": html}}),
    )

    result = word_explanation_service.generate_word_explanation(
        surface="中心",
        lemma="中心",
        reading="ちゅうしん",
        pos=["noun"],
        meanings=["center"],
        primary_meaning="center",
        context="父は海を中心に写真を撮っていた。",
    )

    assert result is not None
    assert result.meaning_zh == "中间，正中。；事物的中心，重点。"
    assert result.example_ja == "文化の中心"
    assert result.example_zh == "文化中心。"
    assert result.source_name == "中文维基词典"


def test_generate_word_explanation_uses_real_provider_result(monkeypatch) -> None:
    settings = SimpleNamespace(
        llm_provider="openai",
        openai_api_key="test-key",
        openai_model="gpt-test",
        openai_timeout_seconds=30,
        ai_cache_ttl_seconds=60,
    )
    monkeypatch.setattr(word_explanation_service, "get_settings", lambda: settings)
    monkeypatch.setattr(word_explanation_service, "_load_cached", lambda key: None)
    monkeypatch.setattr(word_explanation_service, "_save_cached", lambda key, value: None)
    monkeypatch.setattr(
        word_explanation_service.httpx,
        "get",
        lambda *args, **kwargs: FakeResponse({"parse": {"text": "<h2 id='漢語'>漢語</h2>"}}),
    )
    monkeypatch.setattr(
        word_explanation_service.httpx,
        "post",
        lambda *args, **kwargs: FakeResponse(
            {
                "choices": [
                    {
                        "message": {
                            "content": (
                                '{"meaning_zh":"中心；核心","usage_zh":"在句中表示拍摄对象的核心位置",'
                                '"example_ja":"町の中心に図書館がある。","example_zh":"镇中心有一座图书馆。"}'
                            )
                        }
                    }
                ]
            }
        ),
    )

    result = word_explanation_service.generate_word_explanation(
        surface="中心",
        lemma="中心",
        reading="ちゅうしん",
        pos=["noun"],
        meanings=["center"],
        primary_meaning="center",
        context="父は海を中心に写真を撮っていた。",
    )

    assert result is not None
    assert result.meaning_zh == "中心；核心"
    assert result.example_ja != "父は海を中心に写真を撮っていた。"


def test_generate_word_explanation_translates_jmdict_and_uses_tatoeba(monkeypatch) -> None:
    settings = SimpleNamespace(
        llm_provider="openai",
        openai_api_key=None,
        openai_model="gpt-test",
        openai_timeout_seconds=30,
        ai_cache_ttl_seconds=60,
    )
    monkeypatch.setattr(word_explanation_service, "get_settings", lambda: settings)
    monkeypatch.setattr(word_explanation_service, "_load_cached", lambda key: None)
    monkeypatch.setattr(word_explanation_service, "_save_cached", lambda key, value: None)

    def fake_get(url, *args, **kwargs):
        if "wiktionary" in url:
            return FakeResponse({"parse": {"text": "<h2>汉语</h2>"}})
        assert kwargs["params"]["q"] == "=撮影"
        return FakeResponse(
            {
                "data": [
                    {
                        "id": 122,
                        "text": "好きな撮影者は誰ですか。",
                        "translations": [
                            {
                                "text": "谁是你最喜欢的摄影师？",
                                "lang": "cmn",
                                "script": "Hans",
                                "is_unapproved": False,
                            }
                        ],
                    },
                    {
                        "id": 123,
                        "text": "写真撮影禁止。",
                        "translations": [
                            {
                                "text": "禁止拍照。",
                                "lang": "cmn",
                                "script": "Hans",
                                "is_unapproved": False,
                            }
                        ],
                    }
                ]
            }
        )

    monkeypatch.setattr(word_explanation_service.httpx, "get", fake_get)
    monkeypatch.setattr(
        word_explanation_service.httpx,
        "post",
        lambda *args, **kwargs: FakeResponse({"translation": "摄影; 摄影; 拍摄; 拍摄"}),
    )

    result = word_explanation_service.generate_word_explanation(
        surface="撮影",
        lemma="撮影",
        reading="さつえい",
        pos=["noun"],
        meanings=["photography", "taking a picture"],
        primary_meaning="photography",
        context="父は写真を撮影した。",
    )

    assert result is not None
    assert result.meaning_zh == "摄影；拍摄"
    assert result.usage_zh.startswith("在当前原句中以「名词」形式出现")
    assert result.example_ja == "写真撮影禁止。"
    assert result.example_zh == "禁止拍照。"
    assert "Tatoeba" in result.source_name
