package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/SolidStateNetwork/Synapse/agents/axon/internal/tunnel"
	tunnelv1 "github.com/SolidStateNetwork/Synapse/proto"
)

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

	// Create dummy primary cert/key/ca files
	certPath := filepath.Join(tmpDir, "node.crt")
	keyPath := filepath.Join(tmpDir, "node.key")
	caPath := filepath.Join(tmpDir, "ca.crt")
	_ = os.WriteFile(certPath, []byte("CERT_A"), 0o600)
	_ = os.WriteFile(keyPath, []byte("KEY_A"), 0o600)
	_ = os.WriteFile(caPath, []byte("CA_A"), 0o600)

	primaryCfg := &tunnel.IdentityConfig{
		NodeID:        "muscle-01",
		CoreHTTP:      "http://10.10.0.1:8081",
		CoreGateway:   "10.10.0.1:8443",
		Tier:          tunnelv1.Tier2WorkspaceJail,
		WorkspaceRoot: filepath.Join(tmpDir, "workspaces"),
		CertFile:      certPath,
		KeyFile:       keyPath,
		CACertFile:    caPath,
	}
	rawPrimary, _ := json.MarshalIndent(primaryCfg, "", "  ")
	if err := os.WriteFile(filepath.Join(tmpDir, "config.json"), rawPrimary, 0o600); err != nil {
		t.Fatalf("write primary config.json: %v", err)
	}

	// 1. Save named profiles "core-a" and "core-b"
	saveNamedProfile(tmpDir, "core-a", primaryCfg)

	secondaryCfg := &tunnel.IdentityConfig{
		NodeID:        "muscle-01",
		CoreHTTP:      "http://10.10.0.2:9081",
		CoreGateway:   "10.10.0.2:9443",
		Tier:          tunnelv1.Tier1Unleashed,
		WorkspaceRoot: filepath.Join(tmpDir, "workspaces"),
		CertFile:      certPath,
		KeyFile:       keyPath,
		CACertFile:    caPath,
	}
	saveNamedProfile(tmpDir, "core-b", secondaryCfg)

	// 2. Attach saved profile "core-b" via runAddCore (--restart=false)
	runAddCore([]string{"--config-dir", tmpDir, "--profile", "core-b", "--restart=false"})

	loaded, err := tunnel.LoadIdentity(tmpDir)
	if err != nil {
		t.Fatalf("LoadIdentity after runAddCore: %v", err)
	}
	if !loaded.MultiCore || len(loaded.ActiveCoreTargets()) != 2 {
		t.Fatalf("expected 2 active core targets after runAddCore, got %d", len(loaded.ActiveCoreTargets()))
	}

	// 3. List profiles via runProfiles
	runProfiles([]string{"--config-dir", tmpDir})

	// 4. Switch primary core to saved profile "core-b" via runSwitchCore (--restart=false)
	runSwitchCore([]string{"--config-dir", tmpDir, "--profile", "core-b", "--restart=false"})
	switched, err := tunnel.LoadIdentity(tmpDir)
	if err != nil {
		t.Fatalf("LoadIdentity after runSwitchCore: %v", err)
	}
	if switched.CoreGateway != "10.10.0.2:9443" {
		t.Fatalf("expected primary CoreGateway to switch to 10.10.0.2:9443, got %s", switched.CoreGateway)
	}

	// 5. Detach secondary core via runRemoveCore (--restart=false)
	if len(switched.Cores) > 0 {
		targetToRemove := switched.Cores[0].Name
		runRemoveCore([]string{"--config-dir", tmpDir, "--profile", targetToRemove, "--restart=false"})
	}

	// 6. Verify runStatus and printUsage execute cleanly
	runStatus([]string{"--config-dir", tmpDir})
	printUsage()
}
