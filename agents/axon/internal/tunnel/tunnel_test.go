package tunnel

import (
	"os"
	"path/filepath"
	"testing"

	tunnelv1 "github.com/SolidStateNetwork/Synapse/proto"
)

func TestActiveCoreTargets_MultiCoreDeduplication(t *testing.T) {
	cfg := &IdentityConfig{
		NodeID:        "vps2-muscle",
		CoreGateway:   "127.0.0.1:8443",
		CoreHTTP:      "http://127.0.0.1:8081",
		Tier:          tunnelv1.Tier1Unleashed,
		WorkspaceRoot: "/opt/axon/workspaces",
		CertFile:      "/etc/axon/node.crt",
		KeyFile:       "/etc/axon/node.key",
		CACertFile:    "/etc/axon/ca.crt",
		MultiCore:     true,
		Cores: []CoreTarget{
			{
				Name:        "duplicate-primary",
				CoreGateway: "127.0.0.1:8443",
				CoreHTTP:    "http://127.0.0.1:8081",
				Enabled:     true,
			},
			{
				Name:        "local-cachyos-core",
				CoreGateway: "127.0.0.1:9443",
				CoreHTTP:    "http://127.0.0.1:9081",
				CertFile:    "/etc/axon/profiles/local-cachyos-core/node.crt",
				KeyFile:     "/etc/axon/profiles/local-cachyos-core/node.key",
				CACertFile:  "/etc/axon/profiles/local-cachyos-core/ca.crt",
				Enabled:     true,
			},
			{
				Name:        "disabled-core",
				CoreGateway: "10.0.0.99:8443",
				CoreHTTP:    "http://10.0.0.99:8081",
				Enabled:     false,
			},
		},
	}

	targets := cfg.ActiveCoreTargets()
	if len(targets) != 2 {
		t.Fatalf("expected 2 deduplicated active CoreTargets, got %d", len(targets))
	}
	if targets[0].CoreGateway != "127.0.0.1:8443" || targets[0].Name != "primary" {
		t.Fatalf("unexpected primary target: %+v", targets[0])
	}
	if targets[1].CoreGateway != "127.0.0.1:9443" || targets[1].Name != "local-cachyos-core" {
		t.Fatalf("unexpected secondary target: %+v", targets[1])
	}
	if targets[1].NodeID != "vps2-muscle" {
		t.Fatalf("expected secondary target to inherit NodeID 'vps2-muscle', got %q", targets[1].NodeID)
	}
	if targets[1].Tier != tunnelv1.Tier1Unleashed {
		t.Fatalf("expected secondary target to inherit Tier1Unleashed, got %q", targets[1].Tier)
	}
}

func TestLoadIdentity_MultiCorePersistence(t *testing.T) {
	tmpDir := t.TempDir()
	cfgPath := filepath.Join(tmpDir, "config.json")
	raw := `{
  "node_id": "vps2-muscle",
  "core_gateway": "127.0.0.1:8443",
  "core_http": "http://127.0.0.1:8081",
  "tier": "TIER_1_UNLEASHED",
  "workspace_root": "/opt/axon/workspaces",
  "cert_file": "/etc/axon/node.crt",
  "key_file": "/etc/axon/node.key",
  "ca_cert_file": "/etc/axon/ca.crt",
  "multi_core": true,
  "cores": [
    {
      "name": "second-core",
      "node_id": "vps2-muscle",
      "core_gateway": "127.0.0.1:9443",
      "core_http": "http://127.0.0.1:9081",
      "tier": "TIER_1_UNLEASHED",
      "cert_file": "/etc/axon/profiles/second-core/node.crt",
      "key_file": "/etc/axon/profiles/second-core/node.key",
      "ca_cert_file": "/etc/axon/profiles/second-core/ca.crt",
      "enabled": true
    }
  ]
}`
	if err := os.WriteFile(cfgPath, []byte(raw), 0o600); err != nil {
		t.Fatal(err)
	}

	loaded, err := LoadIdentity(tmpDir)
	if err != nil {
		t.Fatalf("LoadIdentity failed: %v", err)
	}
	if !loaded.MultiCore {
		t.Fatalf("expected MultiCore=true")
	}
	targets := loaded.ActiveCoreTargets()
	if len(targets) != 2 {
		t.Fatalf("expected 2 active targets, got %d", len(targets))
	}
}
