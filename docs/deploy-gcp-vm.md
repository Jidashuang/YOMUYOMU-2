# Deploy Yomuyomu To Google Cloud VM

This is the low-cost Google Cloud path for the current app shape. It keeps the existing Web, API, NLP, PostgreSQL, and Redis services together on one Compute Engine VM and uses Caddy as the public reverse proxy.

## Why This Path

- Cloud Run is attractive, but this app currently needs PostgreSQL and Redis.
- Cloud SQL plus Memorystore is likely to exceed a small monthly credit quickly.
- A single VM is simpler and closer to the current `docker-compose.yml` setup.
- Google Cloud has an Always Free Compute Engine `e2-micro` tier in selected US regions, but this app may need swap or a slightly larger VM during builds.

## Cost Posture

Start with:

- Region: `us-west1`, `us-central1`, or `us-east1`
- Machine: `e2-micro` for the lowest-cost test, or `e2-small` if builds/runtime are too slow
- Boot disk: 30 GB standard persistent disk
- No Cloud SQL
- No Memorystore
- No load balancer

If using the Google Developer Program Premium credit, treat the monthly credit as a guardrail, not a guarantee. Set a billing budget alert before deploying.

## Files

- `docker-compose.gcp-vm.yml`: production-ish single-VM stack
- `.env.gcp-vm.example`: environment template
- `infra/docker/web.prod.Dockerfile`: production Next.js image
- `infra/caddy/Caddyfile`: same-origin proxy for Web, API, and NLP
- `scripts/gcp-vm-bootstrap.sh`: installs Docker and swap on Ubuntu
- `scripts/gcp-vm-create-and-deploy.sh`: Cloud Shell helper that creates the VM and deploys the stack

## 1. Prepare Cloud Shell

Open Google Cloud Shell, select your project, then clone this repo so the startup script is available:

```bash
git clone https://github.com/Jidashuang/YOMUYOMU-2.git yomuyomu
cd yomuyomu
```

If the GCP deploy files are on a feature branch, switch to it:

```bash
git switch feat/positioning-validation-pivot
```

## 2. One-Command Deploy From Cloud Shell

The helper script creates the firewall rule and VM, waits for Docker setup, clones the selected branch on the VM, generates `.env.gcp-vm`, starts Docker Compose, and prints the public URL.

```bash
PROJECT_ID=your-gcp-project-id ./scripts/gcp-vm-create-and-deploy.sh
```

Optional overrides:

```bash
PROJECT_ID=your-gcp-project-id \
ZONE=us-central1-a \
MACHINE_TYPE=e2-small \
BRANCH=feat/positioning-validation-pivot \
./scripts/gcp-vm-create-and-deploy.sh
```

Use `e2-micro` first for cost. If the Docker build fails from memory pressure, rerun with `MACHINE_TYPE=e2-small`.

## 3. Manual VM Creation From Cloud Shell

Run from Google Cloud Shell after selecting your project:

```bash
gcloud config set compute/zone us-west1-b
gcloud services enable compute.googleapis.com

gcloud compute firewall-rules create yomuyomu-allow-http-https \
  --allow tcp:80,tcp:443 \
  --target-tags yomuyomu-web \
  --description "Allow HTTP and HTTPS for Yomuyomu"

gcloud compute instances create yomuyomu-vm \
  --machine-type e2-micro \
  --image-family ubuntu-2404-lts-amd64 \
  --image-project ubuntu-os-cloud \
  --boot-disk-size 30GB \
  --boot-disk-type pd-standard \
  --tags yomuyomu-web \
  --metadata-from-file startup-script=scripts/gcp-vm-bootstrap.sh
```

If Docker builds fail from memory pressure, stop the VM and resize it to `e2-small`, then retry the build.

## 4. SSH Into The VM

```bash
gcloud compute ssh yomuyomu-vm
```

Clone the repository on the VM:

```bash
git clone https://github.com/Jidashuang/YOMUYOMU-2.git yomuyomu
cd yomuyomu
```

If the deploy work is on a feature branch, switch to it:

```bash
git switch feat/positioning-validation-pivot
```

## 5. Create The Production Env

```bash
cp .env.gcp-vm.example .env.gcp-vm
```

Edit `.env.gcp-vm`:

```bash
nano .env.gcp-vm
```

Required changes:

- `POSTGRES_PASSWORD`: long random password
- `JWT_SECRET`: at least 32 random characters
- `WEB_ORIGIN`: `http://VM_EXTERNAL_IP` for the first deploy, or `https://your-domain.com`
- `YOMUYOMU_SITE_ADDRESS`: `:80` for first deploy by IP, or `your-domain.com` after DNS is ready
- `OPENAI_API_KEY`: set only when you want real AI explanations

Generate secrets on the VM:

```bash
openssl rand -base64 32
```

## 6. Start The App

```bash
docker compose --env-file .env.gcp-vm -f docker-compose.gcp-vm.yml up -d --build
```

Check services:

```bash
docker compose --env-file .env.gcp-vm -f docker-compose.gcp-vm.yml ps
curl -f http://localhost/api/health
curl -f http://localhost/nlp/health
```

Open:

```text
http://VM_EXTERNAL_IP
```

## 7. Optional Domain And HTTPS

Point an A record to the VM external IP.

Then update `.env.gcp-vm`:

```text
YOMUYOMU_SITE_ADDRESS=your-domain.com
WEB_ORIGIN=https://your-domain.com
```

Recreate Caddy:

```bash
docker compose --env-file .env.gcp-vm -f docker-compose.gcp-vm.yml up -d caddy
```

Caddy will request and renew TLS certificates automatically when DNS is correct and ports `80`/`443` are open.

## 8. Updating After New Commits

```bash
cd ~/yomuyomu
git pull --ff-only
docker compose --env-file .env.gcp-vm -f docker-compose.gcp-vm.yml up -d --build
```

## Notes

- Do not expose Postgres or Redis ports publicly.
- The default GCP VM config is for validation, not high availability.
- Keep backups before real users depend on stored reading data.
- Replace `ALLOW_SEED_FALLBACK=true` with a real JMDict sqlite before public launch.
