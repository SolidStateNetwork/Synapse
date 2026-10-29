#!/usr/bin/env bash
set -euo pipefail

# Synapse Core High-Availability (HA) & Self-Healing Bootstrap Script
# Ensures local systemd --user units for Core Gateway, Core WebUI, and the mTLS Reverse Tunnel
# are installed, enabled, and active, and clears stale remote port forwardings automatically.

REPO_ROOT="/home/denis/Projekte/Synapse"
SYSTEMD_USER_DIR="${HOME}/.config/systemd/user"
VPS2_HOST="root@217.154.20.24"

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
ExecStart=/usr/bin/node ${REPO_ROOT}/apps/core-web/.next/standalone/server.js
Restart=always
RestartSec=2s

[Install]
WantedBy=default.target
EOF

cat > "${SYSTEMD_USER_DIR}/synapse-vps2-tunnel.service" <<EOF
[Unit]
Description=Self-Healing mTLS Reverse Tunnel to vps2-muscle (8443 & 9443 -> 127.0.0.1:8443)
After=network-online.target synapse-core-gateway.service

[Service]
Type=simple
ExecStartPre=-/usr/bin/ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 ${VPS2_HOST} "fuser -k 8443/tcp 9443/tcp 2>/dev/null || true"
ExecStart=/usr/bin/ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=10 -o ServerAliveCountMax=2 -o ExitOnForwardFailure=yes -N -R 8443:127.0.0.1:8443 -R 9443:127.0.0.1:8443 ${VPS2_HOST}
Restart=always
RestartSec=2s

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable synapse-core-gateway.service synapse-core-web.service synapse-vps2-tunnel.service
systemctl --user restart synapse-core-gateway.service synapse-core-web.service synapse-vps2-tunnel.service
echo "[synapse-ha] All 3 High-Availability systemd --user services enabled and active."
