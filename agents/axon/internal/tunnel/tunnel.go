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
}

// BootstrapCSR generates an ECDSA P-256 private key + X.509 CSR, exchanges a one-time join token
// with core-gateway for a signed mTLS certificate, and persists the identity to configDir.
func BootstrapCSR(configDir, coreHTTPURL, joinToken, nodeID string, tier tunnelv1.AutonomyTier, workspaceRoot string) (*IdentityConfig, error) {
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

	dialer := &net.Dialer{Timeout: 10 * time.Second, KeepAlive: 15 * time.Second}
	rawConn, err := tls.DialWithDialer(dialer, "tcp", a.Config.CoreGateway, tlsCfg)
	if err != nil {
		return fmt.Errorf("mTLS dial %s: %w", a.Config.CoreGateway, err)
	}
	defer rawConn.Close()

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

	log.Printf("[axon] mTLS + Yamux Reverse Tunnel established with %s (node=%s, tier=%s)",
		a.Config.CoreGateway, a.Config.NodeID, a.Config.Tier)

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

	// Listen for dynamic ServiceHealthTarget updates pushed from Core Gateway on the same stream
	go func() {
		for {
			var targets []tunnelv1.ServiceHealthTarget
			if err := tunnelv1.ReadFrame(stream, &targets); err != nil {
				return
			}
			a.HealthCol.SetTargets(targets)
		}
	}()

	// Send immediate heartbeat on connect, then every 5 seconds
	sendBeat := func() error {
		hb := a.HealthCol.Collect(a.PtyMgr.ActiveSessionIDs(), a.PtyMgr.ActiveSessionMeta())
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
	resp := a.FsEngine.Execute(req)
	_ = tunnelv1.WriteFrame(stream, resp)
}

// Stream Type 2: Persistent Stateful PTY Sessions (both synchronous Sentinel Exec and live xterm.js mirroring)
func (a *Agent) handlePtyStream(stream net.Conn, hdr tunnelv1.StreamHeader) {
	// If SessionID is prefixed with "live:", attach live xterm.js byte-stream mirroring
	if strings.HasPrefix(hdr.SessionID, "live:") {
		actualSessionID := strings.TrimPrefix(hdr.SessionID, "live:")
		sess, err := a.PtyMgr.GetOrCreateSession(actualSessionID, hdr.ProjectID, a.Config.Tier)
		if err != nil {
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
	resp := a.PtyMgr.Execute(req)
	_ = tunnelv1.WriteFrame(stream, resp)
}

// Stream Type 3: Live TCP/HTTP Port-Forwarding (127.0.0.1:<port> -> Core WebUI iframe)
func (a *Agent) handlePortForwardStream(stream net.Conn, targetPort uint32) {
	if targetPort == 0 || targetPort > 65535 {
		return
	}
	localAddr := fmt.Sprintf("127.0.0.1:%d", targetPort)
	targetConn, err := net.DialTimeout("tcp", localAddr, 3*time.Second)
	if err != nil {
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
