package pki

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"testing"
	"time"

	tunnelv1 "github.com/SolidStateNetwork/Synapse/proto"
)

func TestCSRBootstrapFlow(t *testing.T) {
	auth, err := NewAuthority(t.TempDir())
	if err != nil {
		t.Fatalf("NewAuthority failed: %v", err)
	}

	tokEntry := auth.CreateJoinToken("proj-demo", tunnelv1.Tier2WorkspaceJail, 10*time.Minute)

	priv, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	csrDER, err := x509.CreateCertificateRequest(rand.Reader, &x509.CertificateRequest{
		Subject: pkix.Name{CommonName: "node-alpha"},
	}, priv)
	if err != nil {
		t.Fatal(err)
	}
	csrPEM := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE REQUEST", Bytes: csrDER})

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
	}); err == nil {
		t.Fatalf("expected replay of one-time join token to be rejected")
	}
}
