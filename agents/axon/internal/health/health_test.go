package health

import (
	"testing"

	tunnelv1 "github.com/SolidStateNetwork/Synapse/proto"
)

func TestSetTargetsForSource_MultiCoreDeduplication(t *testing.T) {
	c := NewCollector("vps2-muscle", tunnelv1.AutonomyTierUnspecified)

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
