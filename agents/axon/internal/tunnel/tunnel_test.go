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
	"strings"
	"testing"
	"time"

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
