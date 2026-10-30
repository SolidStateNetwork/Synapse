package health

import (
	"context"
	"fmt"
	"net"
	"os"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
	"time"

	tunnelv1 "github.com/SolidStateNetwork/Synapse/proto"
)

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
