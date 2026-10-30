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

	if resolved := h.ResolveDefaultProjectID(); resolved != projectID {
		t.Fatalf("expected ResolveDefaultProjectID=%q, got %q", projectID, resolved)
	}

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

	// Verify .bak self-healing in readStateJsonWithBackup
	if err := os.WriteFile(statePath, []byte("{corrupted-json"), 0o644); err != nil {
		t.Fatalf("corrupt State.json: %v", err)
	}
	recovered := readStateJsonWithBackup(statePath)
	if recovered == nil || recovered["project_id"] != projectID {
		t.Fatalf("expected State.json to self-heal from .bak, got %v", recovered)
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
					{
						ServiceID:      "auto-svc-4050",
						Name:           "Duplicate Auto Service",
						Port:           4050,
						Healthy:        true,
						AutoDiscovered: true,
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
		t.Fatalf("expected 1 deduplicated service in State.json, got %d", len(services))
	}
}

func TestHubYamuxRPCStreamsAndTelemetryStream(t *testing.T) {
	tmpDir := t.TempDir()
	h := NewHub(tmpDir)
	h.SetDebugEnabled(true)
	if !h.IsDebugEnabled() {
		t.Fatalf("expected debug mode to be enabled")
	}

	h.EnsureNodeAssignedToProject("proj-rpc", "node-a", tunnelv1.Tier1Unleashed)

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

	// Mock Axon Muscle responder on ymServer
	go func() {
		for {
			stream, err := ymServer.AcceptStream()
			if err != nil {
				return
			}
			go func(s net.Conn) {
				defer s.Close()
				var hdr tunnelv1.StreamHeader
				if err := tunnelv1.ReadFrame(s, &hdr); err != nil {
					return
				}
				switch hdr.StreamType {
				case tunnelv1.StreamTypeRpcFs:
					var req tunnelv1.FsRequest
					if err := tunnelv1.ReadFrame(s, &req); err == nil {
						_ = tunnelv1.WriteFrame(s, tunnelv1.FsResponse{
							RequestID: req.RequestID,
							Success:   true,
							Content:   []byte("mock-file-content"),
						})
					}
				case tunnelv1.StreamTypePty:
					var req tunnelv1.PtyExecRequest
					if err := tunnelv1.ReadFrame(s, &req); err == nil {
						_ = tunnelv1.WriteFrame(s, tunnelv1.PtyExecResponse{
							CmdID:     req.CmdID,
							SessionID: req.SessionID,
							Output:    "mock-pty-ok",
							ExitCode:  0,
							Cwd:       "/opt/axon/workspaces/proj-rpc",
						})
					}
				}
			}(stream)
		}
	}()

	telClient, telServer := net.Pipe()
	defer telClient.Close()
	defer telServer.Close()

	cNode := &ConnectedNode{
		NodeID:        "node-a",
		Tier:          tunnelv1.Tier1Unleashed,
		RemoteAddr:    "127.0.0.1:50000",
		ConnectedAt:   time.Now().UTC(),
		session:       ymSession,
		telemetryConn: telServer,
	}

	h.mu.Lock()
	h.nodes["node-a"] = cNode
	h.mu.Unlock()

	// 1. Test ExecFs over Yamux
	fsResp, err := h.ExecFs("node-a", tunnelv1.FsRequest{
		RequestID: "req-1",
		ProjectID: "proj-rpc",
		Operation: tunnelv1.FsOpReadFile,
		Path:      "test.txt",
	})
	if err != nil || !fsResp.Success || string(fsResp.Content) != "mock-file-content" {
		t.Fatalf("ExecFs failed: err=%v resp=%+v", err, fsResp)
	}

	// 2. Test ExecPty over Yamux
	ptyResp, err := h.ExecPty("node-a", tunnelv1.PtyExecRequest{
		CmdID:     "cmd-1",
		SessionID: "default",
		ProjectID: "proj-rpc",
		Command:   "echo ok",
	})
	if err != nil || ptyResp.ExitCode != 0 || ptyResp.Output != "mock-pty-ok" {
		t.Fatalf("ExecPty failed: err=%v resp=%+v", err, ptyResp)
	}

	// 3. Test PushHealthTargets over telemetry stream
	go func() {
		var pushed []tunnelv1.ServiceHealthTarget
		_ = tunnelv1.ReadFrame(telClient, &pushed)
	}()
	if err := h.PushHealthTargets("node-a", []tunnelv1.ServiceHealthTarget{
		{ServiceID: "svc-1", Name: "Web", Port: 3000, Protocol: "http"},
	}); err != nil {
		t.Fatalf("PushHealthTargets failed: %v", err)
	}

	// 4. Test handleNodeInitiatedStream telemetry heartbeat loop
	beatClient, beatServer := net.Pipe()
	go h.handleNodeInitiatedStream(cNode, beatServer)
	_ = tunnelv1.WriteFrame(beatClient, tunnelv1.StreamHeader{StreamType: tunnelv1.StreamTypeTelemetry})
	_ = tunnelv1.WriteFrame(beatClient, tunnelv1.NodeHeartbeat{
		NodeID:        "node-a",
		Hostname:      "host-a",
		CPUPercent:    22.0,
		RAMPercent:    45.0,
		TimestampUnix: time.Now().Unix(),
		Services:      []tunnelv1.ServiceHealthStatus{{ServiceID: "svc-1", Port: 3000, Healthy: true, LatencyMs: 4}},
	})
	_ = beatClient.Close()
	time.Sleep(30 * time.Millisecond)

	nodes := h.ListNodes()
	if len(nodes) != 1 || !nodes[0].Online || nodes[0].LastHeartbeat == nil {
		t.Fatalf("unexpected ListNodes result: %+v", nodes)
	}

	h.ClearDebugEvents()
	if len(h.GetDebugEvents()) != 0 {
		t.Fatalf("expected debug events to be cleared")
	}
}
