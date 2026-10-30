package main

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"os"
	"path/filepath"
	"testing"
	"time"

	tunnelv1 "github.com/SolidStateNetwork/Synapse/proto"
	"github.com/hashicorp/yamux"
)

func TestInitGatewayRuntimeDebugAndSelfHealingTunnelLoop(t *testing.T) {
	tmpDir := t.TempDir()
	t.Setenv("SYNAPSE_DATA_DIR", tmpDir)
	t.Setenv("SYNAPSE_DEBUG", "1")
	t.Setenv("SYNAPSE_TUNNEL_PORT", "9443")

	authority, nodeHub, _, _, _, tunnelPort, err := initGatewayRuntime(true)
	if err != nil {
		t.Fatalf("initGatewayRuntime(true) failed: %v", err)
	}
	if tunnelPort != 9443 || !nodeHub.IsDebugEnabled() {
		t.Fatalf("expected tunnelPort=9443 and debugEnabled=true, got %d / %v", tunnelPort, nodeHub.IsDebugEnabled())
	}

	// Create mock ssh executable and dummy ssh key
	mockSSH := filepath.Join(tmpDir, "ssh")
	if err := os.WriteFile(mockSSH, []byte("#!/bin/sh\nsleep 0.02\nexit 0\n"), 0o755); err != nil {
		t.Fatalf("write mock ssh: %v", err)
	}
	dummyKey := filepath.Join(tmpDir, "id_ed25519")
	if err := os.WriteFile(dummyKey, []byte("DUMMY_SSH_KEY"), 0o600); err != nil {
		t.Fatalf("write dummy ssh key: %v", err)
	}

	t.Setenv("PATH", tmpDir+string(os.PathListSeparator)+os.Getenv("PATH"))
	t.Setenv("SYNAPSE_AUTO_SSH_TUNNEL", "1")
	t.Setenv("SYNAPSE_SSH_REVERSE_HOST", "tunnel-test@127.0.0.1")
	t.Setenv("SYNAPSE_SSH_KEY_PATH", dummyKey)

	// 1. Run 2 cycles with large tickUnit (1ms) so cycle 2 hits the cooldown guard, then 2 cycles with 1ns so cycle 2 kills and respawns activeCmd
	runSelfHealingMuscleTunnelLoop(nodeHub, 9443, 2, time.Millisecond)
	runSelfHealingMuscleTunnelLoop(nodeHub, 9443, 2, time.Nanosecond)

	// 2. Connect a live mTLS node so hasOnline=true branch is exercised
	tlsLis, err := tls.Listen("tcp", "127.0.0.1:0", authority.ServerTLSConfig())
	if err != nil {
		t.Fatal(err)
	}
	defer tlsLis.Close()
	go func() {
		_ = nodeHub.ServeMTLS(tlsLis)
	}()

	tok := authority.CreateJoinToken("proj-tun", tunnelv1.Tier1Unleashed, time.Minute)
	priv, _ := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	csrDER, _ := x509.CreateCertificateRequest(rand.Reader, &x509.CertificateRequest{
		Subject: pkix.Name{CommonName: "tun-online-node"},
	}, priv)
	csrPEM := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE REQUEST", Bytes: csrDER})
	certPEM, _, _, err := authority.SignNodeCSR(tunnelv1.CSRBootstrapRequest{
		JoinToken: tok.Token,
		NodeID:    "tun-online-node",
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
		t.Fatal(err)
	}
	defer cliConn.Close()
	ymSrv, err := yamux.Server(cliConn, yamux.DefaultConfig())
	if err != nil {
		t.Fatal(err)
	}
	defer ymSrv.Close()

	for i := 0; i < 30 && len(nodeHub.ListNodes()) == 0; i++ {
		time.Sleep(5 * time.Millisecond)
	}

	runSelfHealingMuscleTunnelLoop(nodeHub, 9443, 1, time.Microsecond)

	// 3. Verify panic recovery when nodeHub is nil
	runSelfHealingMuscleTunnelLoop(nil, 9443, 1, time.Nanosecond)
}
