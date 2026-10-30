package main

import (
	"bytes"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/json"
	"encoding/pem"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/SolidStateNetwork/Synapse/apps/core-gateway/internal/hub"
	"github.com/SolidStateNetwork/Synapse/apps/core-gateway/internal/pki"
	tunnelv1 "github.com/SolidStateNetwork/Synapse/proto"
)

func setupTestGateway(t *testing.T) (http.Handler, *pki.Authority, *hub.Hub, string) {
	t.Helper()
	tmpDir := t.TempDir()
	vaultRoot := filepath.Join(tmpDir, "projects")
	if err := os.MkdirAll(vaultRoot, 0o755); err != nil {
		t.Fatalf("mkdir vaultRoot: %v", err)
	}
	authority, err := pki.NewAuthority(tmpDir)
	if err != nil {
		t.Fatalf("NewAuthority: %v", err)
	}
	nodeHub := hub.NewHub(vaultRoot)
	handler := buildGatewayMux(authority, nodeHub, tmpDir, vaultRoot, ":8081", 8443)
	return handler, authority, nodeHub, tmpDir
}

func TestGatewayHealthzAndDebugRoutes(t *testing.T) {
	handler, _, nodeHub, _ := setupTestGateway(t)

	// 1. GET /healthz
	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 on /healthz, got %d", rec.Code)
	}
	var health map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &health); err != nil {
		t.Fatalf("unmarshal /healthz: %v", err)
	}
	if health["version"] != "v0.7.0" || health["status"] != "ok" {
		t.Fatalf("unexpected /healthz response: %+v", health)
	}

	// 2. GET /api/v1/debug
	req = httptest.NewRequest(http.MethodGet, "/api/v1/debug", nil)
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 on GET /api/v1/debug, got %d", rec.Code)
	}

	// 3. POST /api/v1/debug (toggle, clear_events, ping_nodes)
	for _, action := range []string{"toggle", "clear_events", "ping_nodes"} {
		body, _ := json.Marshal(map[string]any{"action": action})
		req = httptest.NewRequest(http.MethodPost, "/api/v1/debug", bytes.NewReader(body))
		rec = httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200 on POST /api/v1/debug (%s), got %d", action, rec.Code)
		}
	}
	if !nodeHub.IsDebugEnabled() {
		t.Fatalf("expected debug to be enabled after toggle")
	}
}

func TestGatewayTokensAndCSRBootstrap(t *testing.T) {
	handler, _, _, _ := setupTestGateway(t)

	// 1. Method not allowed on /api/v1/tokens
	req := httptest.NewRequest(http.MethodDelete, "/api/v1/tokens", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405 on DELETE /api/v1/tokens, got %d", rec.Code)
	}

	// 2. POST /api/v1/tokens to create a join token
	tokReqBody, _ := json.Marshal(map[string]any{
		"project_id":  "proj-alpha",
		"tier":        tunnelv1.Tier2WorkspaceJail,
		"ttl_minutes": 15,
	})
	req = httptest.NewRequest(http.MethodPost, "/api/v1/tokens", bytes.NewReader(tokReqBody))
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201 on POST /api/v1/tokens, got %d", rec.Code)
	}
	var issued struct {
		Token string `json:"token"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &issued); err != nil || issued.Token == "" {
		t.Fatalf("failed to parse issued token: %v", err)
	}

	// 3. GET /api/v1/tokens
	req = httptest.NewRequest(http.MethodGet, "/api/v1/tokens", nil)
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), issued.Token) {
		t.Fatalf("expected issued token in GET /api/v1/tokens: %s", rec.Body.String())
	}

	// 4. POST /api/v1/bootstrap/csr with invalid JSON & invalid token
	req = httptest.NewRequest(http.MethodPost, "/api/v1/bootstrap/csr", strings.NewReader("{bad-json"))
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 on malformed CSR JSON, got %d", rec.Code)
	}

	// Generate valid ECDSA P-256 CSR
	priv, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatalf("GenerateKey: %v", err)
	}
	csrDER, err := x509.CreateCertificateRequest(rand.Reader, &x509.CertificateRequest{
		Subject: pkix.Name{CommonName: "muscle-test-01"},
	}, priv)
	if err != nil {
		t.Fatalf("CreateCertificateRequest: %v", err)
	}
	csrPEM := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE REQUEST", Bytes: csrDER})

	csrReqBody, _ := json.Marshal(tunnelv1.CSRBootstrapRequest{
		JoinToken: issued.Token,
		NodeID:    "muscle-test-01",
		Hostname:  "test-host",
		CSRPerm:   csrPEM,
	})
	req = httptest.NewRequest(http.MethodPost, "/api/v1/bootstrap/csr", bytes.NewReader(csrReqBody))
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 on valid CSR bootstrap, got %d: %s", rec.Code, rec.Body.String())
	}

	// Reusing one-time token must fail with 401
	req = httptest.NewRequest(http.MethodPost, "/api/v1/bootstrap/csr", bytes.NewReader(csrReqBody))
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 on reused join token, got %d", rec.Code)
	}
}

func TestGatewayNodeAndRPCEndpoints(t *testing.T) {
	handler, _, _, _ := setupTestGateway(t)

	// 1. GET /api/v1/nodes
	req := httptest.NewRequest(http.MethodGet, "/api/v1/nodes", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 on /api/v1/nodes, got %d", rec.Code)
	}

	// 2. /api/v1/rpc/fs (GET -> 405, bad JSON -> 400, offline node -> 502)
	req = httptest.NewRequest(http.MethodGet, "/api/v1/rpc/fs", nil)
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405 on GET /api/v1/rpc/fs, got %d", rec.Code)
	}

	req = httptest.NewRequest(http.MethodPost, "/api/v1/rpc/fs", strings.NewReader("{bad"))
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 on bad JSON /api/v1/rpc/fs, got %d", rec.Code)
	}

	fsBody, _ := json.Marshal(map[string]any{
		"node_id":   "offline-node",
		"operation": "READ_FILE",
		"path":      "README.md",
		"is_base64": true,
		"content":   "aGVsbG8=",
	})
	req = httptest.NewRequest(http.MethodPost, "/api/v1/rpc/fs", bytes.NewReader(fsBody))
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadGateway {
		t.Fatalf("expected 502 on offline node /api/v1/rpc/fs, got %d", rec.Code)
	}

	// 3. /api/v1/rpc/pty (GET -> 405, bad JSON -> 400, offline node -> 502)
	req = httptest.NewRequest(http.MethodGet, "/api/v1/rpc/pty", nil)
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405 on GET /api/v1/rpc/pty, got %d", rec.Code)
	}

	ptyBody, _ := json.Marshal(map[string]any{
		"node_id": "offline-node",
		"command": "whoami",
	})
	req = httptest.NewRequest(http.MethodPost, "/api/v1/rpc/pty", bytes.NewReader(ptyBody))
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadGateway {
		t.Fatalf("expected 502 on offline node /api/v1/rpc/pty, got %d", rec.Code)
	}

	// 4. /api/v1/pty/stream & /api/v1/nodes/health-targets
	req = httptest.NewRequest(http.MethodGet, "/api/v1/pty/stream?node_id=offline-node&project_id=p1", nil)
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadGateway {
		t.Fatalf("expected 502 on offline node /api/v1/pty/stream, got %d", rec.Code)
	}

	htBody, _ := json.Marshal(map[string]any{"node_id": "offline-node", "targets": []any{}})
	req = httptest.NewRequest(http.MethodPost, "/api/v1/nodes/health-targets", bytes.NewReader(htBody))
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadGateway {
		t.Fatalf("expected 502 on offline node /api/v1/nodes/health-targets, got %d", rec.Code)
	}
}

func TestInstallerBinaryDownloadAndCORSPanicRecovery(t *testing.T) {
	handler, _, nodeHub, tmpDir := setupTestGateway(t)

	// 1. /install.sh with X-Forwarded-Proto: https
	req := httptest.NewRequest(http.MethodGet, "/install.sh", nil)
	req.Header.Set("X-Forwarded-Proto", "https")
	req.Host = "synapse.example.org"
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 on /install.sh, got %d", rec.Code)
	}
	script := rec.Body.String()
	for _, needle := range []string{"https://synapse.example.org", "download_url()", "sha256=1", "/etc/init.d/axon", "systemctl enable"} {
		if !strings.Contains(script, needle) {
			t.Fatalf("expected /install.sh to contain %q", needle)
		}
	}

	// 2. /dl/axon-linux-amd64 with temporary binary via SYNAPSE_AXON_BINARY_PATH
	fakeBin := filepath.Join(tmpDir, "fake-axon-bin")
	if err := os.WriteFile(fakeBin, []byte("FAKE_AXON_ELF_BINARY"), 0o755); err != nil {
		t.Fatalf("write fake binary: %v", err)
	}
	t.Setenv("SYNAPSE_AXON_BINARY_PATH", fakeBin)

	req = httptest.NewRequest(http.MethodGet, "/dl/axon-linux-amd64?sha256=1", nil)
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK || rec.Header().Get("X-Synapse-SHA256") == "" {
		t.Fatalf("expected 200 and X-Synapse-SHA256 header on ?sha256=1, got %d", rec.Code)
	}

	req = httptest.NewRequest(http.MethodGet, "/dl/axon-linux-amd64", nil)
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK || rec.Body.String() != "FAKE_AXON_ELF_BINARY" {
		t.Fatalf("expected binary payload on /dl/axon-linux-amd64, got %d", rec.Code)
	}

	// 3. OPTIONS preflight & Panic Recovery in corsMiddleware
	req = httptest.NewRequest(http.MethodOptions, "/healthz", nil)
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("expected 204 on OPTIONS preflight, got %d", rec.Code)
	}

	panicHandler := corsMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		panic("simulated handler panic")
	}))
	req = httptest.NewRequest(http.MethodGet, "/boom", nil)
	rec = httptest.NewRecorder()
	panicHandler.ServeHTTP(rec, req)
	if rec.Code != http.StatusInternalServerError || !strings.Contains(rec.Body.String(), "internal gateway panic recovered") {
		t.Fatalf("expected 500 JSON on panic recovery, got %d: %s", rec.Code, rec.Body.String())
	}

	// 4. Verify startSelfHealingMuscleTunnel returns immediately when disabled/unconfigured
	t.Setenv("SYNAPSE_SSH_REVERSE_HOST", "")
	startSelfHealingMuscleTunnel(nodeHub, 8443)
	if getEnv("NON_EXISTENT_SYNAPSE_ENV", "fallback-val") != "fallback-val" {
		t.Fatalf("expected fallback value from getEnv")
	}
}
