package guard

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
)

const (
	MaxOutputBytes  = 16 * 1024 // 16 KB
	HeadOutputBytes = 4 * 1024  // 4 KB
	TailOutputBytes = 12 * 1024 // 12 KB
	DefaultLogDir   = "/tmp/axon-logs"
)

var ansiRegex = regexp.MustCompile(`\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(\x07|\x1b\\)`)

// GuardrailConfig holds runtime context for self-lockout protection.
type GuardrailConfig struct {
	AgentPID     int
	ServiceName  string
	CoreHost     string
	CorePort     string
	LogDirectory string
}

// NewDefaultConfig creates a GuardrailConfig populated with the current process PID.
func NewDefaultConfig(coreHost, corePort string) GuardrailConfig {
	return GuardrailConfig{
		AgentPID:     os.Getpid(),
		ServiceName:  "axon.service",
		CoreHost:     coreHost,
		CorePort:     corePort,
		LogDirectory: DefaultLogDir,
	}
}

// ValidateCommand checks whether a shell command would terminate the agent,
// disable axon.service, or block the outbound Core tunnel via firewall rules.
func ValidateCommand(cfg GuardrailConfig, cmd string) (allowed bool, reason string) {
	normalized := strings.ToLower(strings.TrimSpace(cmd))
	pidStr := strconv.Itoa(cfg.AgentPID)

	// 1. Protect axon.service against stop/disable/mask/kill
	servicePatterns := []string{
		"systemctl stop axon",
		"systemctl disable axon",
		"systemctl mask axon",
		"systemctl kill axon",
		"service axon stop",
		"pkill -9 axon",
		"pkill axon",
		"killall axon",
		"killall -9 axon",
	}
	for _, pat := range servicePatterns {
		if strings.Contains(normalized, pat) {
			return false, fmt.Sprintf("Self-Lockout Guardrail: command attempts to terminate or disable %s (%q)", cfg.ServiceName, pat)
		}
	}

	// 2. Protect the current Axon PID against kill signals
	if cfg.AgentPID > 0 {
		killPIDRegex := regexp.MustCompile(`\bkill\b[^;|&\n]*\b` + regexp.QuoteMeta(pidStr) + `\b`)
		if killPIDRegex.MatchString(normalized) {
			return false, fmt.Sprintf("Self-Lockout Guardrail: command attempts to signal or kill active Axon PID %d", cfg.AgentPID)
		}
	}

	// 3. Protect outbound tunnel and SSH from firewall lockouts (ufw, iptables, nft)
	firewallLockoutPatterns := []string{
		"ufw default deny outgoing",
		"ufw default reject outgoing",
		"iptables -p output drop",
		"iptables --policy output drop",
		"iptables -f",
		"nft flush ruleset",
		"ip link set down",
		"ifconfig eth0 down",
	}
	for _, pat := range firewallLockoutPatterns {
		if strings.Contains(normalized, pat) {
			return false, fmt.Sprintf("Self-Lockout Guardrail: firewall/network rule would sever the outbound Core tunnel (%q)", pat)
		}
	}

	// 4. Protect specific CoreHost / CorePort in ufw / iptables rules
	if strings.Contains(normalized, "ufw") || strings.Contains(normalized, "iptables") || strings.Contains(normalized, "nft") {
		if strings.Contains(normalized, "deny") || strings.Contains(normalized, "drop") || strings.Contains(normalized, "reject") {
			if cfg.CorePort != "" && strings.Contains(normalized, strings.ToLower(cfg.CorePort)) {
				return false, fmt.Sprintf("Self-Lockout Guardrail: firewall rule blocks outbound Core tunnel port %s", cfg.CorePort)
			}
			if cfg.CoreHost != "" && cfg.CoreHost != "127.0.0.1" && cfg.CoreHost != "localhost" && strings.Contains(normalized, strings.ToLower(cfg.CoreHost)) {
				return false, fmt.Sprintf("Self-Lockout Guardrail: firewall rule blocks outbound Core host %s", cfg.CoreHost)
			}
		}
	}

	return true, ""
}

// StripANSI removes terminal ANSI escape sequences so LLM context windows remain clean.
func StripANSI(input string) string {
	return ansiRegex.ReplaceAllString(input, "")
}

// RedactSecrets replaces any occurrence of secret values in output with [REDACTED_SECRET:KEY].
// Longer secret values are replaced first to avoid partial substring leaks.
func RedactSecrets(output string, secrets map[string]string) string {
	if len(secrets) == 0 || output == "" {
		return output
	}

	type kv struct {
		key string
		val string
	}
	var pairs []kv
	for k, v := range secrets {
		if strings.TrimSpace(v) != "" {
			pairs = append(pairs, kv{key: k, val: v})
		}
	}
	sort.Slice(pairs, func(i, j int) bool {
		return len(pairs[i].val) > len(pairs[j].val)
	})

	redacted := output
	for _, pair := range pairs {
		placeholder := fmt.Sprintf("[REDACTED_SECRET:%s]", pair.key)
		redacted = strings.ReplaceAll(redacted, pair.val, placeholder)
	}
	return redacted
}

// SanitizeAndTruncate strips ANSI sequences, scrubs secrets, and enforces the 16 KB output cap
// (keeping first 4 KB head + last 12 KB tail). When truncated, the full log is persisted to
// /tmp/axon-logs/<cmd_id>.log.
func SanitizeAndTruncate(cfg GuardrailConfig, cmdID string, rawOutput string, secrets map[string]string) (cleaned string, truncated bool, fullLogPath string) {
	// Step 1: Redact secrets first on raw output
	redacted := RedactSecrets(rawOutput, secrets)
	// Step 2: Strip ANSI escape sequences
	clean := StripANSI(redacted)
	// Step 3: Re-apply secret redaction in case ANSI codes split a secret value
	clean = RedactSecrets(clean, secrets)

	if len(clean) <= MaxOutputBytes {
		return clean, false, ""
	}

	logDir := cfg.LogDirectory
	if logDir == "" {
		logDir = DefaultLogDir
	}
	_ = os.MkdirAll(logDir, 0o700)

	safeCmdID := filepath.Base(cmdID)
	if safeCmdID == "" || safeCmdID == "." || safeCmdID == "/" {
		safeCmdID = "unknown-cmd"
	}
	logFile := filepath.Join(logDir, fmt.Sprintf("%s.log", safeCmdID))
	_ = os.WriteFile(logFile, []byte(clean), 0o600)

	head := clean[:HeadOutputBytes]
	tail := clean[len(clean)-TailOutputBytes:]
	omittedBytes := len(clean) - (HeadOutputBytes + TailOutputBytes)

	notice := fmt.Sprintf(
		"\n\n... [SYNAPSE CONTEXT GUARDRAIL: %d bytes truncated (showing 4KB head + 12KB tail). Full log written to %s] ...\n\n",
		omittedBytes,
		logFile,
	)

	return head + notice + tail, true, logFile
}
