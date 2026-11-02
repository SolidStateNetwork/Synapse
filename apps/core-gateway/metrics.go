package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/SolidStateNetwork/Synapse/apps/core-gateway/internal/hub"
	"github.com/SolidStateNetwork/Synapse/apps/core-gateway/internal/pki"
)

func registerEnterpriseRoutes(mux *http.ServeMux, authority *pki.Authority, nodeHub *hub.Hub, startedAt time.Time) {
	// M8.1: Certificate Revocation List (CRL.json) & Instant Yamux Session Eviction
	mux.HandleFunc("/api/v1/nodes/revoke", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			writeJSON(w, http.StatusOK, map[string]any{
				"revoked": authority.ListRevokedCerts(),
			})
			return
		}
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		var body struct {
			NodeID    string `json:"node_id"`
			SerialHex string `json:"serial_hex"`
			Reason    string `json:"reason"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"success": false, "error": err.Error()})
			return
		}
		serial := strings.TrimSpace(body.SerialHex)
		if serial == "" && body.NodeID != "" && nodeHub != nil {
			serial = nodeHub.GetNodeCertSerial(body.NodeID)
		}
		entry, err := authority.RevokeCertSerial(serial, body.NodeID, body.Reason)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"success": false, "error": err.Error()})
			return
		}
		evicted := false
		if nodeHub != nil && strings.TrimSpace(body.NodeID) != "" {
			evicted = nodeHub.EvictNode(body.NodeID, entry.Reason)
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"success":        true,
			"revoked_entry":  entry,
			"session_evicted": evicted,
		})
	})

	mux.HandleFunc("/api/v1/crl", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{
			"entries": authority.ListRevokedCerts(),
			"count":   len(authority.ListRevokedCerts()),
		})
	})

	// M8.5: OpenTelemetry / Prometheus Metrics Exporter (:8081/metrics & /api/v1/metrics)
	metricsHandler := func(w http.ResponseWriter, r *http.Request) {
		expectedToken := strings.TrimSpace(os.Getenv("SYNAPSE_METRICS_TOKEN"))
		if expectedToken != "" {
			authHdr := strings.TrimSpace(r.Header.Get("Authorization"))
			queryTok := strings.TrimSpace(r.URL.Query().Get("token"))
			if authHdr != "Bearer "+expectedToken && queryTok != expectedToken {
				http.Error(w, "unauthorized metrics scrape", http.StatusUnauthorized)
				return
			}
		}

		nodes := nodeHub.ListNodes()
		revokedCount := 0
		activeTokens := 0
		if authority != nil {
			revokedCount = len(authority.ListRevokedCerts())
			activeTokens = len(authority.ListTokens())
		}

		if strings.Contains(r.Header.Get("Accept"), "application/json") || r.URL.Query().Get("format") == "json" {
			writeJSON(w, http.StatusOK, map[string]any{
				"service":          "synapse-core-gateway",
				"version":          "v2.5.0",
				"uptime_sec":       int64(time.Since(startedAt).Seconds()),
				"connected_nodes":  len(nodes),
				"revoked_certs":    revokedCount,
				"issued_tokens":    activeTokens,
				"nodes":            nodes,
			})
			return
		}

		w.Header().Set("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
		var sb strings.Builder
		sb.WriteString("# HELP synapse_gateway_uptime_seconds Uptime of synapse-core-gateway in seconds\n")
		sb.WriteString("# TYPE synapse_gateway_uptime_seconds gauge\n")
		fmt.Fprintf(&sb, "synapse_gateway_uptime_seconds %d\n", int64(time.Since(startedAt).Seconds()))

		sb.WriteString("# HELP synapse_connected_nodes_total Number of active mTLS Yamux Muscle nodes\n")
		sb.WriteString("# TYPE synapse_connected_nodes_total gauge\n")
		fmt.Fprintf(&sb, "synapse_connected_nodes_total %d\n", len(nodes))

		sb.WriteString("# HELP synapse_crl_revoked_certificates_total Number of revoked certificates in CRL.json\n")
		sb.WriteString("# TYPE synapse_crl_revoked_certificates_total gauge\n")
		fmt.Fprintf(&sb, "synapse_crl_revoked_certificates_total %d\n", revokedCount)

		sb.WriteString("# HELP synapse_node_cpu_percent Current CPU usage percentage per Muscle node\n")
		sb.WriteString("# TYPE synapse_node_cpu_percent gauge\n")
		sb.WriteString("# HELP synapse_node_ram_percent Current RAM usage percentage per Muscle node\n")
		sb.WriteString("# TYPE synapse_node_ram_percent gauge\n")
		sb.WriteString("# HELP synapse_node_disk_percent Current Disk usage percentage per Muscle node\n")
		sb.WriteString("# TYPE synapse_node_disk_percent gauge\n")
		sb.WriteString("# HELP synapse_node_active_streams Active Yamux streams per Muscle node\n")
		sb.WriteString("# TYPE synapse_node_active_streams gauge\n")
		sb.WriteString("# HELP synapse_node_anomaly_alerts_total Active procfs/socket anomaly alerts per Muscle node\n")
		sb.WriteString("# TYPE synapse_node_anomaly_alerts_total gauge\n")

		for _, n := range nodes {
			fmt.Fprintf(&sb, "synapse_node_active_streams{node_id=%q,tier=%q} %d\n", n.NodeID, n.Tier, n.ActiveStreams)
			if n.LastHeartbeat != nil {
				hb := n.LastHeartbeat
				fmt.Fprintf(&sb, "synapse_node_cpu_percent{node_id=%q,hostname=%q} %.2f\n", n.NodeID, hb.Hostname, hb.CPUPercent)
				fmt.Fprintf(&sb, "synapse_node_ram_percent{node_id=%q,hostname=%q} %.2f\n", n.NodeID, hb.Hostname, hb.RAMPercent)
				fmt.Fprintf(&sb, "synapse_node_disk_percent{node_id=%q,hostname=%q} %.2f\n", n.NodeID, hb.Hostname, hb.DiskPercent)
				fmt.Fprintf(&sb, "synapse_node_anomaly_alerts_total{node_id=%q,hostname=%q} %d\n", n.NodeID, hb.Hostname, len(hb.AnomalyAlerts))
			}
		}
		_, _ = w.Write([]byte(sb.String()))
	}

	mux.HandleFunc("/metrics", metricsHandler)
	mux.HandleFunc("/api/v1/metrics", metricsHandler)
}
