package hub

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	tunnelv1 "github.com/SolidStateNetwork/Synapse/proto"
)

// ResolveDefaultProjectID picks the best existing project dynamically from h.VaultRoot,
// falling back to SYNAPSE_DEFAULT_PROJECT or "default-project".
func (h *Hub) ResolveDefaultProjectID() string {
	if envProj := strings.TrimSpace(os.Getenv("SYNAPSE_DEFAULT_PROJECT")); envProj != "" {
		return envProj
	}
	if h.VaultRoot != "" {
		if entries, err := os.ReadDir(h.VaultRoot); err == nil {
			bestID := ""
			bestScore := -1
			for _, entry := range entries {
				if !entry.IsDir() {
					continue
				}
				statePath := filepath.Join(h.VaultRoot, entry.Name(), "State.json")
				raw, readErr := os.ReadFile(statePath)
				if readErr != nil {
					raw, readErr = os.ReadFile(statePath + ".bak")
				}
				if readErr != nil {
					continue
				}
				var state map[string]any
				if json.Unmarshal(raw, &state) != nil {
					continue
				}
				assigned, _ := state["assigned_nodes"].([]any)
				services, _ := state["registered_services"].([]any)
				score := len(assigned)*10 + len(services)
				if score > bestScore {
					bestScore = score
					bestID = entry.Name()
				}
			}
			if bestID != "" {
				return bestID
			}
		}
	}
	return "default-project"
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

	state := readStateJsonWithBackup(statePath)
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

func readStateJsonWithBackup(statePath string) map[string]any {
	var state map[string]any
	if raw, err := os.ReadFile(statePath); err == nil {
		if json.Unmarshal(raw, &state) == nil && state != nil {
			return state
		}
	}
	if bakRaw, err := os.ReadFile(statePath + ".bak"); err == nil {
		if json.Unmarshal(bakRaw, &state) == nil && state != nil {
			_ = os.WriteFile(statePath, bakRaw, 0o644)
			return state
		}
	}
	return nil
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
		return
	}
	_ = os.WriteFile(statePath+".bak", data, 0o644)
}

// syncTelemetryToProjectVaults updates State.json inside any Project Brain Vault that has nodeID assigned.
func (h *Hub) syncTelemetryToProjectVaults(nodeID string, beat *tunnelv1.NodeHeartbeat) {
	if h.VaultRoot == "" {
		return
	}
	defaultProj := h.ResolveDefaultProjectID()

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
		state := readStateJsonWithBackup(statePath)
		if state == nil {
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
			if entry.Name() == defaultProj || len(assigned) == 0 {
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

		dismissedSet := make(map[string]bool)
		if dismissedRaw, ok := state["dismissed_services"].([]any); ok {
			for _, d := range dismissedRaw {
				dismissedSet[strings.TrimSpace(fmt.Sprintf("%v", d))] = true
			}
		}

		// Automatically synchronize services reported by the Muscle node into registered_services
		if len(beat.Services) > 0 {
			regServices, _ := state["registered_services"].([]any)
			nowISO := time.Now().UTC().Format(time.RFC3339)
			for _, liveSvc := range beat.Services {
				if liveSvc.ServiceID == "" || liveSvc.Port == 0 {
					continue
				}
				svcPortKey := fmt.Sprintf("%s:%d", nodeID, liveSvc.Port)
				if dismissedSet[liveSvc.ServiceID] || dismissedSet[svcPortKey] {
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
					if !liveSvc.Healthy {
						continue
					}
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
					if strings.HasPrefix(svcID, "auto-svc-") && customPortOwners[portKey] || dismissedSet[svcID] || dismissedSet[portKey] {
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
			DismissedServices  []string `json:"dismissed_services"`
			RegisteredServices []struct {
				ServiceID   string `json:"service_id"`
				Name        string `json:"name"`
				NodeID      string `json:"node_id"`
				Protocol    string `json:"protocol"`
				Port        uint32 `json:"port"`
				Path        string `json:"path"`
				HealthCheck *struct {
					Type   string `json:"type"`
					Target string `json:"target"`
				} `json:"health_check"`
			} `json:"registered_services"`
		}
		if err := json.Unmarshal(raw, &state); err != nil {
			continue
		}
		dismissedSet := make(map[string]bool, len(state.DismissedServices))
		for _, d := range state.DismissedServices {
			dismissedSet[strings.TrimSpace(d)] = true
		}
		for _, svc := range state.RegisteredServices {
			if svc.NodeID != nodeID || svc.Port == 0 {
				continue
			}
			portKey := fmt.Sprintf("%s:%d", nodeID, svc.Port)
			if dismissedSet[svc.ServiceID] || dismissedSet[portKey] {
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
