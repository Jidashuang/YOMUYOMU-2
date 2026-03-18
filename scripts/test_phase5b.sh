#!/usr/bin/env bash

set -euo pipefail

if [[ -z "${VIRTUAL_ENV:-}" ]]; then
  echo "Activate your Python virtualenv first."
  echo "Example: source .venv-phase45/bin/activate"
  exit 1
fi

echo "[1/3] Running API tests..."
pytest -q apps/api/tests

echo "[2/3] Running NLP lookup tests..."
pytest -q services/nlp/tests

echo "[3/3] Running web type contract checks..."
npm run typecheck:web

echo "All Phase 5B tests passed."
