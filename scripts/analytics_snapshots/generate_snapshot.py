#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import sys
from datetime import date, datetime, timezone
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate daily analytics snapshot from product_events.")
    parser.add_argument("--date", default="", help="Snapshot date in YYYY-MM-DD (UTC). Default: today UTC")
    parser.add_argument(
        "--output",
        default="",
        help="Output JSON path. Default: scripts/analytics_snapshots/output/snapshot_<date>.json",
    )
    return parser.parse_args()


def _parse_snapshot_date(raw: str) -> date:
    if not raw:
        return datetime.now(timezone.utc).date()
    try:
        return date.fromisoformat(raw)
    except ValueError as exc:
        raise SystemExit(f"Invalid --date format: {raw} (expected YYYY-MM-DD)") from exc


def main() -> None:
    args = parse_args()
    snapshot_date = _parse_snapshot_date(args.date)

    repo_root = Path(__file__).resolve().parents[2]
    api_root = repo_root / "apps" / "api"
    if str(api_root) not in sys.path:
        sys.path.insert(0, str(api_root))

    from app.db.session import SessionLocal
    from app.services.analytics_snapshot import build_daily_snapshot

    output_path = Path(args.output) if args.output else repo_root / "scripts" / "analytics_snapshots" / "output" / f"snapshot_{snapshot_date.isoformat()}.json"

    with SessionLocal() as db:
        snapshot = build_daily_snapshot(db, snapshot_date=snapshot_date)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2), encoding="utf-8")

    print(json.dumps(snapshot.get("totals", {}), ensure_ascii=False, indent=2))
    print(f"Saved snapshot: {output_path}")


if __name__ == "__main__":
    main()
