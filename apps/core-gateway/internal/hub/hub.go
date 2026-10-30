package hub

import (
	"crypto/tls"
	"fmt"
	"log"
	"net"
	"os"
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
	defer func() {
		if r := recover(); r != nil {
			log.Printf("[core-gateway] recovered panic in mTLS connection handler: %v", r)
			_ = rawConn.Close()
		}
	}()
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
	defaultProj := h.ResolveDefaultProjectID()
	if projectID == "" {
		projectID = defaultProj
	}
	h.EnsureNodeAssignedToProject(projectID, nodeID, tier)
	if defaultProj != "" && projectID != defaultProj {
		h.EnsureNodeAssignedToProject(defaultProj, nodeID, tier)
	}

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
	defer func() {
		if r := recover(); r != nil {
			log.Printf("[core-gateway] recovered panic in node stream handler (%s): %v", node.NodeID, r)
		}
	}()

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
