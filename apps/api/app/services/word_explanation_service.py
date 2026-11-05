from __future__ import annotations

import hashlib
import json
import re
from html.parser import HTMLParser
from typing import Any
from urllib.parse import quote

import httpx
from pydantic import BaseModel, Field

from app.core.cache import get_redis_client
from app.core.config import get_settings


class WordExplanation(BaseModel):
    meaning_zh: str = Field(min_length=1)
    usage_zh: str = Field(min_length=1)
    example_ja: str = ""
    example_zh: str = ""
    source_name: str = ""
    source_url: str = ""


class JapaneseSectionParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.in_japanese = False
        self.subheading = ""
        self.blocks: list[tuple[str, str, str]] = []
        self._heading_tag = ""
        self._heading_parts: list[str] = []
        self._block_tag = ""
        self._block_parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in {"h2", "h3"}:
            self._heading_tag = tag
            self._heading_parts = []
        elif self.in_japanese and tag in {"p", "li", "dd"}:
            if self._block_tag and tag != self._block_tag:
                self._finish_block()
            if not self._block_tag:
                self._block_tag = tag
                self._block_parts = []

    def handle_data(self, data: str) -> None:
        if self._heading_tag:
            self._heading_parts.append(data)
        if self._block_tag:
            self._block_parts.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag == self._heading_tag:
            heading = _clean_text("".join(self._heading_parts))
            if tag == "h2":
                self.in_japanese = heading in {"日语", "日語"}
                self.subheading = ""
            elif self.in_japanese:
                self.subheading = heading
            self._heading_tag = ""
            self._heading_parts = []
        elif tag == self._block_tag:
            self._finish_block()

    def _finish_block(self) -> None:
        text = _clean_text("".join(self._block_parts))
        if text:
            self.blocks.append((self.subheading, self._block_tag, text))
        self._block_tag = ""
        self._block_parts = []


def _clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def _clean_definition(value: str) -> str:
    cleaned = re.sub(r"\[[^\]]+\]", "", value)
    cleaned = re.sub(r"^[〈《].*?[〉》]", "", cleaned)
    cleaned = re.sub(r"^〖.*?〗", "", cleaned)
    cleaned = re.sub(r"^\([^)]*\)", "", cleaned)
    return _clean_text(cleaned).lstrip("0123456789.、 ")


def _contains_kana(value: str) -> bool:
    return bool(re.search(r"[ぁ-んァ-ン]", value))


def _pos_label(pos: list[str]) -> str:
    labels: list[str] = []
    for item in pos:
        lower = item.lower()
        label = ""
        if lower.startswith("noun") or lower.startswith("nouns which"):
            label = "名词"
        elif "verb" in lower and "adverb" not in lower:
            label = "动词"
        elif "adjectiv" in lower:
            label = "形容词"
        elif lower.startswith("adverb"):
            label = "副词"
        elif lower == "particle":
            label = "助词"
        elif lower.startswith("auxiliary"):
            label = "助动词"
        elif "expression" in lower:
            label = "固定表达"
        if label and label not in labels:
            labels.append(label)
        elif not label and item not in labels:
            labels.append(item)
    return "、".join(labels) if labels else "词语"


def _parse_wiktionary_html(html: str, *, pos: list[str], context: str, page_title: str) -> WordExplanation | None:
    parser = JapaneseSectionParser()
    parser.feed(html)

    definition_headings = ("名詞", "名词", "動詞", "动词", "形容", "副詞", "副词", "釋義", "释义")
    definitions: list[str] = []
    for heading, tag, raw_text in parser.blocks:
        if tag not in {"li", "p"}:
            continue
        cleaned = _clean_definition(raw_text)
        if not cleaned or _contains_kana(cleaned):
            continue
        if heading and not any(keyword in heading for keyword in definition_headings):
            continue
        if cleaned not in definitions:
            definitions.append(cleaned)
        if len(definitions) >= 3:
            break

    if not definitions:
        return None

    example_ja = ""
    example_zh = ""
    for index, (_, tag, raw_text) in enumerate(parser.blocks):
        if tag != "dd":
            continue
        candidate = _clean_text(raw_text)
        if not _contains_kana(candidate) or candidate == context.strip():
            continue
        example_ja = candidate
        if index + 1 < len(parser.blocks):
            following_tag = parser.blocks[index + 1][1]
            following = _clean_definition(parser.blocks[index + 1][2])
            if following_tag == "dd" and following and not _contains_kana(following):
                example_zh = following
        break

    meaning_zh = "；".join(definitions)
    pos_label = _pos_label(pos)
    return WordExplanation(
        meaning_zh=meaning_zh,
        usage_zh=f"在原句中作为「{pos_label}」使用，含义为：{definitions[0]}",
        example_ja=example_ja,
        example_zh=example_zh,
        source_name="中文维基词典",
        source_url=f"https://zh.wiktionary.org/wiki/{quote(page_title)}",
    )


def _cache_key(surface: str, lemma: str, primary_meaning: str, context: str) -> str:
    value = json.dumps(
        {
            "surface": surface,
            "lemma": lemma,
            "primary_meaning": primary_meaning,
            "context": context,
        },
        ensure_ascii=False,
        sort_keys=True,
    )
    return f"word_explain:{hashlib.sha256(value.encode('utf-8')).hexdigest()}"


def _load_cached(key: str) -> WordExplanation | None:
    try:
        raw = get_redis_client().get(key)
        return WordExplanation.model_validate_json(raw) if raw else None
    except Exception:  # noqa: BLE001
        return None


def _save_cached(key: str, value: WordExplanation) -> None:
    try:
        get_redis_client().setex(key, get_settings().ai_cache_ttl_seconds, value.model_dump_json())
    except Exception:  # noqa: BLE001
        return


def _parse_content(response_json: dict[str, Any]) -> WordExplanation:
    content = response_json.get("choices", [{}])[0].get("message", {}).get("content", "")
    if not isinstance(content, str):
        raise ValueError("OpenAI response content is not a string")
    return WordExplanation.model_validate(json.loads(content))


def _fetch_wiktionary(
    *,
    surface: str,
    lemma: str,
    pos: list[str],
    context: str,
    timeout_seconds: float,
) -> WordExplanation | None:
    for page_title in dict.fromkeys([lemma, surface]):
        try:
            response = httpx.get(
                "https://zh.wiktionary.org/w/api.php",
                params={
                    "action": "parse",
                    "page": page_title,
                    "prop": "text",
                    "format": "json",
                    "formatversion": "2",
                    "variant": "zh-hans",
                },
                headers={"User-Agent": "Yomuyomu/0.1 dictionary lookup"},
                timeout=min(timeout_seconds, 5.0),
            )
            response.raise_for_status()
            html = response.json().get("parse", {}).get("text", "")
            explanation = _parse_wiktionary_html(
                html,
                pos=pos,
                context=context,
                page_title=page_title,
            )
            if explanation:
                return explanation
        except Exception:  # noqa: BLE001
            continue
    return None


def _translate_jmdict_meaning(
    *,
    meanings: list[str],
    primary_meaning: str,
    timeout_seconds: float,
) -> str:
    source_text = "; ".join(dict.fromkeys(meanings[:4])) or primary_meaning
    try:
        response = httpx.post(
            "https://translate.wmcloud.org/api/translate",
            json={
                "format": "text",
                "content": source_text,
                "source_language": "en",
                "target_language": "zh",
            },
            headers={"User-Agent": "Yomuyomu/0.1 dictionary lookup"},
            timeout=min(timeout_seconds, 8.0),
        )
        response.raise_for_status()
        translated = _clean_text(response.json().get("translation", ""))
        parts = list(dict.fromkeys(part.strip() for part in re.split(r"[;；]", translated) if part.strip()))
        concise = [part for part in parts if not any(part != other and part in other for other in parts)]
        return "；".join(concise or parts)
    except Exception:  # noqa: BLE001
        return ""


def _fetch_tatoeba_example(
    *,
    surface: str,
    lemma: str,
    timeout_seconds: float,
) -> tuple[str, str, str] | None:
    terms = list(dict.fromkeys([surface, lemma]))
    queries = list(dict.fromkeys([f"={term}" for term in terms] + terms))
    for query in queries:
        term = query.removeprefix("=")
        try:
            response = httpx.get(
                "https://api.tatoeba.org/v1/sentences",
                params={
                    "lang": "jpn",
                    "q": query,
                    "trans:lang": "cmn",
                    "sort": "relevance",
                    "limit": 5,
                },
                headers={"User-Agent": "Yomuyomu/0.1 dictionary lookup"},
                timeout=min(timeout_seconds, 6.0),
            )
            response.raise_for_status()
            candidates: list[tuple[int, str, str, str]] = []
            for sentence in response.json().get("data", []):
                text = _clean_text(sentence.get("text", ""))
                if term not in text:
                    continue
                translations = [
                    item
                    for item in sentence.get("translations", [])
                    if item.get("lang") == "cmn" and not item.get("is_unapproved", False)
                ]
                if not translations:
                    continue
                translation = next(
                    (item for item in translations if item.get("script") == "Hans"),
                    translations[0],
                )
                sentence_id = sentence.get("id")
                candidates.append(
                    (
                        len(text),
                        text,
                        _clean_text(translation.get("text", "")),
                        f"https://tatoeba.org/zh-cn/sentences/show/{sentence_id}",
                    )
                )
            if candidates:
                _, text, translation, source_url = min(candidates)
                return text, translation, source_url
        except Exception:  # noqa: BLE001
            continue
    return None


def _translated_fallback(
    *,
    surface: str,
    lemma: str,
    pos: list[str],
    meanings: list[str],
    primary_meaning: str,
    timeout_seconds: float,
) -> WordExplanation | None:
    meaning_zh = _translate_jmdict_meaning(
        meanings=meanings,
        primary_meaning=primary_meaning,
        timeout_seconds=timeout_seconds,
    )
    if not meaning_zh:
        return None

    example = _fetch_tatoeba_example(
        surface=surface,
        lemma=lemma,
        timeout_seconds=timeout_seconds,
    )
    example_ja, example_zh, example_url = example or ("", "", "")
    return WordExplanation(
        meaning_zh=meaning_zh,
        usage_zh=f"在当前原句中以「{_pos_label(pos)}」形式出现，可理解为：{meaning_zh}",
        example_ja=example_ja,
        example_zh=example_zh,
        source_name="JMdict + Wikimedia MinT" + ("；例句 Tatoeba（CC BY 2.0 FR）" if example else ""),
        source_url=example_url or "https://translate.wmcloud.org/",
    )


def generate_word_explanation(
    *,
    surface: str,
    lemma: str,
    reading: str,
    pos: list[str],
    meanings: list[str],
    primary_meaning: str,
    context: str,
) -> WordExplanation | None:
    settings = get_settings()

    key = _cache_key(surface, lemma, primary_meaning, context)
    cached = _load_cached(key)
    if cached:
        return cached

    explanation = _fetch_wiktionary(
        surface=surface,
        lemma=lemma,
        pos=pos,
        context=context,
        timeout_seconds=settings.openai_timeout_seconds,
    )
    if explanation:
        _save_cached(key, explanation)
        return explanation

    request_payload = {
        "model": settings.openai_model,
        "temperature": 0.1,
        "response_format": {"type": "json_object"},
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are a Japanese-Chinese learner dictionary. Return strict JSON with exactly these keys: "
                    "meaning_zh, usage_zh, example_ja, example_zh. Use concise Simplified Chinese. "
                    "Base meaning_zh on the supplied dictionary senses. Explain the word's exact role in the context. "
                    "Create a new natural Japanese example sentence; do not copy the supplied context."
                ),
            },
            {
                "role": "user",
                "content": json.dumps(
                    {
                        "surface": surface,
                        "lemma": lemma,
                        "reading": reading,
                        "part_of_speech": pos,
                        "dictionary_senses": meanings,
                        "primary_dictionary_sense": primary_meaning,
                        "context": context,
                    },
                    ensure_ascii=False,
                ),
            },
        ],
    }

    explanation = None
    if settings.llm_provider.strip().lower() == "openai" and settings.openai_api_key:
        try:
            response = httpx.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.openai_api_key}",
                    "Content-Type": "application/json",
                },
                json=request_payload,
                timeout=min(settings.openai_timeout_seconds, 12.0),
            )
            response.raise_for_status()
            explanation = _parse_content(response.json())
        except Exception:  # noqa: BLE001
            explanation = None

    if explanation is None:
        explanation = _translated_fallback(
            surface=surface,
            lemma=lemma,
            pos=pos,
            meanings=meanings,
            primary_meaning=primary_meaning,
            timeout_seconds=settings.openai_timeout_seconds,
        )
    if explanation is None:
        return None

    _save_cached(key, explanation)
    return explanation
