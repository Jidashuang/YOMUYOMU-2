#!/usr/bin/env python3
"""Fail if API pydantic schemas and packages/shared-types TS interfaces drift apart.

Compares field *names* only, for the pairs listed in PAIRS (pydantic model, TS interface).
Usage: python scripts/check_contracts.py   (run from anywhere; needs API deps installed)
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps" / "api"))

from app.schemas import article, reader_data  # noqa: E402

TS = (ROOT / "packages" / "shared-types" / "src" / "contracts.ts").read_text(encoding="utf-8")

# (pydantic class, TS interface)
PAIRS = [
    (reader_data.ReaderLookupEntry, "LookupEntry"),
    (reader_data.ReaderLookupResponse, "LookupResponse"),
    (article.ArticleSearchHit, "ArticleSearchHit"),
    (article.ArticleSearchResponse, "ArticleSearchResponse"),
]


def ts_fields(name: str) -> set[str]:
    m = re.search(r"export interface %s\b[^{]*\{(.*?)\n\}" % re.escape(name), TS, re.S)
    if not m:
        raise SystemExit(f"TS interface {name} not found")
    return set(re.findall(r"^\s{2}(\w+)\??:", m.group(1), re.M))


failed = False
for model, iface in PAIRS:
    py, js = set(model.model_fields), ts_fields(iface)
    if py != js:
        failed = True
        print(f"DRIFT {model.__name__} <-> {iface}: only in API={sorted(py - js)} only in TS={sorted(js - py)}")
print("contracts drifted" if failed else "contracts in sync")
sys.exit(1 if failed else 0)
