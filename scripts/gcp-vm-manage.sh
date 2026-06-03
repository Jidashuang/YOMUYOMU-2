#!/usr/bin/env bash
set -euo pipefail

ACTION="${1:-status}"
ACTION_ARGS=("${@:2}")
PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null || true)}"
EXPECTED_GCLOUD_ACCOUNT="jidashuang8@gmail.com"
EXPECTED_GCP_PROJECT="project-c2a014a9-0b24-44a9-abb"
ZONE="${ZONE:-us-west1-b}"
INSTANCE_NAME="${INSTANCE_NAME:-yomuyomu-vm}"
BRANCH="${BRANCH:-feat/positioning-validation-pivot}"

if [ -z "$PROJECT_ID" ]; then
  echo "Set PROJECT_ID or run: gcloud config set project YOUR_PROJECT_ID" >&2
  exit 1
fi

if [ "$PROJECT_ID" != "$EXPECTED_GCP_PROJECT" ]; then
  echo "PROJECT_ID is $PROJECT_ID, expected $EXPECTED_GCP_PROJECT" >&2
  echo "Run: gcloud config set project $EXPECTED_GCP_PROJECT" >&2
  exit 1
fi

if ! command -v gcloud >/dev/null 2>&1; then
  echo "gcloud is required. Run this from Google Cloud Shell or install Google Cloud SDK." >&2
  exit 1
fi

ACTIVE_ACCOUNT="$(gcloud auth list --filter=status:ACTIVE --format='value(account)' | head -n 1 || true)"
if [ -z "$ACTIVE_ACCOUNT" ]; then
  echo "No active gcloud account. Run: gcloud auth login" >&2
  exit 1
fi

if [ "$ACTIVE_ACCOUNT" != "$EXPECTED_GCLOUD_ACCOUNT" ]; then
  echo "Active gcloud account is $ACTIVE_ACCOUNT, expected $EXPECTED_GCLOUD_ACCOUNT" >&2
  echo "Run: gcloud config set account $EXPECTED_GCLOUD_ACCOUNT" >&2
  exit 1
fi

gcloud config set project "$PROJECT_ID" >/dev/null
gcloud config set compute/zone "$ZONE" >/dev/null

instance_status() {
  gcloud compute instances describe "$INSTANCE_NAME" --zone "$ZONE" --format='get(status)'
}

external_ip() {
  gcloud compute instances describe "$INSTANCE_NAME" --zone "$ZONE" --format='get(networkInterfaces[0].accessConfigs[0].natIP)'
}

remote_compose() {
  gcloud compute ssh "$INSTANCE_NAME" --zone "$ZONE" --command "cd ~/yomuyomu && sudo docker compose --env-file .env.gcp-vm -f docker-compose.gcp-vm.yml $*"
}

wait_for_health() {
  gcloud compute ssh "$INSTANCE_NAME" --zone "$ZONE" --command '
    set -euo pipefail
    for attempt in {1..60}; do
      if curl -fsS http://localhost/api/health | grep -q '"status":"ok"' && curl -fsS http://localhost/nlp/health | grep -q '"status":"ok"' && curl -fsS http://localhost/ >/dev/null; then
        exit 0
      fi
      sleep 5
    done
    exit 1
  '
}

check_public_nlp_health() {
  local nlp_base_url="$1"
  if curl -fsS --max-time 10 "$nlp_base_url/health" | grep -q '"status":"ok"'; then
    echo "ok: public nlp health"
  else
    echo "warning: public nlp health check failed; continuing because import/token verification uses API-backed NLP" >&2
  fi
}

ensure_playwright_chromium() {
  if [ "${PLAYWRIGHT_AUTO_INSTALL:-0}" != "1" ]; then
    echo "skipping Playwright browser auto-install; set PLAYWRIGHT_AUTO_INSTALL=1 to enable it"
    return 0
  fi
  local cache_dir="${PLAYWRIGHT_BROWSERS_PATH:-$HOME/.cache/ms-playwright}"
  echo "ensuring Playwright Chromium browser"
  for attempt in 1 2 3; do
    rm -rf "$cache_dir/__dirlock" "$HOME/.cache/ms-playwright/__dirlock"
    if PLAYWRIGHT_DOWNLOAD_CONNECTION_TIMEOUT="${PLAYWRIGHT_DOWNLOAD_CONNECTION_TIMEOUT:-120000}" npx --no-install playwright install chromium; then
      return 0
    fi
    echo "warning: Playwright Chromium install attempt $attempt failed" >&2
    sleep 2
  done
  return 1
}

case "$ACTION" in
  status)
    STATUS="$(instance_status)"
    echo "instance=$INSTANCE_NAME zone=$ZONE status=$STATUS"
    if [ "$STATUS" = "RUNNING" ]; then
      IP="$(external_ip)"
      echo "url=http://$IP"
      gcloud compute ssh "$INSTANCE_NAME" --zone "$ZONE" --command "cd ~/yomuyomu && sudo docker compose --env-file .env.gcp-vm -f docker-compose.gcp-vm.yml ps" || true
    fi
    ;;
  verify)
    STATUS="$(instance_status)"
    echo "instance=$INSTANCE_NAME zone=$ZONE status=$STATUS"
    if [ "$STATUS" != "RUNNING" ]; then
      echo "VM is not running." >&2
      exit 1
    fi
    IP="$(external_ip)"
    echo "url=http://$IP"
    FAILED=0
    if curl -fsS --max-time 10 "http://$IP/" >/dev/null; then
      echo "ok: public homepage"
    else
      echo "fail: public homepage" >&2
      FAILED=1
    fi
    if curl -fsS --max-time 10 "http://$IP/api/health" | grep -q '"status":"ok"'; then
      echo "ok: public api health"
    else
      echo "fail: public api health" >&2
      FAILED=1
    fi
    if curl -fsS --max-time 10 "http://$IP/nlp/health" | grep -q '"status":"ok"'; then
      echo "ok: public nlp health"
    else
      echo "fail: public nlp health" >&2
      FAILED=1
    fi
    if [ "$FAILED" -eq 0 ]; then
      echo "verify=ok"
      exit 0
    fi
    echo "verify=failed"
    gcloud compute firewall-rules describe yomuyomu-allow-http-https --format='yaml(name,network,allowed,targetTags,direction,disabled)' || true
    gcloud compute ssh "$INSTANCE_NAME" --zone "$ZONE" --command '
      set +e
      cd ~/yomuyomu || { echo "repo=missing"; exit 0; }
      echo "--- docker compose ps ---"
      sudo docker compose --env-file .env.gcp-vm -f docker-compose.gcp-vm.yml ps
      echo "--- listening ports ---"
      sudo ss -ltnp | grep -E ":(80|443|3000|8000|8001)\\b" || true
      echo "--- local checks ---"
      curl -fsS --max-time 5 http://localhost/ >/dev/null && echo "ok: local homepage" || echo "fail: local homepage"
      curl -fsS --max-time 5 http://localhost/api/health | grep -q "\"status\":\"ok\"" && echo "ok: local api health" || echo "fail: local api health"
      curl -fsS --max-time 5 http://localhost/nlp/health | grep -q "\"status\":\"ok\"" && echo "ok: local nlp health" || echo "fail: local nlp health"
      echo "--- recent logs ---"
      sudo docker compose --env-file .env.gcp-vm -f docker-compose.gcp-vm.yml logs --tail=80 caddy web api nlp
    ' || true
    exit 1
    ;;
  verify-imports)
    STATUS="$(instance_status)"
    echo "instance=$INSTANCE_NAME zone=$ZONE status=$STATUS"
    if [ "$STATUS" != "RUNNING" ]; then
      echo "VM is not running." >&2
      exit 1
    fi
    IP="$(external_ip)"
    API_BASE_URL="http://$IP/api"
    NLP_BASE_URL="http://$IP/nlp"
    echo "api=$API_BASE_URL"
    curl -fsS --max-time 10 "$API_BASE_URL/health" | grep -q '"status":"ok"'
    check_public_nlp_health "$NLP_BASE_URL"
    python3 scripts/verify_article_imports.py --api-base-url "$API_BASE_URL" "${ACTION_ARGS[@]}"
    echo "--- recent article processing logs ---"
    if remote_compose logs --tail=300 api | grep -E "article_processing_(start|ready|failed)"; then
      echo "ok: article processing log markers found"
    else
      echo "warning: no article_processing_start/ready/failed logs found in recent API logs" >&2
    fi
    ;;
  verify-web-imports)
    STATUS="$(instance_status)"
    echo "instance=$INSTANCE_NAME zone=$ZONE status=$STATUS"
    if [ "$STATUS" != "RUNNING" ]; then
      echo "VM is not running." >&2
      exit 1
    fi
    if [ ! -d node_modules/@playwright/test ]; then
      echo "Node dependencies are required for browser verification. Run: npm ci" >&2
      exit 1
    fi
    ensure_playwright_chromium
    IP="$(external_ip)"
    WEB_BASE_URL="http://$IP"
    API_BASE_URL="http://$IP/api"
    NLP_BASE_URL="http://$IP/nlp"
    echo "url=$WEB_BASE_URL"
    curl -fsS --max-time 10 "$API_BASE_URL/health" | grep -q '"status":"ok"'
    check_public_nlp_health "$NLP_BASE_URL"
    node scripts/verify_web_epub_flow.mjs --web-base-url "$WEB_BASE_URL" --api-base-url "$API_BASE_URL" "${ACTION_ARGS[@]}"
    echo "--- recent article processing logs ---"
    if remote_compose logs --tail=300 api | grep -E "article_processing_(start|ready|failed)"; then
      echo "ok: article processing log markers found"
    else
      echo "warning: no article_processing_start/ready/failed logs found in recent API logs" >&2
    fi
    ;;
  start)
    gcloud compute instances start "$INSTANCE_NAME" --zone "$ZONE"
    IP="$(external_ip)"
    echo "url=http://$IP"
    ;;
  stop)
    gcloud compute instances stop "$INSTANCE_NAME" --zone "$ZONE"
    ;;
  ssh)
    gcloud compute ssh "$INSTANCE_NAME" --zone "$ZONE"
    ;;
  logs)
    remote_compose logs --tail=150
    ;;
  update)
    gcloud compute ssh "$INSTANCE_NAME" --zone "$ZONE" --command "
      set -euo pipefail
      cd ~/yomuyomu
      git fetch origin
      git switch '$BRANCH' 2>/dev/null || git switch -c '$BRANCH' 'origin/$BRANCH'
      git pull --ff-only origin '$BRANCH'
      sudo docker compose --env-file .env.gcp-vm -f docker-compose.gcp-vm.yml up -d --build
      sudo docker compose --env-file .env.gcp-vm -f docker-compose.gcp-vm.yml ps
    "
    wait_for_health
    IP="$(external_ip)"
    echo "url=http://$IP"
    ;;
  backup-db)
    BACKUP_NAME="yomuyomu-$(date -u +%Y%m%dT%H%M%SZ).dump"
    REMOTE_BACKUP="~/yomuyomu-backups/$BACKUP_NAME"
    gcloud compute ssh "$INSTANCE_NAME" --zone "$ZONE" --command "
      set -euo pipefail
      mkdir -p ~/yomuyomu-backups
      cd ~/yomuyomu
      set -a
      . ./.env.gcp-vm
      set +a
      sudo docker compose --env-file .env.gcp-vm -f docker-compose.gcp-vm.yml exec -T postgres pg_dump -U \"\${POSTGRES_USER:-yomuyomu}\" -d \"\${POSTGRES_DB:-yomuyomu}\" -Fc > $REMOTE_BACKUP
    "
    gcloud compute scp "$INSTANCE_NAME:$REMOTE_BACKUP" "./$BACKUP_NAME" --zone "$ZONE"
    echo "backup=./$BACKUP_NAME"
    ;;
  restore-db)
    BACKUP_FILE="${2:-}"
    if [ -z "$BACKUP_FILE" ]; then
      echo "Usage: PROJECT_ID=your-project-id $0 restore-db ./backup.dump" >&2
      exit 1
    fi
    if [ ! -f "$BACKUP_FILE" ]; then
      echo "Backup file not found: $BACKUP_FILE" >&2
      exit 1
    fi
    gcloud compute scp "$BACKUP_FILE" "$INSTANCE_NAME:/tmp/yomuyomu-restore.dump" --zone "$ZONE"
    gcloud compute ssh "$INSTANCE_NAME" --zone "$ZONE" --command '
      set -euo pipefail
      cd ~/yomuyomu
      set -a
      . ./.env.gcp-vm
      set +a
      sudo docker compose --env-file .env.gcp-vm -f docker-compose.gcp-vm.yml exec -T postgres pg_restore -U "${POSTGRES_USER:-yomuyomu}" -d "${POSTGRES_DB:-yomuyomu}" --clean --if-exists --no-owner < /tmp/yomuyomu-restore.dump
      rm -f /tmp/yomuyomu-restore.dump
    '
    ;;
  *)
    echo "Usage: PROJECT_ID=your-project-id $0 {status|verify|verify-imports|verify-web-imports|start|stop|ssh|logs|update|backup-db|restore-db}" >&2
    exit 1
    ;;
esac
