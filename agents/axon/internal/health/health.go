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
	"strconv"
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

func detectOSInfo() string {
	if raw, err := os.ReadFile("/etc/os-release"); err == nil {
		for _, line := range strings.Split(string(raw), "\n") {
			if strings.HasPrefix(line, "PRETTY_NAME=") {
				pretty := strings.Trim(strings.TrimPrefix(line, "PRETTY_NAME="), `"'`)
				return fmt.Sprintf("%s (%s %s)", pretty, runtime.GOOS, runtime.GOARCH)
			}
		}
	}
	return fmt.Sprintf("%s/%s", runtime.GOOS, runtime.GOARCH)
}

func detectPrivateIPv4() string {
	addrs, err := net.InterfaceAddrs()
	if err != nil {
		return "127.0.0.1"
	}
	for _, a := range addrs {
		if ipnet, ok := a.(*net.IPNet); ok && !ipnet.IP.IsLoopback() {
			if v4 := ipnet.IP.To4(); v4 != nil {
				return v4.String()
			}
		}
	}
	return "127.0.0.1"
}

// readLinuxLoadAndUptime reads /proc/loadavg and /proc/uptime on Linux.
func readLinuxLoadAndUptime() (float64, uint64) {
	if runtime.GOOS != "linux" {
		return 0, 0
	}
	var load1 float64
	if raw, err := os.ReadFile("/proc/loadavg"); err == nil {
		fields := strings.Fields(string(raw))
		if len(fields) > 0 {
			load1, _ = strconv.ParseFloat(fields[0], 64)
		}
	}
	var uptime uint64
	if raw, err := os.ReadFile("/proc/uptime"); err == nil {
		fields := strings.Fields(string(raw))
		if len(fields) > 0 {
			if f, err := strconv.ParseFloat(fields[0], 64); err == nil && f > 0 {
				uptime = uint64(f)
			}
		}
	}
	return load1, uptime
}

// inspectPortRuntimeMeta gathers running Docker container port bindings and ss -tulpn process names.
func inspectPortRuntimeMeta() (map[uint32]string, map[uint32]string) {
	containers := make(map[uint32]string)
	processes := make(map[uint32]string)
	if runtime.GOOS != "linux" {
		return containers, processes
	}

	// 1. Inspect running Docker containers: Name|Image|Ports
	ctxDocker, cancelDocker := context.WithTimeout(context.Background(), 1200*time.Millisecond)
	defer cancelDocker()
	if out, err := exec.CommandContext(ctxDocker, "docker", "ps", "--format", "{{.Names}}|{{.Image}}|{{.Ports}}").Output(); err == nil {
		for _, line := range strings.Split(strings.TrimSpace(string(out)), "\n") {
			parts := strings.Split(line, "|")
			if len(parts) < 3 {
				continue
			}
			cName := strings.TrimSpace(parts[0])
			portsStr := parts[2]
			for _, seg := range strings.Split(portsStr, ",") {
				seg = strings.TrimSpace(seg)
				if arrowIdx := strings.Index(seg, "->"); arrowIdx > 0 {
					hostPart := seg[:arrowIdx]
					if colonIdx := strings.LastIndex(hostPart, ":"); colonIdx >= 0 {
						pStr := hostPart[colonIdx+1:]
						if p64, err := strconv.ParseUint(pStr, 10, 32); err == nil && p64 > 0 {
							containers[uint32(p64)] = cName
						}
					}
				}
			}
		}
	}

	// 2. Inspect ss -tulpn for process names per listening TCP port
	ctxSS, cancelSS := context.WithTimeout(context.Background(), 1200*time.Millisecond)
	defer cancelSS()
	if out, err := exec.CommandContext(ctxSS, "ss", "-tlnp").Output(); err == nil {
		for _, line := range strings.Split(string(out), "\n") {
			if !strings.Contains(line, "LISTEN") {
				continue
			}
			fields := strings.Fields(line)
			if len(fields) < 4 {
				continue
			}
			localAddr := fields[3]
			colonIdx := strings.LastIndex(localAddr, ":")
			if colonIdx < 0 {
				continue
			}
			p64, err := strconv.ParseUint(localAddr[colonIdx+1:], 10, 32)
			if err != nil || p64 == 0 {
				continue
			}
			port := uint32(p64)
			if uIdx := strings.Index(line, `users:(("`); uIdx >= 0 {
				rest := line[uIdx+len(`users:(("`):]
				if qIdx := strings.Index(rest, `"`); qIdx > 0 {
					procName := rest[:qIdx]
					if procName != "" {
						processes[port] = procName
					}
				}
			}
		}
	}

	return containers, processes
}

func isIgnoredSystemPortOrProcess(port uint32, procName string) bool {
	// Ignore SSH, DNS, mDNS/LLMNR, Synapse Core/Tunnel ports, and high ephemeral ports
	switch port {
	case 22, 53, 68, 546, 5353, 5355, 8081, 8443, 9081, 9443:
		return true
	}
	if port >= 32768 {
		return true
	}
	lowerProc := strings.ToLower(procName)
	switch lowerProc {
	case "sshd", "sshd-session", "systemd-resolve", "systemd-network", "containerd", "dockerd", "axon":
		return true
	}
	return false
}

// discoverLocalTargets inspects /proc/net/tcp, /proc/net/tcp6, and Docker containers
// on Linux to auto-discover active local application, web, and database services not yet in coveredPorts.
func (c *Collector) discoverLocalTargets(coveredPorts map[uint32]bool, coveredIDs map[string]bool, portContainers map[uint32]string, portProcesses map[uint32]string) []tunnelv1.ServiceHealthTarget {
	if runtime.GOOS != "linux" {
		return nil
	}
	_ = coveredIDs
	isDBNode := strings.Contains(strings.ToLower(c.NodeID), "db")
	seenPorts := make(map[uint32]bool)
	var discovered []tunnelv1.ServiceHealthTarget

	for _, procFile := range []string{"/proc/net/tcp", "/proc/net/tcp6"} {
		raw, err := os.ReadFile(procFile)
		if err != nil {
			continue
		}
		lines := strings.Split(string(raw), "\n")
		for idx, line := range lines {
			if idx == 0 {
				continue
			}
			fields := strings.Fields(line)
			if len(fields) < 4 {
				continue
			}
			// State 0A = TCP_LISTEN
			if fields[3] != "0A" {
				continue
			}
			addrParts := strings.Split(fields[1], ":")
			if len(addrParts) != 2 {
				continue
			}
			port64, err := strconv.ParseUint(addrParts[1], 16, 32)
			if err != nil {
				continue
			}
			port := uint32(port64)
			if coveredPorts[port] || seenPorts[port] {
				continue
			}
			procName := portProcesses[port]
			cName := portContainers[port]
			if isIgnoredSystemPortOrProcess(port, procName) {
				continue
			}

			if isDBNode {
				if port < 5400 || port > 5999 {
					continue
				}
				seenPorts[port] = true
				svcID := fmt.Sprintf("auto-db-%d", port)
				svcName := fmt.Sprintf("Encrypted Mesh DB :%d", port)
				discovered = append(discovered, tunnelv1.ServiceHealthTarget{
					ServiceID:      svcID,
					Name:           svcName,
					Protocol:       "http",
					Port:           port,
					Path:           "/",
					AutoDiscovered: true,
					ProcessName:    procName,
					ContainerName:  cName,
					Category:       "database",
				})
			} else {
				// Discover any user service in 80, 443, 3000..9999, or standard DB ports (3306, 5432, 6379, 27017)
				isStandardPort := (port >= 3000 && port <= 9999) || port == 80 || port == 443 || port == 3306 || port == 5432 || port == 6379 || port == 27017
				if !isStandardPort && cName == "" {
					continue
				}
				seenPorts[port] = true
				svcID := fmt.Sprintf("auto-svc-%d", port)
				svcName := fmt.Sprintf("Autonomous Microservice :%d", port)
				proto := "http"
				category := "backend"

				if cName != "" {
					svcName = fmt.Sprintf("Docker %s :%d", cName, port)
				} else if procName != "" && procName != "python3" && procName != "node" {
					svcName = fmt.Sprintf("%s Service :%d", strings.Title(procName), port)
				}

				switch port {
				case 3306, 5432, 6379, 27017:
					proto = "tcp"
					category = "database"
					svcID = fmt.Sprintf("auto-db-%d", port)
				}
				discovered = append(discovered, tunnelv1.ServiceHealthTarget{
					ServiceID:      svcID,
					Name:           svcName,
					Protocol:       proto,
					Port:           port,
					Path:           "/",
					AutoDiscovered: true,
					ProcessName:    procName,
					ContainerName:  cName,
					Category:       category,
				})
			}
		}
	}
	return discovered
}
