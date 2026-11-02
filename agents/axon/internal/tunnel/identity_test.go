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
	"math/big"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/SolidStateNetwork/Synapse/agents/axon/internal/health"
	tunnelv1 "github.com/SolidStateNetwork/Synapse/proto"
	"github.com/hashicorp/yamux"
)

func createTestPKIAndTLSListener(t *testing.T) ([]byte, *x509.Certificate, *ecdsa.PrivateKey, net.Listener, int) {
	t.Helper()
	caPriv, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	caTmpl := &x509.Certificate{
		SerialNumber:          big.NewInt(1),
		Subject:               pkix.Name{CommonName: "Synapse Test Root CA"},
		NotBefore:             time.Now().Add(-time.Hour),
		NotAfter:              time.Now().Add(time.Hour),
		KeyUsage:              x509.KeyUsageCertSign | x509.KeyUsageDigitalSignature,
		BasicConstraintsValid: true,
		IsCA:                  true,
	}
	caDER, err := x509.CreateCertificate(rand.Reader, caTmpl, caTmpl, &caPriv.PublicKey, caPriv)
	if err != nil {
		t.Fatal(err)
	}
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
	port := tlsListener.Addr().(*net.TCPAddr).Port
	return caPEM, caCert, caPriv, tlsListener, port
}

func TestActiveCoreTargets_MultiCoreDeduplication(t *testing.T) {
	var nilCfg *IdentityConfig
	if nilCfg.ActiveCoreTargets() != nil {
		t.Fatalf("expected nil slice for nil IdentityConfig")
	}

	cfg := &IdentityConfig{
		NodeID:        "edge-node-01",
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
				CertFile:    "/etc/axon/override.crt",
				KeyFile:     "/etc/axon/override.key",
				CACertFile:  "/etc/axon/override-ca.crt",
				Enabled:     true,
			},
			{
				Name:        "secondary-core",
				CoreGateway: "127.0.0.1:9443",
				CoreHTTP:    "http://127.0.0.1:9081",
				CertFile:    "/etc/axon/profiles/secondary-core/node.crt",
				KeyFile:     "/etc/axon/profiles/secondary-core/node.key",
				CACertFile:  "/etc/axon/profiles/secondary-core/ca.crt",
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
	if targets[0].CoreGateway != "127.0.0.1:8443" || targets[0].CertFile != "/etc/axon/override.crt" {
		t.Fatalf("unexpected primary target: %+v", targets[0])
	}
	if targets[1].CoreGateway != "127.0.0.1:9443" || targets[1].Name != "secondary-core" {
		t.Fatalf("unexpected secondary target: %+v", targets[1])
	}
	if targets[1].NodeID != "edge-node-01" || targets[1].Tier != tunnelv1.Tier1Unleashed {
		t.Fatalf("expected secondary target to inherit NodeID & Tier, got %+v", targets[1])
	}
}

func TestLoadIdentity_MultiCorePersistenceAndBackupSelfHealing(t *testing.T) {
	tmpDir := t.TempDir()
	cfgPath := filepath.Join(tmpDir, "config.json")

	// Missing config and backup must return error
	if _, err := LoadIdentity(tmpDir); err == nil {
		t.Fatalf("expected error when config.json does not exist")
	}

	// Create profile cert files to verify profile path reconciliation
	profDir := filepath.Join(tmpDir, "profiles", "second-core")
	if err := os.MkdirAll(profDir, 0o700); err != nil {
		t.Fatal(err)
	}
	for _, f := range []string{"node.crt", "node.key", "ca.crt"} {
		if err := os.WriteFile(filepath.Join(profDir, f), []byte("pem"), 0o600); err != nil {
			t.Fatal(err)
		}
	}

	raw := `{
  "node_id": "edge-node-01",
  "core_gateway": "127.0.0.1:8443",
  "core_http": "http://127.0.0.1:8081",
  "tier": "TIER_1_UNLEASHED",
  "workspace_root": "/opt/axon/workspaces",
  "cert_file": "/etc/axon/node.crt",
  "key_file": "/etc/axon/node.key",
  "ca_cert_file": "/etc/axon/ca.crt",
  "debug": true,
  "multi_core": true,
  "cores": [
    {
      "name": "second-core",
      "node_id": "edge-node-01",
      "core_gateway": "127.0.0.1:9443",
      "core_http": "http://127.0.0.1:9081",
      "tier": "TIER_1_UNLEASHED",
      "enabled": true
    }
  ]
}`
	if err := os.WriteFile(cfgPath+".bak", []byte(raw), 0o600); err != nil {
		t.Fatal(err)
	}
	// Write corrupted primary config.json to verify self-healing from .bak
	if err := os.WriteFile(cfgPath, []byte("{corrupted"), 0o600); err != nil {
		t.Fatal(err)
	}

	loaded, err := LoadIdentity(tmpDir)
	if err != nil {
		t.Fatalf("LoadIdentity self-healing from .bak failed: %v", err)
	}
	if !loaded.MultiCore || len(loaded.Cores) != 1 {
		t.Fatalf("expected MultiCore=true and 1 secondary core, got %+v", loaded)
	}
	if !strings.HasSuffix(loaded.Cores[0].CertFile, "profiles/second-core/node.crt") {
		t.Fatalf("expected profile cert reconciliation, got %q", loaded.Cores[0].CertFile)
	}
}

func TestLoadIdentity_AutoReconcilesLoopbackProfiles(t *testing.T) {
	tmpDir := t.TempDir()
	profDir := filepath.Join(tmpDir, "profiles", "secondary-core")
	if err := os.MkdirAll(profDir, 0o700); err != nil {
		t.Fatal(err)
	}
	for _, f := range []string{"node.crt", "node.key", "ca.crt"} {
		if err := os.WriteFile(filepath.Join(profDir, f), []byte("pem"), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	profCfg := `{
  "node_id": "edge-node-01",
  "core_gateway": "127.0.0.1:9443",
  "core_http": "http://127.0.0.1:9081",
  "tier": "TIER_1_UNLEASHED"
}`
	if err := os.WriteFile(filepath.Join(profDir, "config.json"), []byte(profCfg), 0o600); err != nil {
		t.Fatal(err)
	}

	mainCfg := `{
  "node_id": "edge-node-01",
  "core_gateway": "127.0.0.1:8443",
  "core_http": "http://127.0.0.1:8081",
  "tier": "TIER_1_UNLEASHED",
  "multi_core": true,
  "cores": []
}`
	if err := os.WriteFile(filepath.Join(tmpDir, "config.json"), []byte(mainCfg), 0o600); err != nil {
		t.Fatal(err)
	}

	loaded, err := LoadIdentity(tmpDir)
	if err != nil {
		t.Fatalf("LoadIdentity failed: %v", err)
	}
	targets := loaded.ActiveCoreTargets()
	if len(targets) != 2 {
		t.Fatalf("expected 2 targets after auto-reconciling loopback profile, got %d", len(targets))
	}
}

func TestBootstrapCSRWithOptions_And_AddSecondaryCore(t *testing.T) {
	caPEM, caCert, caPriv, tlsLis, tunnelPort := createTestPKIAndTLSListener(t)
	defer tlsLis.Close()

	rejectNext := false
	bootSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if rejectNext {
			_ = json.NewEncoder(w).Encode(tunnelv1.CSRBootstrapResponse{
				Success: false,
				Error:   "token rejected in test",
			})
			return
		}
		var req tunnelv1.CSRBootstrapRequest
		_ = json.NewDecoder(r.Body).Decode(&req)
		block, _ := pem.Decode(req.CSRPerm)
		csr, _ := x509.ParseCertificateRequest(block.Bytes)
		cliTmpl := &x509.Certificate{
			SerialNumber: big.NewInt(10),
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

	baseDir := t.TempDir()
	// 1. AddSecondaryCore on fresh directory (no existing config.json) with defaults & port-only gatewayOverride
	cfg1, target1, err := AddSecondaryCore(baseDir, "", bootSrv.URL, "tok-1", "", "", "", "9443")
	if err != nil {
		t.Fatalf("AddSecondaryCore initial failed: %v", err)
	}
	if !cfg1.MultiCore || len(cfg1.Cores) != 1 || !strings.HasSuffix(target1.CoreGateway, ":9443") {
		t.Fatalf("unexpected initial AddSecondaryCore result: cfg=%+v target=%+v", cfg1, target1)
	}

	// 2. AddSecondaryCore on existing directory (appends second profile, then updates existing profile)
	cfg2, target2, err := AddSecondaryCore(baseDir, "prod-core-2", bootSrv.URL, "tok-2", "custom-node", tunnelv1.Tier1Unleashed, t.TempDir(), "127.0.0.1:9444")
	if err != nil {
		t.Fatalf("AddSecondaryCore second profile failed: %v", err)
	}
	if len(cfg2.Cores) != 2 || target2.Name != "prod-core-2" {
		t.Fatalf("expected 2 cores after adding prod-core-2, got %+v", cfg2.Cores)
	}

	// Update existing profile by name
	cfg3, _, err := AddSecondaryCore(baseDir, "prod-core-2", bootSrv.URL, "tok-3", "custom-node", tunnelv1.Tier1Unleashed, t.TempDir(), "127.0.0.1:9445")
	if err != nil {
		t.Fatalf("AddSecondaryCore update profile failed: %v", err)
	}
	if len(cfg3.Cores) != 2 {
		t.Fatalf("expected in-place update of prod-core-2 (len=2), got %d", len(cfg3.Cores))
	}

	// 3. Reconcile MultiCore profiles from disk when Cores slice in config.json is empty
	cfg3.Cores = nil
	cfg3.Debug = true
	_ = writeConfigWithBackup(filepath.Join(baseDir, "config.json"), cfg3)
	reconciled, err := LoadIdentity(baseDir)
	if err != nil || len(reconciled.Cores) == 0 {
		t.Fatalf("expected LoadIdentity to reconcile profiles from disk, got %+v (err=%v)", reconciled, err)
	}
	ag := NewAgent(reconciled)
	if _, err := ag.buildTLSConfig(); err != nil {
		t.Fatalf("expected buildTLSConfig to succeed, got %v", err)
	}
	badPEM := filepath.Join(t.TempDir(), "bad.pem")
	_ = os.WriteFile(badPEM, []byte("not-a-pem"), 0o600)
	if _, _, err := NeedsCertRotation(badPEM, 0); err == nil {
		t.Fatal("expected error on invalid PEM in NeedsCertRotation")
	}
	if _, err := ag.buildTLSConfigForTarget(CoreTarget{CertFile: reconciled.CertFile, KeyFile: reconciled.KeyFile, CACertFile: filepath.Join(t.TempDir(), "no-ca.crt")}); err == nil {
		t.Fatal("expected error on missing CA cert")
	}
	if _, err := ag.buildTLSConfigForTarget(CoreTarget{CertFile: reconciled.CertFile, KeyFile: reconciled.KeyFile, CACertFile: badPEM}); err == nil {
		t.Fatal("expected error on invalid CA PEM")
	}
	// Exercise RunDiagnostics degraded branches (missing cert, unreachable HTTP/mTLS, non-dir workspace)
	errDiagDir := t.TempDir()
	wsFile := filepath.Join(errDiagDir, "ws-is-file")
	_ = os.WriteFile(wsFile, []byte("x"), 0o600)
	_ = writeConfigWithBackup(filepath.Join(errDiagDir, "config.json"), &IdentityConfig{
		NodeID:        "err-node",
		CoreHTTP:      "http://127.0.0.1:1",
		CoreGateway:   "127.0.0.1:1",
		CertFile:      filepath.Join(errDiagDir, "missing.crt"),
		KeyFile:       filepath.Join(errDiagDir, "missing.key"),
		CACertFile:    filepath.Join(errDiagDir, "missing-ca.crt"),
		WorkspaceRoot: filepath.Join(wsFile, "sub"),
	})
	degRep := RunDiagnostics(errDiagDir)
	if degRep.CoreHTTPReach || degRep.MTLSHandshakeOK || degRep.WorkspaceWrite {
		t.Fatalf("expected degraded RunDiagnostics report, got %+v", degRep)
	}
	cA, cB := net.Pipe()
	go func() {
		_ = tunnelv1.WriteFrame(cA, tunnelv1.StreamHeader{StreamType: tunnelv1.StreamType(255)})
		_ = cA.Close()
	}()
	ag.handleStreamForTarget(cB, CoreTarget{Name: "p"})
	ag.handlePortForwardStream(cB, 0)
	ag.handlePortForwardStream(cB, 1)

	// 4. Verify rejection path & error paths
	rejectNext = true
	if _, err := BootstrapCSR(t.TempDir(), bootSrv.URL, "bad-tok", "n1", tunnelv1.Tier2WorkspaceJail, t.TempDir()); err == nil {
		t.Fatalf("expected BootstrapCSR to fail when server rejects token")
	}
	if _, _, err := AddSecondaryCore(baseDir, "fail-prof", bootSrv.URL, "bad-tok", "n1", tunnelv1.Tier2WorkspaceJail, t.TempDir(), ""); err == nil {
		t.Fatalf("expected AddSecondaryCore to fail when server rejects token")
	}
	if _, err := BootstrapCSR(t.TempDir(), "http://127.0.0.1:1", "tok", "n1", tunnelv1.Tier2WorkspaceJail, t.TempDir()); err == nil {
		t.Fatalf("expected BootstrapCSR to fail on unreachable endpoint")
	}
	fileTarget := filepath.Join(t.TempDir(), "not-a-dir")
	_ = os.WriteFile(fileTarget, []byte("x"), 0o600)
	if _, err := BootstrapCSR(filepath.Join(fileTarget, "sub"), bootSrv.URL, "tok", "n1", tunnelv1.Tier2WorkspaceJail, t.TempDir()); err == nil {
		t.Fatalf("expected BootstrapCSR to fail when targetDir cannot be created")
	}
	badJSONSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte("not-json"))
	}))
	defer badJSONSrv.Close()
	if _, err := BootstrapCSR(t.TempDir(), badJSONSrv.URL, "tok", "n1", tunnelv1.Tier2WorkspaceJail, t.TempDir()); err == nil {
		t.Fatalf("expected BootstrapCSR to fail on invalid JSON response")
	}
}

func TestMultiCoreSharedHealthCollectorMergesTargets(t *testing.T) {
	col := health.NewCollector("test-multi-core-node", tunnelv1.Tier1Unleashed)
	col.SetTargetsForSource("primary", []tunnelv1.ServiceHealthTarget{
		{ServiceID: "svc-status-api", Name: "Status API", Protocol: "http", Port: 4070, Path: "/"},
		{ServiceID: "svc-webui", Name: "Live WebUI", Protocol: "http", Port: 4090, Path: "/"},
	})
	col.SetTargetsForSource("secondary-core", []tunnelv1.ServiceHealthTarget{
		{ServiceID: "auto-svc-4050", Name: "Autonomous Microservice :4050", Protocol: "http", Port: 4050, Path: "/"},
	})

	beat := col.CollectForNode("edge-node-01", tunnelv1.Tier1Unleashed, nil)
	found := make(map[string]bool)
	for _, s := range beat.Services {
		found[s.ServiceID] = true
	}
	for _, id := range []string{"svc-status-api", "svc-webui", "auto-svc-4050"} {
		if !found[id] {
			t.Fatalf("expected merged heartbeat services to include %q, got %+v", id, beat.Services)
		}
	}

	// Test RotateTargetCertificate EOF & invalid target path error branches
	c1, c2 := net.Pipe()
	defer c1.Close()
	defer c2.Close()
	sSess, _ := yamux.Server(c1, yamux.DefaultConfig())
	cSess, _ := yamux.Client(c2, yamux.DefaultConfig())
	defer sSess.Close()
	defer cSess.Close()

	go func() {
		// Stream 1: immediately close on accept -> EOF on ReadFrame
		if st1, err := cSess.AcceptStream(); err == nil {
			var hdr tunnelv1.StreamHeader
			_ = tunnelv1.ReadFrame(st1, &hdr)
			var req tunnelv1.CertRenewRequest
			_ = tunnelv1.ReadFrame(st1, &req)
			_ = st1.Close()
		}
		// Stream 2: return valid cert but KeyFile is in unwritable path
		if st2, err := cSess.AcceptStream(); err == nil {
			var hdr tunnelv1.StreamHeader
			_ = tunnelv1.ReadFrame(st2, &hdr)
			var req tunnelv1.CertRenewRequest
			_ = tunnelv1.ReadFrame(st2, &req)
			_ = tunnelv1.WriteFrame(st2, tunnelv1.CertRenewResponse{Success: true, CertPEM: []byte("cert"), NotAfterUnix: time.Now().Unix()})
			_ = st2.Close()
		}
		// Stream 3: return valid cert, KeyFile valid, CertFile in unwritable path
		if st3, err := cSess.AcceptStream(); err == nil {
			var hdr tunnelv1.StreamHeader
			_ = tunnelv1.ReadFrame(st3, &hdr)
			var req tunnelv1.CertRenewRequest
			_ = tunnelv1.ReadFrame(st3, &req)
			_ = tunnelv1.WriteFrame(st3, tunnelv1.CertRenewResponse{Success: true, CertPEM: []byte("cert"), NotAfterUnix: time.Now().Unix()})
			_ = st3.Close()
		}
	}()

	if _, err := RotateTargetCertificate(sSess, CoreTarget{Name: "r1", NodeID: "n1", CertFile: filepath.Join(t.TempDir(), "c.crt"), KeyFile: filepath.Join(t.TempDir(), "c.key")}); err == nil {
		t.Fatal("expected error on closed renew response stream")
	}
	if _, err := RotateTargetCertificate(sSess, CoreTarget{Name: "r2", NodeID: "n1", CertFile: "/nonexistent-dir/c.crt", KeyFile: "/nonexistent-dir/c.key"}); err == nil {
		t.Fatal("expected error when temp key cannot be written")
	}
	if _, err := RotateTargetCertificate(sSess, CoreTarget{Name: "r3", NodeID: "n1", CertFile: "/nonexistent-dir/c.crt", KeyFile: filepath.Join(t.TempDir(), "valid.key")}); err == nil {
		t.Fatal("expected error when temp cert cannot be written")
	}

	// Exercise setTargetConnected nil map, runSingleTelemetryStream closed session & handleFsStream / handlePtyStream edge branches
	badWsFile := filepath.Join(t.TempDir(), "ws-file")
	_ = os.WriteFile(badWsFile, []byte("x"), 0o600)
	rawAg := NewAgent(&IdentityConfig{NodeID: "n1", CoreGateway: "invalid-host-no-port", Tier: tunnelv1.Tier2WorkspaceJail, WorkspaceRoot: filepath.Join(badWsFile, "sub")})
	rawAg.connectedTargets = nil
	rawAg.setTargetConnected("127.0.0.1:8443", true)
	_ = sSess.Close()
	_ = rawAg.runSingleTelemetryStream(t.Context(), sSess, CoreTarget{Name: "closed"}, rawAg.HealthCol)
	p1, p2 := net.Pipe()
	_ = p1.Close()
	rawAg.handleFsStream(p2, "")
	rawAg.handlePtyStream(p2, tunnelv1.StreamHeader{SessionID: "s1"}, "")
	rawAg.handlePtyStream(p2, tunnelv1.StreamHeader{SessionID: "input:s1"}, "")
	rawAg.handlePtyStream(p2, tunnelv1.StreamHeader{SessionID: "live:s1"}, "")
	rawAg.PtyMgr.CloseAll()

	// Exercise LoadIdentity non-dir and invalid profile config branches
	profIgnoreDir := t.TempDir()
	_ = os.MkdirAll(filepath.Join(profIgnoreDir, "profiles", "bad-prof"), 0o700)
	_ = os.WriteFile(filepath.Join(profIgnoreDir, "profiles", "file.txt"), []byte("x"), 0o600)
	for _, fn := range []string{"node.crt", "node.key", "ca.crt"} {
		_ = os.WriteFile(filepath.Join(profIgnoreDir, "profiles", "bad-prof", fn), []byte("pem"), 0o600)
	}
	_ = os.WriteFile(filepath.Join(profIgnoreDir, "profiles", "bad-prof", "config.json"), []byte(`{"core_gateway":"10.99.99.99:8443"}`), 0o600)
	_ = writeConfigWithBackup(filepath.Join(profIgnoreDir, "config.json"), &IdentityConfig{
		NodeID:      "n1",
		CoreGateway: "127.0.0.1:8443",
		MultiCore:   true,
	})
	_, _ = LoadIdentity(profIgnoreDir)

	corruptDir := t.TempDir()
	_ = os.WriteFile(filepath.Join(corruptDir, "config.json"), []byte("{bad"), 0o600)
	_, _ = LoadIdentity(corruptDir)
	_ = os.WriteFile(filepath.Join(corruptDir, "config.json.bak"), []byte("{bad-bak"), 0o600)
	_, _ = LoadIdentity(corruptDir)
}



