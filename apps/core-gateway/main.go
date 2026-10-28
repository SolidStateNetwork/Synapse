package main

import (
	"crypto/tls"
	"encoding/base64"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/SolidStateNetwork/Synapse/apps/core-gateway/internal/hub"
	"github.com/SolidStateNetwork/Synapse/apps/core-gateway/internal/pki"
	"github.com/SolidStateNetwork/Synapse/apps/core-gateway/internal/proxy"
	tunnelv1 "github.com/SolidStateNetwork/Synapse/proto"
)

func main() {
	debugFlag := flag.Bool("debug", false, "Enable verbose debug trace logging and HTTP request inspection")
	flag.Parse()

	debugEnv := os.Getenv("SYNAPSE_DEBUG") == "1" || strings.EqualFold(os.Getenv("SYNAPSE_DEBUG"), "true")
	debugMode := *debugFlag || debugEnv
	if debugMode {
		log.SetFlags(log.LstdFlags | log.Lmicroseconds | log.Lshortfile)
		log.Printf("[core-gateway:DEBUG] Verbose Debug Mode ENABLED")
	}

	dataDir := getEnv("SYNAPSE_DATA_DIR", "/var/lib/synapse")
	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		dataDir = filepath.Join(os.TempDir(), "synapse-data")
		_ = os.MkdirAll(dataDir, 0o755)
	}
	vaultRoot := filepath.Join(dataDir, "projects")
	_ = os.MkdirAll(vaultRoot, 0o755)

	tunnelPortStr := getEnv("SYNAPSE_TUNNEL_PORT", "8443")
	tunnelPort, err := strconv.Atoi(tunnelPortStr)
	if err != nil || tunnelPort == 0 {
		tunnelPort = 8443
	}
	httpAddr := getEnv("SYNAPSE_GATEWAY_HTTP_ADDR", ":8081")

	authority, err := pki.NewAuthority(dataDir)
	if err != nil {
		log.Fatalf("[core-gateway] failed to initialize mTLS PKI authority: %v", err)
	}

	nodeHub := hub.NewHub(vaultRoot)
	if debugMode {
		nodeHub.SetDebugEnabled(true)
	}

	// Start mTLS + Yamux Listener for Axon Muscle Nodes
	go func() {
		listenAddr := fmt.Sprintf(":%d", tunnelPort)
		tlsListener, err := tls.Listen("tcp", listenAddr, authority.ServerTLSConfig())
		if err != nil {
			log.Fatalf("[core-gateway] failed to listen on mTLS port %s: %v", listenAddr, err)
		}
		log.Printf("[core-gateway] mTLS + Yamux Reverse Tunnel Server listening on %s (debug=%v)", listenAddr, nodeHub.IsDebugEnabled())
		if err := nodeHub.ServeMTLS(tlsListener); err != nil {
			log.Fatalf("[core-gateway] mTLS server error: %v", err)
		}
	}()

	mux := http.NewServeMux()
	startedAt := time.Now()

	// Health check
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{
			"status":          "ok",
			"service":         "synapse-core-gateway",
			"version":         "v0.3.0",
			"uptime_sec":      int64(time.Since(startedAt).Seconds()),
			"tunnel_port":     tunnelPort,
			"debug_enabled":   nodeHub.IsDebugEnabled(),
			"connected_nodes": len(nodeHub.ListNodes()),
		})
	})

	// Debug & Self-Test Endpoint (/api/v1/debug)
	mux.HandleFunc("/api/v1/debug", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			var body struct {
				Action  string `json:"action"` // set_debug | clear_events | ping_nodes
				Enabled *bool  `json:"enabled"`
			}
			_ = json.NewDecoder(r.Body).Decode(&body)
			switch body.Action {
			case "set_debug", "toggle":
				next := !nodeHub.IsDebugEnabled()
				if body.Enabled != nil {
					next = *body.Enabled
				}
				nodeHub.SetDebugEnabled(next)
			case "clear_events":
				nodeHub.ClearDebugEvents()
			case "ping_nodes":
				nodes := nodeHub.ListNodes()
				pingResults := make([]map[string]any, 0, len(nodes))
				for _, n := range nodes {
					start := time.Now()
					fsResp, fsErr := nodeHub.ExecFs(n.NodeID, tunnelv1.FsRequest{
						RequestID: fmt.Sprintf("dbg-fs-%d", time.Now().UnixNano()),
						ProjectID: "synapse-cloud-demo",
						Tier:      n.Tier,
						Operation: tunnelv1.FsOpListDir,
						Path:      ".",
					})
					ptyResp, ptyErr := nodeHub.ExecPty(n.NodeID, tunnelv1.PtyExecRequest{
						CmdID:         fmt.Sprintf("dbg-pty-%d", time.Now().UnixNano()),
						SessionID:     "debug-self-test",
						ProjectID:     "synapse-cloud-demo",
						Tier:          n.Tier,
						Command:       "echo SYNAPSE_DEBUG_PING_OK && uname -a",
						WaitTimeoutMs: 5000,
					})
					pingResults = append(pingResults, map[string]any{
						"node_id":     n.NodeID,
						"latency_ms":  time.Since(start).Milliseconds(),
						"fs_ok":       fsErr == nil && fsResp.Success,
						"fs_entries":  len(fsResp.Entries),
						"pty_ok":      ptyErr == nil && ptyResp.ExitCode == 0,
						"pty_output":  strings.TrimSpace(ptyResp.Output),
						"current_cwd": ptyResp.Cwd,
					})
				}
				writeJSON(w, http.StatusOK, map[string]any{
					"debug_enabled": nodeHub.IsDebugEnabled(),
					"ping_results":  pingResults,
					"events":        nodeHub.GetDebugEvents(),
				})
				return
			}
		}

		writeJSON(w, http.StatusOK, map[string]any{
			"service":         "synapse-core-gateway",
			"debug_enabled":   nodeHub.IsDebugEnabled(),
			"data_dir":        dataDir,
			"vault_root":      vaultRoot,
			"tunnel_port":     tunnelPort,
			"http_addr":       httpAddr,
			"active_tokens":   len(authority.ListTokens()),
			"connected_nodes": nodeHub.ListNodes(),
			"events":          nodeHub.GetDebugEvents(),
		})
	})

	// 1. Issue One-Time CSR Join Token
	mux.HandleFunc("/api/v1/tokens", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			writeJSON(w, http.StatusOK, map[string]any{"tokens": authority.ListTokens()})
			return
		}
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		var body struct {
			ProjectID  string                `json:"project_id"`
			Tier       tunnelv1.AutonomyTier `json:"tier"`
			TTLMinutes int                   `json:"ttl_minutes"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		ttl := time.Duration(body.TTLMinutes) * time.Minute
		tok := authority.CreateJoinToken(body.ProjectID, body.Tier, ttl)
		nodeHub.RecordEvent("bootstrap", "", fmt.Sprintf("Issued join token for project=%s tier=%s", body.ProjectID, tok.Tier), 0, nil)
		writeJSON(w, http.StatusCreated, tok)
	})

	// 2. CSR Bootstrap Endpoint called by `axon join <token>` or `axon switch`
	mux.HandleFunc("/api/v1/bootstrap/csr", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		start := time.Now()
		var req tunnelv1.CSRBootstrapRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, tunnelv1.CSRBootstrapResponse{
				Success: false,
				Error:   fmt.Sprintf("invalid JSON: %v", err),
			})
			return
		}
		certPEM, tier, projectID, err := authority.SignNodeCSR(req)
		if err != nil {
			nodeHub.RecordEvent("bootstrap", req.NodeID, fmt.Sprintf("CSR bootstrap rejected: %v", err), time.Since(start).Milliseconds(), nil)
			writeJSON(w, http.StatusUnauthorized, tunnelv1.CSRBootstrapResponse{
				Success: false,
				Error:   err.Error(),
			})
			return
		}
		if projectID != "" {
			nodeHub.EnsureNodeAssignedToProject(projectID, req.NodeID, tier)
		}
		log.Printf("[core-gateway] signed X.509 mTLS certificate for node %q (tier=%s, project=%s)", req.NodeID, tier, projectID)
		nodeHub.RecordEvent("bootstrap", req.NodeID, fmt.Sprintf("Signed X.509 mTLS cert (tier=%s, project=%s)", tier, projectID), time.Since(start).Milliseconds(), nil)
		writeJSON(w, http.StatusOK, tunnelv1.CSRBootstrapResponse{
			Success:    true,
			NodeID:     req.NodeID,
			CertPEM:    certPEM,
			CACertPEM:  authority.CACertPEM,
			TunnelPort: tunnelPort,
		})
	})

	// 3. List Connected Nodes & Hardware Telemetry
	mux.HandleFunc("/api/v1/nodes", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{
			"nodes": nodeHub.ListNodes(),
		})
	})

	// 4. Dispatch Atomic Filesystem Operation (`node_fs_operation`) over Yamux StreamTypeRpcFs
	mux.HandleFunc("/api/v1/rpc/fs", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		var payload struct {
			NodeID    string                `json:"node_id"`
			RequestID string                `json:"request_id"`
			ProjectID string                `json:"project_id"`
			Tier      tunnelv1.AutonomyTier `json:"tier"`
			Operation tunnelv1.FsOperation  `json:"operation"`
			Path      string                `json:"path"`
			Content   string                `json:"content"` // raw UTF-8 string or base64 if is_base64=true
			IsBase64  bool                  `json:"is_base64"`
			Diff      string                `json:"diff"`
			FileMode  string                `json:"file_mode"`
		}
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"success": false, "error": err.Error()})
			return
		}

		var contentBytes []byte
		if payload.IsBase64 {
			contentBytes, _ = base64.StdEncoding.DecodeString(payload.Content)
		} else {
			contentBytes = []byte(payload.Content)
		}

		fsReq := tunnelv1.FsRequest{
			RequestID: payload.RequestID,
			ProjectID: payload.ProjectID,
			Tier:      payload.Tier,
			Operation: payload.Operation,
			Path:      payload.Path,
			Content:   contentBytes,
			Diff:      payload.Diff,
			FileMode:  payload.FileMode,
		}

		resp, err := nodeHub.ExecFs(payload.NodeID, fsReq)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{
				"request_id": payload.RequestID,
				"success":    false,
				"error":      err.Error(),
			})
			return
		}

		writeJSON(w, http.StatusOK, map[string]any{
			"request_id": resp.RequestID,
			"success":    resp.Success,
			"error":      resp.Error,
			"content":    string(resp.Content),
			"entries":    resp.Entries,
		})
	})

	// 5. Dispatch Persistent Stateful PTY Command (`node_pty_exec`) over Yamux StreamTypePty
	mux.HandleFunc("/api/v1/rpc/pty", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		var payload struct {
			NodeID        string                `json:"node_id"`
			CmdID         string                `json:"cmd_id"`
			SessionID     string                `json:"session_id"`
			ProjectID     string                `json:"project_id"`
			Tier          tunnelv1.AutonomyTier `json:"tier"`
			Command       string                `json:"command"`
			WaitTimeoutMs uint32                `json:"wait_timeout_ms"`
			Secrets       map[string]string     `json:"secrets"`
			Cols          uint16                `json:"cols"`
			Rows          uint16                `json:"rows"`
			SendSignal    string                `json:"send_signal"`
		}
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": err.Error()})
			return
		}

		resp, err := nodeHub.ExecPty(payload.NodeID, tunnelv1.PtyExecRequest{
			CmdID:         payload.CmdID,
			SessionID:     payload.SessionID,
			ProjectID:     payload.ProjectID,
			Tier:          payload.Tier,
			Command:       payload.Command,
			WaitTimeoutMs: payload.WaitTimeoutMs,
			Secrets:       payload.Secrets,
			Cols:          payload.Cols,
			Rows:          payload.Rows,
			SendSignal:    payload.SendSignal,
		})
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{
				"cmd_id":    payload.CmdID,
				"exit_code": 1,
				"output":    fmt.Sprintf("Gateway dispatch error: %v", err),
			})
			return
		}
		writeJSON(w, http.StatusOK, resp)
	})

	// 6. Live PTY Byte-Stream SSE & Interactive Input for xterm.js in Core WebUI
	mux.HandleFunc("/api/v1/pty/stream", func(w http.ResponseWriter, r *http.Request) {
		nodeID := r.URL.Query().Get("node_id")
		projectID := r.URL.Query().Get("project_id")
		sessionID := r.URL.Query().Get("session_id")
		if sessionID == "" {
			sessionID = "default-" + projectID
		}

		if r.Method == http.MethodPost {
			// Interactive keystroke or resize event from xterm.js
			var frame tunnelv1.PtyLiveFrame
			if err := json.NewDecoder(r.Body).Decode(&frame); err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}
			stream, _, err := nodeHub.OpenStream(nodeID, tunnelv1.StreamHeader{
				StreamType: tunnelv1.StreamTypePty,
				ProjectID:  projectID,
				SessionID:  "live:" + sessionID,
			})
			if err != nil {
				http.Error(w, err.Error(), http.StatusBadGateway)
				return
			}
			defer stream.Close()
			_ = tunnelv1.WriteFrame(stream, frame)
			writeJSON(w, http.StatusOK, map[string]any{"ok": true})
			return
		}

		// GET: Server-Sent Events (SSE) live byte stream from Axon PTY
		flusher, ok := w.(http.Flusher)
		if !ok {
			http.Error(w, "streaming unsupported", http.StatusInternalServerError)
			return
		}
		stream, _, err := nodeHub.OpenStream(nodeID, tunnelv1.StreamHeader{
			StreamType: tunnelv1.StreamTypePty,
			ProjectID:  projectID,
			SessionID:  "live:" + sessionID,
		})
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadGateway)
			return
		}
		defer stream.Close()

		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")
		w.Header().Set("Access-Control-Allow-Origin", "*")

		go func() {
			<-r.Context().Done()
			_ = stream.Close()
		}()

		for {
			var frame tunnelv1.PtyLiveFrame
			if err := tunnelv1.ReadFrame(stream, &frame); err != nil {
				return
			}
			encoded, _ := json.Marshal(map[string]any{
				"session_id": frame.SessionID,
				"data":       string(frame.Data),
			})
			_, _ = fmt.Fprintf(w, "data: %s\n\n", string(encoded))
			flusher.Flush()
		}
	})

	// 7. Push Registered Service Health Targets to Axon Node
	mux.HandleFunc("/api/v1/nodes/health-targets", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		var body struct {
			NodeID  string                         `json:"node_id"`
			Targets []tunnelv1.ServiceHealthTarget `json:"targets"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		if err := nodeHub.PushHealthTargets(body.NodeID, body.Targets); err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"success": false, "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"success": true})
	})

	// 8. Authenticated TCP/HTTP Live-Preview Reverse Proxy: /preview/<project_id>/<node_id>/<port>
	mux.HandleFunc("/preview/", proxy.NewLivePreviewHandler(nodeHub))

	// 9. Zero-Dependency Axon Static Binary Download (/dl/axon-linux-amd64 & /dl/axon-linux-arm64)
	serveAxonBinary := func(arch string) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			candidates := []string{
				os.Getenv("SYNAPSE_AXON_BINARY_PATH"),
				fmt.Sprintf("/usr/local/bin/axon-linux-%s", arch),
				fmt.Sprintf("./bin/axon-linux-%s", arch),
				"./bin/axon",
				"../../bin/axon",
			}
			for _, candidate := range candidates {
				if candidate == "" {
					continue
				}
				if info, err := os.Stat(candidate); err == nil && !info.IsDir() {
					w.Header().Set("Content-Type", "application/octet-stream")
					w.Header().Set("Content-Disposition", "attachment; filename=\"axon\"")
					http.ServeFile(w, r, candidate)
					return
				}
			}
			// Fallback to official GitHub Release asset
			ghReleaseURL := fmt.Sprintf("https://github.com/SolidStateNetwork/Synapse/releases/latest/download/axon-linux-%s", arch)
			http.Redirect(w, r, ghReleaseURL, http.StatusFound)
		}
	}
	mux.HandleFunc("/dl/axon-linux-amd64", serveAxonBinary("amd64"))
	mux.HandleFunc("/dl/axon-linux-arm64", serveAxonBinary("arm64"))

	// 10. One-Liner Axon Node Enrollment & Systemd Installer Script (/install.sh)
	mux.HandleFunc("/install.sh", func(w http.ResponseWriter, r *http.Request) {
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
    --node-id)
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

echo "[synapse] Downloading static Axon Muscle binary (linux/${ARCH})..."
if ! curl -fsSL "$CORE_URL/dl/axon-linux-${ARCH}" -o "$INSTALL_DIR/axon" 2>/dev/null; then
  echo "[synapse] Falling back to GitHub Releases (axon-linux-${ARCH})..."
  curl -fsSL "https://github.com/SolidStateNetwork/Synapse/releases/latest/download/axon-linux-${ARCH}" -o "$INSTALL_DIR/axon"
fi
chmod +x "$INSTALL_DIR/axon"

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
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable --now axon.service
  echo "[synapse] ✔ axon.service enabled and started via systemd (mTLS + Yamux Reverse Tunnel active)."
else
  pkill -f "$INSTALL_DIR/axon run" 2>/dev/null || true
  nohup "$INSTALL_DIR/axon" run $DEBUG_FLAG --config-dir "$CONFIG_DIR" >/tmp/axon-agent.log 2>&1 &
  echo "[synapse] ✔ Axon daemon started in background (PID $!, logs at /tmp/axon-agent.log)."
fi
`, coreBaseURL)
		_, _ = w.Write([]byte(script))
	})

	log.Printf("[core-gateway] HTTP Control & Live-Preview Reverse Proxy listening on %s (VaultRoot=%s, Debug=%v)", httpAddr, vaultRoot, nodeHub.IsDebugEnabled())
	if err := http.ListenAndServe(httpAddr, corsMiddleware(mux)); err != nil {
		log.Fatalf("[core-gateway] HTTP server error: %v", err)
	}
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
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
