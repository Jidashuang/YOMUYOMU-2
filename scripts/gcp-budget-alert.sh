#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null || true)}"
BUDGET_AMOUNT="${BUDGET_AMOUNT:-10USD}"
DISPLAY_NAME="${DISPLAY_NAME:-Yomuyomu $BUDGET_AMOUNT monthly guardrail}"

if [ -z "$PROJECT_ID" ]; then
  echo "Set PROJECT_ID or run: gcloud config set project YOUR_PROJECT_ID" >&2
  exit 1
fi

if ! command -v gcloud >/dev/null 2>&1; then
  echo "gcloud is required. Run this from Google Cloud Shell or install Google Cloud SDK." >&2
  exit 1
fi

gcloud config set project "$PROJECT_ID" >/dev/null

BILLING_ACCOUNT_NAME="$(gcloud beta billing projects describe "$PROJECT_ID" --format='value(billingAccountName)' 2>/dev/null || true)"
if [ -z "$BILLING_ACCOUNT_NAME" ]; then
  echo "No billing account is linked to project: $PROJECT_ID" >&2
  exit 1
fi

BILLING_ACCOUNT_ID="${BILLING_ACCOUNT_NAME#billingAccounts/}"

if gcloud billing budgets list --billing-account "$BILLING_ACCOUNT_ID" --format='value(displayName)' | grep -Fxq "$DISPLAY_NAME"; then
  echo "Budget already exists: $DISPLAY_NAME"
  exit 0
fi

gcloud billing budgets create \
  --billing-account "$BILLING_ACCOUNT_ID" \
  --display-name "$DISPLAY_NAME" \
  --budget-amount "$BUDGET_AMOUNT" \
  --filter-projects "projects/$PROJECT_ID" \
  --threshold-rule percent=0.5 \
  --threshold-rule percent=0.9 \
  --threshold-rule percent=1.0

echo "Budget alert created: $DISPLAY_NAME"
