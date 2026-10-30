package health

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/exec"
	"runtime"
	"sort"
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
	NodeID          string
	Tier            tunnelv1.AutonomyTier
	mu              sync.RWMutex
	targets         map[string]tunnelv1.ServiceHealthTarget
	targetsBySource map[string][]tunnelv1.ServiceHealthTarget
	httpCli         *http.Client
}

// NewCollector creates a telemetry and service health collector.
func NewCollector(nodeID string, tier tunnelv1.AutonomyTier) *Collector {
	return &Collector{
		NodeID:          nodeID,
		Tier:            tier,
		targets:         make(map[string]tunnelv1.ServiceHealthTarget),
		targetsBySource: make(map[string][]tunnelv1.ServiceHealthTarget),
		httpCli: &http.Client{
			Timeout: 2 * time.Second,
		},
	}
}

// SetTargets updates the registered local services for the default source.
func (c *Collector) SetTargets(targets []tunnelv1.ServiceHealthTarget) {
	c.SetTargetsForSource("default", targets)
}

// SetTargetsForSource updates the registered local services from a specific Core source
// and merges all active Core sources so Multi-Core Muscle nodes report the union of all services to every Core.
func (c *Collector) SetTargetsForSource(source string, targets []tunnelv1.ServiceHealthTarget) {
	if strings.TrimSpace(source) == "" {
		source = "default"
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.targetsBySource == nil {
		c.targetsBySource = make(map[string][]tunnelv1.ServiceHealthTarget)
	}
	c.targetsBySource[source] = targets

	merged := make(map[string]tunnelv1.ServiceHealthTarget)
	// Sort source names so "primary" takes precedence if identical ServiceIDs exist
	sources := make([]string, 0, len(c.targetsBySource))
	for s := range c.targetsBySource {
		sources = append(sources, s)
	}
	sort.Strings(sources)
	for _, s := range sources {
		for _, t := range c.targetsBySource[s] {
			if t.ServiceID == "" {
				continue
			}
			merged[t.ServiceID] = t
		}
	}
	// Ensure primary source overrides metadata if present
	if prim, ok := c.targetsBySource["primary"]; ok {
		for _, t := range prim {
			if t.ServiceID != "" {
				merged[t.ServiceID] = t
			}
		}
	}
	// Deduplicate generic auto-svc-<port> targets if an explicit named service exists on the same port
	namedPorts := make(map[uint32]bool)
	for _, t := range merged {
		if t.Port > 0 && !strings.HasPrefix(t.ServiceID, "auto-svc-") {
			namedPorts[t.Port] = true
		}
	}
	for id, t := range merged {
		if strings.HasPrefix(id, "auto-svc-") && namedPorts[t.Port] {
			delete(merged, id)
		}
	}
	c.targets = merged
}

// CollectForNode builds a NodeHeartbeat snapshot using the collector's shared Multi-Core service registry
// while stamping the given nodeID and tier for the target Core.
func (c *Collector) CollectForNode(nodeID string, tier tunnelv1.AutonomyTier, activePtySessions []string, sessionDetails ...[]tunnelv1.PtySessionMeta) tunnelv1.NodeHeartbeat {
	beat := c.Collect(activePtySessions, sessionDetails...)
	if strings.TrimSpace(nodeID) != "" {
		beat.NodeID = nodeID
	}
	if tier != "" && tier != tunnelv1.AutonomyTierUnspecified {
		beat.Tier = tier
	}
	return beat
}

// Collect builds a NodeHeartbeat snapshot including CPU, RAM, Disk, OS info, IPv4, PTY sessions, and local service statuses.
func (c *Collector) Collect(activePtySessions []string, sessionDetails ...[]tunnelv1.PtySessionMeta) (beat tunnelv1.NodeHeartbeat) {
	defer func() {
		if r := recover(); r != nil {
			beat.NodeID = c.NodeID
			beat.Tier = c.Tier
			beat.TimestampUnix = time.Now().Unix()
		}
	}()
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
	coveredPorts := make(map[uint32]bool, len(c.targets))
	coveredIDs := make(map[string]bool, len(c.targets))
	for _, t := range c.targets {
		targets = append(targets, t)
		if t.Port > 0 {
			coveredPorts[t.Port] = true
		}
		if t.ServiceID != "" {
			coveredIDs[t.ServiceID] = true
		}
	}
	c.mu.RUnlock()

	portContainers, portProcesses := inspectPortRuntimeMeta()
	for _, autoTarget := range c.discoverLocalTargets(coveredPorts, coveredIDs, portContainers, portProcesses) {
		targets = append(targets, autoTarget)
	}
	for i := range targets {
		if targets[i].ContainerName == "" {
			if cname, ok := portContainers[targets[i].Port]; ok {
				targets[i].ContainerName = cname
			}
		}
		if targets[i].ProcessName == "" {
			if pname, ok := portProcesses[targets[i].Port]; ok {
				targets[i].ProcessName = pname
			}
		}
	}
	sort.Slice(targets, func(i, j int) bool {
		if targets[i].Port != targets[j].Port {
			return targets[i].Port < targets[j].Port
		}
		return targets[i].ServiceID < targets[j].ServiceID
	})

	statuses := make([]tunnelv1.ServiceHealthStatus, 0, len(targets))
	for _, target := range targets {
		statuses = append(statuses, c.probeService(target))
	}

	var details []tunnelv1.PtySessionMeta
	if len(sessionDetails) > 0 {
		details = sessionDetails[0]
	}

	loadAvg1, uptimeSec := readLinuxLoadAndUptime()

	return tunnelv1.NodeHeartbeat{
		NodeID:            c.NodeID,
		Hostname:          hostname,
		OSArch:            fmt.Sprintf("%s/%s", runtime.GOOS, runtime.GOARCH),
		OSInfo:            detectOSInfo(),
		PrivateIPv4:       detectPrivateIPv4(),
		Tier:              c.Tier,
		CPUPercent:        cpuPct,
		RAMPercent:        ramPct,
		RAMUsedBytes:      ramUsed,
		RAMTotalBytes:     ramTotal,
		DiskPercent:       diskPct,
		DiskUsedBytes:     diskUsed,
		DiskTotalBytes:    diskTotal,
		LoadAvg1:          loadAvg1,
		UptimeSec:         uptimeSec,
		TimestampUnix:     time.Now().Unix(),
		Services:          statuses,
		ActivePtySessions: activePtySessions,
		PtySessionDetails: details,
	}
}

func (c *Collector) probeService(target tunnelv1.ServiceHealthTarget) tunnelv1.ServiceHealthStatus {
	start := time.Now()
	status := tunnelv1.ServiceHealthStatus{
		ServiceID:      target.ServiceID,
		Name:           target.Name,
		Port:           target.Port,
		AutoDiscovered: target.AutoDiscovered,
		ProcessName:    target.ProcessName,
		ContainerName:  target.ContainerName,
		Category:       target.Category,
	}

	if strings.EqualFold(target.Protocol, "exec") && strings.TrimSpace(target.Target) != "" {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		cmd := exec.CommandContext(ctx, "/bin/sh", "-c", target.Target)
		err := cmd.Run()
		status.LatencyMs = time.Since(start).Milliseconds()
		if err != nil {
			status.Healthy = false
			status.LastError = err.Error()
			return status
		}
		status.Healthy = true
		status.StatusCode = 0
		return status
	}

	if strings.EqualFold(target.Protocol, "http") {
		url := strings.TrimSpace(target.Target)
		if !strings.HasPrefix(url, "http://") && !strings.HasPrefix(url, "https://") {
			path := target.Path
			if !strings.HasPrefix(path, "/") {
				path = "/" + path
			}
			url = fmt.Sprintf("http://127.0.0.1:%d%s", target.Port, path)
		}
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

	// Default TCP probe on target or 127.0.0.1:<port>
	addr := strings.TrimSpace(target.Target)
	if addr == "" || !strings.Contains(addr, ":") {
		addr = fmt.Sprintf("127.0.0.1:%d", target.Port)
	}
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
