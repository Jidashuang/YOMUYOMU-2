#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null || true)}"
EXPECTED_GCLOUD_ACCOUNT="${EXPECTED_GCLOUD_ACCOUNT:-zm5848746@gmail.com}"
EXPECTED_GCP_PROJECT="${EXPECTED_GCP_PROJECT:-gen-lang-client-0186292874}"
ZONE="${ZONE:-asia-northeast1-b}"
INSTANCE_NAME="${INSTANCE_NAME:-yomuyomu-vm}"
MACHINE_TYPE="${MACHINE_TYPE:-e2-standard-2}"
BOOT_DISK_SIZE="${BOOT_DISK_SIZE:-30GB}"
FIREWALL_RULE="${FIREWALL_RULE:-yomuyomu-allow-http-https}"
NETWORK="${NETWORK:-default}"
NETWORK_TAG="${NETWORK_TAG:-yomuyomu-web}"
REPO_URL="${REPO_URL:-https://github.com/Jidashuang/YOMUYOMU-2.git}"
BRANCH="${BRANCH:-$(git branch --show-current 2>/dev/null || echo main)}"
# Public domain. Caddy only switches to it (and fetches HTTPS certs) once its A record points at the VM.
DOMAIN="${DOMAIN:-genbun.live}"
REGION="${ZONE%-*}"
ADDRESS_NAME="${ADDRESS_NAME:-yomuyomu-ip}"
GEMINI_MODEL="${GEMINI_MODEL:-google/gemini-3.5-flash-lite}"

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

if [ ! -f scripts/gcp-vm-bootstrap.sh ]; then
  echo "Run this script from the repository root." >&2
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

gcloud config set project "$PROJECT_ID"
gcloud services enable compute.googleapis.com aiplatform.googleapis.com --quiet
gcloud config set compute/zone "$ZONE"

# The API calls Gemini through Vertex AI with the VM's default service account.
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
VM_SERVICE_ACCOUNT="$PROJECT_NUMBER-compute@developer.gserviceaccount.com"
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member "serviceAccount:$VM_SERVICE_ACCOUNT" \
  --role roles/aiplatform.user \
  --condition None \
  --quiet >/dev/null

if ! gcloud compute firewall-rules describe "$FIREWALL_RULE" >/dev/null 2>&1; then
  gcloud compute firewall-rules create "$FIREWALL_RULE" \
    --allow tcp:80,tcp:443 \
    --network "$NETWORK" \
    --target-tags "$NETWORK_TAG" \
    --description "Allow HTTP and HTTPS for Yomuyomu" \
    --quiet
fi

# Reserve a static external IP so the domain's A record never goes stale after a VM restart.
if ! gcloud compute addresses describe "$ADDRESS_NAME" --region "$REGION" >/dev/null 2>&1; then
  gcloud compute addresses create "$ADDRESS_NAME" --region "$REGION" --quiet
fi
STATIC_IP="$(gcloud compute addresses describe "$ADDRESS_NAME" --region "$REGION" --format='get(address)')"

if ! gcloud compute instances describe "$INSTANCE_NAME" --zone "$ZONE" >/dev/null 2>&1; then
  gcloud compute instances create "$INSTANCE_NAME" \
    --zone "$ZONE" \
    --address "$STATIC_IP" \
    --scopes cloud-platform \
    --machine-type "$MACHINE_TYPE" \
    --image-family ubuntu-2404-lts-amd64 \
    --image-project ubuntu-os-cloud \
    --boot-disk-size "$BOOT_DISK_SIZE" \
    --boot-disk-type pd-standard \
    --network "$NETWORK" \
    --tags "$NETWORK_TAG" \
    --metadata-from-file startup-script=scripts/gcp-vm-bootstrap.sh \
    --quiet
fi

echo "Waiting for VM startup script..."
gcloud compute ssh "$INSTANCE_NAME" --zone "$ZONE" --command "cloud-init status --wait || true" --quiet

EXTERNAL_IP="$(gcloud compute instances describe "$INSTANCE_NAME" --zone "$ZONE" --format='get(networkInterfaces[0].accessConfigs[0].natIP)')"

if [ -n "$DOMAIN" ] && [ "$(dig +short "$DOMAIN" A 2>/dev/null | tail -n 1)" = "$EXTERNAL_IP" ]; then
  SITE_ADDRESS="$DOMAIN"
  WEB_ORIGIN="https://$DOMAIN"
else
  SITE_ADDRESS=":80"
  WEB_ORIGIN="http://$EXTERNAL_IP"
fi
REMOTE_SCRIPT="$(mktemp)"

cat > "$REMOTE_SCRIPT" <<REMOTE
#!/usr/bin/env bash
set -euo pipefail

for attempt in {1..60}; do
  if command -v git >/dev/null 2>&1 && command -v docker >/dev/null 2>&1 && sudo docker compose version >/dev/null 2>&1; then
    break
  fi
  if [ "\$attempt" -eq 60 ]; then
    echo "Docker setup did not finish in time. Check the VM startup script logs." >&2
    exit 1
  fi
  sleep 10
done

if [ ! -d "\$HOME/yomuyomu/.git" ]; then
  git clone "$REPO_URL" "\$HOME/yomuyomu"
fi

cd "\$HOME/yomuyomu"
git fetch origin
git switch "$BRANCH" 2>/dev/null || git switch -c "$BRANCH" "origin/$BRANCH"
git pull --ff-only origin "$BRANCH"

if [ ! -f .env.gcp-vm ]; then
  POSTGRES_PASSWORD="\$(openssl rand -base64 32 | tr -d '\n')"
  JWT_SECRET="\$(openssl rand -base64 32 | tr -d '\n')"
  cat > .env.gcp-vm <<ENV
POSTGRES_DB=yomuyomu
POSTGRES_USER=yomuyomu
POSTGRES_PASSWORD=\$POSTGRES_PASSWORD

JWT_SECRET=\$JWT_SECRET
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=10080

LLM_PROVIDER=gemini
OPENAI_API_KEY=${OPENAI_API_KEY:-}
OPENAI_MODEL=gpt-4.1-mini
OPENAI_TIMEOUT_SECONDS=30
OPENAI_MAX_RETRIES=2
GEMINI_PROJECT_ID=${PROJECT_ID}
GEMINI_LOCATION=global
GEMINI_MODEL=$GEMINI_MODEL
AI_PROMPT_VERSION=v2
AI_CACHE_TTL_SECONDS=86400

YOMUYOMU_SITE_ADDRESS=$SITE_ADDRESS
WEB_ORIGIN=$WEB_ORIGIN
NEXT_PUBLIC_API_BASE_URL=/api
NEXT_PUBLIC_NLP_BASE_URL=/nlp
ALLOW_SEED_FALLBACK=true
ENV
fi

# Re-runs switch an existing env from IP to the domain once DNS is ready.
sed -i "s|^YOMUYOMU_SITE_ADDRESS=.*|YOMUYOMU_SITE_ADDRESS=$SITE_ADDRESS|; s|^WEB_ORIGIN=.*|WEB_ORIGIN=$WEB_ORIGIN|; s|^GEMINI_MODEL=.*|GEMINI_MODEL=$GEMINI_MODEL|" .env.gcp-vm

sudo docker compose --env-file .env.gcp-vm -f docker-compose.gcp-vm.yml up -d --build
sudo docker compose --env-file .env.gcp-vm -f docker-compose.gcp-vm.yml ps

# Caddy only answers for the configured site, so probe it the way a browser would.
SITE="$SITE_ADDRESS"
lc() {
  if [ "\$SITE" = ":80" ]; then
    curl -fsS "http://localhost\$1"
  else
    curl -fsS --resolve "\$SITE:443:127.0.0.1" "https://\$SITE\$1"
  fi
}

for attempt in {1..60}; do
  if lc /api/health | grep -q '"status":"ok"' && lc /nlp/health | grep -q '"status":"ok"' && lc / >/dev/null; then
    break
  fi
  if [ "\$attempt" -eq 60 ]; then
    echo "Yomuyomu did not become healthy in time. Check Docker logs with:" >&2
    echo "sudo docker compose --env-file .env.gcp-vm -f docker-compose.gcp-vm.yml logs --tail=100" >&2
    exit 1
  fi
  sleep 5
done
REMOTE

chmod +x "$REMOTE_SCRIPT"
gcloud compute scp "$REMOTE_SCRIPT" "$INSTANCE_NAME:/tmp/yomuyomu-vm-deploy.sh" --zone "$ZONE" --quiet
gcloud compute ssh "$INSTANCE_NAME" --zone "$ZONE" --command "bash /tmp/yomuyomu-vm-deploy.sh" --quiet
rm -f "$REMOTE_SCRIPT"

# jmdict.sqlite (~260 MB) is gitignored, so the VM clone never has it. Upload it once from this machine,
# then turn off the seed-only fallback so lookups use the real dictionary.
LOCAL_JMDICT="services/nlp/data/jmdict.sqlite"
if [ -f "$LOCAL_JMDICT" ]; then
  if ! gcloud compute ssh "$INSTANCE_NAME" --zone "$ZONE" --quiet --command "test -s ~/yomuyomu/$LOCAL_JMDICT"; then
    echo "Uploading $LOCAL_JMDICT to the VM..."
    gcloud compute scp "$LOCAL_JMDICT" "$INSTANCE_NAME:/tmp/jmdict.sqlite" --zone "$ZONE" --quiet
    gcloud compute ssh "$INSTANCE_NAME" --zone "$ZONE" --quiet --command "mv /tmp/jmdict.sqlite ~/yomuyomu/$LOCAL_JMDICT && chmod 644 ~/yomuyomu/$LOCAL_JMDICT"
  fi
  gcloud compute ssh "$INSTANCE_NAME" --zone "$ZONE" --quiet --command "cd ~/yomuyomu && sed -i 's/^ALLOW_SEED_FALLBACK=.*/ALLOW_SEED_FALLBACK=false/' .env.gcp-vm && sudo docker compose --env-file .env.gcp-vm -f docker-compose.gcp-vm.yml up -d nlp"
else
  echo "warning: $LOCAL_JMDICT not found locally; dictionary lookups on the VM stay in seed-only mode." >&2
fi

echo "Yomuyomu should be available at: $WEB_ORIGIN"
if [ "$SITE_ADDRESS" = ":80" ] && [ -n "$DOMAIN" ]; then
  echo
  echo "To serve it at https://$DOMAIN, add this DNS record at your registrar:"
  echo "  type=A  host=@  value=$EXTERNAL_IP"
  echo "Then rerun this script; it switches Caddy to $DOMAIN and fetches the HTTPS certificate."
fi
