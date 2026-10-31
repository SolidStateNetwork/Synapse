#!/usr/bin/env bash
set -euo pipefail

# Synapse Core High-Availability (HA) & Self-Healing Bootstrap Script
# Ensures local systemd --user units for Core Gateway and Core WebUI (plus an optional
# SSH reverse tunnel if SYNAPSE_SSH_REVERSE_HOST is explicitly set) are installed and active.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SYSTEMD_USER_DIR="${HOME}/.config/systemd/user"
SSH_REVERSE_HOST="${SYNAPSE_SSH_REVERSE_HOST:-}"
REMOTE_TUNNEL_PORT="${SYNAPSE_REMOTE_TUNNEL_PORT:-9443}"
REMOTE_HTTP_PORT="${SYNAPSE_REMOTE_HTTP_PORT:-9081}"

mkdir -p "${SYSTEMD_USER_DIR}"

cat > "${SYSTEMD_USER_DIR}/synapse-core-gateway.service" <<EOF
[Unit]
Description=Synapse Core Gateway (HTTP :8081 & mTLS Yamux Hub :8443)
After=network-online.target

[Service]
Type=simple
WorkingDirectory=${REPO_ROOT}
Environment=SYNAPSE_DATA_DIR=${REPO_ROOT}/.synapse-data
Environment=SYNAPSE_AXON_BINARY_PATH=${REPO_ROOT}/bin/axon
ExecStart=${REPO_ROOT}/bin/core-gateway
Restart=always
RestartSec=2s
LimitNOFILE=65535

[Install]
WantedBy=default.target
EOF

cat > "${SYSTEMD_USER_DIR}/synapse-core-web.service" <<EOF
[Unit]
Description=Synapse Core WebUI Control Center (:3000)
After=network-online.target synapse-core-gateway.service

[Service]
Type=simple
WorkingDirectory=${REPO_ROOT}/apps/core-web
Environment=SYNAPSE_VAULT_DIR=${REPO_ROOT}/.synapse-data/projects
Environment=SYNAPSE_CARTRIDGES_DIR=${REPO_ROOT}/cartridges
Environment=CORE_GATEWAY_URL=http://127.0.0.1:8081
Environment=PORT=3000
ExecStartPre=-/usr/bin/cp -r ${REPO_ROOT}/apps/core-web/.next/static ${REPO_ROOT}/apps/core-web/.next/standalone/.next/
ExecStart=/usr/bin/node ${REPO_ROOT}/apps/core-web/.next/standalone/server.js
Restart=always
RestartSec=2s

[Install]
WantedBy=default.target
EOF

SERVICES_TO_START=("synapse-core-gateway.service" "synapse-core-web.service")

if [ -n "${SSH_REVERSE_HOST}" ]; then
  cat > "${SYSTEMD_USER_DIR}/synapse-reverse-tunnel.service" <<EOF
[Unit]
Description=Self-Healing mTLS Reverse Tunnel (${REMOTE_TUNNEL_PORT} -> 127.0.0.1:8443, ${REMOTE_HTTP_PORT} -> 127.0.0.1:8081)
After=network-online.target synapse-core-gateway.service

[Service]
Type=simple
ExecStartPre=-/usr/bin/ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 ${SSH_REVERSE_HOST} "fuser -k ${REMOTE_TUNNEL_PORT}/tcp ${REMOTE_HTTP_PORT}/tcp 2>/dev/null || true"
ExecStart=/usr/bin/ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=10 -o ServerAliveCountMax=2 -o ExitOnForwardFailure=yes -N -R ${REMOTE_TUNNEL_PORT}:127.0.0.1:8443 -R ${REMOTE_HTTP_PORT}:127.0.0.1:8081 ${SSH_REVERSE_HOST}
Restart=always
RestartSec=2s

[Install]
WantedBy=default.target
EOF
  SERVICES_TO_START+=("synapse-reverse-tunnel.service")
fi

systemctl --user daemon-reload
systemctl --user enable "${SERVICES_TO_START[@]}"
systemctl --user restart "${SERVICES_TO_START[@]}"
echo "[synapse-ha] High-Availability systemd --user services (${SERVICES_TO_START[*]}) enabled and active."
