#!/usr/bin/env bash
# One-command local check: web typecheck + web unit tests + API tests + NLP tests.
# Usage: bash scripts/check.sh   (uses $PYTHON or python3; needs deps installed)
set -euo pipefail
cd "$(dirname "$0")/.."
PY="${PYTHON:-python3}"

echo "[1/5] Web typecheck"
npm run --silent typecheck:web

echo "[2/5] Web unit tests"
npm test --silent --workspace @yomuyomu/web

echo "[3/5] API tests"
"$PY" -m pytest -q apps/api/tests

echo "[4/5] NLP tests"
"$PY" -m pytest -q services/nlp/tests

echo "[5/5] API / shared-types contract drift"
"$PY" scripts/check_contracts.py

echo "All checks passed."
