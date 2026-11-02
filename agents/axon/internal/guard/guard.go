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

var (
	ansiRegex              = regexp.MustCompile(`\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(\x07|\x1b\\)`)
	reorderedSystemctlRe   = regexp.MustCompile(`\bsystemctl\b[^;|&\n]*\b(stop|disable|mask|kill)\b[^;|&\n]*\b(axon|ssh|sshd)(\.service)?\b`)
	interfaceDownGuardRe   = regexp.MustCompile(`\bip\s+link\s+set\s+(dev\s+)?(eth0|ens\d+|enp\d+s\d+|wg\d+|tailscale\d+|netbird\d+|wt\d+)\s+down\b`)
	chainSplitTokensRegex  = regexp.MustCompile(`\s*(?:&&|\|\||[;|])\s*`)
)

// GuardrailConfig holds runtime context for self-lockout protection and optional deterministic command allowlisting.
type GuardrailConfig struct {
	AgentPID        int      `json:"agent_pid"`
	ServiceName     string   `json:"service_name"`
	CoreHost        string   `json:"core_host"`
	CorePort        string   `json:"core_port"`
	LogDirectory    string   `json:"log_directory"`
	AllowedCommands []string `json:"allowed_commands,omitempty"`
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

// ValidateCommandWithAllowlist validates a shell command against both self-lockout rules and an explicit allowlist.
func ValidateCommandWithAllowlist(cfg GuardrailConfig, cmd string, allowlist []string) (bool, string) {
	merged := cfg
	if len(allowlist) > 0 {
		merged.AllowedCommands = allowlist
	}
	return ValidateCommand(merged, cmd)
}

func checkCommandAllowlist(cmd string, allowlist []string) (bool, string) {
	if len(allowlist) == 0 {
		return true, ""
	}
	trimmed := strings.TrimSpace(cmd)
	if trimmed == "" {
		return true, ""
	}
	// Block subshell command substitution when strict allowlist is active
	if strings.Contains(trimmed, "$(") || strings.Contains(trimmed, "`") {
		return false, "Command Allowlist Policy: subshell command substitution ($() / backticks) is prohibited when allowed_commands is active"
	}
	segments := chainSplitTokensRegex.Split(trimmed, -1)
	for _, seg := range segments {
		seg = strings.TrimSpace(seg)
		if seg == "" {
			continue
		}
		fields := strings.Fields(seg)
		if len(fields) == 0 {
			continue
		}
		exe := filepath.Base(fields[0])
		matched := false
		for _, allowedPattern := range allowlist {
			pat := strings.TrimSpace(allowedPattern)
			if pat == "" {
				continue
			}
			if pat == "*" || exe == pat || fields[0] == pat || strings.HasPrefix(seg, pat+" ") || seg == pat {
				matched = true
				break
			}
		}
		if !matched {
			return false, fmt.Sprintf("Command Allowlist Policy: executable %q is not in allowed_commands %v", fields[0], allowlist)
		}
	}
	return true, ""
}

// ValidateCommand checks whether a shell command would terminate the agent,
// disable axon.service, block the outbound Core tunnel / SSH via firewall rules, or violate AllowedCommands.
func ValidateCommand(cfg GuardrailConfig, cmd string) (allowed bool, reason string) {
	normalized := strings.ToLower(strings.TrimSpace(cmd))
	pidStr := strconv.Itoa(cfg.AgentPID)

	if ok, denyReason := checkCommandAllowlist(cmd, cfg.AllowedCommands); !ok {
		return false, denyReason
	}

	// 1. Protect axon.service and sshd against stop/disable/mask/kill/deletion
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
		"systemctl stop ssh",
		"systemctl disable ssh",
		"systemctl mask ssh",
		"service ssh stop",
		"service sshd stop",
		"rm -rf /etc/axon",
		"rm -f /etc/axon",
		"rm -rf /usr/local/bin/axon",
		"rm -f /usr/local/bin/axon",
		"--no-preserve-root",
	}
	for _, pat := range servicePatterns {
		if strings.Contains(normalized, pat) {
			return false, fmt.Sprintf("Self-Lockout Guardrail: command attempts to terminate or disable %s or critical host access (%q)", cfg.ServiceName, pat)
		}
	}
	if reorderedSystemctlRe.MatchString(normalized) {
		return false, fmt.Sprintf("Self-Lockout Guardrail: flag-reordered systemctl command attempts to stop/disable %s or SSH", cfg.ServiceName)
	}

	// 1b. Block catastrophic root filesystem destruction (e.g., rm -rf / or rm -rf /*)
	rootWipeRegex := regexp.MustCompile(`\brm\s+(-[rRf]+\s+)+/\s*(\*|[;|&]|$)`)
	if rootWipeRegex.MatchString(normalized) {
		return false, "Self-Lockout Guardrail: catastrophic root filesystem deletion ('rm -rf /') is prohibited"
	}

	// 2. Protect the current Axon PID against kill signals
	if cfg.AgentPID > 0 {
		killPIDRegex := regexp.MustCompile(`\bkill\b[^;|&\n]*\b` + regexp.QuoteMeta(pidStr) + `\b`)
		if killPIDRegex.MatchString(normalized) {
			return false, fmt.Sprintf("Self-Lockout Guardrail: command attempts to signal or kill active Axon PID %d", cfg.AgentPID)
		}
	}

	// 3. Protect outbound tunnel, SSH access, and loopback from firewall lockouts (ufw, iptables, nft)
	firewallLockoutPatterns := []string{
		"ufw default deny outgoing",
		"ufw default reject outgoing",
		"ufw deny 22",
		"ufw deny ssh",
		"ufw reject 22",
		"ufw reject ssh",
		"iptables -p output drop",
		"iptables --policy output drop",
		"iptables -f",
		"nft flush ruleset",
		"ip link set down",
		"ifconfig eth0 down",
		"nmcli networking off",
		"-i lo -j drop",
		"-i lo -j reject",
	}
	for _, pat := range firewallLockoutPatterns {
		if strings.Contains(normalized, pat) {
			return false, fmt.Sprintf("Self-Lockout Guardrail: firewall/network rule would sever the outbound Core tunnel or SSH access (%q)", pat)
		}
	}
	if interfaceDownGuardRe.MatchString(normalized) {
		return false, "Self-Lockout Guardrail: bringing down primary network or VPN tunnel interface is prohibited"
	}

	// 4. Protect specific CoreHost / CorePort and SSH port 22 in ufw / iptables rules
	if strings.Contains(normalized, "ufw") || strings.Contains(normalized, "iptables") || strings.Contains(normalized, "nft") {
		if strings.Contains(normalized, "deny") || strings.Contains(normalized, "drop") || strings.Contains(normalized, "reject") {
			if cfg.CorePort != "" && strings.Contains(normalized, strings.ToLower(cfg.CorePort)) {
				return false, fmt.Sprintf("Self-Lockout Guardrail: firewall rule blocks outbound Core tunnel port %s", cfg.CorePort)
			}
			if cfg.CoreHost != "" && cfg.CoreHost != "127.0.0.1" && cfg.CoreHost != "localhost" && strings.Contains(normalized, strings.ToLower(cfg.CoreHost)) {
				return false, fmt.Sprintf("Self-Lockout Guardrail: firewall rule blocks outbound Core host %s", cfg.CoreHost)
			}
			if strings.Contains(normalized, "--dport 22 ") || strings.HasSuffix(normalized, "--dport 22") || strings.Contains(normalized, "dport 22 ") {
				return false, "Self-Lockout Guardrail: firewall rule would block SSH port 22"
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
	redacted := RedactSecrets(rawOutput, secrets)
	clean := StripANSI(redacted)
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
