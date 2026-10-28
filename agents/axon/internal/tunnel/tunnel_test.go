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
	"math/big"
	"net"
	"net/http"
	"net/http/httptest"
	"net/http/httputil"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/SolidStateNetwork/Synapse/agents/axon/internal/health"
	tunnelv1 "github.com/SolidStateNetwork/Synapse/proto"
	"github.com/hashicorp/yamux"
)

func TestEndToEndAxonMTLSYamuxFourStreams(t *testing.T) {
	axonConfigDir := t.TempDir()
	workspaceDir := t.TempDir()

	// 1. Create Ephemeral Root CA & Server TLS Certificate for Core Gateway mock
	caPriv, _ := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	caTmpl := &x509.Certificate{
		SerialNumber:          big.NewInt(1),
		Subject:               pkix.Name{CommonName: "Synapse Test Root CA"},
		NotBefore:             time.Now().Add(-time.Hour),
		NotAfter:              time.Now().Add(time.Hour),
		KeyUsage:              x509.KeyUsageCertSign | x509.KeyUsageDigitalSignature,
		BasicConstraintsValid: true,
		IsCA:                  true,
	}
	caDER, _ := x509.CreateCertificate(rand.Reader, caTmpl, caTmpl, &caPriv.PublicKey, caPriv)
	caCert, _ := x509.ParseCertificate(caDER)
	caPEM := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: caDER})

	srvPriv, _ := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	srvTmpl := &x509.Certificate{
		SerialNumber: big.NewInt(2),
		Subject:      pkix.Name{CommonName: "synapse-core-gateway"},
		DNSNames:     []string{"synapse-core-gateway", "localhost"},
		IPAddresses:  []net.IP{net.ParseIP("127.0.0.1")},
		NotBefore:    time.Now().Add(-time.Hour),
		NotAfter:     time.Now().Add(time.Hour),
		KeyUsage:     x509.KeyUsageDigitalSignature,
		ExtKeyUsage:  []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
	}
	srvDER, _ := x509.CreateCertificate(rand.Reader, srvTmpl, caCert, &srvPriv.PublicKey, caPriv)
	srvPEM := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: srvDER})
	srvKeyDER, _ := x509.MarshalECPrivateKey(srvPriv)
	srvKeyPEM := pem.EncodeToMemory(&pem.Block{Type: "EC PRIVATE KEY", Bytes: srvKeyDER})
	srvTLSCert, _ := tls.X509KeyPair(srvPEM, srvKeyPEM)

	caPool := x509.NewCertPool()
	caPool.AppendCertsFromPEM(caPEM)

	tlsListener, err := tls.Listen("tcp", "127.0.0.1:0", &tls.Config{
		Certificates: []tls.Certificate{srvTLSCert},
		ClientCAs:    caPool,
		ClientAuth:   tls.RequireAndVerifyClientCert,
		MinVersion:   tls.VersionTLS13,
	})
	if err != nil {
		t.Fatalf("tls.Listen failed: %v", err)
	}
	defer tlsListener.Close()
	tunnelPort := tlsListener.Addr().(*net.TCPAddr).Port

	sessionCh := make(chan *yamux.Session, 1)
	heartbeatCh := make(chan tunnelv1.NodeHeartbeat, 1)

	go func() {
		conn, err := tlsListener.Accept()
		if err != nil {
			return
		}
		sess, err := yamux.Client(conn, nil)
		if err != nil {
			return
		}
		sessionCh <- sess
		// Accept telemetry stream opened by Axon
		stream, err := sess.AcceptStream()
		if err != nil {
			return
		}
		var hdr tunnelv1.StreamHeader
		_ = tunnelv1.ReadFrame(stream, &hdr)
		var beat tunnelv1.NodeHeartbeat
		if err := tunnelv1.ReadFrame(stream, &beat); err == nil {
			heartbeatCh <- beat
		}
	}()

	// 2. Start CSR Bootstrap HTTP Server
	bootSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req tunnelv1.CSRBootstrapRequest
		_ = json.NewDecoder(r.Body).Decode(&req)
		block, _ := pem.Decode(req.CSRPerm)
		csr, _ := x509.ParseCertificateRequest(block.Bytes)
		cliTmpl := &x509.Certificate{
			SerialNumber: big.NewInt(3),
			Subject:      pkix.Name{CommonName: req.NodeID},
			NotBefore:    time.Now().Add(-time.Hour),
			NotAfter:     time.Now().Add(time.Hour),
			KeyUsage:     x509.KeyUsageDigitalSignature,
			ExtKeyUsage:  []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth},
		}
		cliDER, _ := x509.CreateCertificate(rand.Reader, cliTmpl, caCert, csr.PublicKey, caPriv)
		cliPEM := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: cliDER})
		_ = json.NewEncoder(w).Encode(tunnelv1.CSRBootstrapResponse{
			Success:    true,
			NodeID:     req.NodeID,
			CertPEM:    cliPEM,
			CACertPEM:  caPEM,
			TunnelPort: tunnelPort,
		})
	}))
	defer bootSrv.Close()

	// 3. Bootstrap CSR & Start Axon Agent
	idCfg, err := BootstrapCSR(axonConfigDir, bootSrv.URL, "syn_join_testtoken", "node-muscle-1", tunnelv1.Tier2WorkspaceJail, workspaceDir)
	if err != nil {
		t.Fatalf("BootstrapCSR failed: %v", err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	agent := NewAgent(idCfg)
	go func() {
		_ = agent.RunForever(ctx)
	}()

	var ymSess *yamux.Session
	select {
	case ymSess = <-sessionCh:
	case <-time.After(5 * time.Second):
		t.Fatal("timed out waiting for Axon mTLS Yamux connection")
	}

	// Verify Stream Type 4: Telemetry Heartbeat
	select {
	case beat := <-heartbeatCh:
		if beat.NodeID != "node-muscle-1" {
			t.Fatalf("expected heartbeat from node-muscle-1, got %s", beat.NodeID)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("timed out waiting for Axon telemetry heartbeat")
	}

	// Verify Stream Type 1: Atomic FS Operation
	fsStream, err := ymSess.OpenStream()
	if err != nil {
		t.Fatal(err)
	}
	_ = tunnelv1.WriteFrame(fsStream, tunnelv1.StreamHeader{StreamType: tunnelv1.StreamTypeRpcFs, ProjectID: "proj-1"})
	_ = tunnelv1.WriteFrame(fsStream, tunnelv1.FsRequest{
		RequestID: "req-fs-1",
		ProjectID: "proj-1",
		Tier:      tunnelv1.Tier2WorkspaceJail,
		Operation: tunnelv1.FsOpWriteFile,
		Path:      "app.txt",
		Content:   []byte("synapse-muscle-verified"),
	})
	var fsResp tunnelv1.FsResponse
	if err := tunnelv1.ReadFrame(fsStream, &fsResp); err != nil || !fsResp.Success {
		t.Fatalf("FS stream failed: err=%v, resp=%+v", err, fsResp)
	}
	_ = fsStream.Close()

	// Verify Stream Type 2: Persistent Stateful PTY with Sentinel Framing & Secret Scrubbing
	ptyStream, err := ymSess.OpenStream()
	if err != nil {
		t.Fatal(err)
	}
	_ = tunnelv1.WriteFrame(ptyStream, tunnelv1.StreamHeader{StreamType: tunnelv1.StreamTypePty, ProjectID: "proj-1"})
	_ = tunnelv1.WriteFrame(ptyStream, tunnelv1.PtyExecRequest{
		CmdID:         "cmd-pty-1",
		SessionID:     "sess-1",
		ProjectID:     "proj-1",
		Tier:          tunnelv1.Tier2WorkspaceJail,
		Command:       "cat app.txt && echo \" key=$API_SECRET\"",
		WaitTimeoutMs: 5000,
		Secrets:       map[string]string{"API_SECRET": "super_sensitive_98765"},
	})
	var ptyResp tunnelv1.PtyExecResponse
	if err := tunnelv1.ReadFrame(ptyStream, &ptyResp); err != nil {
		t.Fatalf("PTY stream read failed: %v", err)
	}
	_ = ptyStream.Close()
	if !strings.Contains(ptyResp.Output, "synapse-muscle-verified") || !strings.Contains(ptyResp.Output, "[REDACTED_SECRET:API_SECRET]") {
		t.Fatalf("unexpected PTY output: %q", ptyResp.Output)
	}

	// Verify Stream Type 3: Live TCP/HTTP Port-Forwarding
	localListener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer localListener.Close()
	localPort := localListener.Addr().(*net.TCPAddr).Port
	go func() {
		_ = http.Serve(localListener, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			_, _ = w.Write([]byte("PORT_FORWARD_TUNNEL_OK"))
		}))
	}()

	targetURL, _ := url.Parse(fmt.Sprintf("http://127.0.0.1:%d", localPort))
	rp := &httputil.ReverseProxy{
		Director: func(req *http.Request) {
			req.URL.Scheme = targetURL.Scheme
			req.URL.Host = targetURL.Host
		},
		Transport: &http.Transport{
			DialContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
				s, err := ymSess.OpenStream()
				if err != nil {
					return nil, err
				}
				_ = tunnelv1.WriteFrame(s, tunnelv1.StreamHeader{
					StreamType: tunnelv1.StreamTypePortForward,
					TargetPort: uint32(localPort),
				})
				return s, nil
			},
		},
	}
	proxySrv := httptest.NewServer(rp)
	defer proxySrv.Close()

	res, err := http.Get(proxySrv.URL)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	body, _ := io.ReadAll(res.Body)
	if !bytes.Equal(body, []byte("PORT_FORWARD_TUNNEL_OK")) {
		t.Fatalf("expected PORT_FORWARD_TUNNEL_OK, got %q", string(body))
	}
}

func TestActiveCoreTargets_MultiCoreDeduplication(t *testing.T) {
	cfg := &IdentityConfig{
		NodeID:        "vps2-muscle",
		CoreGateway:   "127.0.0.1:8443",
		CoreHTTP:      "http://127.0.0.1:8081",
		Tier:          tunnelv1.Tier1Unleashed,
		WorkspaceRoot: "/opt/axon/workspaces",
		CertFile:      "/etc/axon/node.crt",
		KeyFile:       "/etc/axon/node.key",
		CACertFile:    "/etc/axon/ca.crt",
		MultiCore:     true,
		Cores: []CoreTarget{
			{
				Name:        "duplicate-primary",
				CoreGateway: "127.0.0.1:8443",
				CoreHTTP:    "http://127.0.0.1:8081",
				Enabled:     true,
			},
			{
				Name:        "local-cachyos-core",
				CoreGateway: "127.0.0.1:9443",
				CoreHTTP:    "http://127.0.0.1:9081",
				CertFile:    "/etc/axon/profiles/local-cachyos-core/node.crt",
				KeyFile:     "/etc/axon/profiles/local-cachyos-core/node.key",
				CACertFile:  "/etc/axon/profiles/local-cachyos-core/ca.crt",
				Enabled:     true,
			},
			{
				Name:        "disabled-core",
				CoreGateway: "10.0.0.99:8443",
				CoreHTTP:    "http://10.0.0.99:8081",
				Enabled:     false,
			},
		},
	}

	targets := cfg.ActiveCoreTargets()
	if len(targets) != 2 {
		t.Fatalf("expected 2 deduplicated active CoreTargets, got %d", len(targets))
	}
	if targets[0].CoreGateway != "127.0.0.1:8443" || targets[0].Name != "primary" {
		t.Fatalf("unexpected primary target: %+v", targets[0])
	}
	if targets[1].CoreGateway != "127.0.0.1:9443" || targets[1].Name != "local-cachyos-core" {
		t.Fatalf("unexpected secondary target: %+v", targets[1])
	}
	if targets[1].NodeID != "vps2-muscle" {
		t.Fatalf("expected secondary target to inherit NodeID 'vps2-muscle', got %q", targets[1].NodeID)
	}
	if targets[1].Tier != tunnelv1.Tier1Unleashed {
		t.Fatalf("expected secondary target to inherit Tier1Unleashed, got %q", targets[1].Tier)
	}
}

func TestLoadIdentity_MultiCorePersistence(t *testing.T) {
	tmpDir := t.TempDir()
	cfgPath := filepath.Join(tmpDir, "config.json")
	raw := `{
  "node_id": "vps2-muscle",
  "core_gateway": "127.0.0.1:8443",
  "core_http": "http://127.0.0.1:8081",
  "tier": "TIER_1_UNLEASHED",
  "workspace_root": "/opt/axon/workspaces",
  "cert_file": "/etc/axon/node.crt",
  "key_file": "/etc/axon/node.key",
  "ca_cert_file": "/etc/axon/ca.crt",
  "multi_core": true,
  "cores": [
    {
      "name": "second-core",
      "node_id": "vps2-muscle",
      "core_gateway": "127.0.0.1:9443",
      "core_http": "http://127.0.0.1:9081",
      "tier": "TIER_1_UNLEASHED",
      "cert_file": "/etc/axon/profiles/second-core/node.crt",
      "key_file": "/etc/axon/profiles/second-core/node.key",
      "ca_cert_file": "/etc/axon/profiles/second-core/ca.crt",
      "enabled": true
    }
  ]
}`
	if err := os.WriteFile(cfgPath, []byte(raw), 0o600); err != nil {
		t.Fatal(err)
	}

	loaded, err := LoadIdentity(tmpDir)
	if err != nil {
		t.Fatalf("LoadIdentity failed: %v", err)
	}
	if !loaded.MultiCore {
		t.Fatalf("expected MultiCore=true")
	}
	targets := loaded.ActiveCoreTargets()
	if len(targets) != 2 {
		t.Fatalf("expected 2 active targets, got %d", len(targets))
	}
}

func TestMultiCoreSharedHealthCollectorMergesTargets(t *testing.T) {
	col := health.NewCollector("test-multi-core-node", tunnelv1.Tier1Unleashed)
	col.SetTargetsForSource("primary", []tunnelv1.ServiceHealthTarget{
		{ServiceID: "vps2-status-api", Name: "VPS2 Status API", Protocol: "http", Port: 4070, Path: "/"},
		{ServiceID: "pulse-webui", Name: "Pulse Live WebUI", Protocol: "http", Port: 4090, Path: "/"},
	})
	col.SetTargetsForSource("local-cachyos-core", []tunnelv1.ServiceHealthTarget{
		{ServiceID: "auto-svc-4050", Name: "Autonomous Microservice :4050", Protocol: "http", Port: 4050, Path: "/"},
	})

	beat := col.CollectForNode("vps2-muscle", tunnelv1.Tier1Unleashed, nil)
	found := make(map[string]bool)
	for _, s := range beat.Services {
		found[s.ServiceID] = true
	}
	for _, id := range []string{"vps2-status-api", "pulse-webui", "auto-svc-4050"} {
		if !found[id] {
			t.Fatalf("expected merged heartbeat services to include %q, got %+v", id, beat.Services)
		}
	}
}
