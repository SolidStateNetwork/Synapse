package tunnel

import (
	"bytes"
	"context"
	"crypto/rand"
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

	tunnelv1 "github.com/SolidStateNetwork/Synapse/proto"
	"github.com/hashicorp/yamux"
)

func TestEndToEndAxonMTLSYamuxFourStreams(t *testing.T) {
	axonConfigDir := t.TempDir()
	workspaceDir := t.TempDir()

	caPEM, caCert, caPriv, tlsListener, tunnelPort := createTestPKIAndTLSListener(t)
	defer tlsListener.Close()

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
		stream, err := sess.AcceptStream()
		if err != nil {
			return
		}
		var hdr tunnelv1.StreamHeader
		_ = tunnelv1.ReadFrame(stream, &hdr)
		// Push ServiceHealthTarget list down telemetry stream to exercise listener
		_ = tunnelv1.WriteFrame(stream, []tunnelv1.ServiceHealthTarget{
			{ServiceID: "svc-test", Name: "Test", Protocol: "http", Port: 8080, Path: "/"},
		})
		var beat tunnelv1.NodeHeartbeat
		if err := tunnelv1.ReadFrame(stream, &beat); err == nil {
			heartbeatCh <- beat
		}
	}()

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

	// Verify Stream Type 2 Interactive Input & Resize (`input:` prefix)
	for _, frame := range []tunnelv1.PtyLiveFrame{
		{SessionID: "sess-1", Type: "resize", Cols: 120, Rows: 40},
		{SessionID: "sess-1", Type: "input", Data: []byte("echo interactive_ok\n")},
	} {
		inStream, err := ymSess.OpenStream()
		if err != nil {
			t.Fatal(err)
		}
		_ = tunnelv1.WriteFrame(inStream, tunnelv1.StreamHeader{
			StreamType: tunnelv1.StreamTypePty,
			ProjectID:  "proj-1",
			SessionID:  "input:sess-1",
		})
		_ = tunnelv1.WriteFrame(inStream, frame)
		_ = inStream.Close()
	}

	// Verify Stream Type 2 Live Stream (`live:` prefix)
	liveStream, err := ymSess.OpenStream()
	if err != nil {
		t.Fatal(err)
	}
	_ = tunnelv1.WriteFrame(liveStream, tunnelv1.StreamHeader{
		StreamType: tunnelv1.StreamTypePty,
		ProjectID:  "proj-1",
		SessionID:  "live:sess-1",
	})
	_ = tunnelv1.WriteFrame(liveStream, tunnelv1.PtyLiveFrame{SessionID: "sess-1", Type: "resize", Cols: 100, Rows: 30})
	_ = tunnelv1.WriteFrame(liveStream, tunnelv1.PtyLiveFrame{SessionID: "sess-1", Type: "input", Data: []byte("echo live_stream_ping\n")})
	_ = liveStream.SetReadDeadline(time.Now().Add(3 * time.Second))
	var outFrame tunnelv1.PtyLiveFrame
	if err := tunnelv1.ReadFrame(liveStream, &outFrame); err != nil {
		t.Fatalf("failed to read live PTY frame: %v", err)
	}
	_ = liveStream.Close()

	// Verify Stream Type 3: Live TCP/HTTP Port-Forwarding + Edge Cases
	badPortStream, _ := ymSess.OpenStream()
	_ = tunnelv1.WriteFrame(badPortStream, tunnelv1.StreamHeader{StreamType: tunnelv1.StreamTypePortForward, TargetPort: 0})
	_ = badPortStream.Close()

	unknownStream, _ := ymSess.OpenStream()
	_ = tunnelv1.WriteFrame(unknownStream, tunnelv1.StreamHeader{StreamType: tunnelv1.StreamType(99)})
	_ = unknownStream.Close()

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

func TestCoreTelemetrySummary_MultiCoreLiveAndStandby(t *testing.T) {
	var nilAgent *Agent
	if c, s := nilAgent.CoreTelemetrySummary(); c != 1 || s != nil {
		t.Fatalf("expected (1, nil) for nil agent, got (%d, %v)", c, s)
	}

	emptyAgent := NewAgent(&IdentityConfig{})
	if c, s := emptyAgent.CoreTelemetrySummary(); c != 1 || s != nil {
		t.Fatalf("expected (1, nil) for empty targets, got (%d, %v)", c, s)
	}

	cfg := &IdentityConfig{
		NodeID:      "edge-node-01",
		CoreGateway: "127.0.0.1:8443",
		CoreHTTP:    "http://127.0.0.1:8081",
		Tier:        tunnelv1.Tier1Unleashed,
		MultiCore:   true,
		Cores: []CoreTarget{
			{
				Name:        "primary-core",
				CoreGateway: "127.0.0.1:8443",
				CoreHTTP:    "http://127.0.0.1:8081",
				Enabled:     true,
			},
			{
				Name:        "secondary-core",
				CoreGateway: "127.0.0.1:9443",
				CoreHTTP:    "http://127.0.0.1:9081",
				Enabled:     true,
			},
		},
	}

	agent := NewAgent(cfg)
	agent.setTargetConnected("127.0.0.1:8443", true)

	activeCount, summaries := agent.CoreTelemetrySummary()
	if activeCount != 2 || len(summaries) != 2 {
		t.Fatalf("expected 2 summaries, got count=%d (%v)", activeCount, summaries)
	}
	if summaries[0] != "primary-core (127.0.0.1:8443 - LIVE)" || summaries[1] != "secondary-core (127.0.0.1:9443 - STANDBY)" {
		t.Fatalf("unexpected summaries: %v", summaries)
	}

	agent.setTargetConnected("127.0.0.1:9443", true)
	_, summaries2 := agent.CoreTelemetrySummary()
	if summaries2[1] != "secondary-core (127.0.0.1:9443 - LIVE)" {
		t.Fatalf("expected secondary summary to transition to LIVE, got %q", summaries2[1])
	}
}

func TestRunDiagnostics_EndToEndAndErrorPaths(t *testing.T) {
	// 1. Missing config directory must return ConfigValid=false
	badRep := RunDiagnostics( filepath.Join(t.TempDir(), "nonexistent"))
	if badRep.ConfigValid || len(badRep.Errors) == 0 {
		t.Fatalf("expected ConfigValid=false and errors on missing configDir, got %+v", badRep)
	}

	// 2. Setup live mTLS listener + HTTP server for full 5-step diagnostics
	caPEM, caCert, caPriv, tlsListener, tunnelPort := createTestPKIAndTLSListener(t)
	defer tlsListener.Close()

	go func() {
		for {
			conn, err := tlsListener.Accept()
			if err != nil {
				return
			}
			if tlsConn, ok := conn.(interface{ Handshake() error }); ok {
				_ = tlsConn.Handshake()
			}
			_ = conn.Close()
		}
	}()

	nodeOnline := false
	httpSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/api/v1/bootstrap/csr":
			var req tunnelv1.CSRBootstrapRequest
			_ = json.NewDecoder(r.Body).Decode(&req)
			block, _ := pem.Decode(req.CSRPerm)
			csr, _ := x509.ParseCertificateRequest(block.Bytes)
			cliTmpl := &x509.Certificate{
				SerialNumber: big.NewInt(55),
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
		case "/healthz":
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"status":"ok"}`))
		case "/api/v1/nodes":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"nodes": []map[string]any{
					{"node_id": "diag-node-1", "online": nodeOnline},
				},
			})
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer httpSrv.Close()

	cfgDir := t.TempDir()
	wsDir := t.TempDir()
	idCfg, err := BootstrapCSR(cfgDir, httpSrv.URL, "tok-diag", "diag-node-1", tunnelv1.Tier2WorkspaceJail, wsDir)
	if err != nil {
		t.Fatalf("BootstrapCSR for diagnostics failed: %v", err)
	}

	// Case A: Direct mTLS dial handshake (nodeOnline=false)
	rep1 := RunDiagnostics(cfgDir)
	if !rep1.ConfigValid || !rep1.CoreHTTPReach || !rep1.MTLSHandshakeOK || !rep1.WorkspaceWrite {
		t.Fatalf("expected all diagnostic checks to pass via live mTLS dial, got %+v", rep1)
	}

	// Case B: Node already online in /api/v1/nodes (nodeOnline=true)
	nodeOnline = true
	rep2 := RunDiagnostics(cfgDir)
	if !rep2.MTLSHandshakeOK || !strings.Contains(rep2.MTLSCipherSuite, "active Yamux session") {
		t.Fatalf("expected active Yamux session detection, got %+v", rep2)
	}

	// Case C: Verify buildTLSConfig and buildTLSConfigForTarget error paths
	ag := NewAgent(idCfg)
	if _, err := ag.buildTLSConfig(); err != nil {
		t.Fatalf("expected valid buildTLSConfig, got %v", err)
	}
	if _, err := ag.buildTLSConfigForTarget(CoreTarget{CertFile: "/nonexistent", KeyFile: "/nonexistent"}); err == nil {
		t.Fatalf("expected error for missing client keypair")
	}
	badCA := filepath.Join(t.TempDir(), "bad-ca.crt")
	_ = os.WriteFile(badCA, []byte("not a pem"), 0o600)
	if _, err := ag.buildTLSConfigForTarget(CoreTarget{CertFile: idCfg.CertFile, KeyFile: idCfg.KeyFile, CACertFile: badCA}); err == nil {
		t.Fatalf("expected error for invalid CA PEM")
	}
}

func TestRunForever_EmptyTargetsAndMultiCoreCancel(t *testing.T) {
	emptyAg := NewAgent(&IdentityConfig{})
	if err := emptyAg.RunForever(context.Background()); err == nil {
		t.Fatalf("expected error when no active Core targets are configured")
	}

	mcAg := NewAgent(&IdentityConfig{
		NodeID:      "mc-node",
		CoreGateway: "127.0.0.1:1",
		MultiCore:   true,
		Cores: []CoreTarget{
			{Name: "c2", CoreGateway: "127.0.0.1:2", Enabled: true},
		},
	})
	ctx, cancel := context.WithTimeout(context.Background(), 150*time.Millisecond)
	defer cancel()
	_ = mcAg.RunForever(ctx)
}
