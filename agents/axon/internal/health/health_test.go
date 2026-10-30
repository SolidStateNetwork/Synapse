package health

import (
	"fmt"
	"net"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	tunnelv1 "github.com/SolidStateNetwork/Synapse/proto"
)

func TestSetTargetsForSource_MultiCoreDeduplication(t *testing.T) {
	c := NewCollector("edge-node-01", tunnelv1.AutonomyTierUnspecified)

	// Primary core registers explicit named service on port 4050 and a generic auto-svc-9999
	c.SetTargetsForSource("primary", []tunnelv1.ServiceHealthTarget{
		{
			ServiceID: "svc-pulse",
			Name:      "Pulse Service",
			Port:      4050,
			Protocol:  "http",
			Path:      "/health",
		},
		{
			ServiceID: "auto-svc-9999",
			Name:      "Auto Service :9999",
			Port:      9999,
			Protocol:  "http",
			Path:      "/",
		},
	})

	// Secondary core registers generic auto-svc-4050 on port 4050 and an explicit service on 4070
	c.SetTargetsForSource("secondary-0", []tunnelv1.ServiceHealthTarget{
		{
			ServiceID: "auto-svc-4050",
			Name:      "Auto Service :4050",
			Port:      4050,
			Protocol:  "http",
			Path:      "/",
		},
		{
			ServiceID: "svc-kanban",
			Name:      "Kanban Hub",
			Port:      4070,
			Protocol:  "http",
			Path:      "/health",
		},
	})

	c.mu.RLock()
	defer c.mu.RUnlock()

	if _, exists := c.targets["auto-svc-4050"]; exists {
		t.Fatalf("expected generic auto-svc-4050 to be deduplicated because svc-pulse owns port 4050")
	}
	if _, exists := c.targets["svc-pulse"]; !exists {
		t.Fatalf("expected named svc-pulse on port 4050 to remain in targets")
	}
	if _, exists := c.targets["svc-kanban"]; !exists {
		t.Fatalf("expected named svc-kanban on port 4070 from secondary-0 to be merged")
	}
	if _, exists := c.targets["auto-svc-9999"]; !exists {
		t.Fatalf("expected auto-svc-9999 to remain when no named service exists on port 9999")
	}
}

func TestProbeServiceProtocolsAndCollectorSnapshot(t *testing.T) {
	c := NewCollector("edge-node-02", tunnelv1.Tier2WorkspaceJail)

	// 1. HTTP Probe (healthy 200 & unhealthy 503)
	okSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	}))
	defer okSrv.Close()

	failSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	defer failSrv.Close()

	httpOK := c.probeService(tunnelv1.ServiceHealthTarget{
		ServiceID: "svc-http-ok",
		Name:      "HTTP OK",
		Protocol:  "http",
		Target:    okSrv.URL + "/healthz",
	})
	if !httpOK.Healthy || httpOK.StatusCode != 200 {
		t.Fatalf("expected healthy HTTP probe, got %+v", httpOK)
	}

	httpFail := c.probeService(tunnelv1.ServiceHealthTarget{
		ServiceID: "svc-http-fail",
		Name:      "HTTP Fail",
		Protocol:  "http",
		Target:    failSrv.URL,
	})
	if httpFail.Healthy || httpFail.StatusCode != 503 {
		t.Fatalf("expected unhealthy 503 HTTP probe, got %+v", httpFail)
	}

	// 2. TCP Probe (listening socket vs closed port)
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("net.Listen: %v", err)
	}
	addrParts := strings.Split(ln.Addr().String(), ":")
	port64, _ := strconv.ParseUint(addrParts[len(addrParts)-1], 10, 32)
	tcpPort := uint32(port64)

	tcpOK := c.probeService(tunnelv1.ServiceHealthTarget{
		ServiceID: "svc-tcp-ok",
		Name:      "TCP OK",
		Protocol:  "tcp",
		Port:      tcpPort,
	})
	if !tcpOK.Healthy {
		t.Fatalf("expected healthy TCP probe on port %d, got %+v", tcpPort, tcpOK)
	}
	_ = ln.Close()

	tcpFail := c.probeService(tunnelv1.ServiceHealthTarget{
		ServiceID: "svc-tcp-closed",
		Name:      "TCP Closed",
		Protocol:  "tcp",
		Target:    fmt.Sprintf("127.0.0.1:%d", tcpPort),
	})
	if tcpFail.Healthy {
		t.Fatalf("expected unhealthy TCP probe after listener closed")
	}

	// 3. EXEC Probe (exit 0 vs exit 1)
	execOK := c.probeService(tunnelv1.ServiceHealthTarget{
		ServiceID: "svc-exec-ok",
		Name:      "Exec OK",
		Protocol:  "exec",
		Target:    "true",
	})
	if !execOK.Healthy {
		t.Fatalf("expected healthy exec probe, got %+v", execOK)
	}

	execFail := c.probeService(tunnelv1.ServiceHealthTarget{
		ServiceID: "svc-exec-fail",
		Name:      "Exec Fail",
		Protocol:  "exec",
		Target:    "false",
	})
	if execFail.Healthy {
		t.Fatalf("expected unhealthy exec probe for 'false'")
	}

	// 4. Full Collect & CollectForNode + Firewall/Port filter helpers
	c.SetTargets([]tunnelv1.ServiceHealthTarget{
		{
			ServiceID: "svc-http-ok",
			Name:      "HTTP OK",
			Protocol:  "http",
			Target:    okSrv.URL,
			Port:      8080,
		},
	})
	beat := c.CollectForNode("override-node", tunnelv1.Tier1Unleashed, []string{"default"}, []tunnelv1.PtySessionMeta{
		{SessionID: "default", Cwd: "/tmp"},
	})
	if beat.NodeID != "override-node" || beat.Tier != tunnelv1.Tier1Unleashed || len(beat.ActivePtySessions) != 1 {
		t.Fatalf("unexpected CollectForNode heartbeat: %+v", beat)
	}

	if !isIgnoredSystemPortOrProcess(22, "sshd") || !isIgnoredSystemPortOrProcess(50000, "python3") || !isIgnoredSystemPortOrProcess(4000, "axon") {
		t.Fatalf("expected system ports/processes to be ignored")
	}
	if isIgnoredSystemPortOrProcess(4050, "python3") {
		t.Fatalf("expected user microservice port 4050 (python3) not to be ignored")
	}
	if detectOSInfo() == "" || detectPrivateIPv4() == "" {
		t.Fatalf("expected non-empty OSInfo and PrivateIPv4")
	}

	// 5. HTTP probe using Port + Path (no explicit Target URL) and connection refused error
	portRelativeFail := c.probeService(tunnelv1.ServiceHealthTarget{
		ServiceID: "svc-http-port-only",
		Name:      "HTTP Port Only",
		Protocol:  "http",
		Port:      tcpPort,
		Path:      "health",
	})
	if portRelativeFail.Healthy {
		t.Fatalf("expected closed port HTTP probe to be unhealthy")
	}

	// 6. Deterministic discoverLocalTargets test with real listening ports in 3000..9999 & 5400..5999
	if appLis, err := net.Listen("tcp", "127.0.0.1:4589"); err == nil {
		defer appLis.Close()
		discovered := c.discoverLocalTargets(
			map[uint32]bool{},
			map[string]bool{},
			map[uint32]string{4589: "demo-container"},
			map[uint32]string{4589: "gunicorn"},
		)
		found4589 := false
		for _, d := range discovered {
			if d.Port == 4589 {
				found4589 = true
				break
			}
		}
		if !found4589 {
			t.Fatalf("expected port 4589 to be discovered by discoverLocalTargets")
		}
	}

	if dbLis, err := net.Listen("tcp", "127.0.0.1:5489"); err == nil {
		defer dbLis.Close()
		dbCollector := NewCollector("edge-db-node", tunnelv1.Tier2WorkspaceJail)
		dbDiscovered := dbCollector.discoverLocalTargets(
			map[uint32]bool{},
			map[string]bool{},
			map[uint32]string{},
			map[uint32]string{5489: "postgres"},
		)
		found5489 := false
		for _, d := range dbDiscovered {
			if d.Port == 5489 && d.Category == "database" {
				found5489 = true
				break
			}
		}
		if !found5489 {
			t.Fatalf("expected DB port 5489 to be discovered on db-node")
		}
	}
}
