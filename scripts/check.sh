#!/usr/bin/env bash
# One-command local check: web typecheck + API tests + NLP tests.
# Usage: bash scripts/check.sh   (uses $PYTHON or python3; needs deps installed)
set -euo pipefail
cd "$(dirname "$0")/.."
PY="${PYTHON:-python3}"

echo "[1/3] Web typecheck"
npm run --silent typecheck:web

echo "[2/3] API tests"
"$PY" -m pytest -q apps/api/tests

echo "[3/3] NLP tests"
"$PY" -m pytest -q services/nlp/tests

echo "All checks passed."
