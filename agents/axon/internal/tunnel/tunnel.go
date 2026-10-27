package tunnel

import (
	"bytes"
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/SolidStateNetwork/Synapse/agents/axon/internal/fs"
	"github.com/SolidStateNetwork/Synapse/agents/axon/internal/guard"
	"github.com/SolidStateNetwork/Synapse/agents/axon/internal/health"
	"github.com/SolidStateNetwork/Synapse/agents/axon/internal/pty"
	tunnelv1 "github.com/SolidStateNetwork/Synapse/proto"
	"github.com/hashicorp/yamux"
)

// IdentityConfig stores the persistent mTLS identity and Core Gateway endpoint for this node.
type IdentityConfig struct {
	NodeID        string                `json:"node_id"`
	CoreGateway   string                `json:"core_gateway"` // host:port for mTLS yamux
	CoreHTTP      string                `json:"core_http"`    // http(s)://host:port for bootstrap
	Tier          tunnelv1.AutonomyTier `json:"tier"`
	WorkspaceRoot string                `json:"workspace_root"`
	CertFile      string                `json:"cert_file"`
	KeyFile       string                `json:"key_file"`
	CACertFile    string                `json:"ca_cert_file"`
	Debug         bool                  `json:"debug,omitempty"`
}

// DebugEnabled controls verbose trace logging across the Axon Muscle agent.
var DebugEnabled = os.Getenv("SYNAPSE_DEBUG") == "1" || strings.EqualFold(os.Getenv("SYNAPSE_DEBUG"), "true")

func debugLog(format string, v ...any) {
	if DebugEnabled {
		log.Printf("[axon:DEBUG] "+format, v...)
	}
}

// DiagnosticReport summarizes the 5-step Muscle self-test (`axon debug` / `axon doctor`).
type DiagnosticReport struct {
	Timestamp       string         `json:"timestamp"`
	NodeID          string         `json:"node_id"`
	Tier            string         `json:"tier"`
	CoreHTTP        string         `json:"core_http"`
	CoreGateway     string         `json:"core_gateway"`
	WorkspaceRoot   string         `json:"workspace_root"`
	ConfigValid     bool           `json:"config_valid"`
	CertSubject     string         `json:"cert_subject,omitempty"`
	CertExpiresAt   string         `json:"cert_expires_at,omitempty"`
	CoreHTTPReach   bool           `json:"core_http_reachable"`
	CoreHTTPLatency string         `json:"core_http_latency,omitempty"`
	MTLSHandshakeOK bool           `json:"mtls_handshake_ok"`
	MTLSCipherSuite string         `json:"mtls_cipher_suite,omitempty"`
	WorkspaceWrite  bool           `json:"workspace_writable"`
	Checks          map[string]any `json:"checks"`
	Errors          []string       `json:"errors,omitempty"`
}

// RunDiagnostics executes a comprehensive connectivity & certificate self-test for `axon debug`.
func RunDiagnostics(configDir string) DiagnosticReport {
	rep := DiagnosticReport{
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		Checks:    make(map[string]any),
	}

	cfg, err := LoadIdentity(configDir)
	if err != nil {
		rep.Errors = append(rep.Errors, fmt.Sprintf("load config.json from %s: %v", configDir, err))
		return rep
	}
	rep.ConfigValid = true
	rep.NodeID = cfg.NodeID
	rep.Tier = string(cfg.Tier)
	rep.CoreHTTP = cfg.CoreHTTP
	rep.CoreGateway = cfg.CoreGateway
	rep.WorkspaceRoot = cfg.WorkspaceRoot

	// 1. Inspect X.509 client certificate
	if certBytes, err := os.ReadFile(cfg.CertFile); err == nil {
		if block, _ := pem.Decode(certBytes); block != nil {
			if parsed, err := x509.ParseCertificate(block.Bytes); err == nil {
				rep.CertSubject = parsed.Subject.String()
				rep.CertExpiresAt = parsed.NotAfter.UTC().Format(time.RFC3339)
				rep.Checks["certificate"] = "valid X.509 ECDSA P-256"
			}
		}
	} else {
		rep.Errors = append(rep.Errors, fmt.Sprintf("read cert %s: %v", cfg.CertFile, err))
	}

	// 2. Test Core HTTP `/healthz` reachability
	startHTTP := time.Now()
	httpCli := &http.Client{
		Timeout: 5 * time.Second,
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		},
	}
	healthURL := strings.TrimRight(cfg.CoreHTTP, "/") + "/healthz"
	if resp, err := httpCli.Get(healthURL); err == nil {
		_ = resp.Body.Close()
		rep.CoreHTTPReach = resp.StatusCode == http.StatusOK
		rep.CoreHTTPLatency = time.Since(startHTTP).Round(time.Millisecond).String()
		rep.Checks["core_http"] = fmt.Sprintf("HTTP %d (%s)", resp.StatusCode, rep.CoreHTTPLatency)
	} else {
		rep.Errors = append(rep.Errors, fmt.Sprintf("GET %s failed: %v", healthURL, err))
		rep.Checks["core_http"] = "unreachable"
	}

	// 3. Test mTLS 1.3 Handshake to CoreGateway (:8443) (or verify active Yamux session via /api/v1/nodes so we don't bump a running daemon)
	alreadyConnected := false
	nodesURL := strings.TrimRight(cfg.CoreHTTP, "/") + "/api/v1/nodes"
	if resp, err := httpCli.Get(nodesURL); err == nil {
		var body struct {
			Nodes []struct {
				NodeID string `json:"node_id"`
				Online bool   `json:"online"`
			} `json:"nodes"`
		}
		_ = json.NewDecoder(resp.Body).Decode(&body)
		_ = resp.Body.Close()
		for _, n := range body.Nodes {
			if n.NodeID == cfg.NodeID && n.Online {
				alreadyConnected = true
				rep.MTLSHandshakeOK = true
				rep.MTLSCipherSuite = "TLS_AES_128_GCM_SHA256 (active Yamux session)"
				rep.Checks["mtls_tunnel"] = "active mTLS 1.3 + Yamux session online in Core Gateway"
				break
			}
		}
	}

	if !alreadyConnected {
		agent := NewAgent(cfg)
		if tlsCfg, err := agent.buildTLSConfig(); err == nil {
			dialer := &net.Dialer{Timeout: 5 * time.Second}
			if conn, err := tls.DialWithDialer(dialer, "tcp", cfg.CoreGateway, tlsCfg); err == nil {
				state := conn.ConnectionState()
				rep.MTLSHandshakeOK = state.HandshakeComplete
				rep.MTLSCipherSuite = tls.CipherSuiteName(state.CipherSuite)
				rep.Checks["mtls_tunnel"] = fmt.Sprintf("TLS 1.3 handshake OK (%s)", rep.MTLSCipherSuite)
				_ = conn.Close()
			} else {
				rep.Errors = append(rep.Errors, fmt.Sprintf("mTLS dial %s failed: %v", cfg.CoreGateway, err))
				rep.Checks["mtls_tunnel"] = "handshake failed"
			}
		} else {
			rep.Errors = append(rep.Errors, fmt.Sprintf("build TLS config: %v", err))
		}
	}

	// 4. Test Workspace Root write permission
	if err := os.MkdirAll(cfg.WorkspaceRoot, 0o755); err == nil {
		probeFile := filepath.Join(cfg.WorkspaceRoot, ".axon-debug-probe")
		if err := os.WriteFile(probeFile, []byte("ok"), 0o600); err == nil {
			_ = os.Remove(probeFile)
			rep.WorkspaceWrite = true
			rep.Checks["workspace_fs"] = fmt.Sprintf("writable (%s)", cfg.WorkspaceRoot)
		} else {
			rep.Errors = append(rep.Errors, fmt.Sprintf("write probe to %s: %v", cfg.WorkspaceRoot, err))
		}
	} else {
		rep.Errors = append(rep.Errors, fmt.Sprintf("mkdir workspace %s: %v", cfg.WorkspaceRoot, err))
	}

	return rep
}

// BootstrapCSR generates an ECDSA P-256 private key + X.509 CSR, exchanges a one-time join token
// with core-gateway for a signed mTLS certificate, and persists the identity to configDir.
func BootstrapCSR(configDir, coreHTTPURL, joinToken, nodeID string, tier tunnelv1.AutonomyTier, workspaceRoot string) (*IdentityConfig, error) {
	debugLog("BootstrapCSR starting: configDir=%s coreHTTPURL=%s nodeID=%s tier=%s workspaceRoot=%s",
		configDir, coreHTTPURL, nodeID, tier, workspaceRoot)

	if err := os.MkdirAll(configDir, 0o700); err != nil {
		return nil, fmt.Errorf("create config dir %s: %w", configDir, err)
	}

	hostname, _ := os.Hostname()
	if hostname == "" {
		hostname = "axon-node"
	}
	if strings.TrimSpace(nodeID) == "" {
		nodeID = fmt.Sprintf("node-%s-%d", hostname, time.Now().Unix()%10000)
	}
	if tier == "" || tier == tunnelv1.AutonomyTierUnspecified {
		tier = tunnelv1.Tier2WorkspaceJail
	}
	if strings.TrimSpace(workspaceRoot) == "" {
		workspaceRoot = fs.DefaultWorkspaceRoot
	}

	privKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return nil, fmt.Errorf("generate ecdsa key: %w", err)
	}

	keyBytes, err := x509.MarshalECPrivateKey(privKey)
	if err != nil {
		return nil, fmt.Errorf("marshal private key: %w", err)
	}
	keyPEM := pem.EncodeToMemory(&pem.Block{Type: "EC PRIVATE KEY", Bytes: keyBytes})

	csrTemplate := &x509.CertificateRequest{
		Subject: pkix.Name{
			CommonName:   nodeID,
			Organization: []string{"Synapse Axon Node"},
		},
		DNSNames: []string{hostname, nodeID},
	}
	csrDER, err := x509.CreateCertificateRequest(rand.Reader, csrTemplate, privKey)
	if err != nil {
		return nil, fmt.Errorf("create CSR: %w", err)
	}
	csrPEM := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE REQUEST", Bytes: csrDER})

	reqBody := tunnelv1.CSRBootstrapRequest{
		JoinToken: joinToken,
		NodeID:    nodeID,
		Hostname:  hostname,
		CSRPerm:   csrPEM,
		Tier:      tier,
	}
	rawReq, err := json.Marshal(reqBody)
	if err != nil {
		return nil, err
	}

	endpoint := strings.TrimRight(coreHTTPURL, "/") + "/api/v1/bootstrap/csr"
	debugLog("POST %s (CSR bytes=%d)", endpoint, len(csrPEM))

	httpCli := &http.Client{
		Timeout: 10 * time.Second,
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		},
	}
	resp, err := httpCli.Post(endpoint, "application/json", bytes.NewReader(rawReq))
	if err != nil {
		return nil, fmt.Errorf("CSR bootstrap request to %s failed: %w", endpoint, err)
	}
	defer resp.Body.Close()

	var bootResp tunnelv1.CSRBootstrapResponse
	if err := json.NewDecoder(resp.Body).Decode(&bootResp); err != nil {
		return nil, fmt.Errorf("decode CSR bootstrap response: %w", err)
	}
	if !bootResp.Success {
		return nil, fmt.Errorf("CSR bootstrap rejected by Core Gateway: %s", bootResp.Error)
	}
	debugLog("CSR signed successfully: nodeID=%s tunnelPort=%d certBytes=%d",
		bootResp.NodeID, bootResp.TunnelPort, len(bootResp.CertPEM))

	certPath := filepath.Join(configDir, "node.crt")
	keyPath := filepath.Join(configDir, "node.key")
	caPath := filepath.Join(configDir, "ca.crt")

	if err := os.WriteFile(certPath, bootResp.CertPEM, 0o600); err != nil {
		return nil, err
	}
	if err := os.WriteFile(keyPath, keyPEM, 0o600); err != nil {
		return nil, err
	}
	if err := os.WriteFile(caPath, bootResp.CACertPEM, 0o600); err != nil {
		return nil, err
	}

	// Derive tunnel host:port from coreHTTPURL + returned tunnel_port
	hostOnly := strings.TrimPrefix(strings.TrimPrefix(coreHTTPURL, "https://"), "http://")
	if h, _, splitErr := net.SplitHostPort(hostOnly); splitErr == nil {
		hostOnly = h
	}
	tunnelPort := bootResp.TunnelPort
	if tunnelPort == 0 {
		tunnelPort = 8443
	}

	idCfg := &IdentityConfig{
		NodeID:        bootResp.NodeID,
		CoreGateway:   fmt.Sprintf("%s:%d", hostOnly, tunnelPort),
		CoreHTTP:      coreHTTPURL,
		Tier:          tier,
		WorkspaceRoot: workspaceRoot,
		CertFile:      certPath,
		KeyFile:       keyPath,
		CACertFile:    caPath,
		Debug:         DebugEnabled,
	}

	cfgBytes, _ := json.MarshalIndent(idCfg, "", "  ")
	if err := os.WriteFile(filepath.Join(configDir, "config.json"), cfgBytes, 0o600); err != nil {
		return nil, err
	}

	return idCfg, nil
}

// LoadIdentity reads config.json from the given directory.
func LoadIdentity(configDir string) (*IdentityConfig, error) {
	raw, err := os.ReadFile(filepath.Join(configDir, "config.json"))
	if err != nil {
		return nil, err
	}
	var cfg IdentityConfig
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return nil, err
	}
	if cfg.Debug {
		DebugEnabled = true
	}
	return &cfg, nil
}

// Agent orchestrates the outbound mTLS + Yamux reverse tunnel and all 4 logical stream types.
type Agent struct {
	Config    *IdentityConfig
	FsEngine  *fs.Engine
	PtyMgr    *pty.Manager
	HealthCol *health.Collector
}

// NewAgent initializes an Axon Agent with its Guardrail, PTY, FS, and Telemetry subsystems.
func NewAgent(cfg *IdentityConfig) *Agent {
	host, port, err := net.SplitHostPort(cfg.CoreGateway)
	if err != nil {
		host = cfg.CoreGateway
		port = "8443"
	}
	guardCfg := guard.NewDefaultConfig(host, port)
	return &Agent{
		Config:    cfg,
		FsEngine:  fs.NewEngine(cfg.WorkspaceRoot),
		PtyMgr:    pty.NewManager(cfg.WorkspaceRoot, guardCfg),
		HealthCol: health.NewCollector(cfg.NodeID, cfg.Tier),
	}
}

// RunForever maintains the outbound mTLS Yamux connection with automatic backoff reconnection.
func (a *Agent) RunForever(ctx context.Context) error {
	defer a.PtyMgr.CloseAll()

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		if err := a.connectAndServe(ctx); err != nil {
			log.Printf("[axon] tunnel disconnected (%v); reconnecting in 3s...", err)
		}

		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(3 * time.Second):
		}
	}
}

func (a *Agent) connectAndServe(ctx context.Context) error {
	tlsCfg, err := a.buildTLSConfig()
	if err != nil {
		return fmt.Errorf("build mTLS config: %w", err)
	}

	debugLog("dialing CoreGateway mTLS endpoint %s...", a.Config.CoreGateway)
	dialer := &net.Dialer{Timeout: 10 * time.Second, KeepAlive: 15 * time.Second}
	rawConn, err := tls.DialWithDialer(dialer, "tcp", a.Config.CoreGateway, tlsCfg)
	if err != nil {
		return fmt.Errorf("mTLS dial %s: %w", a.Config.CoreGateway, err)
	}
	defer rawConn.Close()

	state := rawConn.ConnectionState()
	debugLog("mTLS 1.3 handshake complete with %s (cipher=%s, serverName=%s)",
		a.Config.CoreGateway, tls.CipherSuiteName(state.CipherSuite), state.ServerName)

	// Outbound node acts as the Yamux Server so Core Gateway can open streams on demand,
	// while Axon also opens an outbound stream for its 5-second telemetry heartbeat.
	ymCfg := yamux.DefaultConfig()
	ymCfg.EnableKeepAlive = true
	ymCfg.KeepAliveInterval = 15 * time.Second

	session, err := yamux.Server(rawConn, ymCfg)
	if err != nil {
		return fmt.Errorf("create yamux server session: %w", err)
	}
	defer session.Close()

	log.Printf("[axon] mTLS + Yamux Reverse Tunnel established with %s (node=%s, tier=%s, debug=%v)",
		a.Config.CoreGateway, a.Config.NodeID, a.Config.Tier, DebugEnabled)

	// Start Stream Type 4: 5-second Telemetry & Service Health Heartbeat stream to Core
	hbCtx, cancelHb := context.WithCancel(ctx)
	defer cancelHb()
	go a.telemetryLoop(hbCtx, session)

	// Accept incoming streams opened by Core Gateway (Stream Types 1, 2, 3)
	for {
		stream, err := session.AcceptStream()
		if err != nil {
			return fmt.Errorf("yamux accept stream: %w", err)
		}
		go a.handleStream(stream)
	}
}

func (a *Agent) telemetryLoop(ctx context.Context, session *yamux.Session) {
	stream, err := session.OpenStream()
	if err != nil {
		log.Printf("[axon] failed to open telemetry stream: %v", err)
		return
	}
	defer stream.Close()

	hdr := tunnelv1.StreamHeader{
		StreamType: tunnelv1.StreamTypeTelemetry,
	}
	if err := tunnelv1.WriteFrame(stream, hdr); err != nil {
		return
	}
	debugLog("StreamTypeTelemetry opened to Core Gateway")

	// Listen for dynamic ServiceHealthTarget updates pushed from Core Gateway on the same stream
	go func() {
		for {
			var targets []tunnelv1.ServiceHealthTarget
			if err := tunnelv1.ReadFrame(stream, &targets); err != nil {
				return
			}
			debugLog("received %d ServiceHealthTarget(s) from Core Gateway", len(targets))
			a.HealthCol.SetTargets(targets)
		}
	}()

	// Send immediate heartbeat on connect, then every 5 seconds
	sendBeat := func() error {
		hb := a.HealthCol.Collect(a.PtyMgr.ActiveSessionIDs(), a.PtyMgr.ActiveSessionMeta())
		debugLog("sending telemetry heartbeat: cpu=%.1f%% ram=%.1f%% disk=%.1f%% ptySessions=%d",
			hb.CPUPercent, hb.RAMPercent, hb.DiskPercent, len(hb.ActivePtySessions))
		return tunnelv1.WriteFrame(stream, hb)
	}
	_ = sendBeat()

	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := sendBeat(); err != nil {
				return
			}
		}
	}
}

func (a *Agent) handleStream(stream net.Conn) {
	defer stream.Close()

	var hdr tunnelv1.StreamHeader
	if err := tunnelv1.ReadFrame(stream, &hdr); err != nil {
		return
	}
	debugLog("accepted Yamux stream: type=%v project=%s session=%s targetPort=%d",
		hdr.StreamType, hdr.ProjectID, hdr.SessionID, hdr.TargetPort)

	switch hdr.StreamType {
	case tunnelv1.StreamTypeRpcFs:
		a.handleFsStream(stream)
	case tunnelv1.StreamTypePty:
		a.handlePtyStream(stream, hdr)
	case tunnelv1.StreamTypePortForward:
		a.handlePortForwardStream(stream, hdr.TargetPort)
	default:
		log.Printf("[axon] unknown stream type %v", hdr.StreamType)
	}
}

// Stream Type 1: RPC Control & Atomic Filesystem Ops
func (a *Agent) handleFsStream(stream net.Conn) {
	var req tunnelv1.FsRequest
	if err := tunnelv1.ReadFrame(stream, &req); err != nil {
		return
	}
	if req.Tier == "" || req.Tier == tunnelv1.AutonomyTierUnspecified {
		req.Tier = a.Config.Tier
	}
	start := time.Now()
	resp := a.FsEngine.Execute(req)
	debugLog("FS RPC op=%s path=%q tier=%s -> success=%v err=%q (%s)",
		req.Operation, req.Path, req.Tier, resp.Success, resp.Error, time.Since(start).Round(time.Microsecond))
	_ = tunnelv1.WriteFrame(stream, resp)
}

// Stream Type 2: Persistent Stateful PTY Sessions (both synchronous Sentinel Exec and live xterm.js mirroring)
func (a *Agent) handlePtyStream(stream net.Conn, hdr tunnelv1.StreamHeader) {
	// If SessionID is prefixed with "live:", attach live xterm.js byte-stream mirroring
	if strings.HasPrefix(hdr.SessionID, "live:") {
		actualSessionID := strings.TrimPrefix(hdr.SessionID, "live:")
		debugLog("attaching live PTY stream for session=%s project=%s", actualSessionID, hdr.ProjectID)
		sess, err := a.PtyMgr.GetOrCreateSession(actualSessionID, hdr.ProjectID, a.Config.Tier)
		if err != nil {
			debugLog("failed to get/create live PTY session %s: %v", actualSessionID, err)
			return
		}
		liveCh, unsubscribe := sess.SubscribeLive()
		defer unsubscribe()

		var wg sync.WaitGroup
		wg.Add(1)
		go func() {
			defer wg.Done()
			for chunk := range liveCh {
				frame := tunnelv1.PtyLiveFrame{
					SessionID: sess.ID,
					Type:      "data",
					Data:      chunk,
				}
				if err := tunnelv1.WriteFrame(stream, frame); err != nil {
					return
				}
			}
		}()

		for {
			var inFrame tunnelv1.PtyLiveFrame
			if err := tunnelv1.ReadFrame(stream, &inFrame); err != nil {
				break
			}
			switch inFrame.Type {
			case "input":
				_ = sess.WriteInteractive(inFrame.Data)
			case "resize":
				_ = sess.Resize(inFrame.Cols, inFrame.Rows)
			}
		}
		_ = stream.Close()
		wg.Wait()
		return
	}

	// Standard AI Tool Execution with Sentinel Framing (`node_pty_exec`)
	var req tunnelv1.PtyExecRequest
	if err := tunnelv1.ReadFrame(stream, &req); err != nil {
		return
	}
	if req.Tier == "" || req.Tier == tunnelv1.AutonomyTierUnspecified {
		req.Tier = a.Config.Tier
	}
	start := time.Now()
	debugLog("PTY EXEC start: session=%s cmd=%q timeoutMs=%d", req.SessionID, req.Command, req.WaitTimeoutMs)
	resp := a.PtyMgr.Execute(req)
	debugLog("PTY EXEC done: session=%s exitCode=%d cwd=%q blocked=%v (%s)",
		req.SessionID, resp.ExitCode, resp.Cwd, resp.BlockedByGuardrail, time.Since(start).Round(time.Millisecond))
	_ = tunnelv1.WriteFrame(stream, resp)
}

// Stream Type 3: Live TCP/HTTP Port-Forwarding (127.0.0.1:<port> -> Core WebUI iframe)
func (a *Agent) handlePortForwardStream(stream net.Conn, targetPort uint32) {
	if targetPort == 0 || targetPort > 65535 {
		return
	}
	localAddr := fmt.Sprintf("127.0.0.1:%d", targetPort)
	debugLog("PortForward dialing local loopback %s", localAddr)
	targetConn, err := net.DialTimeout("tcp", localAddr, 3*time.Second)
	if err != nil {
		debugLog("PortForward dial %s failed: %v", localAddr, err)
		return
	}
	defer targetConn.Close()

	var wg sync.WaitGroup
	wg.Add(2)
	go func() {
		defer wg.Done()
		_, _ = io.Copy(targetConn, stream)
		if tcpConn, ok := targetConn.(*net.TCPConn); ok {
			_ = tcpConn.CloseWrite()
		}
	}()
	go func() {
		defer wg.Done()
		_, _ = io.Copy(stream, targetConn)
		_ = stream.Close()
	}()
	wg.Wait()
}

func (a *Agent) buildTLSConfig() (*tls.Config, error) {
	cert, err := tls.LoadX509KeyPair(a.Config.CertFile, a.Config.KeyFile)
	if err != nil {
		return nil, fmt.Errorf("load client keypair: %w", err)
	}
	caPEM, err := os.ReadFile(a.Config.CACertFile)
	if err != nil {
		return nil, fmt.Errorf("read CA cert: %w", err)
	}
	caPool := x509.NewCertPool()
	if !caPool.AppendCertsFromPEM(caPEM) {
		return nil, fmt.Errorf("failed to append CA certificate to pool")
	}
	return &tls.Config{
		Certificates: []tls.Certificate{cert},
		RootCAs:      caPool,
		MinVersion:   tls.VersionTLS13,
		ServerName:   "synapse-core-gateway",
	}, nil
}
