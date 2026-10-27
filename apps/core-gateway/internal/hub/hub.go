package hub

import (
	"crypto/tls"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"os"
	"path/filepath"
	"sync"
	"time"

	tunnelv1 "github.com/SolidStateNetwork/Synapse/proto"
	"github.com/hashicorp/yamux"
)

// ConnectedNode represents an active mTLS + Yamux session from an Axon node.
type ConnectedNode struct {
	NodeID        string                `json:"node_id"`
	Tier          tunnelv1.AutonomyTier `json:"tier"`
	RemoteAddr    string                `json:"remote_addr"`
	ConnectedAt   time.Time             `json:"connected_at"`
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
	LastHeartbeat *tunnelv1.NodeHeartbeat `json:"last_heartbeat,omitempty"`
}

// Hub manages all active mTLS Yamux node sessions and synchronizes telemetry into Project Brain Vaults.
type Hub struct {
	VaultRoot string
	mu        sync.RWMutex
	nodes     map[string]*ConnectedNode
}

// NewHub creates a Yamux Hub backed by the given VaultRoot (/var/lib/synapse/projects).
func NewHub(vaultRoot string) *Hub {
	return &Hub{
		VaultRoot: vaultRoot,
		nodes:     make(map[string]*ConnectedNode),
	}
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
	tlsConn, ok := rawConn.(*tls.Conn)
	if !ok {
		_ = rawConn.Close()
		return
	}
	if err := tlsConn.Handshake(); err != nil {
		log.Printf("[core-gateway] mTLS handshake failed from %s: %v", rawConn.RemoteAddr(), err)
		_ = rawConn.Close()
		return
	}

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
	if projectID != "" {
		h.EnsureNodeAssignedToProject(projectID, nodeID, tier)
	}

	// Core Gateway acts as the Yamux Client over the reverse connection so it can open streams to Axon,
	// while also accepting the telemetry stream opened by Axon.
	ymCfg := yamux.DefaultConfig()
	ymCfg.EnableKeepAlive = true
	ymCfg.KeepAliveInterval = 15 * time.Second

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

	defer func() {
		_ = session.Close()
		h.mu.Lock()
		if cur, ok := h.nodes[nodeID]; ok && cur == node {
			delete(h.nodes, nodeID)
		}
		h.mu.Unlock()
		log.Printf("[core-gateway] Axon node %q disconnected", nodeID)
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

	var hdr tunnelv1.StreamHeader
	if err := tunnelv1.ReadFrame(stream, &hdr); err != nil {
		return
	}

	if hdr.StreamType != tunnelv1.StreamTypeTelemetry {
		return
	}

	node.mu.Lock()
	node.telemetryConn = stream
	node.mu.Unlock()

	for {
		var beat tunnelv1.NodeHeartbeat
		if err := tunnelv1.ReadFrame(stream, &beat); err != nil {
			return
		}
		node.mu.Lock()
		beatCopy := beat
		node.LastHeartbeat = &beatCopy
		node.mu.Unlock()

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

	if err := tunnelv1.WriteFrame(stream, hdr); err != nil {
		_ = stream.Close()
		return nil, nil, fmt.Errorf("write stream header to node %q: %w", nodeID, err)
	}
	return stream, node, nil
}

// ExecFs dispatches an atomic filesystem operation (StreamTypeRpcFs) to the target node.
func (h *Hub) ExecFs(nodeID string, req tunnelv1.FsRequest) (tunnelv1.FsResponse, error) {
	stream, node, err := h.OpenStream(nodeID, tunnelv1.StreamHeader{
		StreamType: tunnelv1.StreamTypeRpcFs,
		ProjectID:  req.ProjectID,
	})
	if err != nil {
		return tunnelv1.FsResponse{}, err
	}
	defer stream.Close()

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
	return resp, nil
}

// ExecPty dispatches a persistent stateful PTY command with sentinel framing (StreamTypePty) to the target node.
func (h *Hub) ExecPty(nodeID string, req tunnelv1.PtyExecRequest) (tunnelv1.PtyExecResponse, error) {
	stream, node, err := h.OpenStream(nodeID, tunnelv1.StreamHeader{
		StreamType: tunnelv1.StreamTypePty,
		ProjectID:  req.ProjectID,
		SessionID:  req.SessionID,
	})
	if err != nil {
		return tunnelv1.PtyExecResponse{}, err
	}
	defer stream.Close()

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
	node.mu.RLock()
	conn := node.telemetryConn
	node.mu.RUnlock()
	if conn == nil {
		return fmt.Errorf("telemetry stream not active for node %q", nodeID)
	}
	return tunnelv1.WriteFrame(conn, targets)
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
		out = append(out, NodeSummary{
			NodeID:        n.NodeID,
			Tier:          n.Tier,
			RemoteAddr:    n.RemoteAddr,
			ConnectedAt:   n.ConnectedAt.Format(time.RFC3339),
			Online:        !n.session.IsClosed(),
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
				m["tier"] = string(beat.Tier)
				m["hostname"] = beat.Hostname
				m["os_arch"] = beat.OSArch
				m["last_seen_unix"] = beat.TimestampUnix
			}
		}
		if !isAssigned {
			continue
		}

		telemetryMap, ok := state["telemetry"].(map[string]any)
		if !ok {
			telemetryMap = make(map[string]any)
		}
		telemetryMap[nodeID] = beat
		state["telemetry"] = telemetryMap
		state["active_pty_sessions"] = beat.ActivePtySessions
		state["updated_at"] = time.Now().UTC().Format(time.RFC3339)

		if updatedBytes, err := json.MarshalIndent(state, "", "  "); err == nil {
			atomicWriteStateFile(statePath, updatedBytes)
		}
	}
}
