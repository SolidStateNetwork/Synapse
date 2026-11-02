package tunnel

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"math/big"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	tunnelv1 "github.com/SolidStateNetwork/Synapse/proto"
	"github.com/hashicorp/yamux"
)

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
		MinVersion:       tls.VersionTLS13,
		MaxVersion:       tls.VersionTLS13,
		CurvePreferences: []tls.CurveID{tls.X25519, tls.CurveP256},
		ServerName:       "synapse-core-gateway",
	}, nil
}

// ComputeReconnectBackoff calculates an exponential reconnect delay (1s -> 30s) with +/-25% crypto/rand jitter.
func ComputeReconnectBackoff(attempt int) time.Duration {
	if attempt < 0 {
		attempt = 0
	}
	if attempt > 5 {
		attempt = 5
	}
	baseMs := int64(1000) << uint(attempt)
	if baseMs > 30000 {
		baseMs = 30000
	}
	jitterWindow := baseMs / 2
	jitterOffset := int64(0)
	if jitterWindow > 0 {
		if n, err := rand.Int(rand.Reader, big.NewInt(jitterWindow+1)); err == nil {
			jitterOffset = n.Int64() - (jitterWindow / 2)
		}
	}
	finalMs := baseMs + jitterOffset
	if finalMs < 750 {
		finalMs = 750
	}
	if finalMs > 37500 {
		finalMs = 37500
	}
	return time.Duration(finalMs) * time.Millisecond
}

// NeedsCertRotation checks whether the X.509 certificate at certFile expires within renewWindow (e.g., 30 days).
func NeedsCertRotation(certFile string, renewWindow time.Duration) (bool, time.Time, error) {
	if renewWindow <= 0 {
		renewWindow = 30 * 24 * time.Hour
	}
	certBytes, err := os.ReadFile(certFile)
	if err != nil {
		return false, time.Time{}, err
	}
	block, _ := pem.Decode(certBytes)
	if block == nil {
		return false, time.Time{}, fmt.Errorf("invalid PEM block in %s", certFile)
	}
	parsed, err := x509.ParseCertificate(block.Bytes)
	if err != nil {
		return false, time.Time{}, err
	}
	needs := time.Until(parsed.NotAfter) <= renewWindow
	return needs, parsed.NotAfter, nil
}

// RotateTargetCertificate generates a fresh ECDSA P-256 keypair + CSR, requests a renewed certificate
// over the active Yamux session (StreamTypeCertRenew), and atomically updates CertFile and KeyFile.
func RotateTargetCertificate(session *yamux.Session, target CoreTarget) (time.Time, error) {
	if session == nil || session.IsClosed() {
		return time.Time{}, fmt.Errorf("yamux session is not open")
	}
	privKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return time.Time{}, fmt.Errorf("generate P-256 key: %w", err)
	}
	keyDER, err := x509.MarshalECPrivateKey(privKey)
	if err != nil {
		return time.Time{}, fmt.Errorf("marshal EC key: %w", err)
	}
	keyPEM := pem.EncodeToMemory(&pem.Block{Type: "EC PRIVATE KEY", Bytes: keyDER})

	hostname, _ := os.Hostname()
	if hostname == "" {
		hostname = target.NodeID
	}
	csrTmpl := &x509.CertificateRequest{
		Subject: pkix.Name{
			CommonName:   target.NodeID,
			Organization: []string{"Synapse Muscle Node"},
		},
		DNSNames: []string{hostname, target.NodeID},
	}
	csrDER, err := x509.CreateCertificateRequest(rand.Reader, csrTmpl, privKey)
	if err != nil {
		return time.Time{}, fmt.Errorf("create CSR: %w", err)
	}
	csrPEM := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE REQUEST", Bytes: csrDER})

	stream, err := session.OpenStream()
	if err != nil {
		return time.Time{}, fmt.Errorf("open cert renew stream: %w", err)
	}
	defer stream.Close()
	_ = stream.SetDeadline(time.Now().Add(15 * time.Second))

	if err := tunnelv1.WriteFrame(stream, tunnelv1.StreamHeader{
		StreamType: tunnelv1.StreamTypeCertRenew,
	}); err != nil {
		return time.Time{}, fmt.Errorf("write renew header: %w", err)
	}
	if err := tunnelv1.WriteFrame(stream, tunnelv1.CertRenewRequest{
		NodeID: target.NodeID,
		CSRPEM: csrPEM,
	}); err != nil {
		return time.Time{}, fmt.Errorf("write renew request: %w", err)
	}
	var resp tunnelv1.CertRenewResponse
	if err := tunnelv1.ReadFrame(stream, &resp); err != nil {
		return time.Time{}, fmt.Errorf("read renew response: %w", err)
	}
	if !resp.Success || len(resp.CertPEM) == 0 {
		return time.Time{}, fmt.Errorf("gateway rejected cert renewal: %s", resp.Error)
	}

	tmpKey := target.KeyFile + ".tmp"
	tmpCert := target.CertFile + ".tmp"
	if err := os.WriteFile(tmpKey, keyPEM, 0o600); err != nil {
		return time.Time{}, fmt.Errorf("write temp key: %w", err)
	}
	if err := os.WriteFile(tmpCert, resp.CertPEM, 0o644); err != nil {
		_ = os.Remove(tmpKey)
		return time.Time{}, fmt.Errorf("write temp cert: %w", err)
	}
	if err := os.Rename(tmpKey, target.KeyFile); err != nil {
		return time.Time{}, fmt.Errorf("rename key: %w", err)
	}
	if err := os.Rename(tmpCert, target.CertFile); err != nil {
		return time.Time{}, fmt.Errorf("rename cert: %w", err)
	}
	return time.Unix(resp.NotAfterUnix, 0).UTC(), nil
}

