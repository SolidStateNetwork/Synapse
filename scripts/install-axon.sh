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

if [ "$(id -u)" -ne 0 ] || [ ! -w "/usr/local" ]; then
  INSTALL_DIR="${HOME:-/tmp}/.local/bin"
  CONFIG_DIR="${HOME:-/tmp}/.config/axon"
  WORKSPACE_DIR="${HOME:-/tmp}/.local/share/axon/workspaces"
fi

mkdir -p "$INSTALL_DIR" "$CONFIG_DIR" "$WORKSPACE_DIR"

download_url() {
  SRC_URL="$1"
  DEST_FILE="$2"
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL --retry 2 --connect-timeout 10 "$SRC_URL" -o "$DEST_FILE" 2>/dev/null
    return $?
  elif command -v wget >/dev/null 2>&1; then
    wget -qO "$DEST_FILE" --timeout=10 "$SRC_URL" 2>/dev/null
    return $?
  else
    echo "[synapse] ERROR: Neither curl nor wget is installed." >&2
    return 1
  fi
}

fetch_text() {
  SRC_URL="$1"
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL --connect-timeout 5 "$SRC_URL" 2>/dev/null || true
  elif command -v wget >/dev/null 2>&1; then
    wget -qO- --timeout=5 "$SRC_URL" 2>/dev/null || true
  fi
}

verify_sha256() {
  FILE_PATH="$1"
  EXPECTED_RAW="$2"
  EXPECTED="$(printf '%s' "$EXPECTED_RAW" | awk '{print $1}' | tr -d '[:space:]')"
  if [ -z "$EXPECTED" ] || [ "${#EXPECTED}" -ne 64 ]; then
    return 0
  fi
  ACTUAL=""
  if command -v sha256sum >/dev/null 2>&1; then
    ACTUAL="$(sha256sum "$FILE_PATH" | awk '{print $1}')"
  elif command -v shasum >/dev/null 2>&1; then
    ACTUAL="$(shasum -a 256 "$FILE_PATH" | awk '{print $1}')"
  fi
  if [ -n "$ACTUAL" ] && [ "$ACTUAL" != "$EXPECTED" ]; then
    echo "[synapse] ERROR: SHA-256 checksum mismatch! Expected $EXPECTED, got $ACTUAL" >&2
    return 1
  fi
  if [ -n "$ACTUAL" ]; then
    echo "[synapse] ✔ SHA-256 binary integrity verified (${ACTUAL})"
  fi
  return 0
}

echo "[synapse] 1/3 Downloading static Axon Muscle binary (linux/${ARCH})..."
TMP_BIN="$INSTALL_DIR/axon.tmp.$$"
CORE_BASE="${CORE_URL%/}"
if download_url "${CORE_BASE}/dl/axon-linux-${ARCH}" "$TMP_BIN"; then
  EXPECTED_SHA="$(fetch_text "${CORE_BASE}/dl/axon-linux-${ARCH}?sha256=1")"
  if ! verify_sha256 "$TMP_BIN" "$EXPECTED_SHA"; then
    rm -f "$TMP_BIN"
    exit 1
  fi
else
  echo "[synapse] Core binary endpoint unavailable; downloading from GitHub Releases (axon-linux-${ARCH})..."
  download_url "https://github.com/SolidStateNetwork/Synapse/releases/latest/download/axon-linux-${ARCH}" "$TMP_BIN"
fi
chmod 0755 "$TMP_BIN"
mv -f "$TMP_BIN" "$INSTALL_DIR/axon"

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
Environment="PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
ExecStart=$INSTALL_DIR/axon run --config-dir $CONFIG_DIR
KillMode=process
Restart=always
RestartSec=3s
TimeoutStopSec=3s
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable --now axon.service
  echo "[synapse] ✔ axon.service enabled and started via systemd (mTLS + Yamux Reverse Tunnel active)."
elif [ "$(id -u)" -eq 0 ] && command -v rc-service >/dev/null 2>&1 && [ -d /etc/init.d ]; then
  cat >/etc/init.d/axon <<EOF
#!/sbin/openrc-run
name="Synapse Axon Muscle Node Agent"
command="$INSTALL_DIR/axon"
command_args="run --config-dir $CONFIG_DIR"
command_background=true
pidfile="/run/axon.pid"
output_log="/var/log/axon.log"
error_log="/var/log/axon.err"
depend() {
  need net
}
EOF
  chmod 0755 /etc/init.d/axon
  rc-update add axon default >/dev/null 2>&1 || true
  rc-service axon restart
  echo "[synapse] ✔ axon service enabled and started via OpenRC."
else
  pkill -f "$INSTALL_DIR/axon run --config-dir $CONFIG_DIR" 2>/dev/null || true
  nohup "$INSTALL_DIR/axon" run --config-dir "$CONFIG_DIR" >/tmp/axon-agent.log 2>&1 </dev/null &
  echo "[synapse] ✔ Axon daemon started in background (PID $!, logs at /tmp/axon-agent.log)."
fi
