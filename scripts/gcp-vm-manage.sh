#!/usr/bin/env bash
set -euo pipefail

ACTION="${1:-status}"
PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null || true)}"
EXPECTED_GCLOUD_ACCOUNT="${EXPECTED_GCLOUD_ACCOUNT-jidashuang8@gmail.com}"
EXPECTED_GCP_PROJECT="${EXPECTED_GCP_PROJECT-project-c2a014a9-0b24-44a9-abb}"
ZONE="${ZONE:-us-west1-b}"
INSTANCE_NAME="${INSTANCE_NAME:-yomuyomu-vm}"
BRANCH="${BRANCH:-feat/positioning-validation-pivot}"

if [ -z "$PROJECT_ID" ]; then
  echo "Set PROJECT_ID or run: gcloud config set project YOUR_PROJECT_ID" >&2
  exit 1
fi

if [ -n "$EXPECTED_GCP_PROJECT" ] && [ "$PROJECT_ID" != "$EXPECTED_GCP_PROJECT" ]; then
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

if [ -n "$EXPECTED_GCLOUD_ACCOUNT" ] && [ "$ACTIVE_ACCOUNT" != "$EXPECTED_GCLOUD_ACCOUNT" ]; then
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
    echo "Usage: PROJECT_ID=your-project-id $0 {status|start|stop|ssh|logs|update|backup-db|restore-db}" >&2
    exit 1
    ;;
esac
