#!/usr/bin/env bash
set -euo pipefail

ACTION="${1:-status}"
PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null || true)}"
ZONE="${ZONE:-us-west1-b}"
INSTANCE_NAME="${INSTANCE_NAME:-yomuyomu-vm}"
BRANCH="${BRANCH:-feat/positioning-validation-pivot}"

if [ -z "$PROJECT_ID" ]; then
  echo "Set PROJECT_ID or run: gcloud config set project YOUR_PROJECT_ID" >&2
  exit 1
fi

if ! command -v gcloud >/dev/null 2>&1; then
  echo "gcloud is required. Run this from Google Cloud Shell or install Google Cloud SDK." >&2
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
      if curl -fsS http://localhost/api/health >/dev/null && curl -fsS http://localhost/nlp/health >/dev/null && curl -fsS http://localhost/ >/dev/null; then
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
  *)
    echo "Usage: PROJECT_ID=your-project-id $0 {status|start|stop|ssh|logs|update}" >&2
    exit 1
    ;;
esac
