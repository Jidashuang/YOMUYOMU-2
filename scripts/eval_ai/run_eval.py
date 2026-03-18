#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from time import perf_counter, sleep

import httpx

REQUIRED_RESPONSE_KEYS = {
    "translation_zh",
    "literal_translation",
    "grammar_points",
    "token_breakdown",
    "omissions",
    "nuance",
    "examples",
    "why_this_expression",
    "alternative_expressions",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run batch AI explanation evaluation.")
    parser.add_argument("--mode", choices=["api", "offline-mock"], default="api", help="Evaluation mode")
    parser.add_argument("--api-base-url", default="http://localhost:8000", help="API base URL")
    parser.add_argument("--email", default="eval@example.com", help="Eval account email")
    parser.add_argument("--password", default="password123", help="Eval account password")
    parser.add_argument(
        "--input",
        default="scripts/eval_ai/samples.jsonl",
        help="JSONL file with evaluation samples",
    )
    parser.add_argument(
        "--output",
        default="scripts/eval_ai/results/eval_results.json",
        help="Output JSON file",
    )
    parser.add_argument("--article-id", default="", help="Existing article id. If empty, create one automatically")
    parser.add_argument("--wait-seconds", type=float, default=0.0, help="Optional delay between requests")
    parser.add_argument("--timeout", type=float, default=60.0, help="HTTP timeout in seconds")
    parser.add_argument("--prompt-version", default="v2", help="Prompt version label for offline mode")
    parser.add_argument("--expect-provider", default="", help="Fail a row when provider does not match this value")
    return parser.parse_args()


def load_samples(path: Path) -> list[dict]:
    rows: list[dict] = []
    with path.open("r", encoding="utf-8") as file:
        for line in file:
            line = line.strip()
            if not line:
                continue
            rows.append(json.loads(line))
    return rows


def ensure_auth(client: httpx.Client, base_url: str, email: str, password: str) -> str:
    register_payload = {"email": email, "password": password}
    register_response = client.post(f"{base_url}/auth/register", json=register_payload)
    if register_response.status_code not in {201, 409}:
        raise RuntimeError(f"Register failed: {register_response.status_code} {register_response.text}")

    login_response = client.post(f"{base_url}/auth/login", json=register_payload)
    if login_response.status_code != 200:
        raise RuntimeError(f"Login failed: {login_response.status_code} {login_response.text}")

    token = login_response.json().get("access_token")
    if not isinstance(token, str) or not token:
        raise RuntimeError("Missing access_token in login response")
    return token


def ensure_article(client: httpx.Client, base_url: str, token: str, article_id: str, samples: list[dict]) -> str:
    if article_id:
        return article_id

    content = "\n".join(item["sentence"] for item in samples)
    response = client.post(
        f"{base_url}/articles",
        headers={"Authorization": f"Bearer {token}"},
        json={"title": "AI Eval Corpus", "source_type": "text", "raw_content": content},
    )
    if response.status_code != 201:
        raise RuntimeError(f"Create article failed: {response.status_code} {response.text}")

    payload = response.json()
    created_id = payload.get("id")
    if not isinstance(created_id, str) or not created_id:
        raise RuntimeError("Create article response missing id")
    return created_id


def validate_schema(response_json: dict) -> bool:
    if not REQUIRED_RESPONSE_KEYS.issubset(set(response_json.keys())):
        return False
    return True


def run_eval(args: argparse.Namespace) -> dict:
    samples = load_samples(Path(args.input))
    if not samples:
        raise RuntimeError("No samples found")

    output_rows: list[dict] = []
    provider_counter: Counter[str] = Counter()
    prompt_version_counter: Counter[str] = Counter()
    error_type_counter: Counter[str] = Counter()
    latencies_ms: list[float] = []

    if args.mode == "offline-mock":
        repo_root = Path(__file__).resolve().parents[2]
        api_root = repo_root / "apps" / "api"
        if str(api_root) not in sys.path:
            sys.path.insert(0, str(api_root))
        from app.services.ai_provider import MockAIProvider

        provider = MockAIProvider()
        for sample in samples:
            started_at = perf_counter()
            payload = {
                "sentence": sample["sentence"],
                "previous_sentence": sample.get("previous_sentence", ""),
                "next_sentence": sample.get("next_sentence", ""),
                "user_level": sample.get("user_level", "N3"),
                "tokenized_result": [
                    {
                        "surface": sample["sentence"],
                        "lemma": sample["sentence"],
                        "reading": "",
                        "pos": "sentence",
                        "start": 0,
                        "end": len(sample["sentence"]),
                    }
                ],
                "dictionary_hints": [],
            }
            result = provider.generate(payload, args.prompt_version)
            latency_ms = (perf_counter() - started_at) * 1000
            latencies_ms.append(latency_ms)

            provider_counter[result.provider_name] += 1
            prompt_version_counter[args.prompt_version] += 1
            if result.error_type:
                error_type_counter[result.error_type] += 1

            row = {
                "sample_id": sample.get("id", ""),
                "genre": sample.get("genre", ""),
                "sentence": sample.get("sentence", ""),
                "status_code": 200,
                "latency_ms": round(latency_ms, 2),
                "ok": True,
                "provider": result.provider_name,
                "model": result.model,
                "prompt_version": args.prompt_version,
                "from_cache": False,
                "error_type": result.error_type,
                "schema_valid": validate_schema(result.response_json),
                "translation_zh": result.response_json.get("translation_zh", ""),
                "literal_translation": result.response_json.get("literal_translation", ""),
                "grammar_points_count": len(result.response_json.get("grammar_points", [])),
                "examples_count": len(result.response_json.get("examples", [])),
                "alternative_expressions_count": len(result.response_json.get("alternative_expressions", [])),
                }
            expected_provider = args.expect_provider.strip().lower()
            if expected_provider and result.provider_name.lower() != expected_provider:
                row["ok"] = False
                row["error"] = (
                    f"provider_mismatch: expected={expected_provider}, actual={result.provider_name}"
                )
            output_rows.append(row)
    else:
        base_url = args.api_base_url.rstrip("/")
        with httpx.Client(timeout=args.timeout) as client:
            token = ensure_auth(client, base_url, args.email, args.password)
            article_id = ensure_article(client, base_url, token, args.article_id, samples)

            for sample in samples:
                started_at = perf_counter()
                response = client.post(
                    f"{base_url}/ai-explanations",
                    headers={"Authorization": f"Bearer {token}"},
                    json={
                        "article_id": article_id,
                        "sentence": sample["sentence"],
                        "previous_sentence": sample.get("previous_sentence", ""),
                        "next_sentence": sample.get("next_sentence", ""),
                        "user_level": sample.get("user_level", "N3"),
                    },
                )
                latency_ms = (perf_counter() - started_at) * 1000
                latencies_ms.append(latency_ms)

                row = {
                    "sample_id": sample.get("id", ""),
                    "genre": sample.get("genre", ""),
                    "sentence": sample.get("sentence", ""),
                    "status_code": response.status_code,
                    "latency_ms": round(latency_ms, 2),
                }

                if response.status_code == 201:
                    payload = response.json()
                    provider = str(payload.get("provider", ""))
                    error_type = str(payload.get("error_type") or "")
                    provider_counter[provider] += 1
                    prompt_version = str(payload.get("prompt_version", ""))
                    if prompt_version:
                        prompt_version_counter[prompt_version] += 1
                    if error_type:
                        error_type_counter[error_type] += 1

                    response_json = payload.get("response_json", {})
                    row.update(
                        {
                            "ok": True,
                            "provider": provider,
                            "model": payload.get("model"),
                            "prompt_version": payload.get("prompt_version"),
                            "from_cache": bool(payload.get("from_cache", False)),
                            "error_type": payload.get("error_type"),
                            "schema_valid": validate_schema(response_json) if isinstance(response_json, dict) else False,
                            "translation_zh": response_json.get("translation_zh", "")
                            if isinstance(response_json, dict)
                            else "",
                            "literal_translation": response_json.get("literal_translation", "")
                            if isinstance(response_json, dict)
                            else "",
                            "grammar_points_count": len(response_json.get("grammar_points", []))
                            if isinstance(response_json, dict)
                            else 0,
                            "examples_count": len(response_json.get("examples", []))
                            if isinstance(response_json, dict)
                            else 0,
                            "alternative_expressions_count": len(
                                response_json.get("alternative_expressions", [])
                            )
                            if isinstance(response_json, dict)
                            else 0,
                        }
                    )
                    expected_provider = args.expect_provider.strip().lower()
                    if expected_provider and provider.lower() != expected_provider:
                        row["ok"] = False
                        row["error"] = f"provider_mismatch: expected={expected_provider}, actual={provider}"
                else:
                    row.update(
                        {
                            "ok": False,
                            "error": response.text,
                            "provider": "",
                            "model": "",
                            "prompt_version": "",
                            "from_cache": False,
                            "error_type": "",
                            "schema_valid": False,
                            "translation_zh": "",
                            "literal_translation": "",
                            "grammar_points_count": 0,
                            "examples_count": 0,
                            "alternative_expressions_count": 0,
                        }
                    )

                output_rows.append(row)

                if args.wait_seconds > 0:
                    sleep(args.wait_seconds)

    succeeded = sum(1 for item in output_rows if item.get("ok"))
    failed = len(output_rows) - succeeded
    cache_hits = sum(1 for item in output_rows if item.get("from_cache"))
    schema_valid_count = sum(1 for item in output_rows if item.get("schema_valid"))

    summary = {
        "run_at": datetime.now(timezone.utc).isoformat(),
        "mode": args.mode,
        "samples_total": len(output_rows),
        "succeeded": succeeded,
        "failed": failed,
        "cache_hits": cache_hits,
        "cache_hit_rate": round(cache_hits / len(output_rows), 4) if output_rows else 0,
        "schema_valid_count": schema_valid_count,
        "avg_latency_ms": round(sum(latencies_ms) / len(latencies_ms), 2) if latencies_ms else 0,
        "provider_counts": dict(provider_counter),
        "prompt_version_counts": dict(prompt_version_counter),
        "error_type_counts": dict(error_type_counter),
    }

    expected_provider = args.expect_provider.strip().lower()
    if expected_provider:
        observed = provider_counter.get(expected_provider, 0)
        if observed <= 0:
            raise RuntimeError(
                f"Expected provider '{expected_provider}' was not observed. "
                "Real provider may be unavailable (e.g. missing OPENAI_API_KEY or server fallback)."
            )

    return {
        "summary": summary,
        "results": output_rows,
    }


def main() -> None:
    args = parse_args()
    results = run_eval(args)

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")

    print(json.dumps(results["summary"], ensure_ascii=False, indent=2))
    print(f"Saved full results to: {output_path}")


if __name__ == "__main__":
    main()
