package hub

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/json"
	"encoding/pem"
	"net"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/SolidStateNetwork/Synapse/apps/core-gateway/internal/pki"
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

func TestHubServeMTLSLiveSessionReplacementAndVaultTargetSync(t *testing.T) {
	vaultDir := t.TempDir()
	h := NewHub(vaultDir)
	h.SetDebugEnabled(true)

	// Offline error paths for OpenStream, ExecFs, ExecPty, PushHealthTargets
	if _, _, err := h.OpenStream("missing", tunnelv1.StreamHeader{}); err == nil {
		t.Fatal("expected OpenStream error for missing node")
	}
	if _, err := h.ExecFs("missing", tunnelv1.FsRequest{}); err == nil {
		t.Fatal("expected ExecFs error for missing node")
	}
	if _, err := h.ExecPty("missing", tunnelv1.PtyExecRequest{}); err == nil {
		t.Fatal("expected ExecPty error for missing node")
	}
	if err := h.PushHealthTargets("missing", nil); err == nil {
		t.Fatal("expected PushHealthTargets error for missing node")
	}

	// Non-TLS connection passed to handleConnection must close cleanly
	c1, c2 := net.Pipe()
	_ = c1.Close()
	h.handleConnection(c2)

	// Pre-populate project vault State.json with registered_services and dismissed_services
	projDir := filepath.Join(vaultDir, "proj-mtls")
	_ = os.MkdirAll(projDir, 0o755)
	initialState := map[string]any{
		"project_id":         "proj-mtls",
		"assigned_nodes":     []any{},
		"dismissed_services": []string{"svc-dismissed"},
		"registered_services": []map[string]any{
			{
				"service_id": "svc-existing",
				"name":       "Existing Web Portal",
				"node_id":    "mtls-node-1",
				"port":       8080,
				"protocol":   "http",
				"path":       "/health",
				"health_check": map[string]any{
					"type":   "HTTP",
					"target": "http://127.0.0.1:8080/health",
					"status": "HEALTHY",
				},
			},
			{
				"service_id": "svc-dismissed",
				"name":       "Dismissed Service",
				"node_id":    "mtls-node-1",
				"port":       9999,
			},
		},
	}
	rawState, _ := json.MarshalIndent(initialState, "", "  ")
	_ = os.WriteFile(filepath.Join(projDir, "State.json"), rawState, 0o644)

	auth, err := pki.NewAuthority(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	tlsLis, err := tls.Listen("tcp", "127.0.0.1:0", auth.ServerTLSConfig())
	if err != nil {
		t.Fatal(err)
	}
	defer tlsLis.Close()
	go func() {
		_ = h.ServeMTLS(tlsLis)
	}()

	dialNode := func() (*yamux.Session, net.Conn) {
		tok := auth.CreateJoinToken("proj-mtls", tunnelv1.Tier1Unleashed, time.Minute)
		priv, _ := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
		csrDER, _ := x509.CreateCertificateRequest(rand.Reader, &x509.CertificateRequest{
			Subject: pkix.Name{CommonName: "mtls-node-1"},
		}, priv)
		csrPEM := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE REQUEST", Bytes: csrDER})
		certPEM, _, _, err := auth.SignNodeCSR(tunnelv1.CSRBootstrapRequest{
			JoinToken: tok.Token,
			NodeID:    "mtls-node-1",
			CSRPerm:   csrPEM,
		})
		if err != nil {
			t.Fatal(err)
		}
		keyDER, _ := x509.MarshalECPrivateKey(priv)
		keyPEM := pem.EncodeToMemory(&pem.Block{Type: "EC PRIVATE KEY", Bytes: keyDER})
		cliCert, _ := tls.X509KeyPair(certPEM, keyPEM)
		pool := x509.NewCertPool()
		pool.AppendCertsFromPEM(auth.CACertPEM)

		conn, err := tls.Dial("tcp", tlsLis.Addr().String(), &tls.Config{
			Certificates: []tls.Certificate{cliCert},
			RootCAs:      pool,
			MinVersion:   tls.VersionTLS13,
			ServerName:   "synapse-core-gateway",
		})
		if err != nil {
			t.Fatal(err)
		}
		sess, err := yamux.Server(conn, yamux.DefaultConfig())
		if err != nil {
			t.Fatal(err)
		}
		return sess, conn
	}

	// First connection + replacement by second connection
	sess1, conn1 := dialNode()
	defer conn1.Close()
	defer sess1.Close()
	time.Sleep(20 * time.Millisecond)

	sess2, conn2 := dialNode()
	defer conn2.Close()
	defer sess2.Close()

	// Open non-telemetry stream first (ignored cleanly by handleNodeInitiatedStream)
	nonTel, _ := sess2.OpenStream()
	_ = tunnelv1.WriteFrame(nonTel, tunnelv1.StreamHeader{StreamType: tunnelv1.StreamTypeRpcFs})
	_ = nonTel.Close()

	// Open telemetry stream and receive synced health targets from State.json
	telStream, err := sess2.OpenStream()
	if err != nil {
		t.Fatal(err)
	}
	_ = tunnelv1.WriteFrame(telStream, tunnelv1.StreamHeader{StreamType: tunnelv1.StreamTypeTelemetry})

	targetCh := make(chan []tunnelv1.ServiceHealthTarget, 1)
	go func() {
		var targets []tunnelv1.ServiceHealthTarget
		if err := tunnelv1.ReadFrame(telStream, &targets); err == nil {
			targetCh <- targets
		}
	}()

	// Send 62 heartbeats to exercise 60-sample rolling history & category inference (database/webui/existing)
	for i := 0; i < 62; i++ {
		_ = tunnelv1.WriteFrame(telStream, tunnelv1.NodeHeartbeat{
			NodeID:        "mtls-node-1",
			Hostname:      "node-host",
			OSArch:        "linux/amd64",
			CPUPercent:    float64(i),
			TimestampUnix: time.Now().Unix(),
			Services: []tunnelv1.ServiceHealthStatus{
				{ServiceID: "svc-existing", Name: "Existing Web Portal", Port: 8080, Healthy: false, LatencyMs: 5, ProcessName: "nginx", ContainerName: "web-1", AutoDiscovered: true},
				{ServiceID: "svc-postgres-db", Name: "Postgres DB", Port: 5432, Healthy: true, LatencyMs: 1},
				{ServiceID: "svc-dashboard-ui", Name: "Admin UI", Port: 3001, Healthy: true, LatencyMs: 2},
				{ServiceID: "svc-dismissed", Name: "Dismissed", Port: 9999, Healthy: true},
			},
		})
	}

	select {
	case synced := <-targetCh:
		if len(synced) != 1 || synced[0].ServiceID != "svc-existing" {
			t.Fatalf("expected 1 non-dismissed synced target (svc-existing), got %+v", synced)
		}
	case <-time.After(3 * time.Second):
		t.Fatal("timed out waiting for syncHealthTargetsFromVaultsToNode")
	}
	_ = telStream.Close()
}
