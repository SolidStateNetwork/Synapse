package guard

import (
	"os"
	"strings"
	"testing"
)

func TestValidateCommandSelfLockout(t *testing.T) {
	cfg := GuardrailConfig{
		AgentPID:     42424,
		ServiceName:  "axon.service",
		CoreHost:     "10.20.30.40",
		CorePort:     "8443",
		LogDirectory: t.TempDir(),
	}

	blockedCmds := []string{
		"sudo systemctl stop axon.service",
		"systemctl disable axon",
		"kill -9 42424",
		"ufw default deny outgoing",
		"ufw deny out 8443/tcp",
		"ufw deny 22/tcp",
		"ufw deny ssh",
		"iptables -A INPUT -p tcp --dport 22 -j DROP",
		"iptables -A INPUT -i lo -j DROP",
		"iptables -A OUTPUT -d 10.20.30.40 -j DROP",
		"pkill -9 axon",
		"rm -rf /",
		"rm -rf /*",
		"rm -rf --no-preserve-root /",
		"rm -rf /etc/axon",
		"systemctl stop sshd",
	}

	for _, cmd := range blockedCmds {
		allowed, reason := ValidateCommand(cfg, cmd)
		if allowed {
			t.Fatalf("expected command %q to be blocked by self-lockout guardrail", cmd)
		}
		if reason == "" {
			t.Fatalf("expected non-empty guardrail reason for %q", cmd)
		}
	}

	safeCmds := []string{
		"systemctl restart nginx",
		"ufw allow 443/tcp",
		"iptables -I INPUT ! -i lo -p tcp --dport 4070 -j DROP",
		"kill -9 99999",
		"docker compose up -d",
	}

	for _, cmd := range safeCmds {
		allowed, reason := ValidateCommand(cfg, cmd)
		if !allowed {
			t.Fatalf("expected safe command %q to be allowed, got reason: %s", cmd, reason)
		}
	}
}

func TestSanitizeAndTruncate(t *testing.T) {
	tmpDir := t.TempDir()
	cfg := GuardrailConfig{
		AgentPID:     1000,
		LogDirectory: tmpDir,
	}

	secrets := map[string]string{
		"DB_PASSWORD": "super-secret-password-999",
		"API_TOKEN":   "syn_live_abcdef123456",
	}

	raw := "\x1b[32mConnecting with super-secret-password-999 and token syn_live_abcdef123456\x1b[0m\n"
	cleaned, truncated, logPath := SanitizeAndTruncate(cfg, "cmd-1", raw, secrets)
	if truncated {
		t.Fatalf("expected small output not to be truncated")
	}
	if logPath != "" {
		t.Fatalf("expected empty logPath for non-truncated output")
	}
	if strings.Contains(cleaned, "super-secret-password-999") || strings.Contains(cleaned, "syn_live_abcdef123456") {
		t.Fatalf("secret leaked in cleaned output: %s", cleaned)
	}
	if !strings.Contains(cleaned, "[REDACTED_SECRET:DB_PASSWORD]") || !strings.Contains(cleaned, "[REDACTED_SECRET:API_TOKEN]") {
		t.Fatalf("expected redaction placeholders in output: %s", cleaned)
	}
	if strings.Contains(cleaned, "\x1b[") {
		t.Fatalf("expected ANSI escape sequences to be stripped: %q", cleaned)
	}

	// Test 20 KB truncation (4KB head + 12KB tail)
	large := strings.Repeat("A", 5000) + strings.Repeat("M", 10000) + strings.Repeat("Z", 5000)
	truncOut, isTrunc, fullPath := SanitizeAndTruncate(cfg, "cmd-large", large, nil)
	if !isTrunc {
		t.Fatalf("expected 20KB output to be truncated")
	}
	if fullPath == "" {
		t.Fatalf("expected full log path to be populated")
	}
	diskData, err := os.ReadFile(fullPath)
	if err != nil {
		t.Fatalf("failed reading full log file %s: %v", fullPath, err)
	}
	if len(diskData) != 20000 {
		t.Fatalf("expected full log file to have 20000 bytes, got %d", len(diskData))
	}
	if !strings.HasPrefix(truncOut, strings.Repeat("A", 4096)) {
		t.Fatalf("expected truncated output to start with 4KB head")
	}
	if !strings.HasSuffix(truncOut, strings.Repeat("Z", 5000)) {
		t.Fatalf("expected truncated output to end with 12KB tail")
	}
}
