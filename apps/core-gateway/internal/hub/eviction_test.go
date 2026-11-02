package hub

import (
	"crypto/x509"
	"crypto/x509/pkix"
	"math/big"
	"os"
	"path/filepath"
	"strings"
	"testing"

	tunnelv1 "github.com/SolidStateNetwork/Synapse/proto"
)

func TestEvictNodeAndGetNodeCertSerial(t *testing.T) {
	vaultRoot := t.TempDir()
	h := NewHub(vaultRoot)

	if h.EvictNode("", "") {
		t.Fatal("expected EvictNode with empty nodeID to return false")
	}
	if h.GetNodeCertSerial("unknown-node") != "" {
		t.Fatal("expected empty serial for unknown node")
	}

	h.EnsureNodeAssignedToProject("proj-evict", "node-evict-1", tunnelv1.Tier2WorkspaceJail)
	synDir := filepath.Join(vaultRoot, "proj-evict", ".synapse")
	_ = os.MkdirAll(synDir, 0o755)
	_ = os.WriteFile(filepath.Join(synDir, "State.json"), []byte(`{"nodes":{"node-evict-1":{"online":true}}}`), 0o644)

	h.mu.Lock()
	h.nodes["node-evict-1"] = &ConnectedNode{
		NodeID: "node-evict-1",
		Tier:   tunnelv1.Tier2WorkspaceJail,
		clientCert: &x509.Certificate{
			SerialNumber: big.NewInt(0xABCD1234),
			Subject:      pkix.Name{CommonName: "node-evict-1"},
		},
	}
	h.mu.Unlock()

	if ser := h.GetNodeCertSerial("node-evict-1"); ser != "abcd1234" {
		t.Fatalf("expected serial abcd1234, got %q", ser)
	}

	if !h.EvictNode("node-evict-1", "") {
		t.Fatal("expected EvictNode to return true for active node")
	}
	if len(h.ListNodes()) != 0 {
		t.Fatalf("expected 0 nodes after EvictNode, got %d", len(h.ListNodes()))
	}

	stateBytes, err := os.ReadFile(filepath.Join(vaultRoot, "proj-evict", "State.json"))
	if err != nil || !strings.Contains(string(stateBytes), `"REVOKED"`) {
		t.Fatalf("expected State.json to mark node REVOKED: %s (%v)", string(stateBytes), err)
	}
	synStateBytes, err := os.ReadFile(filepath.Join(synDir, "State.json"))
	if err != nil || !strings.Contains(string(synStateBytes), `"revoked": true`) {
		t.Fatalf("expected .synapse/State.json to mark node revoked: %s (%v)", string(synStateBytes), err)
	}

	// Verify offline OpenStream / ExecFs / ExecPty / PushHealthTargets branches
	if _, _, err := h.OpenStream("node-evict-1", tunnelv1.StreamHeader{}); err == nil {
		t.Fatal("expected OpenStream error for evicted node")
	}
	if _, err := h.ExecFs("node-evict-1", tunnelv1.FsRequest{Operation: tunnelv1.FsOpReadFile, Path: "a.txt"}); err == nil {
		t.Fatal("expected ExecFs error for evicted node")
	}
	if _, err := h.ExecPty("node-evict-1", tunnelv1.PtyExecRequest{Command: "id"}); err == nil {
		t.Fatal("expected ExecPty error for evicted node")
	}
	if err := h.PushHealthTargets("node-evict-1", nil); err == nil {
		t.Fatal("expected PushHealthTargets error for evicted node")
	}

	// Verify ResolveDefaultProjectID env override & .bak fallback
	t.Setenv("SYNAPSE_DEFAULT_PROJECT", "env-proj")
	if got := h.ResolveDefaultProjectID(); got != "env-proj" {
		t.Fatalf("expected env-proj, got %q", got)
	}
	t.Setenv("SYNAPSE_DEFAULT_PROJECT", "")
	bakProjDir := filepath.Join(vaultRoot, "proj-bak")
	_ = os.MkdirAll(bakProjDir, 0o755)
	_ = os.WriteFile(filepath.Join(bakProjDir, "State.json.bak"), []byte(`{"assigned_nodes":[{"node_id":"n1"},{"node_id":"n2"}]}`), 0o644)
	_ = os.WriteFile(filepath.Join(vaultRoot, "not-a-dir"), []byte("x"), 0o644)
	if got := h.ResolveDefaultProjectID(); got != "proj-bak" {
		t.Fatalf("expected proj-bak from .bak score, got %q", got)
	}

	// Verify syncTelemetryToProjectVaults category inference & dismissed services
	_ = os.WriteFile(filepath.Join(bakProjDir, "State.json"), []byte(`{
		"project_id": "proj-bak",
		"assigned_nodes": [],
		"dismissed_services": ["svc-dismissed"],
		"registered_services": [
			{"service_id": "svc-keep", "node_id": "node-auto", "port": 5432, "protocol": "tcp", "health_check": {"type": "TCP", "target": "127.0.0.1:5432"}}
		]
	}`), 0o644)
	h.syncTelemetryToProjectVaults("node-auto", &tunnelv1.NodeHeartbeat{
		NodeID:   "node-auto",
		Hostname: "host-auto",
		Services: []tunnelv1.ServiceHealthStatus{
			{ServiceID: "svc-dismissed", Name: "Dismissed", Port: 9999, Healthy: true},
			{ServiceID: "svc-keep", Name: "Postgres DB", Port: 5432, Healthy: false, LatencyMs: 5, ProcessName: "postgres", ContainerName: "pg"},
			{ServiceID: "auto-svc-5432", Name: "Auto Dup", Port: 5432, Healthy: true},
			{ServiceID: "svc-db-new", Name: "Redis SQL Cache", Port: 6379, Healthy: true},
			{ServiceID: "svc-ui-new", Name: "Frontend WebUI Portal", Port: 3000, Healthy: true},
		},
	})
	h.syncHealthTargetsFromVaultsToNode("node-auto")
}

