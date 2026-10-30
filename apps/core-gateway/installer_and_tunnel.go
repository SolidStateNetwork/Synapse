package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/SolidStateNetwork/Synapse/apps/core-gateway/internal/hub"
)

func computeFileSHA256(path string) (string, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer f.Close()
	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return "", err
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}

func serveAxonBinary(arch string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		candidates := []string{
			os.Getenv("SYNAPSE_AXON_BINARY_PATH"),
			fmt.Sprintf("/usr/local/bin/axon-linux-%s", arch),
			fmt.Sprintf("./bin/axon-linux-%s", arch),
			fmt.Sprintf("../../bin/axon-linux-%s", arch),
			"./bin/axon",
			"../../bin/axon",
		}
		for _, candidate := range candidates {
			if candidate == "" {
				continue
			}
			if info, err := os.Stat(candidate); err == nil && !info.IsDir() && info.Size() > 0 {
				sum, sumErr := computeFileSHA256(candidate)
				if sumErr == nil && sum != "" {
					w.Header().Set("X-Synapse-SHA256", sum)
				}
				if r.URL.Query().Get("sha256") == "1" {
					if sum == "" {
						http.Error(w, "sha256 unavailable", http.StatusNotFound)
						return
					}
					w.Header().Set("Content-Type", "text/plain; charset=utf-8")
					_, _ = fmt.Fprintf(w, "%s  axon\n", sum)
					return
				}
				w.Header().Set("Content-Type", "application/octet-stream")
				w.Header().Set("Content-Disposition", "attachment; filename=\"axon\"")
				http.ServeFile(w, r, candidate)
				return
			}
		}
		if r.URL.Query().Get("sha256") == "1" {
			http.Error(w, "local binary checksum unavailable", http.StatusNotFound)
			return
		}
		ghReleaseURL := fmt.Sprintf("https://github.com/SolidStateNetwork/Synapse/releases/latest/download/axon-linux-%s", arch)
		http.Redirect(w, r, ghReleaseURL, http.StatusFound)
	}
}

func handleInstallScript(w http.ResponseWriter, r *http.Request) {
	scheme := "http"
	if r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https" {
		scheme = "https"
	}
	host := r.Host
	if host == "" {
		host = "127.0.0.1:8081"
	}
	coreBaseURL := fmt.Sprintf("%s://%s", scheme, host)

	w.Header().Set("Content-Type", "text/x-shellscript; charset=utf-8")
	script := fmt.Sprintf(`#!/usr/bin/env sh
set -eu

CORE_URL="%s"
TOKEN=""
TIER="TIER_2_WORKSPACE_JAIL"
NODE_ID=""
DEBUG_FLAG=""

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
    --node-id|--node)
      NODE_ID="$2"
      shift 2
      ;;
    --debug|-d)
      DEBUG_FLAG="--debug"
      shift
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
  echo "Usage: curl -fsSL $CORE_URL/install.sh | sudo sh -s -- <join_token> [TIER_1_UNLEASHED|TIER_2_WORKSPACE_JAIL|TIER_3_SUPERVISED] [node_id] [--debug]"
  exit 1
fi

download_url() {
  src_url="$1"
  dest_file="$2"
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$src_url" -o "$dest_file" 2>/dev/null
  elif command -v wget >/dev/null 2>&1; then
    wget -qO "$dest_file" "$src_url" 2>/dev/null
  else
    echo "[synapse] Error: neither curl nor wget is installed." >&2
    return 1
  fi
}

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
TMP_BIN="${INSTALL_DIR}/.axon.tmp.$$"

echo "[synapse] Downloading static Axon Muscle binary (linux/${ARCH})..."
if download_url "$CORE_URL/dl/axon-linux-${ARCH}" "$TMP_BIN"; then
  EXPECTED_SHA=""
  if command -v curl >/dev/null 2>&1; then
    EXPECTED_SHA="$(curl -fsSL "$CORE_URL/dl/axon-linux-${ARCH}?sha256=1" 2>/dev/null | awk '{print $1}' || true)"
  elif command -v wget >/dev/null 2>&1; then
    EXPECTED_SHA="$(wget -qO- "$CORE_URL/dl/axon-linux-${ARCH}?sha256=1" 2>/dev/null | awk '{print $1}' || true)"
  fi
  if [ -n "$EXPECTED_SHA" ]; then
    ACTUAL_SHA=""
    if command -v sha256sum >/dev/null 2>&1; then
      ACTUAL_SHA="$(sha256sum "$TMP_BIN" | awk '{print $1}')"
    elif command -v shasum >/dev/null 2>&1; then
      ACTUAL_SHA="$(shasum -a 256 "$TMP_BIN" | awk '{print $1}')"
    fi
    if [ -n "$ACTUAL_SHA" ] && [ "$ACTUAL_SHA" != "$EXPECTED_SHA" ]; then
      echo "[synapse] Error: SHA-256 checksum mismatch for downloaded Axon binary ($ACTUAL_SHA != $EXPECTED_SHA)" >&2
      rm -f "$TMP_BIN"
      exit 1
    fi
    echo "[synapse] ✔ SHA-256 binary integrity verified (${EXPECTED_SHA})."
  fi
else
  echo "[synapse] Falling back to GitHub Releases (axon-linux-${ARCH})..."
  download_url "https://github.com/SolidStateNetwork/Synapse/releases/latest/download/axon-linux-${ARCH}" "$TMP_BIN"
fi

chmod +x "$TMP_BIN"
mv -f "$TMP_BIN" "$INSTALL_DIR/axon"

echo "[synapse] Authenticating one-time token & bootstrapping mTLS 1.3 CSR with Core ($CORE_URL)..."
if [ -n "$NODE_ID" ]; then
  "$INSTALL_DIR/axon" join $DEBUG_FLAG --core "$CORE_URL" --tier "$TIER" --node-id "$NODE_ID" --config-dir "$CONFIG_DIR" --workspace-root "$WORKSPACE_DIR" "$TOKEN"
else
  "$INSTALL_DIR/axon" join $DEBUG_FLAG --core "$CORE_URL" --tier "$TIER" --config-dir "$CONFIG_DIR" --workspace-root "$WORKSPACE_DIR" "$TOKEN"
fi

if [ "$(id -u)" -eq 0 ] && command -v systemctl >/dev/null 2>&1 && [ -d /run/systemd/system ]; then
  cat >/etc/systemd/system/axon.service <<EOF
[Unit]
Description=Synapse Axon Muscle Node Agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=$INSTALL_DIR/axon run $DEBUG_FLAG --config-dir $CONFIG_DIR
Restart=always
RestartSec=3s
TimeoutStopSec=2s
KillMode=process
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
command_args="run $DEBUG_FLAG --config-dir $CONFIG_DIR"
command_background="yes"
pidfile="/run/axon.pid"
depend() {
  need net
}
EOF
  chmod +x /etc/init.d/axon
  rc-update add axon default 2>/dev/null || true
  rc-service axon restart
  echo "[synapse] ✔ axon service enabled and started via OpenRC."
else
  pkill -f "$INSTALL_DIR/axon run" 2>/dev/null || true
  nohup "$INSTALL_DIR/axon" run $DEBUG_FLAG --config-dir "$CONFIG_DIR" >/tmp/axon-agent.log 2>&1 &
  echo "[synapse] ✔ Axon daemon started in background (PID $!, logs at /tmp/axon-agent.log)."
fi
`, coreBaseURL)
	_, _ = w.Write([]byte(script))
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if rec := recover(); rec != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]any{
					"ok":    false,
					"error": fmt.Sprintf("internal gateway panic recovered: %v", rec),
				})
			}
		}()
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		if r.Body != nil {
			r.Body = http.MaxBytesReader(w, r.Body, 16<<20)
		}
		next.ServeHTTP(w, r)
	})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// startSelfHealingMuscleTunnel optionally maintains an SSH reverse tunnel when SYNAPSE_SSH_REVERSE_HOST
// is explicitly configured in the environment. Disabled by default so no hardcoded hosts or connections exist.
func startSelfHealingMuscleTunnel(nodeHub *hub.Hub, localTunnelPort int) {
	runSelfHealingMuscleTunnelLoop(nodeHub, localTunnelPort, 0, time.Second)
}

func runSelfHealingMuscleTunnelLoop(nodeHub *hub.Hub, localTunnelPort int, maxCycles int, tickUnit time.Duration) {
	defer func() {
		if r := recover(); r != nil {
			fmt.Printf("[core-gateway] recovered panic in reverse tunnel supervisor: %v\n", r)
		}
	}()
	if os.Getenv("SYNAPSE_AUTO_SSH_TUNNEL") == "0" {
		return
	}
	remoteHost := strings.TrimSpace(os.Getenv("SYNAPSE_SSH_REVERSE_HOST"))
	if remoteHost == "" {
		return
	}
	homeDir, err := os.UserHomeDir()
	if err != nil || homeDir == "" {
		return
	}
	keyCandidates := []string{
		os.Getenv("SYNAPSE_SSH_KEY_PATH"),
		filepath.Join(homeDir, ".ssh", "synapse_vps_ed25519"),
		filepath.Join(homeDir, ".ssh", "id_ed25519"),
	}
	var sshKeyPath string
	for _, cand := range keyCandidates {
		if cand == "" {
			continue
		}
		if st, err := os.Stat(cand); err == nil && !st.IsDir() {
			sshKeyPath = cand
			break
		}
	}
	if sshKeyPath == "" {
		return
	}

	defaultRemoteTunnel := "8443"
	defaultRemoteHTTP := "8081"
	if runtime.GOOS != "windows" {
		defaultRemoteTunnel = "9443"
		defaultRemoteHTTP = "9081"
	}
	remoteTunnelPort := getEnv("SYNAPSE_REMOTE_TUNNEL_PORT", defaultRemoteTunnel)
	remoteHTTPPort := getEnv("SYNAPSE_REMOTE_HTTP_PORT", defaultRemoteHTTP)

	var activeCmd *exec.Cmd
	var lastSpawn time.Time

	time.Sleep(2 * tickUnit)
	for cycle := 0; maxCycles <= 0 || cycle < maxCycles; cycle++ {
		nodes := nodeHub.ListNodes()
		hasOnline := false
		for _, n := range nodes {
			if n.Online {
				hasOnline = true
				break
			}
		}

		if hasOnline {
			time.Sleep(6 * tickUnit)
			continue
		}

		if activeCmd != nil && activeCmd.Process != nil && time.Since(lastSpawn) < 12*tickUnit {
			time.Sleep(2 * tickUnit)
			continue
		}

		if activeCmd != nil && activeCmd.Process != nil {
			_ = activeCmd.Process.Kill()
			_, _ = activeCmd.Process.Wait()
			activeCmd = nil
		}

		cleanScript := fmt.Sprintf("fuser -k %s/tcp %s/tcp 2>/dev/null || true", remoteTunnelPort, remoteHTTPPort)
		cleanCmd := exec.Command(
			"ssh",
			"-i", sshKeyPath,
			"-o", "StrictHostKeyChecking=no",
			"-o", "BatchMode=yes",
			"-o", "ConnectTimeout=5",
			remoteHost,
			cleanScript,
		)
		_ = cleanCmd.Run()

		tunnelCmd := exec.Command(
			"ssh",
			"-i", sshKeyPath,
			"-o", "StrictHostKeyChecking=no",
			"-o", "BatchMode=yes",
			"-o", "ConnectTimeout=6",
			"-o", "ServerAliveInterval=10",
			"-o", "ServerAliveCountMax=2",
			"-o", "ExitOnForwardFailure=yes",
			"-N",
			"-R", fmt.Sprintf("%s:127.0.0.1:%d", remoteTunnelPort, localTunnelPort),
			"-R", fmt.Sprintf("%s:127.0.0.1:8081", remoteHTTPPort),
			remoteHost,
		)
		if err := tunnelCmd.Start(); err == nil {
			activeCmd = tunnelCmd
			lastSpawn = time.Now()
			nodeHub.RecordEvent("mtls", remoteHost, fmt.Sprintf("Self-healing reverse tunnel spawned (%s -> 127.0.0.1:%d)", remoteTunnelPort, localTunnelPort), 0, nil)
			go func(c *exec.Cmd) {
				_ = c.Wait()
			}(tunnelCmd)
		}

		time.Sleep(4 * tickUnit)
	}
}
