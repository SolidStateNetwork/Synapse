package pty

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/SolidStateNetwork/Synapse/agents/axon/internal/guard"
	tunnelv1 "github.com/SolidStateNetwork/Synapse/proto"
)

func TestPersistentPtySentinelAndState(t *testing.T) {
	wsRoot := t.TempDir()
	guardCfg := guard.GuardrailConfig{
		AgentPID:     os.Getpid(),
		ServiceName:  "axon.service",
		CoreHost:     "10.0.0.1",
		CorePort:     "8443",
		LogDirectory: t.TempDir(),
	}

	mgr := NewManager(wsRoot, guardCfg)
	defer mgr.CloseAll()

	// 1. Create a subdirectory and cd into it + export an environment variable
	resp1 := mgr.Execute(tunnelv1.PtyExecRequest{
		CmdID:         "cmd-101",
		SessionID:     "sess-test",
		ProjectID:     "demo-proj",
		Tier:          tunnelv1.Tier1Unleashed,
		Command:       "mkdir -p backend/api && cd backend/api && export SYNAPSE_STATE_TEST='persisted_value_42' && pwd",
		WaitTimeoutMs: 5000,
	})
	if resp1.ExitCode != 0 {
		t.Fatalf("expected exit code 0, got %d (output: %s)", resp1.ExitCode, resp1.Output)
	}
	expectedCwd := filepath.Join(wsRoot, "demo-proj", "backend", "api")
	if !strings.HasSuffix(resp1.Cwd, "backend/api") {
		t.Fatalf("expected CWD to end with backend/api, got %s (expected %s)", resp1.Cwd, expectedCwd)
	}
	if strings.Contains(resp1.Output, "__SYNAPSE_EOF_") {
		t.Fatalf("sentinel leaked into output: %q", resp1.Output)
	}

	// 2. Subsequent command in the SAME session must preserve CWD, env var, and redact secrets
	resp2 := mgr.Execute(tunnelv1.PtyExecRequest{
		CmdID:         "cmd-102",
		SessionID:     "sess-test",
		ProjectID:     "demo-proj",
		Tier:          tunnelv1.Tier1Unleashed,
		Command:       "echo \"ENV=$SYNAPSE_STATE_TEST SECRET=$STRIPE_KEY\" && (exit 7)",
		WaitTimeoutMs: 5000,
		Secrets: map[string]string{
			"STRIPE_KEY": "sk_live_9988776655",
		},
	})
	if resp2.ExitCode != 7 {
		t.Fatalf("expected exit code 7 from subshell, got %d", resp2.ExitCode)
	}
	if !strings.Contains(resp2.Output, "ENV=persisted_value_42") {
		t.Fatalf("expected persisted env var in output, got: %q", resp2.Output)
	}
	if strings.Contains(resp2.Output, "sk_live_9988776655") {
		t.Fatalf("secret value leaked in PTY output: %q", resp2.Output)
	}
	if !strings.Contains(resp2.Output, "[REDACTED_SECRET:STRIPE_KEY]") {
		t.Fatalf("expected [REDACTED_SECRET:STRIPE_KEY] in output, got: %q", resp2.Output)
	}
	if !strings.HasSuffix(resp2.Cwd, "backend/api") {
		t.Fatalf("expected CWD to remain backend/api across calls, got %s", resp2.Cwd)
	}
}
