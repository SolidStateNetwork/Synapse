#!/usr/bin/env bash
set -euo pipefail

CONFIG_DIR="${AXON_CONFIG_DIR:-/etc/axon}"
WORKSPACE_DIR="${AXON_WORKSPACE_DIR:-/opt/axon/workspaces}"
CORE_HTTP_URL="${SYNAPSE_CORE_HTTP_URL:-http://synapse-core:8081}"
CORE_TUNNEL_ADDR="${SYNAPSE_CORE_TUNNEL_ADDR:-}"
NODE_ID="${AXON_NODE_ID:-local-muscle}"
TIER="${AXON_TIER:-TIER_1_UNLEASHED}"
AXON_BIN="${AXON_BIN_PATH:-/usr/local/bin/axon}"

mkdir -p "$CONFIG_DIR" "$WORKSPACE_DIR"

echo "[synapse-muscle] Waiting for Synapse Core Gateway at ${CORE_HTTP_URL}/healthz..."
for _ in $(seq 1 40); do
  if curl -fsS "${CORE_HTTP_URL}/healthz" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if [ ! -f "${CONFIG_DIR}/config.json" ] || [ ! -f "${CONFIG_DIR}/node.crt" ]; then
  echo "[synapse-muscle] Bootstrapping mTLS identity for node '${NODE_ID}' (${TIER})..."
  TOKEN_JSON="$(curl -fsS -X POST "${CORE_HTTP_URL}/api/v1/tokens" -H "Content-Type: application/json" -d "{\"tier\":\"${TIER}\"}")"
  JOIN_TOKEN="$(printf '%s' "$TOKEN_JSON" | sed -n 's/.*"token"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
  if [ -z "$JOIN_TOKEN" ]; then
    echo "[synapse-muscle] ERROR: Failed to obtain CSR join token from ${CORE_HTTP_URL}/api/v1/tokens"
    exit 1
  fi

  GW_ARGS=()
  if [ -n "$CORE_TUNNEL_ADDR" ]; then
    GW_ARGS=(--gateway "$CORE_TUNNEL_ADDR")
  fi

  "$AXON_BIN" join \
    --config-dir "$CONFIG_DIR" \
    --core "$CORE_HTTP_URL" \
    --node-id "$NODE_ID" \
    --tier "$TIER" \
    --workspace-root "$WORKSPACE_DIR" \
    "${GW_ARGS[@]}" \
    "$JOIN_TOKEN"
fi

echo "[synapse-muscle] Starting Axon mTLS + Yamux Reverse Tunnel (node=${NODE_ID})..."
exec "$AXON_BIN" run --config-dir "$CONFIG_DIR"
