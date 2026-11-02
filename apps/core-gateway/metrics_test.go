package main

import (
	"bytes"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/json"
	"encoding/pem"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	tunnelv1 "github.com/SolidStateNetwork/Synapse/proto"
	"github.com/hashicorp/yamux"
)

func TestGatewayEnterpriseCRLAndPrometheusMetrics(t *testing.T) {
	handler, authority, nodeHub, _ := setupTestGateway(t)

	tlsLis, err := tls.Listen("tcp", "127.0.0.1:0", authority.ServerTLSConfig())
	if err != nil {
		t.Fatal(err)
	}
	defer tlsLis.Close()
	go func() {
		_ = nodeHub.ServeMTLS(tlsLis)
	}()

	tok := authority.CreateJoinToken("proj-crl", tunnelv1.Tier2WorkspaceJail, time.Minute)
	priv, _ := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	csrDER, _ := x509.CreateCertificateRequest(rand.Reader, &x509.CertificateRequest{
		Subject: pkix.Name{CommonName: "evict-node-01"},
	}, priv)
	csrPEM := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE REQUEST", Bytes: csrDER})
	certPEM, _, _, err := authority.SignNodeCSR(tunnelv1.CSRBootstrapRequest{
		JoinToken: tok.Token,
		NodeID:    "evict-node-01",
		CSRPerm:   csrPEM,
	})
	if err != nil {
		t.Fatal(err)
	}
	keyDER, _ := x509.MarshalECPrivateKey(priv)
	keyPEM := pem.EncodeToMemory(&pem.Block{Type: "EC PRIVATE KEY", Bytes: keyDER})
	cliCert, _ := tls.X509KeyPair(certPEM, keyPEM)
	caPool := x509.NewCertPool()
	caPool.AppendCertsFromPEM(authority.CACertPEM)

	cliConn, err := tls.Dial("tcp", tlsLis.Addr().String(), &tls.Config{
		Certificates: []tls.Certificate{cliCert},
		RootCAs:      caPool,
		MinVersion:   tls.VersionTLS13,
		ServerName:   "synapse-core-gateway",
	})
	if err != nil {
		t.Fatalf("initial mTLS dial failed: %v", err)
	}
	defer cliConn.Close()
	ymSrv, err := yamux.Server(cliConn, yamux.DefaultConfig())
	if err != nil {
		t.Fatal(err)
	}
	defer ymSrv.Close()

	telStream, err := ymSrv.OpenStream()
	if err != nil {
		t.Fatal(err)
	}
	_ = tunnelv1.WriteFrame(telStream, tunnelv1.StreamHeader{StreamType: tunnelv1.StreamTypeTelemetry})
	_ = tunnelv1.WriteFrame(telStream, tunnelv1.NodeHeartbeat{
		NodeID:        "evict-node-01",
		Hostname:      "evict-host",
		CPUPercent:    42.5,
		RAMPercent:    51.0,
		DiskPercent:   30.0,
		TimestampUnix: time.Now().Unix(),
		AnomalyAlerts: []tunnelv1.AnomalyAlert{{Code: "TEST_ALERT", Severity: "WARNING", Message: "test"}},
	})

	for i := 0; i < 30 && len(nodeHub.ListNodes()) == 0; i++ {
		time.Sleep(10 * time.Millisecond)
	}

	// 1. Test /metrics (unauthenticated when no token set, JSON format, and Bearer token enforcement)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/metrics", nil))
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), "synapse_connected_nodes_total 1") {
		t.Fatalf("unexpected /metrics output: %d %s", rec.Code, rec.Body.String())
	}

	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/metrics?format=json", nil))
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"version":"v2.5.0"`) {
		t.Fatalf("unexpected JSON /api/v1/metrics output: %d %s", rec.Code, rec.Body.String())
	}

	t.Setenv("SYNAPSE_METRICS_TOKEN", "gw-secret-tok")
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/metrics", nil))
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 on /metrics without token, got %d", rec.Code)
	}
	reqAuth := httptest.NewRequest(http.MethodGet, "/metrics", nil)
	reqAuth.Header.Set("Authorization", "Bearer gw-secret-tok")
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, reqAuth)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 on /metrics with Bearer token, got %d", rec.Code)
	}

	// 2. Test /api/v1/nodes/revoke & /api/v1/crl (error paths + live session eviction)
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodDelete, "/api/v1/nodes/revoke", nil))
	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405 on DELETE /api/v1/nodes/revoke, got %d", rec.Code)
	}
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/api/v1/nodes/revoke", strings.NewReader("{bad")))
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 on bad JSON /api/v1/nodes/revoke, got %d", rec.Code)
	}
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/api/v1/nodes/revoke", strings.NewReader(`{}`)))
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 on empty /api/v1/nodes/revoke, got %d", rec.Code)
	}

	revBody, _ := json.Marshal(map[string]any{
		"node_id": "evict-node-01",
		"reason":  "security_compromise_drill",
	})
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/api/v1/nodes/revoke", bytes.NewReader(revBody)))
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"session_evicted":true`) {
		t.Fatalf("expected 200 and session_evicted:true on /api/v1/nodes/revoke, got %d %s", rec.Code, rec.Body.String())
	}

	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/nodes/revoke", nil))
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), "evict-node-01") {
		t.Fatalf("expected revoked node in GET /api/v1/nodes/revoke: %s", rec.Body.String())
	}
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/crl", nil))
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), "evict-node-01") {
		t.Fatalf("expected revoked node in GET /api/v1/crl: %s", rec.Body.String())
	}

	// 3. Reconnecting with the revoked client certificate must fail mTLS handshake
	reConn, err := tls.Dial("tcp", tlsLis.Addr().String(), &tls.Config{
		Certificates: []tls.Certificate{cliCert},
		RootCAs:      caPool,
		MinVersion:   tls.VersionTLS13,
		ServerName:   "synapse-core-gateway",
	})
	if err == nil {
		// In TLS 1.3 client handshake completes before reading server post-handshake alert; reading triggers the error
		_ = reConn.SetReadDeadline(time.Now().Add(500 * time.Millisecond))
		var buf [1]byte
		_, readErr := reConn.Read(buf[:])
		_ = reConn.Close()
		if readErr == nil {
			t.Fatalf("expected revoked certificate connection to be rejected by ServerTLSConfig VerifyPeerCertificate")
		}
	}
}
