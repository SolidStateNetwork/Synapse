#!/usr/bin/env sh
set -eu

CORE_URL="${SYNAPSE_CORE_URL:-http://127.0.0.1:8081}"
TOKEN="${SYNAPSE_JOIN_TOKEN:-}"
TIER="TIER_2_WORKSPACE_JAIL"
NODE_ID=""

while [ "$#" -gt 0 ]; do
  case "$1" in
    --core)
      CORE_URL="$2"
      shift 2
      ;;
    --token)
      TOKEN="$2"
      shift 2
      ;;
    --tier)
      TIER="$2"
      shift 2
      ;;
    --node-id)
      NODE_ID="$2"
      shift 2
      ;;
    *)
      if [ -z "$TOKEN" ]; then
        TOKEN="$1"
      elif [ "$TIER" = "TIER_2_WORKSPACE_JAIL" ] && ( [ "$1" = "TIER_1_UNLEASHED" ] || [ "$1" = "TIER_2_WORKSPACE_JAIL" ] || [ "$1" = "TIER_3_SUPERVISED" ] ); then
        TIER="$1"
      elif [ -z "$NODE_ID" ]; then
        NODE_ID="$1"
      fi
      shift
      ;;
  esac
done

if [ -z "$TOKEN" ]; then
  echo "Usage: curl -fsSL <CORE_URL>/install.sh | sudo sh -s -- <JOIN_TOKEN> [TIER_1_UNLEASHED|TIER_2_WORKSPACE_JAIL|TIER_3_SUPERVISED] [NODE_ID]"
  echo "   or: curl -fsSL https://raw.githubusercontent.com/SolidStateNetwork/Synapse/main/scripts/install-axon.sh | sudo sh -s -- --core http://<CORE_IP>:8081 --token <JOIN_TOKEN>"
  exit 1
fi

ARCH_RAW="$(uname -m)"
case "$ARCH_RAW" in
  x86_64|amd64) ARCH="amd64" ;;
  aarch64|arm64) ARCH="arm64" ;;
  *) ARCH="amd64" ;;
esac

INSTALL_DIR="/usr/local/bin"
CONFIG_DIR="/etc/axon"
WORKSPACE_DIR="/opt/axon/workspaces"

if [ "$(id -u)" -ne 0 ]; then
  INSTALL_DIR="${HOME}/.local/bin"
  CONFIG_DIR="${HOME}/.config/axon"
  WORKSPACE_DIR="${HOME}/.local/share/axon/workspaces"
fi

mkdir -p "$INSTALL_DIR" "$CONFIG_DIR" "$WORKSPACE_DIR"

echo "[synapse] 1/3 Downloading static Axon Muscle binary (linux/${ARCH})..."
if ! curl -fsSL "${CORE_URL%/}/dl/axon-linux-${ARCH}" -o "$INSTALL_DIR/axon" 2>/dev/null; then
  echo "[synapse] Downloading from GitHub Releases (axon-linux-${ARCH})..."
  curl -fsSL "https://github.com/SolidStateNetwork/Synapse/releases/latest/download/axon-linux-${ARCH}" -o "$INSTALL_DIR/axon"
fi
chmod +x "$INSTALL_DIR/axon"

echo "[synapse] 2/3 Authenticating with One-Time Token & bootstrapping mTLS 1.3 CSR with Core (${CORE_URL})..."
if [ -n "$NODE_ID" ]; then
  "$INSTALL_DIR/axon" join --core "$CORE_URL" --tier "$TIER" --node-id "$NODE_ID" --config-dir "$CONFIG_DIR" --workspace-root "$WORKSPACE_DIR" "$TOKEN"
else
  "$INSTALL_DIR/axon" join --core "$CORE_URL" --tier "$TIER" --config-dir "$CONFIG_DIR" --workspace-root "$WORKSPACE_DIR" "$TOKEN"
fi

echo "[synapse] 3/3 Starting Axon Muscle Reverse Tunnel daemon..."
if [ "$(id -u)" -eq 0 ] && command -v systemctl >/dev/null 2>&1 && [ -d /run/systemd/system ]; then
  cat >/etc/systemd/system/axon.service <<EOF
[Unit]
Description=Synapse Axon Muscle Node Agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=$INSTALL_DIR/axon run --config-dir $CONFIG_DIR
Restart=always
RestartSec=3s
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable --now axon.service
  echo "[synapse] ✔ axon.service enabled and started via systemd (mTLS + Yamux Reverse Tunnel active)."
else
  pkill -f "$INSTALL_DIR/axon run --config-dir $CONFIG_DIR" 2>/dev/null || true
  nohup "$INSTALL_DIR/axon" run --config-dir "$CONFIG_DIR" >/tmp/axon-agent.log 2>&1 &
  echo "[synapse] ✔ Axon daemon started in background (PID $!, logs at /tmp/axon-agent.log)."
fi
