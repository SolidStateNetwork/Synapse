package pty

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

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
		Cols:          120,
		Rows:          40,
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

	// 3. Test ActiveSessionIDs, ActiveSessionMeta, SubscribeLive, Resize, and SendSignal
	if len(mgr.ActiveSessionIDs()) != 1 || len(mgr.ActiveSessionMeta()) != 1 {
		t.Fatalf("expected 1 active session in manager")
	}

	sess, err := mgr.GetOrCreateSession("sess-test", "demo-proj", tunnelv1.Tier1Unleashed)
	if err != nil {
		t.Fatalf("GetOrCreateSession failed: %v", err)
	}
	liveCh, unsub := sess.SubscribeLive()
	defer unsub()
	_ = sess.Resize(100, 30)
	_ = sess.WriteInteractive([]byte("echo LIVE_STREAM_MARKER\n"))

	select {
	case <-liveCh:
	case <-time.After(2 * time.Second):
		t.Fatalf("timed out waiting for SubscribeLive output")
	}

	sigResp := mgr.Execute(tunnelv1.PtyExecRequest{
		CmdID:      "cmd-sig",
		SessionID:  "sess-test",
		ProjectID:  "demo-proj",
		Tier:       tunnelv1.Tier1Unleashed,
		SendSignal: "SIGINT",
	})
	if sigResp.ExitCode != 0 || !strings.Contains(sigResp.Output, "SIGINT") {
		t.Fatalf("unexpected SIGINT response: %+v", sigResp)
	}

	for _, sig := range []string{"SIGTERM", "SIGKILL"} {
		r := mgr.Execute(tunnelv1.PtyExecRequest{
			SessionID:  "sess-test",
			ProjectID:  "demo-proj",
			Tier:       tunnelv1.Tier1Unleashed,
			SendSignal: sig,
		})
		if r.ExitCode != 0 || !strings.Contains(r.Output, sig) {
			t.Fatalf("unexpected %s response: %+v", sig, r)
		}
	}

	// Verify command timeout followed by subsequent command auto-interrupting the running command
	toResp := mgr.Execute(tunnelv1.PtyExecRequest{
		SessionID:     "sess-timeout",
		ProjectID:     "demo-proj",
		Tier:          tunnelv1.Tier2WorkspaceJail,
		Command:       "sleep 2",
		WaitTimeoutMs: 80,
	})
	if !toResp.TimedOut {
		t.Fatalf("expected sleep 2 with 80ms timeout to time out, got %+v", toResp)
	}

	recoverResp := mgr.Execute(tunnelv1.PtyExecRequest{
		SessionID:     "sess-timeout",
		ProjectID:     "demo-proj",
		Tier:          tunnelv1.Tier2WorkspaceJail,
		Command:       "echo RECOVERED_OK",
		WaitTimeoutMs: 5000,
	})
	if !strings.Contains(recoverResp.Output, "RECOVERED_OK") {
		t.Fatalf("expected session recovery after timeout, got %+v", recoverResp)
	}

	_ = sess.Resize(0, 0)

	// 4. Test Tier2WorkspaceJail command blocking & Self-Lockout Guardrail blocking
	jailBlocked := mgr.Execute(tunnelv1.PtyExecRequest{
		CmdID:     "cmd-jail",
		SessionID: "sess-test",
		ProjectID: "demo-proj",
		Tier:      tunnelv1.Tier2WorkspaceJail,
		Command:   "sudo systemctl stop sshd",
	})
	if !jailBlocked.BlockedByGuardrail || jailBlocked.ExitCode != 126 {
		t.Fatalf("expected Tier2WorkspaceJail to block sudo/systemctl, got %+v", jailBlocked)
	}

	guardBlocked := mgr.Execute(tunnelv1.PtyExecRequest{
		CmdID:     "cmd-guard",
		SessionID: "sess-test",
		ProjectID: "demo-proj",
		Tier:      tunnelv1.Tier1Unleashed,
		Command:   fmt.Sprintf("kill -9 %d", os.Getpid()),
	})
	if !guardBlocked.BlockedByGuardrail || guardBlocked.ExitCode != 126 {
		t.Fatalf("expected Self-Lockout Guardrail to block killing agent PID, got %+v", guardBlocked)
	}

	// 5. Test Ephemeral Session Auto-Reaping & PruneClosedAndExcessSessions
	if !IsEphemeralSessionID("offsite-bkp-12345") || IsEphemeralSessionID("default-demo-proj") {
		t.Fatalf("unexpected IsEphemeralSessionID classification")
	}

	ephResp := mgr.Execute(tunnelv1.PtyExecRequest{
		CmdID:         "cmd-eph",
		SessionID:     "offsite-bkp-999",
		ProjectID:     "demo-proj",
		Tier:          tunnelv1.Tier1Unleashed,
		Command:       "echo EPHEMERAL_OK",
		WaitTimeoutMs: 5000,
	})
	if ephResp.ExitCode != 0 || !strings.Contains(ephResp.Output, "EPHEMERAL_OK") {
		t.Fatalf("expected ephemeral command to succeed, got %+v", ephResp)
	}
	for _, activeID := range mgr.ActiveSessionIDs() {
		if activeID == "offsite-bkp-999" {
			t.Fatalf("expected ephemeral session offsite-bkp-999 to be auto-reaped")
		}
	}

	for i := 0; i < 4; i++ {
		_, _ = mgr.GetOrCreateSession(fmt.Sprintf("extra-sess-%d", i), "demo-proj", tunnelv1.Tier1Unleashed)
	}
	reaped := mgr.PruneClosedAndExcessSessions(2)
	if reaped == 0 {
		t.Fatalf("expected PruneClosedAndExcessSessions(2) to reap excess sessions")
	}
	mgr.CloseSession("sess-timeout")
}
