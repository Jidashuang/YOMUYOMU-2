#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
API_PORT="${PLAYWRIGHT_API_PORT:-8001}"
WEB_PORT="${PLAYWRIGHT_WEB_PORT:-3101}"
PLAYWRIGHT_DB_PATH="${PLAYWRIGHT_DB_PATH:-$(mktemp -t yomuyomu-playwright-api)}"

export DATABASE_URL="sqlite+pysqlite:///${PLAYWRIGHT_DB_PATH}"
export REDIS_URL="redis://127.0.0.1:6379/0?socket_connect_timeout=0.1&socket_timeout=0.1"
export NLP_SERVICE_URL="http://127.0.0.1:8001"
export JWT_SECRET="playwright-test-secret-value-with-minimum-32-bytes"
export AUTH_COOKIE_SECURE="false"
export AUTH_COOKIE_SAMESITE="lax"
export LLM_PROVIDER="mock"
export AI_PROMPT_VERSION="v2-test"
export API_CORS_ORIGINS="http://127.0.0.1:${WEB_PORT},http://localhost:${WEB_PORT}"

sqlite3 "${PLAYWRIGHT_DB_PATH}" "
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  billing_status TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_users_plan ON users (plan);
CREATE INDEX IF NOT EXISTS ix_users_stripe_customer_id ON users (stripe_customer_id);
CREATE INDEX IF NOT EXISTS ix_users_stripe_subscription_id ON users (stripe_subscription_id);
CREATE INDEX IF NOT EXISTS ix_users_billing_status ON users (billing_status);

CREATE TABLE IF NOT EXISTS articles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  source_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing',
  raw_content TEXT NOT NULL,
  normalized_content TEXT,
  processing_error TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS ix_articles_user_id ON articles (user_id);
CREATE INDEX IF NOT EXISTS ix_articles_status ON articles (status);
"

exec "$ROOT_DIR/.venv-api313/bin/uvicorn" app.main:app --app-dir "$ROOT_DIR/apps/api" --host 127.0.0.1 --port "${API_PORT}" --access-log
