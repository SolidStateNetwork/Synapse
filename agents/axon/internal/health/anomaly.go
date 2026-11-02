package health

import (
	"encoding/hex"
	"fmt"
	"net"
	"os"
	"strconv"
	"strings"
	"time"

	tunnelv1 "github.com/SolidStateNetwork/Synapse/proto"
)

var suspiciousOutboundPorts = map[uint16]string{
	1337:  "suspicious_c2_port_1337",
	3333:  "cryptominer_stratum_port_3333",
	4444:  "metasploit_reverse_shell_4444",
	5555:  "android_adb_reverse_shell_5555",
	6667:  "irc_botnet_port_6667",
	9001:  "tor_relay_or_reverse_shell_9001",
	14444: "cryptominer_stratum_tls_14444",
	31337: "backdoor_elite_port_31337",
}

// DetectProcfsAnomalies inspects /proc/net/tcp, /proc/self/fd, and CPU utilization to surface runtime anomaly alerts.
func DetectProcfsAnomalies(cpuPct float64) (alerts []tunnelv1.AnomalyAlert, openFDs int, outboundConns int) {
	if entries, err := os.ReadDir("/proc/self/fd"); err == nil {
		openFDs = len(entries)
	}
	rawTCP, _ := os.ReadFile("/proc/net/tcp")
	alerts, outboundConns = AnalyzeProcfsSnapshot(string(rawTCP), cpuPct, openFDs)
	return alerts, openFDs, outboundConns
}

// AnalyzeProcfsSnapshot parses /proc/net/tcp content alongside CPU and FD metrics to generate deterministic AnomalyAlerts.
func AnalyzeProcfsSnapshot(procNetTCP string, cpuPct float64, openFDs int) ([]tunnelv1.AnomalyAlert, int) {
	now := time.Now().Unix()
	var alerts []tunnelv1.AnomalyAlert
	outboundConns := 0

	lines := strings.Split(procNetTCP, "\n")
	for _, line := range lines {
		fields := strings.Fields(strings.TrimSpace(line))
		if len(fields) < 4 || fields[0] == "sl" {
			continue
		}
		stateHex := strings.ToUpper(fields[3])
		if stateHex != "01" { // 01 = TCP_ESTABLISHED
			continue
		}
		remIP, remPort, ok := parseProcHexAddr(fields[2])
		if !ok || remIP.IsLoopback() || remPort == 0 {
			continue
		}
		outboundConns++
		if label, suspicious := suspiciousOutboundPorts[remPort]; suspicious {
			alerts = append(alerts, tunnelv1.AnomalyAlert{
				Code:          "SUSPICIOUS_OUTBOUND_SOCKET",
				Severity:      "CRITICAL",
				Message:       fmt.Sprintf("Detected established socket to %s:%d (%s)", remIP.String(), remPort, label),
				TimestampUnix: now,
			})
		}
	}

	if cpuPct >= 90.0 {
		alerts = append(alerts, tunnelv1.AnomalyAlert{
			Code:          "CPU_RUNAWAY_SPIKE",
			Severity:      "WARNING",
			Message:       fmt.Sprintf("Host CPU utilization spike at %.1f%% (>= 90%% threshold)", cpuPct),
			TimestampUnix: now,
		})
	}

	if openFDs >= 1024 {
		alerts = append(alerts, tunnelv1.AnomalyAlert{
			Code:          "FD_EXHAUSTION_RISK",
			Severity:      "WARNING",
			Message:       fmt.Sprintf("Process open file descriptors at %d (>= 1024 threshold)", openFDs),
			TimestampUnix: now,
		})
	}

	return alerts, outboundConns
}

func parseProcHexAddr(addrPort string) (net.IP, uint16, bool) {
	parts := strings.Split(addrPort, ":")
	if len(parts) != 2 || len(parts[0]) != 8 {
		return nil, 0, false
	}
	ipBytes, err := hex.DecodeString(parts[0])
	if err != nil || len(ipBytes) != 4 {
		return nil, 0, false
	}
	// /proc/net/tcp stores IPv4 in little-endian byte order on x86_64/arm64
	ip := net.IPv4(ipBytes[3], ipBytes[2], ipBytes[1], ipBytes[0])
	port64, err := strconv.ParseUint(parts[1], 16, 16)
	if err != nil {
		return nil, 0, false
	}
	return ip, uint16(port64), true
}
