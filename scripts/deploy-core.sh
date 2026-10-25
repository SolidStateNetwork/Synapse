#!/usr/bin/env bash
set -euo pipefail

echo "=================================================================="
echo "  Synapse Core ('The Brain') — One-Command Docker Deployment"
echo "=================================================================="

if ! command -v docker >/dev/null 2>&1; then
  echo "[error] Docker is not installed. Please install Docker first: https://docs.docker.com/engine/install/"
  exit 1
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
if docker compose pull; then
  docker compose up -d
else
  echo "[synapse] GHCR pull unavailable; building images from GitHub repository source..."
  if [ ! -d src ]; then
    git clone --depth 1 https://github.com/SolidStateNetwork/Synapse.git src
  fi
  cd src
  cp "$DEPLOY_DIR/.env" .env
  docker compose up --build -d
fi

echo "[synapse] Waiting for Core Gateway (:8081) and mTLS Hub (:8443) to become ready..."
for _ in $(seq 1 30); do
  if curl -fsSL http://127.0.0.1:8081/healthz >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

PUBLIC_IP="$(hostname -I 2>/dev/null | awk '{print $1}' || echo '127.0.0.1')"
if [ -z "$PUBLIC_IP" ]; then
  PUBLIC_IP="127.0.0.1"
fi

TOKEN_JSON="$(curl -fsSL -X POST http://127.0.0.1:8081/api/v1/tokens -H 'Content-Type: application/json' -d '{"project_id":"synapse-cloud-demo","tier":"TIER_2_WORKSPACE_JAIL","ttl_minutes":60}' 2>/dev/null || true)"
JOIN_TOKEN="$(printf '%s' "$TOKEN_JSON" | sed -n 's/.*"token"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"

echo ""
echo "=================================================================="
echo "  ✔ Synapse Core is ONLINE!"
echo "=================================================================="
echo "  • Studio WebUI:      http://${PUBLIC_IP}:3000"
echo "  • Core Gateway API:  http://${PUBLIC_IP}:8081"
echo "  • mTLS Yamux Tunnel: ${PUBLIC_IP}:8443"
echo ""
if [ -n "$JOIN_TOKEN" ]; then
  echo "  ► Connect a Remote Muscle Node (One-Command Installer + Token Login):"
  echo "    curl -fsSL http://${PUBLIC_IP}:8081/install.sh | sudo sh -s -- ${JOIN_TOKEN} TIER_2_WORKSPACE_JAIL"
  echo ""
fi
echo "=================================================================="
