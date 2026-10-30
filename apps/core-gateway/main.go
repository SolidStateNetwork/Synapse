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

	// Optional Self-Healing Reverse Tunnel Supervisor (only active if SYNAPSE_SSH_REVERSE_HOST is set)
	go startSelfHealingMuscleTunnel(nodeHub, tunnelPort)

	handler := buildGatewayMux(authority, nodeHub, dataDir, vaultRoot, httpAddr, tunnelPort)

	log.Printf("[core-gateway] HTTP Control & Live-Preview Reverse Proxy listening on %s (VaultRoot=%s, Debug=%v)", httpAddr, vaultRoot, nodeHub.IsDebugEnabled())
	httpServer := &http.Server{
		Addr:              httpAddr,
		Handler:           handler,
		ReadHeaderTimeout: 10 * time.Second,
		IdleTimeout:       120 * time.Second,
	}
	if err := httpServer.ListenAndServe(); err != nil {
		log.Fatalf("[core-gateway] HTTP server error: %v", err)
	}
}

func buildGatewayMux(authority *pki.Authority, nodeHub *hub.Hub, dataDir, vaultRoot, httpAddr string, tunnelPort int) http.Handler {
	mux := http.NewServeMux()
	startedAt := time.Now()

	// Health check
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{
			"status":          "ok",
			"service":         "synapse-core-gateway",
			"version":         "v0.5.0",
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
				defaultProj := nodeHub.ResolveDefaultProjectID()
				pingResults := make([]map[string]any, 0, len(nodes))
				for _, n := range nodes {
					start := time.Now()
					fsResp, fsErr := nodeHub.ExecFs(n.NodeID, tunnelv1.FsRequest{
						RequestID: fmt.Sprintf("dbg-fs-%d", time.Now().UnixNano()),
						ProjectID: defaultProj,
						Tier:      n.Tier,
						Operation: tunnelv1.FsOpListDir,
						Path:      ".",
					})
					ptyResp, ptyErr := nodeHub.ExecPty(n.NodeID, tunnelv1.PtyExecRequest{
						CmdID:         fmt.Sprintf("dbg-pty-%d", time.Now().UnixNano()),
						SessionID:     "debug-self-test",
						ProjectID:     defaultProj,
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
			Content   string                `json:"content"`
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
			var frame tunnelv1.PtyLiveFrame
			if err := json.NewDecoder(r.Body).Decode(&frame); err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}
			stream, _, err := nodeHub.OpenStream(nodeID, tunnelv1.StreamHeader{
				StreamType: tunnelv1.StreamTypePty,
				ProjectID:  projectID,
				SessionID:  "input:" + sessionID,
			})
			if err != nil {
				http.Error(w, err.Error(), http.StatusBadGateway)
				return
			}
			defer stream.Close()
			_ = stream.SetWriteDeadline(time.Now().Add(5 * time.Second))
			_ = tunnelv1.WriteFrame(stream, frame)
			writeJSON(w, http.StatusOK, map[string]any{"ok": true})
			return
		}

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

		w.Header().Set("Content-Type", "text/event-stream; charset=utf-8")
		w.Header().Set("Cache-Control", "no-cache, no-transform")
		w.Header().Set("Connection", "keep-alive")
		w.Header().Set("X-Accel-Buffering", "no")

		_, _ = fmt.Fprintf(w, ": connected\n\n")
		flusher.Flush()

		doneCh := make(chan struct{})
		defer close(doneCh)
		go func() {
			select {
			case <-r.Context().Done():
				_ = stream.Close()
			case <-doneCh:
			}
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
	mux.HandleFunc("/dl/axon-linux-amd64", serveAxonBinary("amd64"))
	mux.HandleFunc("/dl/axon-linux-arm64", serveAxonBinary("arm64"))

	// 10. One-Liner Axon Node Enrollment & Systemd Installer Script (/install.sh)
	mux.HandleFunc("/install.sh", handleInstallScript)

	return corsMiddleware(mux)
}
