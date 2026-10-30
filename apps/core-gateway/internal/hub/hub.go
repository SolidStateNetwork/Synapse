package hub

import (
	"crypto/tls"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	tunnelv1 "github.com/SolidStateNetwork/Synapse/proto"
	"github.com/hashicorp/yamux"
)

// DebugEvent represents a structured diagnostic trace entry in the Core Gateway ring buffer.
type DebugEvent struct {
	Timestamp  string         `json:"timestamp"`
	Category   string         `json:"category"` // mtls | yamux | rpc_fs | rpc_pty | telemetry | bootstrap | http
	NodeID     string         `json:"node_id,omitempty"`
	Summary    string         `json:"summary"`
	DurationMs int64          `json:"duration_ms,omitempty"`
	Details    map[string]any `json:"details,omitempty"`
}

// ConnectedNode represents an active mTLS + Yamux session from an Axon node.
type ConnectedNode struct {
	NodeID        string                  `json:"node_id"`
	Tier          tunnelv1.AutonomyTier   `json:"tier"`
	RemoteAddr    string                  `json:"remote_addr"`
	ConnectedAt   time.Time               `json:"connected_at"`
	LastHeartbeat *tunnelv1.NodeHeartbeat `json:"last_heartbeat,omitempty"`

	session       *yamux.Session
	telemetryConn net.Conn
	mu            sync.RWMutex
}

// NodeSummary is returned by the Core Gateway HTTP API to core-web.
type NodeSummary struct {
	NodeID        string                  `json:"node_id"`
	Tier          tunnelv1.AutonomyTier   `json:"tier"`
	RemoteAddr    string                  `json:"remote_addr"`
	ConnectedAt   string                  `json:"connected_at"`
	Online        bool                    `json:"online"`
	ActiveStreams int                     `json:"active_streams,omitempty"`
	LastHeartbeat *tunnelv1.NodeHeartbeat `json:"last_heartbeat,omitempty"`
}

// Hub manages all active mTLS Yamux node sessions and synchronizes telemetry into Project Brain Vaults.
type Hub struct {
	VaultRoot     string
	mu            sync.RWMutex
	vaultMu       sync.Mutex
	nodes         map[string]*ConnectedNode
	historyByNode map[string][]tunnelv1.TelemetrySample
	debugEnabled  bool
	debugEvents   []DebugEvent
}

// NewHub creates a Yamux Hub backed by the given VaultRoot (/var/lib/synapse/projects).
func NewHub(vaultRoot string) *Hub {
	dbg := os.Getenv("SYNAPSE_DEBUG") == "1" || strings.EqualFold(os.Getenv("SYNAPSE_DEBUG"), "true")
	return &Hub{
		VaultRoot:     vaultRoot,
		nodes:         make(map[string]*ConnectedNode),
		historyByNode: make(map[string][]tunnelv1.TelemetrySample),
		debugEnabled:  dbg,
		debugEvents:   make([]DebugEvent, 0, 256),
	}
}

// SetDebugEnabled toggles verbose debug logging and trace capture at runtime.
func (h *Hub) SetDebugEnabled(enabled bool) {
	h.mu.Lock()
	h.debugEnabled = enabled
	h.mu.Unlock()
	h.RecordEvent("system", "", fmt.Sprintf("Gateway Debug Mode set to %v", enabled), 0, nil)
}

// IsDebugEnabled returns whether debug mode is active on the Hub.
func (h *Hub) IsDebugEnabled() bool {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return h.debugEnabled
}

// ClearDebugEvents clears the in-memory diagnostic ring buffer.
func (h *Hub) ClearDebugEvents() {
	h.mu.Lock()
	h.debugEvents = h.debugEvents[:0]
	h.mu.Unlock()
}

// RecordEvent appends a structured diagnostic event to the ring buffer (max 250 items) and logs it when DebugMode is on.
func (h *Hub) RecordEvent(category, nodeID, summary string, durationMs int64, details map[string]any) {
	evt := DebugEvent{
		Timestamp:  time.Now().UTC().Format(time.RFC3339Nano),
		Category:   category,
		NodeID:     nodeID,
		Summary:    summary,
		DurationMs: durationMs,
		Details:    details,
	}
	h.mu.Lock()
	dbg := h.debugEnabled
	if len(h.debugEvents) >= 250 {
		h.debugEvents = append(h.debugEvents[1:], evt)
	} else {
		h.debugEvents = append(h.debugEvents, evt)
	}
	h.mu.Unlock()

	if dbg {
		if nodeID != "" {
			log.Printf("[core-gateway:DEBUG] [%s] node=%s %s (%dms)", category, nodeID, summary, durationMs)
		} else {
			log.Printf("[core-gateway:DEBUG] [%s] %s (%dms)", category, summary, durationMs)
		}
	}
}

// GetDebugEvents returns the most recent debug events (newest first).
func (h *Hub) GetDebugEvents() []DebugEvent {
	h.mu.RLock()
	defer h.mu.RUnlock()
	out := make([]DebugEvent, len(h.debugEvents))
	for i := range h.debugEvents {
		out[len(h.debugEvents)-1-i] = h.debugEvents[i]
	}
	return out
}

// ServeMTLS accepts incoming mTLS connections from Axon nodes and multiplexes them via hashicorp/yamux.
func (h *Hub) ServeMTLS(listener net.Listener) error {
	for {
		rawConn, err := listener.Accept()
		if err != nil {
			return err
		}
		go h.handleConnection(rawConn)
	}
}

func (h *Hub) handleConnection(rawConn net.Conn) {
	start := time.Now()
	tlsConn, ok := rawConn.(*tls.Conn)
	if !ok {
		_ = rawConn.Close()
		return
	}
	_ = rawConn.SetDeadline(time.Now().Add(10 * time.Second))
	if err := tlsConn.Handshake(); err != nil {
		log.Printf("[core-gateway] mTLS handshake failed from %s: %v", rawConn.RemoteAddr(), err)
		h.RecordEvent("mtls", "", fmt.Sprintf("mTLS handshake failed from %s: %v", rawConn.RemoteAddr(), err), time.Since(start).Milliseconds(), nil)
		_ = rawConn.Close()
		return
	}
	_ = rawConn.SetDeadline(time.Time{})

	state := tlsConn.ConnectionState()
	if len(state.PeerCertificates) == 0 {
		_ = rawConn.Close()
		return
	}
	clientCert := state.PeerCertificates[0]
	nodeID := clientCert.Subject.CommonName
	tier := tunnelv1.Tier2WorkspaceJail
	if len(clientCert.Subject.OrganizationalUnit) > 0 {
		tier = tunnelv1.AutonomyTier(clientCert.Subject.OrganizationalUnit[0])
	}
	projectID := ""
	if len(clientCert.Subject.Locality) > 0 {
		projectID = clientCert.Subject.Locality[0]
	}
	if projectID == "" {
		projectID = "synapse-cloud-demo"
	}
	h.EnsureNodeAssignedToProject(projectID, nodeID, tier)
	if projectID != "synapse-cloud-demo" {
		h.EnsureNodeAssignedToProject("synapse-cloud-demo", nodeID, tier)
	}

	// Core Gateway acts as the Yamux Client over the reverse connection so it can open streams to Axon,
	// while also accepting the telemetry stream opened by Axon.
	ymCfg := yamux.DefaultConfig()
	ymCfg.EnableKeepAlive = true
	ymCfg.KeepAliveInterval = 10 * time.Second
	ymCfg.ConnectionWriteTimeout = 10 * time.Second

	session, err := yamux.Client(tlsConn, ymCfg)
	if err != nil {
		log.Printf("[core-gateway] yamux client init failed for %s: %v", nodeID, err)
		_ = rawConn.Close()
		return
	}

	node := &ConnectedNode{
		NodeID:      nodeID,
		Tier:        tier,
		RemoteAddr:  rawConn.RemoteAddr().String(),
		ConnectedAt: time.Now().UTC(),
		session:     session,
	}

	h.mu.Lock()
	if prev, exists := h.nodes[nodeID]; exists && prev.session != nil {
		_ = prev.session.Close()
	}
	h.nodes[nodeID] = node
	h.mu.Unlock()

	log.Printf("[core-gateway] Axon node %q connected via mTLS+Yamux from %s (tier=%s)", nodeID, node.RemoteAddr, tier)
	h.RecordEvent("mtls", nodeID, fmt.Sprintf("Connected via mTLS 1.3 + Yamux from %s (tier=%s, cipher=%s)", node.RemoteAddr, tier, tls.CipherSuiteName(state.CipherSuite)), time.Since(start).Milliseconds(), map[string]any{
		"remote_addr": node.RemoteAddr,
		"tier":        tier,
		"project_id":  projectID,
	})

	defer func() {
		_ = session.Close()
		h.mu.Lock()
		if cur, ok := h.nodes[nodeID]; ok && cur == node {
			delete(h.nodes, nodeID)
		}
		h.mu.Unlock()
		log.Printf("[core-gateway] Axon node %q disconnected", nodeID)
		h.RecordEvent("mtls", nodeID, "Axon node session closed / disconnected", 0, nil)
	}()

	// Accept streams initiated by Axon (specifically StreamTypeTelemetry)
	for {
		stream, err := session.AcceptStream()
		if err != nil {
			return
		}
		go h.handleNodeInitiatedStream(node, stream)
	}
}

func (h *Hub) handleNodeInitiatedStream(node *ConnectedNode, stream net.Conn) {
	defer stream.Close()

	_ = stream.SetReadDeadline(time.Now().Add(10 * time.Second))
	var hdr tunnelv1.StreamHeader
	if err := tunnelv1.ReadFrame(stream, &hdr); err != nil {
		return
	}
	_ = stream.SetReadDeadline(time.Time{})

	if hdr.StreamType != tunnelv1.StreamTypeTelemetry {
		return
	}

	node.mu.Lock()
	node.telemetryConn = stream
	node.mu.Unlock()

	h.RecordEvent("telemetry", node.NodeID, "StreamTypeTelemetry opened by Muscle node", 0, nil)
	go h.syncHealthTargetsFromVaultsToNode(node.NodeID)

	for {
		_ = stream.SetReadDeadline(time.Now().Add(20 * time.Second))
		var beat tunnelv1.NodeHeartbeat
		if err := tunnelv1.ReadFrame(stream, &beat); err != nil {
			return
		}
		_ = stream.SetReadDeadline(time.Time{})
		var totalLatency int64
		var latencyCount int64
		for _, svc := range beat.Services {
			if svc.LatencyMs >= 0 {
				totalLatency += svc.LatencyMs
				latencyCount++
			}
		}
		var avgLatency int64
		if latencyCount > 0 {
			avgLatency = totalLatency / latencyCount
		}
		sample := tunnelv1.TelemetrySample{
			TimestampUnix: beat.TimestampUnix,
			CPUPercent:    beat.CPUPercent,
			RAMPercent:    beat.RAMPercent,
			DiskPercent:   beat.DiskPercent,
			AvgLatencyMs:  avgLatency,
		}

		h.mu.Lock()
		hist := h.historyByNode[node.NodeID]
		if len(hist) >= 60 {
			hist = append(hist[1:], sample)
		} else {
			hist = append(hist, sample)
		}
		h.historyByNode[node.NodeID] = hist
		histSnapshot := make([]tunnelv1.TelemetrySample, len(hist))
		copy(histSnapshot, hist)
		h.mu.Unlock()

		node.mu.Lock()
		beatCopy := beat
		beatCopy.TelemetryHistory = histSnapshot
		node.LastHeartbeat = &beatCopy
		node.mu.Unlock()

		if h.IsDebugEnabled() {
			h.RecordEvent("telemetry", node.NodeID, fmt.Sprintf("Heartbeat CPU=%.1f%% RAM=%.1f%% DSK=%.1f%% PTY=%d", beatCopy.CPUPercent, beatCopy.RAMPercent, beatCopy.DiskPercent, len(beatCopy.ActivePtySessions)), 0, nil)
		}

		h.syncTelemetryToProjectVaults(node.NodeID, &beatCopy)
	}
}

// OpenStream opens a multiplexed Yamux stream to the specified node and sends the StreamHeader.
func (h *Hub) OpenStream(nodeID string, hdr tunnelv1.StreamHeader) (net.Conn, *ConnectedNode, error) {
	h.mu.RLock()
	node, ok := h.nodes[nodeID]
	h.mu.RUnlock()
	if !ok || node.session == nil || node.session.IsClosed() {
		return nil, nil, fmt.Errorf("axon node %q is not connected to Core Gateway", nodeID)
	}

	stream, err := node.session.OpenStream()
	if err != nil {
		return nil, nil, fmt.Errorf("open yamux stream to node %q: %w", nodeID, err)
	}

	_ = stream.SetWriteDeadline(time.Now().Add(10 * time.Second))
	if err := tunnelv1.WriteFrame(stream, hdr); err != nil {
		_ = stream.Close()
		return nil, nil, fmt.Errorf("write stream header to node %q: %w", nodeID, err)
	}
	_ = stream.SetWriteDeadline(time.Time{})
	return stream, node, nil
}

// ExecFs dispatches an atomic filesystem operation (StreamTypeRpcFs) to the target node.
func (h *Hub) ExecFs(nodeID string, req tunnelv1.FsRequest) (tunnelv1.FsResponse, error) {
	start := time.Now()
	stream, node, err := h.OpenStream(nodeID, tunnelv1.StreamHeader{
		StreamType: tunnelv1.StreamTypeRpcFs,
		ProjectID:  req.ProjectID,
	})
	if err != nil {
		h.RecordEvent("rpc_fs", nodeID, fmt.Sprintf("FS %s %q failed to open stream: %v", req.Operation, req.Path, err), time.Since(start).Milliseconds(), nil)
		return tunnelv1.FsResponse{}, err
	}
	defer stream.Close()
	_ = stream.SetDeadline(time.Now().Add(30 * time.Second))

	if req.Tier == "" || req.Tier == tunnelv1.AutonomyTierUnspecified {
		req.Tier = node.Tier
	}
	if err := tunnelv1.WriteFrame(stream, req); err != nil {
		return tunnelv1.FsResponse{}, err
	}
	var resp tunnelv1.FsResponse
	if err := tunnelv1.ReadFrame(stream, &resp); err != nil {
		return tunnelv1.FsResponse{}, err
	}
	h.RecordEvent("rpc_fs", nodeID, fmt.Sprintf("FS %s %q -> success=%v", req.Operation, req.Path, resp.Success), time.Since(start).Milliseconds(), map[string]any{
		"operation": req.Operation,
		"path":      req.Path,
		"success":   resp.Success,
		"error":     resp.Error,
	})
	return resp, nil
}

// ExecPty dispatches a persistent stateful PTY command with sentinel framing (StreamTypePty) to the target node.
func (h *Hub) ExecPty(nodeID string, req tunnelv1.PtyExecRequest) (tunnelv1.PtyExecResponse, error) {
	start := time.Now()
	stream, node, err := h.OpenStream(nodeID, tunnelv1.StreamHeader{
		StreamType: tunnelv1.StreamTypePty,
		ProjectID:  req.ProjectID,
		SessionID:  req.SessionID,
	})
	if err != nil {
		h.RecordEvent("rpc_pty", nodeID, fmt.Sprintf("PTY %q failed to open stream: %v", req.Command, err), time.Since(start).Milliseconds(), nil)
		return tunnelv1.PtyExecResponse{}, err
	}
	defer stream.Close()
	_ = stream.SetDeadline(time.Now().Add(10 * time.Minute))

	if req.Tier == "" || req.Tier == tunnelv1.AutonomyTierUnspecified {
		req.Tier = node.Tier
	}
	if err := tunnelv1.WriteFrame(stream, req); err != nil {
		return tunnelv1.PtyExecResponse{}, err
	}
	var resp tunnelv1.PtyExecResponse
	if err := tunnelv1.ReadFrame(stream, &resp); err != nil {
		return tunnelv1.PtyExecResponse{}, err
	}
	h.RecordEvent("rpc_pty", nodeID, fmt.Sprintf("PTY [%s] %q -> exit=%d cwd=%s", req.SessionID, req.Command, resp.ExitCode, resp.Cwd), time.Since(start).Milliseconds(), map[string]any{
		"session_id": req.SessionID,
		"command":    req.Command,
		"exit_code":  resp.ExitCode,
		"cwd":        resp.Cwd,
		"blocked":    resp.BlockedByGuardrail,
	})
	return resp, nil
}

// PushHealthTargets sends updated ServiceHealthTarget definitions to a connected node over its telemetry stream.
func (h *Hub) PushHealthTargets(nodeID string, targets []tunnelv1.ServiceHealthTarget) error {
	h.mu.RLock()
	node, ok := h.nodes[nodeID]
	h.mu.RUnlock()
	if !ok {
		return fmt.Errorf("node %q not connected", nodeID)
	}
	node.mu.Lock()
	defer node.mu.Unlock()
	conn := node.telemetryConn
	if conn == nil {
		return fmt.Errorf("telemetry stream not active for node %q", nodeID)
	}
	h.RecordEvent("telemetry", nodeID, fmt.Sprintf("Pushed %d ServiceHealthTarget(s)", len(targets)), 0, nil)
	_ = conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
	err := tunnelv1.WriteFrame(conn, targets)
	_ = conn.SetWriteDeadline(time.Time{})
	return err
}

// ListNodes returns a snapshot of all currently connected Axon nodes and their latest telemetry.
func (h *Hub) ListNodes() []NodeSummary {
	h.mu.RLock()
	defer h.mu.RUnlock()
	out := make([]NodeSummary, 0, len(h.nodes))
	for _, n := range h.nodes {
		n.mu.RLock()
		hb := n.LastHeartbeat
		n.mu.RUnlock()
		activeStreams := 0
		if n.session != nil && !n.session.IsClosed() {
			activeStreams = n.session.NumStreams()
		}
		out = append(out, NodeSummary{
			NodeID:        n.NodeID,
			Tier:          n.Tier,
			RemoteAddr:    n.RemoteAddr,
			ConnectedAt:   n.ConnectedAt.Format(time.RFC3339),
			Online:        n.session != nil && !n.session.IsClosed(),
			ActiveStreams: activeStreams,
			LastHeartbeat: hb,
		})
	}
	return out
}

// EnsureNodeAssignedToProject automatically binds an enrolled Axon node to its target Project Brain Vault State.json.
func (h *Hub) EnsureNodeAssignedToProject(projectID string, nodeID string, tier tunnelv1.AutonomyTier) {
	if h.VaultRoot == "" || projectID == "" || nodeID == "" {
		return
	}
	h.vaultMu.Lock()
	defer h.vaultMu.Unlock()
	projDir := filepath.Join(h.VaultRoot, projectID)
	_ = os.MkdirAll(projDir, 0o755)
	statePath := filepath.Join(projDir, "State.json")

	var state map[string]any
	if raw, err := os.ReadFile(statePath); err == nil {
		_ = json.Unmarshal(raw, &state)
	}
	if state == nil {
		state = map[string]any{
			"project_id":          projectID,
			"name":                projectID,
			"assigned_nodes":      []any{},
			"active_cartridges":   []string{"docker-first", "zero-trust-networking"},
			"registered_services": []any{},
			"telemetry":           map[string]any{},
			"pending_approvals":   []any{},
			"updated_at":          time.Now().UTC().Format(time.RFC3339),
		}
	}

	assigned, _ := state["assigned_nodes"].([]any)
	found := false
	for _, item := range assigned {
		if m, ok := item.(map[string]any); ok && m["node_id"] == nodeID {
			m["online"] = true
			m["status"] = "ONLINE"
			m["tier"] = string(tier)
			found = true
		}
	}
	if !found {
		assigned = append(assigned, map[string]any{
			"node_id": nodeID,
			"tier":    string(tier),
			"online":  true,
			"status":  "ONLINE",
		})
	}
	state["assigned_nodes"] = assigned
	state["updated_at"] = time.Now().UTC().Format(time.RFC3339)

	if updatedBytes, err := json.MarshalIndent(state, "", "  "); err == nil {
		atomicWriteStateFile(statePath, updatedBytes)
	}
}

func atomicWriteStateFile(statePath string, data []byte) {
	dir := filepath.Dir(statePath)
	tmp, err := os.CreateTemp(dir, ".state-gw-*")
	if err != nil {
		_ = os.WriteFile(statePath, data, 0o644)
		return
	}
	tmpName := tmp.Name()
	_, _ = tmp.Write(data)
	_ = tmp.Close()
	_ = os.Chmod(tmpName, 0o644)
	if err := os.Rename(tmpName, statePath); err != nil {
		_ = os.Remove(tmpName)
	}
}

// syncTelemetryToProjectVaults updates State.json inside any Project Brain Vault that has nodeID assigned.
func (h *Hub) syncTelemetryToProjectVaults(nodeID string, beat *tunnelv1.NodeHeartbeat) {
	if h.VaultRoot == "" {
		return
	}
	h.vaultMu.Lock()
	defer h.vaultMu.Unlock()
	entries, err := os.ReadDir(h.VaultRoot)
	if err != nil {
		return
	}
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		statePath := filepath.Join(h.VaultRoot, entry.Name(), "State.json")
		raw, err := os.ReadFile(statePath)
		if err != nil {
			continue
		}
		var state map[string]any
		if err := json.Unmarshal(raw, &state); err != nil {
			continue
		}

		// Check if nodeID is assigned to this project
		assigned, _ := state["assigned_nodes"].([]any)
		isAssigned := false
		for _, item := range assigned {
			if m, ok := item.(map[string]any); ok && m["node_id"] == nodeID {
				isAssigned = true
				m["online"] = true
				if existingTier, ok := m["tier"].(string); !ok || strings.TrimSpace(existingTier) == "" {
					m["tier"] = string(beat.Tier)
				}
				m["hostname"] = beat.Hostname
				m["os_arch"] = beat.OSArch
				m["last_seen_unix"] = beat.TimestampUnix
			}
		}
		if !isAssigned {
			if entry.Name() == "synapse-cloud-demo" || len(assigned) == 0 {
				tierStr := string(beat.Tier)
				if tierStr == "" {
					tierStr = string(tunnelv1.Tier2WorkspaceJail)
				}
				assigned = append(assigned, map[string]any{
					"node_id":        nodeID,
					"tier":           tierStr,
					"online":         true,
					"status":         "ONLINE",
					"hostname":       beat.Hostname,
					"os_arch":        beat.OSArch,
					"last_seen_unix": beat.TimestampUnix,
				})
				state["assigned_nodes"] = assigned
				state["planning_only"] = false
				isAssigned = true
			} else {
				continue
			}
		}

		telemetryMap, ok := state["telemetry"].(map[string]any)
		if !ok {
			telemetryMap = make(map[string]any)
		}
		telemetryMap[nodeID] = beat
		state["telemetry"] = telemetryMap
		state["active_pty_sessions"] = beat.ActivePtySessions

		// Automatically synchronize services reported by the Muscle node (including services
		// registered by another Core in Multi-Core mode or auto-discovered on the Muscle host)
		// into registered_services so every connected Core displays all running Muscle services.
		if len(beat.Services) > 0 {
			regServices, _ := state["registered_services"].([]any)
			nowISO := time.Now().UTC().Format(time.RFC3339)
			for _, liveSvc := range beat.Services {
				if liveSvc.ServiceID == "" || liveSvc.Port == 0 {
					continue
				}
				foundSvc := false
				for _, item := range regServices {
					m, ok := item.(map[string]any)
					if !ok {
						continue
					}
					if m["node_id"] == nodeID && (m["service_id"] == liveSvc.ServiceID || (strings.HasPrefix(liveSvc.ServiceID, "auto-svc-") && fmt.Sprintf("%v", m["port"]) == fmt.Sprintf("%d", liveSvc.Port))) {
						foundSvc = true
						m["healthy"] = liveSvc.Healthy
						m["latency_ms"] = liveSvc.LatencyMs
						if liveSvc.ProcessName != "" {
							m["process_name"] = liveSvc.ProcessName
						}
						if liveSvc.ContainerName != "" {
							m["container_name"] = liveSvc.ContainerName
						}
						if liveSvc.AutoDiscovered {
							m["auto_discovered"] = true
						}
						if hc, ok := m["health_check"].(map[string]any); ok {
							if liveSvc.Healthy {
								hc["status"] = "HEALTHY"
							} else {
								hc["status"] = "UNHEALTHY"
							}
							hc["last_checked"] = nowISO
							hc["latency_ms"] = liveSvc.LatencyMs
						}
						break
					}
				}
				if !foundSvc {
					lowerMeta := strings.ToLower(liveSvc.ServiceID + " " + liveSvc.Name)
					category := liveSvc.Category
					if category == "" {
						category = "backend"
						switch {
						case strings.Contains(lowerMeta, "db") || strings.Contains(lowerMeta, "sqlite") || strings.Contains(lowerMeta, "postgres") || strings.Contains(lowerMeta, "mysql") || strings.Contains(lowerMeta, "redis") || strings.Contains(lowerMeta, "sql"):
							category = "database"
						case strings.Contains(lowerMeta, "web") || strings.Contains(lowerMeta, "ui") || strings.Contains(lowerMeta, "frontend") || strings.Contains(lowerMeta, "dashboard") || strings.Contains(lowerMeta, "portal"):
							category = "webui"
						}
					}
					statusStr := "UNHEALTHY"
					if liveSvc.Healthy {
						statusStr = "HEALTHY"
					}
					regServices = append(regServices, map[string]any{
						"service_id":           liveSvc.ServiceID,
						"name":                 liveSvc.Name,
						"node_id":              nodeID,
						"port":                 liveSvc.Port,
						"protocol":             "http",
						"path":                 "/",
						"category":             category,
						"healthy":              liveSvc.Healthy,
						"latency_ms":           liveSvc.LatencyMs,
						"auto_discovered":      liveSvc.AutoDiscovered,
						"process_name":         liveSvc.ProcessName,
						"container_name":       liveSvc.ContainerName,
						"consecutive_failures": 0,
						"registered_at":        nowISO,
						"health_check": map[string]any{
							"type":         "HTTP",
							"target":       fmt.Sprintf("http://127.0.0.1:%d/", liveSvc.Port),
							"interval_sec": 15,
							"status":       statusStr,
							"last_checked": nowISO,
							"latency_ms":   liveSvc.LatencyMs,
							"last_error":   liveSvc.LastError,
						},
					})
				}
			}
			// v0.7.0 State Hygiene: Remove auto-svc-<port> duplicates when an explicit service already owns that port on the same node
			customPortOwners := make(map[string]bool)
			for _, item := range regServices {
				if m, ok := item.(map[string]any); ok {
					svcID := fmt.Sprintf("%v", m["service_id"])
					if !strings.HasPrefix(svcID, "auto-svc-") {
						customPortOwners[fmt.Sprintf("%v:%v", m["node_id"], m["port"])] = true
					}
				}
			}
			dedupServices := make([]any, 0, len(regServices))
			for _, item := range regServices {
				if m, ok := item.(map[string]any); ok {
					svcID := fmt.Sprintf("%v", m["service_id"])
					portKey := fmt.Sprintf("%v:%v", m["node_id"], m["port"])
					if strings.HasPrefix(svcID, "auto-svc-") && customPortOwners[portKey] {
						continue
					}
					dedupServices = append(dedupServices, item)
				}
			}
			state["registered_services"] = dedupServices
		}

		state["updated_at"] = time.Now().UTC().Format(time.RFC3339)

		if updatedBytes, err := json.MarshalIndent(state, "", "  "); err == nil {
			atomicWriteStateFile(statePath, updatedBytes)
		}
	}
}

// syncHealthTargetsFromVaultsToNode scans all Project Brain Vaults on connect/reconnect
// and automatically pushes all registered ServiceHealthTargets for nodeID so service probes resume immediately.
func (h *Hub) syncHealthTargetsFromVaultsToNode(nodeID string) {
	if h.VaultRoot == "" || nodeID == "" {
		return
	}
	entries, err := os.ReadDir(h.VaultRoot)
	if err != nil {
		return
	}
	var targets []tunnelv1.ServiceHealthTarget
	seen := make(map[string]bool)

	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		statePath := filepath.Join(h.VaultRoot, entry.Name(), "State.json")
		raw, err := os.ReadFile(statePath)
		if err != nil {
			continue
		}
		var state struct {
			RegisteredServices []struct {
				ServiceID string `json:"service_id"`
				Name      string `json:"name"`
				NodeID    string `json:"node_id"`
				Protocol  string `json:"protocol"`
				Port      uint32 `json:"port"`
				Path      string `json:"path"`
				HealthCheck *struct {
					Type   string `json:"type"`
					Target string `json:"target"`
				} `json:"health_check"`
			} `json:"registered_services"`
		}
		if err := json.Unmarshal(raw, &state); err != nil {
			continue
		}
		for _, svc := range state.RegisteredServices {
			if svc.NodeID != nodeID || svc.Port == 0 {
				continue
			}
			key := fmt.Sprintf("%s:%d", svc.ServiceID, svc.Port)
			if seen[key] {
				continue
			}
			seen[key] = true
			proto := strings.ToLower(svc.Protocol)
			target := ""
			if svc.HealthCheck != nil {
				if svc.HealthCheck.Type != "" {
					proto = strings.ToLower(svc.HealthCheck.Type)
				}
				target = svc.HealthCheck.Target
			}
			if proto == "" {
				proto = "http"
			}
			path := svc.Path
			if path == "" {
				path = "/"
			}
			targets = append(targets, tunnelv1.ServiceHealthTarget{
				ServiceID: svc.ServiceID,
				Name:      svc.Name,
				Protocol:  proto,
				Port:      svc.Port,
				Path:      path,
				Target:    target,
			})
		}
	}

	if len(targets) > 0 {
		_ = h.PushHealthTargets(nodeID, targets)
	}
}
