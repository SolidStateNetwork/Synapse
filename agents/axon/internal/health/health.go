package health

import (
	"fmt"
	"net"
	"net/http"
	"os"
	"runtime"
	"strings"
	"sync"
	"time"

	tunnelv1 "github.com/SolidStateNetwork/Synapse/proto"
	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/mem"
)

// Collector gathers host hardware telemetry and performs local service health probes.
type Collector struct {
	NodeID   string
	Tier     tunnelv1.AutonomyTier
	mu       sync.RWMutex
	targets  map[string]tunnelv1.ServiceHealthTarget
	httpCli  *http.Client
}

// NewCollector creates a telemetry and service health collector.
func NewCollector(nodeID string, tier tunnelv1.AutonomyTier) *Collector {
	return &Collector{
		NodeID:  nodeID,
		Tier:    tier,
		targets: make(map[string]tunnelv1.ServiceHealthTarget),
		httpCli: &http.Client{
			Timeout: 2 * time.Second,
		},
	}
}

// SetTargets updates the registered local services to probe on each heartbeat.
func (c *Collector) SetTargets(targets []tunnelv1.ServiceHealthTarget) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.targets = make(map[string]tunnelv1.ServiceHealthTarget, len(targets))
	for _, t := range targets {
		c.targets[t.ServiceID] = t
	}
}

// Collect builds a NodeHeartbeat snapshot including CPU, RAM, Disk, and local service statuses.
func (c *Collector) Collect(activePtySessions []string) tunnelv1.NodeHeartbeat {
	hostname, err := os.Hostname()
	if err != nil || hostname == "" {
		hostname = "axon-node"
	}

	var cpuPct float64
	if pcts, err := cpu.Percent(0, false); err == nil && len(pcts) > 0 {
		cpuPct = pcts[0]
	}

	var ramPct float64
	var ramUsed, ramTotal uint64
	if vm, err := mem.VirtualMemory(); err == nil && vm != nil {
		ramPct = vm.UsedPercent
		ramUsed = vm.Used
		ramTotal = vm.Total
	}

	var diskPct float64
	var diskUsed, diskTotal uint64
	if du, err := disk.Usage("/"); err == nil && du != nil {
		diskPct = du.UsedPercent
		diskUsed = du.Used
		diskTotal = du.Total
	}

	c.mu.RLock()
	targets := make([]tunnelv1.ServiceHealthTarget, 0, len(c.targets))
	for _, t := range c.targets {
		targets = append(targets, t)
	}
	c.mu.RUnlock()

	statuses := make([]tunnelv1.ServiceHealthStatus, 0, len(targets))
	for _, target := range targets {
		statuses = append(statuses, c.probeService(target))
	}

	return tunnelv1.NodeHeartbeat{
		NodeID:            c.NodeID,
		Hostname:          hostname,
		OSArch:            fmt.Sprintf("%s/%s", runtime.GOOS, runtime.GOARCH),
		Tier:              c.Tier,
		CPUPercent:        cpuPct,
		RAMPercent:        ramPct,
		RAMUsedBytes:      ramUsed,
		RAMTotalBytes:     ramTotal,
		DiskPercent:       diskPct,
		DiskUsedBytes:     diskUsed,
		DiskTotalBytes:    diskTotal,
		TimestampUnix:     time.Now().Unix(),
		Services:          statuses,
		ActivePtySessions: activePtySessions,
	}
}

func (c *Collector) probeService(target tunnelv1.ServiceHealthTarget) tunnelv1.ServiceHealthStatus {
	start := time.Now()
	status := tunnelv1.ServiceHealthStatus{
		ServiceID: target.ServiceID,
		Name:      target.Name,
		Port:      target.Port,
	}

	if strings.EqualFold(target.Protocol, "http") {
		path := target.Path
		if !strings.HasPrefix(path, "/") {
			path = "/" + path
		}
		url := fmt.Sprintf("http://127.0.0.1:%d%s", target.Port, path)
		resp, err := c.httpCli.Get(url)
		status.LatencyMs = time.Since(start).Milliseconds()
		if err != nil {
			status.Healthy = false
			status.LastError = err.Error()
			return status
		}
		defer resp.Body.Close()
		status.StatusCode = resp.StatusCode
		status.Healthy = resp.StatusCode >= 200 && resp.StatusCode < 500
		return status
	}

	// Default TCP probe on 127.0.0.1:<port>
	addr := fmt.Sprintf("127.0.0.1:%d", target.Port)
	conn, err := net.DialTimeout("tcp", addr, 1500*time.Millisecond)
	status.LatencyMs = time.Since(start).Milliseconds()
	if err != nil {
		status.Healthy = false
		status.LastError = err.Error()
		return status
	}
	_ = conn.Close()
	status.Healthy = true
	return status
}
