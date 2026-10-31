#!/usr/bin/env bash
set -euo pipefail

echo "=================================================================="
echo "  Synapse Core v0.7.0 ('The Brain') — One-Command Docker Deployment"
echo "=================================================================="

http_get() {
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$1" 2>/dev/null
  elif command -v wget >/dev/null 2>&1; then
    wget -qO- "$1" 2>/dev/null
  else
    return 1
  fi
}

if ! command -v docker >/dev/null 2>&1; then
  echo "[synapse] Docker not found — installing Docker & Compose automatically..."
  if command -v apt-get >/dev/null 2>&1; then
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -y -qq
    apt-get install -y -qq curl ca-certificates git docker.io docker-compose-v2 2>/dev/null || \
      apt-get install -y -qq curl ca-certificates git docker.io docker-compose
    systemctl enable --now docker >/dev/null 2>&1 || true
  elif command -v apk >/dev/null 2>&1; then
    apk add --no-cache curl ca-certificates git docker docker-cli-compose
    rc-update add docker default >/dev/null 2>&1 || true
    rc-service docker start >/dev/null 2>&1 || true
  elif command -v dnf >/dev/null 2>&1; then
    dnf install -y curl ca-certificates git docker
    systemctl enable --now docker >/dev/null 2>&1 || true
  elif command -v curl >/dev/null 2>&1; then
    curl -fsSL https://get.docker.com | sh
    systemctl enable --now docker >/dev/null 2>&1 || true
  else
    echo "[error] Docker is not installed and automatic installation failed."
    exit 1
  fi
fi

DEPLOY_DIR="${SYNAPSE_DEPLOY_DIR:-$HOME/synapse-core}"
mkdir -p "$DEPLOY_DIR"
cd "$DEPLOY_DIR"

if [ ! -f .env ]; then
  if command -v openssl >/dev/null 2>&1; then
    MASTER_KEY="synapse-aes256-$(openssl rand -hex 24)"
  else
    MASTER_KEY="synapse-aes256-$(date +%s)-key"
  fi
  cat >.env <<EOF
SYNAPSE_MASTER_KEY=${MASTER_KEY}
SYNAPSE_DEBUG=${SYNAPSE_DEBUG:-1}
OPENAI_API_KEY=${OPENAI_API_KEY:-}
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-}
EOF
  echo "[synapse] Generated AES-256-GCM Vault Master Key in $DEPLOY_DIR/.env"
fi

cat >docker-compose.yml <<'EOF'
services:
  core-gateway:
    image: ghcr.io/solidstatenetwork/synapse-core-gateway:latest
    container_name: synapse-core-gateway
    restart: unless-stopped
    env_file:
      - .env
    environment:
      - SYNAPSE_DATA_DIR=/var/lib/synapse
      - SYNAPSE_TUNNEL_PORT=8443
      - SYNAPSE_GATEWAY_HTTP_ADDR=:8081
    ports:
      - "8081:8081"
      - "8443:8443"
    volumes:
      - synapse_vault:/var/lib/synapse
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1:8081/healthz"]
      interval: 10s
      timeout: 3s
      retries: 3

  core-web:
    image: ghcr.io/solidstatenetwork/synapse-core-web:latest
    container_name: synapse-core-web
    restart: unless-stopped
    depends_on:
      core-gateway:
        condition: service_healthy
    env_file:
      - .env
    environment:
      - NODE_ENV=production
      - CORE_GATEWAY_INTERNAL_URL=http://core-gateway:8081
      - CORE_GATEWAY_URL=http://core-gateway:8081
      - SYNAPSE_VAULT_DIR=/var/lib/synapse/projects
      - SYNAPSE_CARTRIDGES_DIR=/app/cartridges
    ports:
      - "3000:3000"
    volumes:
      - synapse_vault:/var/lib/synapse

volumes:
  synapse_vault:
EOF

echo "[synapse] Pulling prebuilt Docker images from GitHub Container Registry (GHCR)..."
if docker compose pull 2>/dev/null || docker-compose pull 2>/dev/null; then
  docker compose up -d 2>/dev/null || docker-compose up -d
else
  echo "[synapse] GHCR pull unavailable; building images from GitHub repository source..."
  if [ ! -d src ]; then
    git clone --depth 1 https://github.com/SolidStateNetwork/Synapse.git src
  fi
  cd src
  cp "$DEPLOY_DIR/.env" .env
  docker compose up --build -d 2>/dev/null || docker-compose up --build -d
fi

echo "[synapse] Waiting for Core Gateway (:8081) and mTLS Hub (:8443) to become ready..."
for _ in $(seq 1 30); do
  if http_get http://127.0.0.1:8081/healthz >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

PUBLIC_IP="$(hostname -I 2>/dev/null | awk '{print $1}' || echo '127.0.0.1')"
if [ -z "$PUBLIC_IP" ]; then
  PUBLIC_IP="127.0.0.1"
fi

DEFAULT_PROJ="${SYNAPSE_DEFAULT_PROJECT:-default-project}"
TOKEN_JSON="$(curl -fsSL -X POST http://127.0.0.1:8081/api/v1/tokens -H 'Content-Type: application/json' -d "{\"project_id\":\"${DEFAULT_PROJ}\",\"tier\":\"TIER_2_WORKSPACE_JAIL\",\"ttl_minutes\":60}" 2>/dev/null || true)"
JOIN_TOKEN="$(printf '%s' "$TOKEN_JSON" | sed -n 's/.*"token"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"

echo ""
echo "=================================================================="
echo "  ✔ Synapse Core is ONLINE!"
echo "=================================================================="
echo "  • Control Center UI: http://${PUBLIC_IP}:3000"
echo "  • Core Gateway API:  http://${PUBLIC_IP}:8081"
echo "  • mTLS Yamux Tunnel: ${PUBLIC_IP}:8443"
echo ""
if [ -n "$JOIN_TOKEN" ]; then
  echo "  ► Connect a Remote Muscle Node (One-Command Installer + Token Login):"
  echo "    curl -fsSL http://${PUBLIC_IP}:8081/install.sh | sudo sh -s -- ${JOIN_TOKEN} TIER_2_WORKSPACE_JAIL"
  echo ""
fi
echo "=================================================================="
