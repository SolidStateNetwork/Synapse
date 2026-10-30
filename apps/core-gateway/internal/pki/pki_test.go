package pki

import (
	"bytes"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	tunnelv1 "github.com/SolidStateNetwork/Synapse/proto"
)

func createValidCSRPEM(t *testing.T, cn string) ([]byte, []byte) {
	t.Helper()
	priv, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	csrDER, err := x509.CreateCertificateRequest(rand.Reader, &x509.CertificateRequest{
		Subject:  pkix.Name{CommonName: cn},
		DNSNames: []string{cn, "localhost"},
	}, priv)
	if err != nil {
		t.Fatal(err)
	}
	csrPEM := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE REQUEST", Bytes: csrDER})
	return csrPEM, csrDER
}

func TestCSRBootstrapFlow(t *testing.T) {
	dataDir := t.TempDir()
	auth, err := NewAuthority(dataDir)
	if err != nil {
		t.Fatalf("NewAuthority failed: %v", err)
	}

	tokEntry := auth.CreateJoinToken("proj-demo", tunnelv1.Tier2WorkspaceJail, 10*time.Minute)
	csrPEM, _ := createValidCSRPEM(t, "node-alpha")

	certPEM, tier, projID, err := auth.SignNodeCSR(tunnelv1.CSRBootstrapRequest{
		JoinToken: tokEntry.Token,
		NodeID:    "node-alpha",
		Hostname:  "alpha-host",
		CSRPerm:   csrPEM,
	})
	if err != nil {
		t.Fatalf("SignNodeCSR failed: %v", err)
	}
	if len(certPEM) == 0 {
		t.Fatalf("expected non-empty signed client certificate")
	}
	if tier != tunnelv1.Tier2WorkspaceJail {
		t.Fatalf("expected Tier2WorkspaceJail, got %s", tier)
	}
	if projID != "proj-demo" {
		t.Fatalf("expected proj-demo, got %s", projID)
	}

	// Reusing the same one-time join token must fail
	if _, _, _, err := auth.SignNodeCSR(tunnelv1.CSRBootstrapRequest{
		JoinToken: tokEntry.Token,
		NodeID:    "node-replay",
		CSRPerm:   csrPEM,
	}); err == nil || !strings.Contains(err.Error(), "already been consumed") {
		t.Fatalf("expected replay of one-time join token to be rejected, got %v", err)
	}
}

func TestPKIAuthority_PersistenceReloadAndServerTLSConfig(t *testing.T) {
	dataDir := t.TempDir()
	auth1, err := NewAuthority(dataDir)
	if err != nil {
		t.Fatalf("first NewAuthority failed: %v", err)
	}

	// Reloading Authority from existing dataDir must preserve the Root CA
	auth2, err := NewAuthority(dataDir)
	if err != nil {
		t.Fatalf("reloaded NewAuthority failed: %v", err)
	}
	if !bytes.Equal(auth1.CACertPEM, auth2.CACertPEM) {
		t.Fatalf("expected Root CA PEM to persist across NewAuthority restarts")
	}

	tlsCfg := auth2.ServerTLSConfig()
	if tlsCfg == nil {
		t.Fatalf("expected non-nil ServerTLSConfig")
	}
	if tlsCfg.MinVersion != tls.VersionTLS13 {
		t.Fatalf("expected TLS 1.3 minimum version, got %x", tlsCfg.MinVersion)
	}
	if tlsCfg.ClientAuth != tls.RequireAndVerifyClientCert {
		t.Fatalf("expected RequireAndVerifyClientCert")
	}
	if len(tlsCfg.Certificates) != 1 || tlsCfg.ClientCAs == nil {
		t.Fatalf("expected server certificate and ClientCAs pool")
	}

	// Invalid dataDir where a file blocks directory creation must fail cleanly
	blockerFile := filepath.Join(t.TempDir(), "file-blocker")
	if err := os.WriteFile(blockerFile, []byte("x"), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := NewAuthority(blockerFile); err == nil {
		t.Fatalf("expected NewAuthority to fail when dataDir is a regular file")
	}
}

func TestPKIAuthority_EdgeCases_ExpiredTokenAndInvalidCSRs(t *testing.T) {
	auth, err := NewAuthority(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}

	// 1. Default TTL and Default Tier in CreateJoinToken + ListTokens verification
	defaultTok := auth.CreateJoinToken("proj-defaults", "", 0)
	if defaultTok.Tier != tunnelv1.Tier2WorkspaceJail {
		t.Fatalf("expected default Tier2WorkspaceJail, got %s", defaultTok.Tier)
	}
	if time.Until(defaultTok.ExpiresAt) < 25*time.Minute {
		t.Fatalf("expected default 30m TTL, got %v", time.Until(defaultTok.ExpiresAt))
	}
	if len(auth.ListTokens()) != 1 {
		t.Fatalf("expected ListTokens length 1, got %d", len(auth.ListTokens()))
	}

	csrPEM, csrDER := createValidCSRPEM(t, "node-edge")

	// 2. Unknown token
	if _, _, _, err := auth.SignNodeCSR(tunnelv1.CSRBootstrapRequest{
		JoinToken: "syn_join_nonexistent",
		NodeID:    "node-edge",
		CSRPerm:   csrPEM,
	}); err == nil || !strings.Contains(err.Error(), "invalid or unknown join token") {
		t.Fatalf("expected unknown join token error, got %v", err)
	}

	// 3. Expired token
	expTok := auth.CreateJoinToken("proj-exp", tunnelv1.Tier3Supervised, time.Minute)
	expTok.ExpiresAt = time.Now().Add(-time.Second)
	if _, _, _, err := auth.SignNodeCSR(tunnelv1.CSRBootstrapRequest{
		JoinToken: expTok.Token,
		NodeID:    "node-exp",
		CSRPerm:   csrPEM,
	}); err == nil || !strings.Contains(err.Error(), "expired") {
		t.Fatalf("expected expired token error, got %v", err)
	}

	// 4. Invalid PEM block
	tokBadPEM := auth.CreateJoinToken("proj-bad", tunnelv1.Tier2WorkspaceJail, time.Minute)
	if _, _, _, err := auth.SignNodeCSR(tunnelv1.CSRBootstrapRequest{
		JoinToken: tokBadPEM.Token,
		NodeID:    "node-bad-pem",
		CSRPerm:   []byte("not a valid PEM block"),
	}); err == nil || !strings.Contains(err.Error(), "invalid CSR PEM") {
		t.Fatalf("expected invalid CSR PEM error, got %v", err)
	}

	// 5. Corrupted DER inside PEM block
	tokBadDER := auth.CreateJoinToken("proj-bad-der", tunnelv1.Tier2WorkspaceJail, time.Minute)
	corruptPEM := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE REQUEST", Bytes: []byte("corrupted-der-bytes")})
	if _, _, _, err := auth.SignNodeCSR(tunnelv1.CSRBootstrapRequest{
		JoinToken: tokBadDER.Token,
		NodeID:    "node-bad-der",
		CSRPerm:   corruptPEM,
	}); err == nil || !strings.Contains(err.Error(), "parse CSR") {
		t.Fatalf("expected parse CSR error, got %v", err)
	}

	// 6. Tampered CSR signature
	tokTampered := auth.CreateJoinToken("proj-tampered", tunnelv1.Tier2WorkspaceJail, time.Minute)
	tamperedDER := append([]byte(nil), csrDER...)
	tamperedDER[len(tamperedDER)-2] ^= 0xFF
	tamperedPEM := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE REQUEST", Bytes: tamperedDER})
	if _, _, _, err := auth.SignNodeCSR(tunnelv1.CSRBootstrapRequest{
		JoinToken: tokTampered.Token,
		NodeID:    "node-tampered",
		CSRPerm:   tamperedPEM,
	}); err == nil {
		t.Fatalf("expected tampered CSR signature to fail verification")
	}

	// 7. Request tier override
	tokOverride := auth.CreateJoinToken("proj-override", tunnelv1.Tier2WorkspaceJail, time.Minute)
	_, assignedTier, _, err := auth.SignNodeCSR(tunnelv1.CSRBootstrapRequest{
		JoinToken: tokOverride.Token,
		NodeID:    "node-override",
		Tier:      tunnelv1.Tier1Unleashed,
		CSRPerm:   csrPEM,
	})
	if err != nil || assignedTier != tunnelv1.Tier1Unleashed {
		t.Fatalf("expected Tier1Unleashed override, got tier=%s err=%v", assignedTier, err)
	}
}
