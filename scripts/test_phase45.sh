#!/usr/bin/env bash

set -euo pipefail

if [[ -z "${VIRTUAL_ENV:-}" ]]; then
  echo "Activate your Python virtualenv first."
  echo "Example: source .venv-phase45/bin/activate"
  exit 1
fi

echo "[1/2] Running API tests..."
pytest -q apps/api/tests

echo "[2/2] Running NLP lookup tests..."
pytest -q services/nlp/tests

echo "All Phase 5A tests passed."
