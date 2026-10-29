package hub

import (
	"encoding/json"
	"net"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	tunnelv1 "github.com/SolidStateNetwork/Synapse/proto"
	"github.com/hashicorp/yamux"
)

func TestHubVaultAssignmentAndTelemetrySync(t *testing.T) {
	tmpDir := t.TempDir()
	h := NewHub(tmpDir)

	projectID := "test-project"
	nodeID := "muscle-node-1"
	h.EnsureNodeAssignedToProject(projectID, nodeID, tunnelv1.Tier1Unleashed)

	statePath := filepath.Join(tmpDir, projectID, "State.json")
	raw, err := os.ReadFile(statePath)
	if err != nil {
		t.Fatalf("expected State.json to be created, got error: %v", err)
	}

	var state map[string]any
	if err := json.Unmarshal(raw, &state); err != nil {
		t.Fatalf("invalid State.json JSON: %v", err)
	}
	assigned, ok := state["assigned_nodes"].([]any)
	if !ok || len(assigned) != 1 {
		t.Fatalf("expected 1 assigned node, got %v", state["assigned_nodes"])
	}

	// Test concurrent telemetry sync without race conditions
	var wg sync.WaitGroup
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func(seq int) {
			defer wg.Done()
			beat := &tunnelv1.NodeHeartbeat{
				NodeID:        nodeID,
				Hostname:      "muscle-host",
				OSArch:        "linux/amd64",
				Tier:          tunnelv1.Tier1Unleashed,
				CPUPercent:    12.5 + float64(seq),
				RAMPercent:    34.0,
				TimestampUnix: time.Now().Unix(),
				Services: []tunnelv1.ServiceHealthStatus{
					{
						ServiceID: "svc-api",
						Name:      "Test API",
						Port:      4050,
						Healthy:   true,
						LatencyMs: 2,
					},
				},
			}
			h.syncTelemetryToProjectVaults(nodeID, beat)
		}(i)
	}
	wg.Wait()

	rawAfter, err := os.ReadFile(statePath)
	if err != nil {
		t.Fatalf("read State.json after telemetry sync: %v", err)
	}
	var stateAfter map[string]any
	if err := json.Unmarshal(rawAfter, &stateAfter); err != nil {
		t.Fatalf("unmarshal State.json after telemetry sync: %v", err)
	}
	services, _ := stateAfter["registered_services"].([]any)
	if len(services) != 1 {
		t.Fatalf("expected 1 auto-synced service in State.json, got %d", len(services))
	}
}

func TestHubYamuxStreamAndDebugRingBuffer(t *testing.T) {
	h := NewHub(t.TempDir())
	h.SetDebugEnabled(true)
	if !h.IsDebugEnabled() {
		t.Fatalf("expected debug mode to be enabled")
	}

	for i := 0; i < 260; i++ {
		h.RecordEvent("test", "node-a", "event", int64(i), nil)
	}
	events := h.GetDebugEvents()
	if len(events) != 250 {
		t.Fatalf("expected ring buffer capped at 250 events, got %d", len(events))
	}

	clientConn, serverConn := net.Pipe()
	defer clientConn.Close()
	defer serverConn.Close()

	ymSession, err := yamux.Client(clientConn, yamux.DefaultConfig())
	if err != nil {
		t.Fatalf("yamux client init: %v", err)
	}
	defer ymSession.Close()

	ymServer, err := yamux.Server(serverConn, yamux.DefaultConfig())
	if err != nil {
		t.Fatalf("yamux server init: %v", err)
	}
	defer ymServer.Close()

	h.mu.Lock()
	h.nodes["node-a"] = &ConnectedNode{
		NodeID:      "node-a",
		Tier:        tunnelv1.Tier1Unleashed,
		RemoteAddr:  "127.0.0.1:50000",
		ConnectedAt: time.Now().UTC(),
		session:     ymSession,
	}
	h.mu.Unlock()

	nodes := h.ListNodes()
	if len(nodes) != 1 || !nodes[0].Online || nodes[0].NodeID != "node-a" {
		t.Fatalf("unexpected ListNodes result: %+v", nodes)
	}

	h.ClearDebugEvents()
	if len(h.GetDebugEvents()) != 0 {
		t.Fatalf("expected debug events to be cleared")
	}
}
