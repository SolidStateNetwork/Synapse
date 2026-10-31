#!/usr/bin/env bash
set -euo pipefail

mkdir -p "${SYNAPSE_DATA_DIR:-/var/lib/synapse}/projects"

echo "[synapse-core] Starting Core Gateway on :8081 (HTTP) and :8443 (mTLS Tunnel)..."
/usr/local/bin/core-gateway &
GW_PID=$!

for _ in $(seq 1 20); do
  if wget -qO- http://127.0.0.1:8081/healthz >/dev/null 2>&1 || curl -fsS http://127.0.0.1:8081/healthz >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done

echo "[synapse-core] Starting Core WebUI on :${PORT:-3000}..."
node /app/server.js &
WEB_PID=$!

trap 'kill -TERM "$GW_PID" "$WEB_PID" 2>/dev/null || true; wait' INT TERM
wait -n "$GW_PID" "$WEB_PID"
