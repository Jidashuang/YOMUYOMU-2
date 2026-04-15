from __future__ import annotations

from argparse import Namespace
from pathlib import Path
import importlib.util

import pytest


def _load_eval_module():
    repo_root = Path(__file__).resolve().parents[3]
    script_path = repo_root / "scripts" / "eval_ai" / "run_eval.py"
    spec = importlib.util.spec_from_file_location("eval_runner", script_path)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


def test_eval_requires_expected_provider() -> None:
    module = _load_eval_module()
    repo_root = Path(__file__).resolve().parents[3]
    args = Namespace(
        mode="offline-mock",
        api_base_url="http://localhost:8000",
        email="eval@example.com",
        password="strong-password-123",
        input=str(repo_root / "scripts" / "eval_ai" / "samples.jsonl"),
        output=str(repo_root / "scripts" / "eval_ai" / "results" / "tmp_eval.json"),
        article_id="",
        wait_seconds=0.0,
        timeout=10.0,
        prompt_version="v2",
        expect_provider="openai",
    )

    with pytest.raises(RuntimeError, match="Expected provider 'openai' was not observed"):
        module.run_eval(args)


def test_eval_expected_provider_mock_passes() -> None:
    module = _load_eval_module()
    repo_root = Path(__file__).resolve().parents[3]
    args = Namespace(
        mode="offline-mock",
        api_base_url="http://localhost:8000",
        email="eval@example.com",
        password="strong-password-123",
        input=str(repo_root / "scripts" / "eval_ai" / "samples.jsonl"),
        output=str(repo_root / "scripts" / "eval_ai" / "results" / "tmp_eval.json"),
        article_id="",
        wait_seconds=0.0,
        timeout=10.0,
        prompt_version="v2",
        expect_provider="mock",
    )

    results = module.run_eval(args)
    assert results["summary"]["provider_counts"]["mock"] > 0
