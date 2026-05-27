#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null || true)}"
EXPECTED_GCLOUD_ACCOUNT="jidashuang8@gmail.com"
EXPECTED_GCP_PROJECT="project-c2a014a9-0b24-44a9-abb"
ZONE="${ZONE:-us-west1-b}"
INSTANCE_NAME="${INSTANCE_NAME:-yomuyomu-vm}"
MACHINE_TYPE="${MACHINE_TYPE:-e2-micro}"
FIREWALL_RULE="${FIREWALL_RULE:-yomuyomu-allow-http-https}"
NETWORK="${NETWORK:-default}"

failures=0

ok() {
  printf 'ok: %s\n' "$1"
}

warn() {
  printf 'warn: %s\n' "$1" >&2
}

fail() {
  printf 'fail: %s\n' "$1" >&2
  failures=$((failures + 1))
}

if ! command -v gcloud >/dev/null 2>&1; then
  fail "gcloud is not installed; run this from Google Cloud Shell or install Google Cloud SDK."
  exit 1
fi
ok "gcloud is available"

if [ -z "$PROJECT_ID" ]; then
  fail "PROJECT_ID is empty; set PROJECT_ID=your-project-id or run gcloud config set project YOUR_PROJECT_ID."
  exit 1
fi

if [ "$PROJECT_ID" != "$EXPECTED_GCP_PROJECT" ]; then
  fail "PROJECT_ID is $PROJECT_ID, expected $EXPECTED_GCP_PROJECT"
  printf 'Run: gcloud config set project %s\n' "$EXPECTED_GCP_PROJECT" >&2
  exit 1
fi

if gcloud auth list --filter=status:ACTIVE --format='value(account)' | grep -q .; then
  ACTIVE_ACCOUNT="$(gcloud auth list --filter=status:ACTIVE --format='value(account)' | head -n 1)"
  ok "active gcloud account: $ACTIVE_ACCOUNT"
  if [ "$ACTIVE_ACCOUNT" != "$EXPECTED_GCLOUD_ACCOUNT" ]; then
    fail "active gcloud account is $ACTIVE_ACCOUNT, expected $EXPECTED_GCLOUD_ACCOUNT"
    printf 'Run: gcloud config set account %s\n' "$EXPECTED_GCLOUD_ACCOUNT" >&2
    exit 1
  fi
else
  fail "no active gcloud account; run gcloud auth login."
fi

if gcloud projects describe "$PROJECT_ID" >/dev/null 2>&1; then
  ok "project exists: $PROJECT_ID"
  gcloud config set project "$PROJECT_ID" >/dev/null
else
  fail "project is not accessible: $PROJECT_ID"
fi

compute_api_enabled=false
if gcloud services list --enabled --filter='config.name=compute.googleapis.com' --format='value(config.name)' 2>/dev/null | grep -q compute.googleapis.com; then
  compute_api_enabled=true
  ok "Compute Engine API is enabled"
else
  warn "Compute Engine API is not enabled yet; deploy script will try to enable it."
fi

if gcloud beta billing projects describe "$PROJECT_ID" --format='value(billingEnabled)' 2>/dev/null | grep -q True; then
  ok "billing appears enabled for project"
else
  warn "could not confirm billing is enabled; VM creation will fail if billing is disabled."
fi

if [ "$compute_api_enabled" = true ]; then
  if gcloud compute zones describe "$ZONE" >/dev/null 2>&1; then
    ok "zone exists: $ZONE"
  else
    fail "zone is not accessible: $ZONE"
  fi

  if gcloud compute machine-types describe "$MACHINE_TYPE" --zone "$ZONE" >/dev/null 2>&1; then
    ok "machine type exists in zone: $MACHINE_TYPE"
  else
    fail "machine type is not available in $ZONE: $MACHINE_TYPE"
  fi

  if gcloud compute networks describe "$NETWORK" >/dev/null 2>&1; then
    ok "VPC network exists: $NETWORK"
  else
    fail "VPC network is not accessible: $NETWORK. Create a VPC or rerun with NETWORK=your-network."
  fi

  if gcloud compute instances describe "$INSTANCE_NAME" --zone "$ZONE" >/dev/null 2>&1; then
    STATUS="$(gcloud compute instances describe "$INSTANCE_NAME" --zone "$ZONE" --format='get(status)')"
    IP="$(gcloud compute instances describe "$INSTANCE_NAME" --zone "$ZONE" --format='get(networkInterfaces[0].accessConfigs[0].natIP)')"
    ok "VM already exists: $INSTANCE_NAME status=$STATUS ip=$IP"
  else
    ok "VM does not exist yet and can be created: $INSTANCE_NAME"
  fi

  if gcloud compute firewall-rules describe "$FIREWALL_RULE" >/dev/null 2>&1; then
    ok "firewall rule already exists: $FIREWALL_RULE"
  else
    ok "firewall rule does not exist yet and can be created: $FIREWALL_RULE"
  fi
else
  warn "skipping Compute Engine zone, machine type, network, VM, and firewall checks until the API is enabled."
fi

if [ "$failures" -gt 0 ]; then
  printf 'preflight failed with %s issue(s)\n' "$failures" >&2
  exit 1
fi

cat <<NEXT
preflight passed.

Next:
PROJECT_ID=$PROJECT_ID ZONE=$ZONE MACHINE_TYPE=$MACHINE_TYPE NETWORK=$NETWORK ./scripts/gcp-vm-create-and-deploy.sh
NEXT
