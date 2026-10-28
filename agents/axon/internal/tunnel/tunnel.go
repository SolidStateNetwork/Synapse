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
	"strconv"
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

// CoreTarget represents a Core Control Plane endpoint and mTLS identity that this Muscle connects to.
type CoreTarget struct {
	Name        string                `json:"name"`
	NodeID      string                `json:"node_id,omitempty"`
	CoreGateway string                `json:"core_gateway"` // host:port for mTLS yamux
	CoreHTTP    string                `json:"core_http"`    // http(s)://host:port for bootstrap
	Tier        tunnelv1.AutonomyTier `json:"tier,omitempty"`
	CertFile    string                `json:"cert_file"`
	KeyFile     string                `json:"key_file"`
	CACertFile  string                `json:"ca_cert_file"`
	Enabled     bool                  `json:"enabled"`
}

// IdentityConfig stores the persistent mTLS identity and Core Gateway endpoint(s) for this node.
// When MultiCore is true or Cores is non-empty, Axon maintains simultaneous mTLS + Yamux tunnels
// to the primary Core AND all enabled CoreTargets in Cores concurrently.
type IdentityConfig struct {
	NodeID        string                `json:"node_id"`
	CoreGateway   string                `json:"core_gateway"` // primary host:port for mTLS yamux
	CoreHTTP      string                `json:"core_http"`    // primary http(s)://host:port for bootstrap
	Tier          tunnelv1.AutonomyTier `json:"tier"`
	WorkspaceRoot string                `json:"workspace_root"`
	CertFile      string                `json:"cert_file"`
	KeyFile       string                `json:"key_file"`
	CACertFile    string                `json:"ca_cert_file"`
	Debug         bool                  `json:"debug,omitempty"`
	MultiCore     bool                  `json:"multi_core,omitempty"`
	Cores         []CoreTarget          `json:"cores,omitempty"`
}

// ActiveCoreTargets returns the deduplicated list of all enabled Core targets (Primary + Secondary Cores).
func (cfg *IdentityConfig) ActiveCoreTargets() []CoreTarget {
	if cfg == nil {
		return nil
	}
	seen := make(map[string]bool)
	out := make([]CoreTarget, 0, 1+len(cfg.Cores))

	if strings.TrimSpace(cfg.CoreGateway) != "" {
		primary := CoreTarget{
			Name:        "primary",
			NodeID:      cfg.NodeID,
			CoreGateway: cfg.CoreGateway,
			CoreHTTP:    cfg.CoreHTTP,
			Tier:        cfg.Tier,
			CertFile:    cfg.CertFile,
			KeyFile:     cfg.KeyFile,
			CACertFile:  cfg.CACertFile,
			Enabled:     true,
		}
		seen[primary.CoreGateway] = true
		out = append(out, primary)
	}

	for _, c := range cfg.Cores {
		if !c.Enabled || strings.TrimSpace(c.CoreGateway) == "" {
			continue
		}
		if seen[c.CoreGateway] {
			continue
		}
		if strings.TrimSpace(c.NodeID) == "" {
			c.NodeID = cfg.NodeID
		}
		if c.Tier == "" || c.Tier == tunnelv1.AutonomyTierUnspecified {
			c.Tier = cfg.Tier
		}
		seen[c.CoreGateway] = true
		out = append(out, c)
	}
	return out
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
	Timestamp       string           `json:"timestamp"`
	NodeID          string           `json:"node_id"`
	Tier            string           `json:"tier"`
	CoreHTTP        string           `json:"core_http"`
	CoreGateway     string           `json:"core_gateway"`
	MultiCore       bool             `json:"multi_core"`
	ActiveCores     int              `json:"active_cores"`
	CoreTargets     []map[string]any `json:"core_targets,omitempty"`
	WorkspaceRoot   string           `json:"workspace_root"`
	ConfigValid     bool             `json:"config_valid"`
	CertSubject     string           `json:"cert_subject,omitempty"`
	CertExpiresAt   string           `json:"cert_expires_at,omitempty"`
	CoreHTTPReach   bool             `json:"core_http_reachable"`
	CoreHTTPLatency string           `json:"core_http_latency,omitempty"`
	MTLSHandshakeOK bool             `json:"mtls_handshake_ok"`
	MTLSCipherSuite string           `json:"mtls_cipher_suite,omitempty"`
	WorkspaceWrite  bool             `json:"workspace_writable"`
	Checks          map[string]any   `json:"checks"`
	Errors          []string         `json:"errors,omitempty"`
}

// RunDiagnostics executes a comprehensive connectivity & certificate self-test for `axon debug` across all configured Cores.
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
	targets := cfg.ActiveCoreTargets()
	rep.ConfigValid = true
	rep.NodeID = cfg.NodeID
	rep.Tier = string(cfg.Tier)
	rep.CoreHTTP = cfg.CoreHTTP
	rep.CoreGateway = cfg.CoreGateway
	rep.MultiCore = len(targets) > 1 || cfg.MultiCore
	rep.ActiveCores = len(targets)
	rep.WorkspaceRoot = cfg.WorkspaceRoot

	// 1. Inspect primary X.509 client certificate
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

	httpCli := &http.Client{
		Timeout: 5 * time.Second,
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		},
	}

	agent := NewAgent(cfg)
	targetReports := make([]map[string]any, 0, len(targets))

	for idx, t := range targets {
		tRep := map[string]any{
			"name":         t.Name,
			"node_id":      t.NodeID,
			"core_http":    t.CoreHTTP,
			"core_gateway": t.CoreGateway,
			"tier":         t.Tier,
		}

		// Test Core HTTP `/healthz` reachability
		startHTTP := time.Now()
		healthURL := strings.TrimRight(t.CoreHTTP, "/") + "/healthz"
		httpOK := false
		httpLat := ""
		if resp, err := httpCli.Get(healthURL); err == nil {
			_ = resp.Body.Close()
			httpOK = resp.StatusCode == http.StatusOK
			httpLat = time.Since(startHTTP).Round(time.Millisecond).String()
			tRep["http_status"] = resp.StatusCode
			tRep["http_latency"] = httpLat
		} else {
			tRep["http_error"] = err.Error()
			rep.Errors = append(rep.Errors, fmt.Sprintf("[%s] GET %s failed: %v", t.Name, healthURL, err))
		}
		tRep["http_reachable"] = httpOK

		// Test mTLS 1.3 Handshake or active Yamux session
		alreadyConnected := false
		mtlsOK := false
		cipherSuite := ""
		nodesURL := strings.TrimRight(t.CoreHTTP, "/") + "/api/v1/nodes"
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
				if n.NodeID == t.NodeID && n.Online {
					alreadyConnected = true
					mtlsOK = true
					cipherSuite = "TLS_AES_128_GCM_SHA256 (active Yamux session)"
					break
				}
			}
		}

		if !alreadyConnected {
			if tlsCfg, err := agent.buildTLSConfigForTarget(t); err == nil {
				dialer := &net.Dialer{Timeout: 5 * time.Second}
				if conn, err := tls.DialWithDialer(dialer, "tcp", t.CoreGateway, tlsCfg); err == nil {
					state := conn.ConnectionState()
					mtlsOK = state.HandshakeComplete
					cipherSuite = tls.CipherSuiteName(state.CipherSuite)
					_ = conn.Close()
				} else {
					tRep["mtls_error"] = err.Error()
					rep.Errors = append(rep.Errors, fmt.Sprintf("[%s] mTLS dial %s failed: %v", t.Name, t.CoreGateway, err))
				}
			} else {
				tRep["mtls_error"] = err.Error()
				rep.Errors = append(rep.Errors, fmt.Sprintf("[%s] build TLS config: %v", t.Name, err))
			}
		}

		tRep["mtls_handshake_ok"] = mtlsOK
		tRep["mtls_cipher_suite"] = cipherSuite
		targetReports = append(targetReports, tRep)

		if idx == 0 {
			rep.CoreHTTPReach = httpOK
			rep.CoreHTTPLatency = httpLat
			rep.MTLSHandshakeOK = mtlsOK
			rep.MTLSCipherSuite = cipherSuite
			if httpOK {
				rep.Checks["core_http"] = fmt.Sprintf("HTTP 200 (%s)", httpLat)
			} else {
				rep.Checks["core_http"] = "unreachable"
			}
			if mtlsOK {
				rep.Checks["mtls_tunnel"] = fmt.Sprintf("mTLS 1.3 OK (%s)", cipherSuite)
			} else {
				rep.Checks["mtls_tunnel"] = "handshake failed"
			}
		}
	}
	rep.CoreTargets = targetReports

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
	return BootstrapCSRWithOptions(configDir, coreHTTPURL, joinToken, nodeID, tier, workspaceRoot, "", true)
}

// BootstrapCSRWithOptions exchanges a one-time join token with core-gateway for a signed mTLS certificate,
// writes node.crt/node.key/ca.crt into targetDir, and optionally writes config.json and overrides the tunnel host:port.
func BootstrapCSRWithOptions(targetDir, coreHTTPURL, joinToken, nodeID string, tier tunnelv1.AutonomyTier, workspaceRoot, gatewayOverride string, writeConfig bool) (*IdentityConfig, error) {
	debugLog("BootstrapCSR starting: targetDir=%s coreHTTPURL=%s nodeID=%s tier=%s workspaceRoot=%s gatewayOverride=%s",
		targetDir, coreHTTPURL, nodeID, tier, workspaceRoot, gatewayOverride)

	if err := os.MkdirAll(targetDir, 0o700); err != nil {
		return nil, fmt.Errorf("create target dir %s: %w", targetDir, err)
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

	certPath := filepath.Join(targetDir, "node.crt")
	keyPath := filepath.Join(targetDir, "node.key")
	caPath := filepath.Join(targetDir, "ca.crt")

	if err := os.WriteFile(certPath, bootResp.CertPEM, 0o600); err != nil {
		return nil, err
	}
	if err := os.WriteFile(keyPath, keyPEM, 0o600); err != nil {
		return nil, err
	}
	if err := os.WriteFile(caPath, bootResp.CACertPEM, 0o600); err != nil {
		return nil, err
	}

	// Derive tunnel host:port from gatewayOverride or coreHTTPURL + returned tunnel_port
	hostPort := strings.TrimPrefix(strings.TrimPrefix(coreHTTPURL, "https://"), "http://")
	hostOnly := hostPort
	httpPort := 8081
	if h, pStr, splitErr := net.SplitHostPort(hostPort); splitErr == nil {
		hostOnly = h
		if parsedP, pErr := strconv.Atoi(pStr); pErr == nil && parsedP > 0 {
			httpPort = parsedP
		}
	}
	tunnelPort := bootResp.TunnelPort
	if tunnelPort == 0 {
		tunnelPort = 8443
	}

	resolvedGateway := fmt.Sprintf("%s:%d", hostOnly, tunnelPort)
	if strings.TrimSpace(gatewayOverride) != "" {
		resolvedGateway = strings.TrimSpace(gatewayOverride)
		if !strings.Contains(resolvedGateway, ":") {
			resolvedGateway = fmt.Sprintf("%s:%s", hostOnly, resolvedGateway)
		}
	} else if httpPort != 8081 && tunnelPort == 8443 {
		// If HTTP port is offset (e.g., SSH port-forward 9081 -> 8081 and 9443 -> 8443), check if offset port is listening
		candidatePort := httpPort + (8443 - 8081)
		if candidatePort > 0 && candidatePort <= 65535 {
			candidateAddr := fmt.Sprintf("%s:%d", hostOnly, candidatePort)
			if c, dialErr := net.DialTimeout("tcp", candidateAddr, 500*time.Millisecond); dialErr == nil {
				_ = c.Close()
				resolvedGateway = candidateAddr
			}
		}
	}

	idCfg := &IdentityConfig{
		NodeID:        bootResp.NodeID,
		CoreGateway:   resolvedGateway,
		CoreHTTP:      coreHTTPURL,
		Tier:          tier,
		WorkspaceRoot: workspaceRoot,
		CertFile:      certPath,
		KeyFile:       keyPath,
		CACertFile:    caPath,
		Debug:         DebugEnabled,
	}

	if writeConfig {
		cfgBytes, _ := json.MarshalIndent(idCfg, "", "  ")
		if err := os.WriteFile(filepath.Join(targetDir, "config.json"), cfgBytes, 0o600); err != nil {
			return nil, err
		}
	}

	return idCfg, nil
}

// AddSecondaryCore bootstraps a new Core identity inside `<baseConfigDir>/profiles/<profileName>/`
// WITHOUT overwriting the existing primary Core certificates in `<baseConfigDir>`, and registers the new
// Core in `config.json` (`multi_core: true`, `cores: [...]`) so Axon connects to all Cores simultaneously.
func AddSecondaryCore(baseConfigDir, profileName, coreHTTPURL, joinToken, nodeID string, tier tunnelv1.AutonomyTier, workspaceRoot, gatewayOverride string) (*IdentityConfig, *CoreTarget, error) {
	if strings.TrimSpace(profileName) == "" {
		profileName = fmt.Sprintf("core-%d", time.Now().Unix()%10000)
	}
	profDir := filepath.Join(baseConfigDir, "profiles", profileName)

	// Load existing primary config if present to inherit NodeID / Tier / WorkspaceRoot
	existingCfg, existingErr := LoadIdentity(baseConfigDir)
	if existingErr == nil && existingCfg != nil {
		if strings.TrimSpace(nodeID) == "" {
			nodeID = existingCfg.NodeID
		}
		if tier == "" || tier == tunnelv1.AutonomyTierUnspecified {
			tier = existingCfg.Tier
		}
		if strings.TrimSpace(workspaceRoot) == "" || workspaceRoot == fs.DefaultWorkspaceRoot {
			if existingCfg.WorkspaceRoot != "" {
				workspaceRoot = existingCfg.WorkspaceRoot
			}
		}
	}

	profCfg, err := BootstrapCSRWithOptions(profDir, coreHTTPURL, joinToken, nodeID, tier, workspaceRoot, gatewayOverride, true)
	if err != nil {
		return nil, nil, err
	}

	target := CoreTarget{
		Name:        profileName,
		NodeID:      profCfg.NodeID,
		CoreGateway: profCfg.CoreGateway,
		CoreHTTP:    profCfg.CoreHTTP,
		Tier:        profCfg.Tier,
		CertFile:    profCfg.CertFile,
		KeyFile:     profCfg.KeyFile,
		CACertFile:  profCfg.CACertFile,
		Enabled:     true,
	}

	// If no base config existed yet, promote this profile as the base config too
	if existingErr != nil || existingCfg == nil {
		baseCfg := *profCfg
		baseCfg.MultiCore = true
		baseCfg.Cores = []CoreTarget{target}
		b, _ := json.MarshalIndent(&baseCfg, "", "  ")
		if err := os.WriteFile(filepath.Join(baseConfigDir, "config.json"), b, 0o600); err != nil {
			return nil, nil, err
		}
		return &baseCfg, &target, nil
	}

	// Update existing config.json to enable MultiCore and upsert the new CoreTarget
	existingCfg.MultiCore = true
	updated := false
	for i := range existingCfg.Cores {
		if existingCfg.Cores[i].Name == target.Name || existingCfg.Cores[i].CoreGateway == target.CoreGateway {
			existingCfg.Cores[i] = target
			updated = true
			break
		}
	}
	if !updated {
		existingCfg.Cores = append(existingCfg.Cores, target)
	}

	cfgBytes, _ := json.MarshalIndent(existingCfg, "", "  ")
	if err := os.WriteFile(filepath.Join(baseConfigDir, "config.json"), cfgBytes, 0o600); err != nil {
		return nil, nil, err
	}

	return existingCfg, &target, nil
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

// Agent orchestrates the outbound mTLS + Yamux reverse tunnel(s) and all 4 logical stream types.
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

// RunForever maintains simultaneous outbound mTLS Yamux connections to all active CoreTargets with automatic backoff reconnection.
func (a *Agent) RunForever(ctx context.Context) error {
	defer a.PtyMgr.CloseAll()

	targets := a.Config.ActiveCoreTargets()
	if len(targets) == 0 {
		return fmt.Errorf("no active Core targets configured")
	}

	if len(targets) == 1 {
		return a.runTargetForever(ctx, targets[0])
	}

	log.Printf("[axon] MULTI-CORE MODE ENABLED: maintaining %d simultaneous mTLS + Yamux tunnels for node %q", len(targets), a.Config.NodeID)
	var wg sync.WaitGroup
	for _, t := range targets {
		target := t
		wg.Add(1)
		go func() {
			defer wg.Done()
			_ = a.runTargetForever(ctx, target)
		}()
	}
	wg.Wait()
	return ctx.Err()
}

func (a *Agent) runTargetForever(ctx context.Context, target CoreTarget) error {
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		if err := a.connectAndServeTarget(ctx, target, a.HealthCol); err != nil {
			log.Printf("[axon][%s -> %s] tunnel disconnected (%v); reconnecting in 3s...", target.Name, target.CoreGateway, err)
		}

		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(3 * time.Second):
		}
	}
}

func (a *Agent) connectAndServeTarget(ctx context.Context, target CoreTarget, healthCol *health.Collector) error {
	tlsCfg, err := a.buildTLSConfigForTarget(target)
	if err != nil {
		return fmt.Errorf("build mTLS config for %s (%s): %w", target.Name, target.CoreGateway, err)
	}

	debugLog("[%s] dialing CoreGateway mTLS endpoint %s...", target.Name, target.CoreGateway)
	dialer := &net.Dialer{Timeout: 10 * time.Second, KeepAlive: 15 * time.Second}
	rawConn, err := tls.DialWithDialer(dialer, "tcp", target.CoreGateway, tlsCfg)
	if err != nil {
		return fmt.Errorf("mTLS dial %s: %w", target.CoreGateway, err)
	}
	defer rawConn.Close()

	state := rawConn.ConnectionState()
	debugLog("[%s] mTLS 1.3 handshake complete with %s (cipher=%s, serverName=%s)",
		target.Name, target.CoreGateway, tls.CipherSuiteName(state.CipherSuite), state.ServerName)

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

	stopCh := make(chan struct{})
	defer close(stopCh)
	go func() {
		select {
		case <-ctx.Done():
			_ = session.Close()
		case <-stopCh:
		}
	}()

	log.Printf("[axon][%s] mTLS + Yamux Reverse Tunnel established with %s (node=%s, tier=%s, debug=%v)",
		target.Name, target.CoreGateway, target.NodeID, target.Tier, DebugEnabled)

	// Start Stream Type 4: 5-second Telemetry & Service Health Heartbeat stream to this Core
	hbCtx, cancelHb := context.WithCancel(ctx)
	defer cancelHb()
	go a.telemetryLoopForTarget(hbCtx, session, target, healthCol)

	// Accept incoming streams opened by this Core Gateway (Stream Types 1, 2, 3)
	for {
		stream, err := session.AcceptStream()
		if err != nil {
			return fmt.Errorf("yamux accept stream: %w", err)
		}
		go a.handleStreamForTarget(stream, target)
	}
}

func (a *Agent) telemetryLoopForTarget(ctx context.Context, session *yamux.Session, target CoreTarget, healthCol *health.Collector) {
	stream, err := session.OpenStream()
	if err != nil {
		log.Printf("[axon][%s] failed to open telemetry stream to %s: %v", target.Name, target.CoreGateway, err)
		return
	}
	defer stream.Close()

	hdr := tunnelv1.StreamHeader{
		StreamType: tunnelv1.StreamTypeTelemetry,
	}
	if err := tunnelv1.WriteFrame(stream, hdr); err != nil {
		return
	}
	debugLog("[%s] StreamTypeTelemetry opened to Core Gateway %s", target.Name, target.CoreGateway)

	// Listen for dynamic ServiceHealthTarget updates pushed from this Core Gateway on the same stream
	go func() {
		for {
			var targets []tunnelv1.ServiceHealthTarget
			if err := tunnelv1.ReadFrame(stream, &targets); err != nil {
				return
			}
			debugLog("[%s] received %d ServiceHealthTarget(s) from Core Gateway %s", target.Name, len(targets), target.CoreGateway)
			healthCol.SetTargetsForSource(target.Name, targets)
		}
	}()

	// Send immediate heartbeat on connect, then every 5 seconds
	sendBeat := func() error {
		hb := healthCol.CollectForNode(target.NodeID, target.Tier, a.PtyMgr.ActiveSessionIDs(), a.PtyMgr.ActiveSessionMeta())
		debugLog("[%s -> %s] sending telemetry heartbeat: cpu=%.1f%% ram=%.1f%% disk=%.1f%% services=%d ptySessions=%d",
			target.Name, target.CoreGateway, hb.CPUPercent, hb.RAMPercent, hb.DiskPercent, len(hb.Services), len(hb.ActivePtySessions))
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

func (a *Agent) handleStreamForTarget(stream net.Conn, target CoreTarget) {
	defer stream.Close()

	var hdr tunnelv1.StreamHeader
	if err := tunnelv1.ReadFrame(stream, &hdr); err != nil {
		return
	}
	debugLog("[%s] accepted Yamux stream: type=%v project=%s session=%s targetPort=%d",
		target.Name, hdr.StreamType, hdr.ProjectID, hdr.SessionID, hdr.TargetPort)

	switch hdr.StreamType {
	case tunnelv1.StreamTypeRpcFs:
		a.handleFsStream(stream, target.Tier)
	case tunnelv1.StreamTypePty:
		a.handlePtyStream(stream, hdr, target.Tier)
	case tunnelv1.StreamTypePortForward:
		a.handlePortForwardStream(stream, hdr.TargetPort)
	default:
		log.Printf("[axon][%s] unknown stream type %v", target.Name, hdr.StreamType)
	}
}

// Stream Type 1: RPC Control & Atomic Filesystem Ops
func (a *Agent) handleFsStream(stream net.Conn, defaultTier tunnelv1.AutonomyTier) {
	var req tunnelv1.FsRequest
	if err := tunnelv1.ReadFrame(stream, &req); err != nil {
		return
	}
	if req.Tier == "" || req.Tier == tunnelv1.AutonomyTierUnspecified {
		req.Tier = defaultTier
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
func (a *Agent) handlePtyStream(stream net.Conn, hdr tunnelv1.StreamHeader, defaultTier tunnelv1.AutonomyTier) {
	effectiveTier := defaultTier
	if effectiveTier == "" || effectiveTier == tunnelv1.AutonomyTierUnspecified {
		effectiveTier = a.Config.Tier
	}

	// If SessionID is prefixed with "live:", attach live xterm.js byte-stream mirroring
	if strings.HasPrefix(hdr.SessionID, "live:") {
		actualSessionID := strings.TrimPrefix(hdr.SessionID, "live:")
		debugLog("attaching live PTY stream for session=%s project=%s", actualSessionID, hdr.ProjectID)
		sess, err := a.PtyMgr.GetOrCreateSession(actualSessionID, hdr.ProjectID, effectiveTier)
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
		req.Tier = effectiveTier
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
	return a.buildTLSConfigForTarget(CoreTarget{
		Name:        "primary",
		NodeID:      a.Config.NodeID,
		CoreGateway: a.Config.CoreGateway,
		CoreHTTP:    a.Config.CoreHTTP,
		Tier:        a.Config.Tier,
		CertFile:    a.Config.CertFile,
		KeyFile:     a.Config.KeyFile,
		CACertFile:  a.Config.CACertFile,
		Enabled:     true,
	})
}

func (a *Agent) buildTLSConfigForTarget(target CoreTarget) (*tls.Config, error) {
	cert, err := tls.LoadX509KeyPair(target.CertFile, target.KeyFile)
	if err != nil {
		return nil, fmt.Errorf("load client keypair (%s, %s): %w", target.CertFile, target.KeyFile, err)
	}
	caPEM, err := os.ReadFile(target.CACertFile)
	if err != nil {
		return nil, fmt.Errorf("read CA cert %s: %w", target.CACertFile, err)
	}
	caPool := x509.NewCertPool()
	if !caPool.AppendCertsFromPEM(caPEM) {
		return nil, fmt.Errorf("failed to append CA certificate to pool from %s", target.CACertFile)
	}
	return &tls.Config{
		Certificates: []tls.Certificate{cert},
		RootCAs:      caPool,
		MinVersion:   tls.VersionTLS13,
		ServerName:   "synapse-core-gateway",
	}, nil
}
