package proxy

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/SolidStateNetwork/Synapse/apps/core-gateway/internal/hub"
	"github.com/SolidStateNetwork/Synapse/apps/core-gateway/internal/pki"
	tunnelv1 "github.com/SolidStateNetwork/Synapse/proto"
	"github.com/hashicorp/yamux"
)

func TestLivePreviewHandlerValidationAndErrorModes(t *testing.T) {
	h := hub.NewHub(t.TempDir())
	handler := NewLivePreviewHandler(h)

	// 1. Invalid path with too few segments
	reqShort := httptest.NewRequest(http.MethodGet, "/preview/only-two/segments", nil)
	recShort := httptest.NewRecorder()
	handler.ServeHTTP(recShort, reqShort)
	if recShort.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 Bad Request for short path, got %d", recShort.Code)
	}

	// 2. Invalid port number
	reqBadPort := httptest.NewRequest(http.MethodGet, "/preview/proj-1/node-1/99999/health", nil)
	recBadPort := httptest.NewRecorder()
	handler.ServeHTTP(recBadPort, reqBadPort)
	if recBadPort.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 Bad Request for invalid port, got %d", recBadPort.Code)
	}

	// 3. Offline node with JSON Accept header -> structured JSON 502 Bad Gateway
	reqJSON := httptest.NewRequest(http.MethodGet, "/preview/proj-1/offline-node/4050/api/status", nil)
	reqJSON.Header.Set("Accept", "application/json")
	recJSON := httptest.NewRecorder()
	handler.ServeHTTP(recJSON, reqJSON)
	if recJSON.Code != http.StatusBadGateway {
		t.Fatalf("expected 502 Bad Gateway for offline node JSON request, got %d", recJSON.Code)
	}
	if !strings.Contains(recJSON.Header().Get("Content-Type"), "application/json") {
		t.Fatalf("expected application/json error response, got %q", recJSON.Header().Get("Content-Type"))
	}

	// 4. Offline node with HTML browser GET -> HTML 502 card
	reqHTML := httptest.NewRequest(http.MethodGet, "/preview/proj-1/offline-node/4050/", nil)
	reqHTML.Header.Set("Accept", "text/html")
	recHTML := httptest.NewRecorder()
	handler.ServeHTTP(recHTML, reqHTML)
	if recHTML.Code != http.StatusBadGateway {
		t.Fatalf("expected 502 Bad Gateway for offline node HTML request, got %d", recHTML.Code)
	}
	if !strings.Contains(recHTML.Body.String(), "Synapse Live-Preview Tunnel Unavailable") {
		t.Fatalf("expected HTML fallback card in body")
	}

	// 5. Connected node round-trip exercising ModifyResponse
	auth, err := pki.NewAuthority(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	tlsLis, err := tls.Listen("tcp", "127.0.0.1:0", auth.ServerTLSConfig())
	if err != nil {
		t.Fatal(err)
	}
	defer tlsLis.Close()
	go func() { _ = h.ServeMTLS(tlsLis) }()

	tok := auth.CreateJoinToken("proj-1", tunnelv1.Tier1Unleashed, time.Minute)
	priv, _ := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	csrDER, _ := x509.CreateCertificateRequest(rand.Reader, &x509.CertificateRequest{Subject: pkix.Name{CommonName: "proxy-node"}}, priv)
	csrPEM := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE REQUEST", Bytes: csrDER})
	certPEM, _, _, _ := auth.SignNodeCSR(tunnelv1.CSRBootstrapRequest{JoinToken: tok.Token, NodeID: "proxy-node", CSRPerm: csrPEM})
	keyDER, _ := x509.MarshalECPrivateKey(priv)
	cliCert, _ := tls.X509KeyPair(certPEM, pem.EncodeToMemory(&pem.Block{Type: "EC PRIVATE KEY", Bytes: keyDER}))
	pool := x509.NewCertPool()
	pool.AppendCertsFromPEM(auth.CACertPEM)

	cliConn, err := tls.Dial("tcp", tlsLis.Addr().String(), &tls.Config{
		Certificates: []tls.Certificate{cliCert},
		RootCAs:      pool,
		MinVersion:   tls.VersionTLS13,
		ServerName:   "synapse-core-gateway",
	})
	if err != nil {
		t.Fatal(err)
	}
	defer cliConn.Close()
	ymSrv, _ := yamux.Server(cliConn, yamux.DefaultConfig())
	defer ymSrv.Close()

	go func() {
		for {
			s, err := ymSrv.AcceptStream()
			if err != nil {
				return
			}
			go func(c net.Conn) {
				defer c.Close()
				var hdr tunnelv1.StreamHeader
				_ = tunnelv1.ReadFrame(c, &hdr)
				buf := make([]byte, 1024)
				_, _ = c.Read(buf)
				_, _ = c.Write([]byte("HTTP/1.1 200 OK\r\nX-Frame-Options: DENY\r\nAccess-Control-Allow-Origin: *\r\nContent-Length: 7\r\n\r\nPROXIED"))
			}(s)
		}
	}()

	for i := 0; i < 30 && len(h.ListNodes()) == 0; i++ {
		time.Sleep(10 * time.Millisecond)
	}
	reqLive := httptest.NewRequest(http.MethodGet, "/preview/proj-1/proxy-node/4050/hello", nil)
	recLive := httptest.NewRecorder()
	handler.ServeHTTP(recLive, reqLive)
	if recLive.Code != http.StatusOK || recLive.Header().Get("X-Frame-Options") != "" || recLive.Body.String() != "PROXIED" {
		t.Fatalf("unexpected live preview response: code=%d body=%q", recLive.Code, recLive.Body.String())
	}
}

