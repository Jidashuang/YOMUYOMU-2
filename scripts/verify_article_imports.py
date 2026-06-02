#!/usr/bin/env python3

from __future__ import annotations

import argparse
import base64
import io
import json
import sys
import zipfile
from datetime import datetime, timezone
from time import sleep
from typing import Any
from urllib.error import HTTPError
from urllib.request import Request, urlopen


TEXT_CONTENT = "彼は来るはずだったのに。\n今日は雨が降っている。"
VERIFICATION_EMAIL = "article-verify@example.com"


class JsonResponse:
    def __init__(self, status_code: int, text: str) -> None:
        self.status_code = status_code
        self.text = text

    def json(self) -> dict[str, Any]:
        payload = json.loads(self.text)
        if not isinstance(payload, dict):
            raise RuntimeError("response JSON is not an object")
        return payload


class JsonClient:
    def __init__(self, timeout: float) -> None:
        self.timeout = timeout

    def get(self, url: str, headers: dict[str, str] | None = None) -> JsonResponse:
        return self._request("GET", url, headers=headers)

    def post(self, url: str, json_payload: dict[str, Any], headers: dict[str, str] | None = None) -> JsonResponse:
        body = json.dumps(json_payload).encode("utf-8")
        request_headers = {"Content-Type": "application/json", **(headers or {})}
        return self._request("POST", url, body=body, headers=request_headers)

    def _request(
        self,
        method: str,
        url: str,
        body: bytes | None = None,
        headers: dict[str, str] | None = None,
    ) -> JsonResponse:
        request = Request(url, data=body, headers=headers or {}, method=method)
        try:
            with urlopen(request, timeout=self.timeout) as response:
                text = response.read().decode("utf-8", errors="replace")
                return JsonResponse(response.status, text)
        except HTTPError as exc:
            text = exc.read().decode("utf-8", errors="replace")
            return JsonResponse(exc.code, text)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Verify text and EPUB article imports against a live API.")
    parser.add_argument("--api-base-url", default="http://localhost:8000", help="API base URL, e.g. http://IP/api")
    parser.add_argument(
        "--email",
        default=VERIFICATION_EMAIL,
        help=f"Verification account email. Defaults to {VERIFICATION_EMAIL}",
    )
    parser.add_argument("--password", default="password123", help="Verification account password")
    parser.add_argument("--timeout", type=float, default=60.0, help="HTTP timeout in seconds")
    parser.add_argument("--poll-timeout", type=float, default=45.0, help="Seconds to wait for each article")
    parser.add_argument("--poll-interval", type=float, default=1.5, help="Seconds between article polls")
    parser.add_argument("--skip-failure-case", action="store_true", help="Skip invalid EPUB failure verification")
    return parser.parse_args()


def ensure_auth(client: JsonClient, base_url: str, email: str, password: str) -> str:
    payload = {"email": email, "password": password}
    response = client.post(f"{base_url}/auth/register", json_payload=payload)
    if response.status_code not in {201, 409}:
        raise RuntimeError(f"register failed: {response.status_code} {response.text}")

    response = client.post(f"{base_url}/auth/login", json_payload=payload)
    if response.status_code != 200:
        raise RuntimeError(f"login failed: {response.status_code} {response.text}")

    token = response.json().get("access_token")
    if not isinstance(token, str) or not token:
        raise RuntimeError("login response missing access_token")
    return token


def build_epub_data_url() -> str:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, mode="w") as zf:
        zf.writestr("mimetype", "application/epub+zip", compress_type=zipfile.ZIP_STORED)
        zf.writestr(
            "META-INF/container.xml",
            """<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>
""",
        )
        zf.writestr(
            "OEBPS/content.opf",
            """<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
  <manifest>
    <item id="chapter1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
    <item id="chapter2" href="chapter2.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="chapter1"/>
    <itemref idref="chapter2"/>
  </spine>
</package>
""",
        )
        zf.writestr(
            "OEBPS/chapter1.xhtml",
            """<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
  <body>
    <h1>第一章</h1>
    <p>彼は来るはずだったのに。</p>
    <p>今日は雨が降っている。</p>
  </body>
</html>
""",
        )
        zf.writestr(
            "OEBPS/chapter2.xhtml",
            """<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
  <body>
    <h1>第二章</h1>
    <p>彼女は返事を待っていた。</p>
  </body>
</html>
""",
        )
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f"data:application/epub+zip;base64,{encoded}"


def create_article(client: JsonClient, base_url: str, token: str, title: str, source_type: str, raw_content: str) -> str:
    response = client.post(
        f"{base_url}/articles",
        headers={"Authorization": f"Bearer {token}"},
        json_payload={"title": title, "source_type": source_type, "raw_content": raw_content},
    )
    if response.status_code != 201:
        raise RuntimeError(f"create {title} failed: {response.status_code} {response.text}")
    article_id = response.json().get("id")
    if not isinstance(article_id, str) or not article_id:
        raise RuntimeError(f"create {title} response missing id")
    return article_id


def poll_article(client: JsonClient, base_url: str, token: str, article_id: str, args: argparse.Namespace) -> dict[str, Any]:
    deadline = datetime.now(timezone.utc).timestamp() + args.poll_timeout
    last_payload: dict[str, Any] | None = None
    snapshots: list[dict[str, Any]] = []

    while datetime.now(timezone.utc).timestamp() <= deadline:
        response = client.get(f"{base_url}/articles/{article_id}", headers={"Authorization": f"Bearer {token}"})
        if response.status_code != 200:
            raise RuntimeError(f"get article failed: {response.status_code} {response.text}")
        payload = response.json()
        last_payload = payload
        snapshots.append(
            {
                "status": payload.get("status"),
                "blocks": len(payload.get("blocks") or []),
                "processed_block_count": payload.get("processed_block_count"),
                "total_block_count": payload.get("total_block_count"),
            }
        )
        if payload.get("status") in {"ready", "failed"}:
            payload["_snapshots"] = snapshots
            return payload
        sleep(args.poll_interval)

    raise RuntimeError(f"article {article_id} did not finish in {args.poll_timeout}s: {last_payload}")


def token_count(article: dict[str, Any]) -> int:
    return sum(len(block.get("tokens") or []) for block in article.get("blocks") or [])


def assert_ready_article(article: dict[str, Any], title: str) -> None:
    if article.get("status") != "ready":
        raise RuntimeError(f"{title} not ready: status={article.get('status')} error={article.get('processing_error')}")
    blocks = article.get("blocks") or []
    if not blocks:
        raise RuntimeError(f"{title} has no blocks")
    if token_count(article) <= 0:
        raise RuntimeError(f"{title} has no tokens")
    if article.get("processed_block_count") != article.get("total_block_count"):
        raise RuntimeError(
            f"{title} progress mismatch: {article.get('processed_block_count')}/{article.get('total_block_count')}"
        )


def assert_epub_article(article: dict[str, Any]) -> None:
    assert_ready_article(article, "epub import")
    normalized = str(article.get("normalized_content") or "")
    if "第一章" not in normalized or "第二章" not in normalized:
        raise RuntimeError("epub import did not preserve both chapter texts")
    if normalized.find("第一章") > normalized.find("第二章"):
        raise RuntimeError("epub import did not preserve spine order")


def summarize(article: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": article.get("id"),
        "title": article.get("title"),
        "source_type": article.get("source_type"),
        "status": article.get("status"),
        "processing_error": article.get("processing_error"),
        "blocks": len(article.get("blocks") or []),
        "tokens": token_count(article),
        "processed_block_count": article.get("processed_block_count"),
        "total_block_count": article.get("total_block_count"),
        "snapshots": article.get("_snapshots", []),
    }


def run(args: argparse.Namespace) -> dict[str, Any]:
    base_url = args.api_base_url.rstrip("/")
    email = args.email
    client = JsonClient(timeout=args.timeout)
    token = ensure_auth(client, base_url, email, args.password)

    text_id = create_article(client, base_url, token, "verify text import", "text", TEXT_CONTENT)
    text_article = poll_article(client, base_url, token, text_id, args)
    assert_ready_article(text_article, "text import")

    epub_id = create_article(client, base_url, token, "verify epub import", "epub", build_epub_data_url())
    epub_article = poll_article(client, base_url, token, epub_id, args)
    assert_epub_article(epub_article)

    result: dict[str, Any] = {
        "ok": True,
        "api_base_url": base_url,
        "email": email,
        "text": summarize(text_article),
        "epub": summarize(epub_article),
    }

    if not args.skip_failure_case:
        bad_payload = "data:application/epub+zip;base64," + base64.b64encode(b"not a zip").decode("ascii")
        failed_id = create_article(client, base_url, token, "verify invalid epub", "epub", bad_payload)
        failed_article = poll_article(client, base_url, token, failed_id, args)
        if failed_article.get("status") != "failed" or not failed_article.get("processing_error"):
            raise RuntimeError(f"invalid epub did not fail clearly: {failed_article}")
        result["invalid_epub"] = summarize(failed_article)

    return result


def main() -> int:
    args = parse_args()
    try:
        result = run(args)
    except Exception as exc:  # noqa: BLE001
        print(json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False, indent=2), file=sys.stderr)
        return 1
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
