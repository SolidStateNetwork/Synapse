package hub

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// GetNodeCertSerial returns the hex serial number of an active node's client certificate, if connected.
func (h *Hub) GetNodeCertSerial(nodeID string) string {
	h.mu.RLock()
	defer h.mu.RUnlock()
	node, ok := h.nodes[strings.TrimSpace(nodeID)]
	if !ok || node == nil || node.clientCert == nil || node.clientCert.SerialNumber == nil {
		return ""
	}
	return strings.ToLower(node.clientCert.SerialNumber.Text(16))
}

// EvictNode immediately terminates any active Yamux/mTLS session for nodeID, removes it from the active session table,
// marks it offline across project vaults, and records an eviction security event.
func (h *Hub) EvictNode(nodeID, reason string) bool {
	cleanID := strings.TrimSpace(nodeID)
	if cleanID == "" {
		return false
	}
	if strings.TrimSpace(reason) == "" {
		reason = "certificate_revoked"
	}

	h.mu.Lock()
	node, exists := h.nodes[cleanID]
	if exists {
		delete(h.nodes, cleanID)
	}
	h.mu.Unlock()

	evicted := false
	if exists && node != nil {
		evicted = true
		node.mu.Lock()
		if node.telemetryConn != nil {
			_ = node.telemetryConn.Close()
		}
		if node.session != nil {
			_ = node.session.Close()
		}
		node.mu.Unlock()
	}

	h.markNodeOfflineInVaults(cleanID)
	h.RecordEvent("mtls", cleanID, fmt.Sprintf("Evicted node %q (%s) [active_session=%v]", cleanID, reason, evicted), 0, map[string]any{
		"reason":         reason,
		"active_session": evicted,
	})
	return evicted
}

func (h *Hub) markNodeOfflineInVaults(nodeID string) {
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
		projDir := filepath.Join(h.VaultRoot, entry.Name())
		for _, rel := range []string{"State.json", filepath.Join(".synapse", "State.json")} {
			statePath := filepath.Join(projDir, rel)
			raw, err := os.ReadFile(statePath)
			if err != nil {
				continue
			}
			var state map[string]any
			if err := json.Unmarshal(raw, &state); err != nil {
				continue
			}
			changed := false
			if assigned, ok := state["assigned_nodes"].([]any); ok {
				for _, item := range assigned {
					if m, ok := item.(map[string]any); ok && m["node_id"] == nodeID {
						m["online"] = false
						m["status"] = "REVOKED"
						m["revoked"] = true
						changed = true
					}
				}
			}
			if nodesObj, ok := state["nodes"].(map[string]any); ok {
				if nObj, ok := nodesObj[nodeID].(map[string]any); ok {
					nObj["online"] = false
					nObj["revoked"] = true
					changed = true
				}
			}
			if changed {
				if out, err := json.MarshalIndent(state, "", "  "); err == nil {
					atomicWriteStateFile(statePath, out)
				}
			}
		}
	}
}
