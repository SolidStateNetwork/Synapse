package main

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/json"
	"encoding/pem"
	"math/big"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/SolidStateNetwork/Synapse/agents/axon/internal/tunnel"
	tunnelv1 "github.com/SolidStateNetwork/Synapse/proto"
)

func startMockCoreBootstrapServer(t *testing.T) *httptest.Server {
	t.Helper()
	caPriv, _ := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	caTmpl := &x509.Certificate{
		SerialNumber:          big.NewInt(1),
		Subject:               pkix.Name{CommonName: "Synapse CLI Test CA"},
		NotBefore:             time.Now().Add(-time.Hour),
		NotAfter:              time.Now().Add(time.Hour),
		KeyUsage:              x509.KeyUsageCertSign | x509.KeyUsageDigitalSignature,
		BasicConstraintsValid: true,
		IsCA:                  true,
	}
	caDER, _ := x509.CreateCertificate(rand.Reader, caTmpl, caTmpl, &caPriv.PublicKey, caPriv)
	caCert, _ := x509.ParseCertificate(caDER)
	caPEM := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: caDER})

	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/api/v1/bootstrap/csr":
			var req tunnelv1.CSRBootstrapRequest
			_ = json.NewDecoder(r.Body).Decode(&req)
			block, _ := pem.Decode(req.CSRPerm)
			csr, _ := x509.ParseCertificateRequest(block.Bytes)
			cliTmpl := &x509.Certificate{
				SerialNumber: big.NewInt(2),
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
				TunnelPort: 8443,
			})
		case "/healthz":
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"status":"ok"}`))
		case "/api/v1/nodes":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"nodes": []map[string]any{{"node_id": "cli-node-1", "online": true}},
			})
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
}

func TestSanitizeProfileSlug(t *testing.T) {
	cases := map[string]string{
		"http://10.0.0.5:8081":         "10-0-0-5-8081",
		"https://core.example.org:443": "core-example-org-443",
		"":                             "default-core",
		"---":                          "default-core",
		"Prod_Core-01":                 "prod_core-01",
	}
	for input, expected := range cases {
		if got := sanitizeProfileSlug(input); got != expected {
			t.Fatalf("sanitizeProfileSlug(%q) = %q, expected %q", input, got, expected)
		}
	}
}

func TestMultiCoreProfileLifecycleAndCLICommands(t *testing.T) {
	tmpDir := t.TempDir()
	wsDir := t.TempDir()

	// Empty profiles output before configuration exists
	runProfiles([]string{"--config-dir", tmpDir})
	runStatus([]string{"--config-dir", tmpDir})

	bootSrv := startMockCoreBootstrapServer(t)
	defer bootSrv.Close()

	// 1. Test runJoin (primary bootstrap + second primary bootstrap preserving previous profile + --add Multi-Core)
	runJoin([]string{
		"--config-dir", tmpDir,
		"--core", bootSrv.URL,
		"--workspace-root", wsDir,
		"--node-id", "cli-node-1",
		"--tier", "TIER_2_WORKSPACE_JAIL",
		"--profile", "core-a",
		"tok-join-1",
	})

	runJoin([]string{
		"--config-dir", tmpDir,
		"--core", bootSrv.URL,
		"--workspace-root", wsDir,
		"--node-id", "cli-node-1",
		"--gateway", "127.0.0.1:8444",
		"--token", "tok-join-2",
	})

	runJoin([]string{
		"--config-dir", tmpDir,
		"--core", bootSrv.URL,
		"--workspace-root", wsDir,
		"--add",
		"--gateway", "127.0.0.1:9443",
		"tok-join-add",
	})

	// 2. Test runAddCore with live CSR token and positional args, then saved profile with gateway override
	runAddCore([]string{
		"--config-dir", tmpDir,
		"--workspace-root", wsDir,
		"--profile", "core-live-add",
		"--gateway", "127.0.0.1:9444",
		"--restart=false",
		bootSrv.URL,
		"TIER_1_UNLEASHED",
		"tok-add-live",
	})

	runAddCore([]string{
		"--config-dir", tmpDir,
		"--profile", "core-a",
		"--gateway", "127.0.0.1:9445",
		"--restart=false",
	})

	loaded, err := tunnel.LoadIdentity(tmpDir)
	if err != nil {
		t.Fatalf("LoadIdentity after runAddCore: %v", err)
	}
	if !loaded.MultiCore || len(loaded.ActiveCoreTargets()) < 2 {
		t.Fatalf("expected MultiCore active targets >= 2, got %d", len(loaded.ActiveCoreTargets()))
	}

	// 3. List profiles via runProfiles
	runProfiles([]string{"--config-dir", tmpDir})

	// 4. Switch primary core via token rebind, saved profile activation, and --multi alias
	runSwitchCore([]string{
		"--config-dir", tmpDir,
		"--workspace-root", wsDir,
		"--gateway", "127.0.0.1:8445",
		"--restart=false",
		bootSrv.URL,
		"TIER_3_SUPERVISED",
		"tok-switch-1",
	})

	runSwitchCore([]string{
		"--config-dir", tmpDir,
		"--profile", "core-a",
		"--restart=false",
	})

	runSwitchCore([]string{
		"--config-dir", tmpDir,
		"--multi",
		"--profile", "core-a",
		"--restart=false",
	})

	// 5. Detach secondary core via positional arg in runRemoveCore
	switched, err := tunnel.LoadIdentity(tmpDir)
	if err != nil {
		t.Fatalf("LoadIdentity after runSwitchCore: %v", err)
	}
	if len(switched.Cores) > 0 {
		runRemoveCore([]string{"--config-dir", tmpDir, "--restart=false", switched.Cores[0].Name})
	}

	// 6. Verify runDebugDoctor (--enable and --disable) and runStatus
	enableDebugLogging(false)
	runDebugDoctor([]string{"--config-dir", tmpDir, "--enable"})
	runDebugDoctor([]string{"--config-dir", tmpDir, "--disable"})
	runStatus([]string{"--config-dir", tmpDir})
	printUsage()

	// Verify activateSavedProfile error when profile does not exist
	if _, err := activateSavedProfile(tmpDir, "nonexistent-profile"); err == nil {
		t.Fatal("expected error for nonexistent saved profile")
	}
}
