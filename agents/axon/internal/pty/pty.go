package pty

import (
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/SolidStateNetwork/Synapse/agents/axon/internal/guard"
	tunnelv1 "github.com/SolidStateNetwork/Synapse/proto"
	creackpty "github.com/creack/pty"
)

const DefaultCommandTimeoutMs = 30000

// Session represents a persistent stateful Linux shell backed by creack/pty.
type Session struct {
	ID            string
	ProjectID     string
	Cmd           *exec.Cmd
	Ptmx          *os.File
	ShellPID      int
	WorkspaceRoot string

	mu          sync.Mutex
	execMu      sync.Mutex
	knownSecret map[string]string
	runningCmd  string

	subMu       sync.Mutex
	subscribers map[chan []byte]struct{}
	captureCh   chan []byte
	closed      bool
}

// Manager maintains persistent PTY sessions across AI tool invocations and live xterm.js streams.
type Manager struct {
	mu            sync.RWMutex
	sessions      map[string]*Session
	workspaceRoot string
	guardCfg      guard.GuardrailConfig
}

// NewManager creates a persistent PTY session manager.
func NewManager(workspaceRoot string, guardCfg guard.GuardrailConfig) *Manager {
	if strings.TrimSpace(workspaceRoot) == "" {
		workspaceRoot = "/opt/axon/workspaces"
	}
	return &Manager{
		sessions:      make(map[string]*Session),
		workspaceRoot: workspaceRoot,
		guardCfg:      guardCfg,
	}
}

// ActiveSessionIDs returns the IDs of all active PTY sessions.
func (m *Manager) ActiveSessionIDs() []string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	out := make([]string, 0, len(m.sessions))
	for id, sess := range m.sessions {
		if !sess.isClosed() {
			out = append(out, id)
		}
	}
	return out
}

// ActiveSessionMeta returns rich metadata (session_id, cwd, running_cmd) for all active PTY sessions.
func (m *Manager) ActiveSessionMeta() []tunnelv1.PtySessionMeta {
	m.mu.RLock()
	defer m.mu.RUnlock()
	out := make([]tunnelv1.PtySessionMeta, 0, len(m.sessions))
	for id, sess := range m.sessions {
		if !sess.isClosed() {
			sess.mu.Lock()
			rc := sess.runningCmd
			sess.mu.Unlock()
			out = append(out, tunnelv1.PtySessionMeta{
				SessionID:  id,
				Cwd:        sess.ResolveCWD(),
				RunningCmd: rc,
			})
		}
	}
	return out
}

// GetOrCreateSession returns an existing persistent bash PTY session or starts a new one.
func (m *Manager) GetOrCreateSession(sessionID string, projectID string, tier tunnelv1.AutonomyTier) (*Session, error) {
	if strings.TrimSpace(sessionID) == "" {
		sessionID = "default-" + strings.TrimSpace(projectID)
	}
	if sessionID == "default-" {
		sessionID = "default"
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	if existing, ok := m.sessions[sessionID]; ok && !existing.isClosed() {
		return existing, nil
	}

	safeProj := filepath.Base(strings.TrimSpace(projectID))
	if safeProj == "" || safeProj == "." || safeProj == "/" {
		safeProj = "default"
	}
	initialDir := filepath.Join(m.workspaceRoot, safeProj)
	if err := os.MkdirAll(initialDir, 0o755); err != nil {
		initialDir = os.TempDir()
	}

	shellBin := "/bin/bash"
	if _, err := os.Stat(shellBin); err != nil {
		shellBin = "/bin/sh"
	}

	var cmd *exec.Cmd
	if strings.HasSuffix(shellBin, "bash") {
		cmd = exec.Command(shellBin, "--norc", "--noprofile", "--noediting")
	} else {
		cmd = exec.Command(shellBin)
	}
	cmd.Dir = initialDir
	cmd.Env = append(os.Environ(),
		"TERM=xterm-256color",
		"PS1=",
		"PROMPT_COMMAND=",
		fmt.Sprintf("SYNAPSE_PROJECT_ID=%s", safeProj),
		fmt.Sprintf("SYNAPSE_AUTONOMY_TIER=%s", string(tier)),
	)

	ptmx, err := creackpty.StartWithSize(cmd, &creackpty.Winsize{
		Rows: 36,
		Cols: 120,
	})
	if err != nil {
		return nil, fmt.Errorf("start persistent pty: %w", err)
	}

	initCap := make(chan []byte, 64)
	sess := &Session{
		ID:            sessionID,
		ProjectID:     safeProj,
		Cmd:           cmd,
		Ptmx:          ptmx,
		ShellPID:      cmd.Process.Pid,
		WorkspaceRoot: initialDir,
		knownSecret:   make(map[string]string),
		subscribers:   make(map[chan []byte]struct{}),
		captureCh:     initCap,
	}

	go sess.readLoop()
	// Reap child shell process on exit so defunct zombie processes never accumulate
	go func(c *exec.Cmd, s *Session, p *os.File) {
		_ = c.Wait()
		_ = p.Close()
		s.subMu.Lock()
		s.closed = true
		s.subMu.Unlock()
	}(cmd, sess, ptmx)

	// Disable terminal echo and wait deterministically for shell readiness
	_, _ = ptmx.Write([]byte("stty -echo 2>/dev/null; export PS1=''; unset PROMPT_COMMAND; printf \"__SYNAPSE_INIT_\"\"READY__\\n\"\n"))
	initDeadline := time.NewTimer(2 * time.Second)
	var initBuf bytes.Buffer
initWait:
	for {
		select {
		case chunk := <-initCap:
			initBuf.Write(chunk)
			if strings.Contains(initBuf.String(), "__SYNAPSE_INIT_READY__") {
				break initWait
			}
		case <-initDeadline.C:
			break initWait
		}
	}
	initDeadline.Stop()
	sess.subMu.Lock()
	sess.captureCh = nil
	sess.subMu.Unlock()

	m.sessions[sessionID] = sess
	return sess, nil
}

// Execute runs a command inside the persistent PTY using deterministic Sentinel Framing:
// `command; echo -e "\n__SYNAPSE_EOF_<cmd_id>:$?__"`
func (m *Manager) Execute(req tunnelv1.PtyExecRequest) tunnelv1.PtyExecResponse {
	cmdID := strings.TrimSpace(req.CmdID)
	if cmdID == "" {
		cmdID = fmt.Sprintf("cmd-%d", time.Now().UnixNano())
	}

	// 1. Deterministic Self-Lockout Guardrail Check
	if allowed, reason := guard.ValidateCommand(m.guardCfg, req.Command); !allowed {
		return tunnelv1.PtyExecResponse{
			CmdID:              cmdID,
			SessionID:          req.SessionID,
			Output:             reason,
			ExitCode:           126,
			BlockedByGuardrail: true,
			GuardrailReason:    reason,
		}
	}

	// 2. Enforce TIER_2_WORKSPACE_JAIL command checks against escaping the workspace
	if req.Tier == tunnelv1.Tier2WorkspaceJail {
		if blocked, reason := checkTier2CommandJail(req.Command, m.workspaceRoot, req.ProjectID); blocked {
			return tunnelv1.PtyExecResponse{
				CmdID:              cmdID,
				SessionID:          req.SessionID,
				Output:             reason,
				ExitCode:           126,
				BlockedByGuardrail: true,
				GuardrailReason:    reason,
			}
		}
	}

	sess, err := m.GetOrCreateSession(req.SessionID, req.ProjectID, req.Tier)
	if err != nil {
		return tunnelv1.PtyExecResponse{
			CmdID:     cmdID,
			SessionID: req.SessionID,
			Output:    fmt.Sprintf("failed to initialize persistent PTY session: %v", err),
			ExitCode:  1,
		}
	}

	if req.Cols > 0 && req.Rows > 0 {
		_ = sess.Resize(req.Cols, req.Rows)
	}

	// Optional Signal Injection (SIGINT / SIGTERM / SIGKILL) before or instead of command execution
	sigUpper := strings.ToUpper(strings.TrimSpace(req.SendSignal))
	if sigUpper == "SIGINT" {
		_, _ = sess.Ptmx.Write([]byte{0x03}) // Ctrl+C to foreground process group
		signalShellChildren(sess.ShellPID, syscall.SIGINT)
		sess.mu.Lock()
		sess.runningCmd = ""
		sess.mu.Unlock()
		sess.broadcastLive([]byte("^C\r\n"))
		if strings.TrimSpace(req.Command) == "" {
			return tunnelv1.PtyExecResponse{
				CmdID:     cmdID,
				SessionID: sess.ID,
				Output:    "Sent SIGINT (Ctrl+C) to foreground process.",
				ExitCode:  0,
				Cwd:       sess.ResolveCWD(),
			}
		}
	} else if sigUpper == "SIGTERM" || sigUpper == "SIGKILL" {
		sig := syscall.SIGTERM
		if sigUpper == "SIGKILL" {
			sig = syscall.SIGKILL
		}
		_, _ = sess.Ptmx.Write([]byte{0x03})
		signalShellChildren(sess.ShellPID, sig)
		sess.mu.Lock()
		sess.runningCmd = ""
		sess.mu.Unlock()
		if strings.TrimSpace(req.Command) == "" {
			return tunnelv1.PtyExecResponse{
				CmdID:     cmdID,
				SessionID: sess.ID,
				Output:    fmt.Sprintf("Sent %s to foreground process.", sigUpper),
				ExitCode:  0,
				Cwd:       sess.ResolveCWD(),
			}
		}
	}

	sess.execMu.Lock()
	defer sess.execMu.Unlock()

	// If a previous command timed out and left a foreground child running, interrupt it before starting the new command
	sess.mu.Lock()
	wasRunning := sess.runningCmd != ""
	sess.runningCmd = req.Command
	sess.mu.Unlock()
	if wasRunning && strings.TrimSpace(req.Command) != "" {
		_, _ = sess.Ptmx.Write([]byte{0x03, '\n'})
		signalShellChildren(sess.ShellPID, syscall.SIGINT)
		time.Sleep(60 * time.Millisecond)
	}

	// Mirror the command line into attached xterm.js live streams
	sess.broadcastLive([]byte(fmt.Sprintf("\r\n\x1b[32m[synapse-ai]$\x1b[0m %s\r\n", req.Command)))

	// Merge any newly injected secrets into session secret registry for continuous redaction
	sess.mu.Lock()
	for k, v := range req.Secrets {
		if strings.TrimSpace(k) != "" && v != "" {
			sess.knownSecret[k] = v
		}
	}
	activeSecrets := make(map[string]string, len(sess.knownSecret))
	for k, v := range sess.knownSecret {
		activeSecrets[k] = v
	}
	sess.mu.Unlock()

	capture := make(chan []byte, 512)
	sess.subMu.Lock()
	sess.captureCh = capture
	sess.subMu.Unlock()
	defer func() {
		sess.subMu.Lock()
		sess.captureCh = nil
		sess.subMu.Unlock()
	}()

	// Export any provided secrets silently in the persistent shell before running the command
	var envExports strings.Builder
	for k, v := range req.Secrets {
		if isValidEnvKey(k) {
			escapedVal := strings.ReplaceAll(v, `'`, `'\''`)
			envExports.WriteString(fmt.Sprintf("export %s='%s'; ", k, escapedVal))
		}
	}

	// If Tier 2 Workspace Jail, ensure CWD starts inside the jail if it ever drifted
	if req.Tier == tunnelv1.Tier2WorkspaceJail {
		cwd := sess.ResolveCWD()
		if !strings.HasPrefix(cwd, sess.WorkspaceRoot) {
			envExports.WriteString(fmt.Sprintf("cd %q; ", sess.WorkspaceRoot))
		}
	}

	// Deterministic Sentinel Framing as required by the Synapse specification:
	// command; printf "\n__SYNAPSE_"EOF"_<cmd_id>:%d__\n" "$?"
	sentinelPrefix := fmt.Sprintf("__SYNAPSE_EOF_%s:", cmdID)
	sentinelRegex := regexp.MustCompile(`(?m)\r?\n?__SYNAPSE_EOF_` + regexp.QuoteMeta(cmdID) + `:(-?\d+)__\r?\n?`)
	echoedSentinelCmdRegex := regexp.MustCompile(`(?m)^.*__SYNAPSE_.*EOF.*$\r?\n?`)

	framedCommand := fmt.Sprintf("%s%s\nprintf \"\\n__SYNAPSE_\"\"EOF_%s:%%d__\\n\" \"$?\"\n", envExports.String(), req.Command, cmdID)
	if _, err := sess.Ptmx.Write([]byte(framedCommand)); err != nil {
		return tunnelv1.PtyExecResponse{
			CmdID:     cmdID,
			SessionID: sess.ID,
			Output:    fmt.Sprintf("failed writing command to PTY: %v", err),
			ExitCode:  1,
			Cwd:       sess.ResolveCWD(),
		}
	}

	timeoutMs := req.WaitTimeoutMs
	if timeoutMs == 0 {
		timeoutMs = DefaultCommandTimeoutMs
	}
	timer := time.NewTimer(time.Duration(timeoutMs) * time.Millisecond)
	defer timer.Stop()

	var rawBuf bytes.Buffer
	exitCode := 0
	timedOut := false

loop:
	for {
		select {
		case chunk := <-capture:
			rawBuf.Write(chunk)
			current := rawBuf.String()
			if strings.Contains(current, sentinelPrefix) {
				if match := sentinelRegex.FindStringSubmatch(current); match != nil {
					parsedCode, convErr := strconv.Atoi(match[1])
					if convErr == nil {
						exitCode = parsedCode
					}
					break loop
				}
			}
		case <-timer.C:
			timedOut = true
			break loop
		}
	}

	if !timedOut {
		sess.mu.Lock()
		sess.runningCmd = ""
		sess.mu.Unlock()
	}

	rawOutput := rawBuf.String()
	// Strip the sentinel marker and any echoed framing lines from the output
	rawOutput = sentinelRegex.ReplaceAllString(rawOutput, "")
	rawOutput = echoedSentinelCmdRegex.ReplaceAllString(rawOutput, "")
	rawOutput = strings.TrimPrefix(rawOutput, framedCommand)

	cwd := sess.ResolveCWD()
	// Enforce Tier 2 post-command CWD check
	if req.Tier == tunnelv1.Tier2WorkspaceJail && !strings.HasPrefix(cwd, sess.WorkspaceRoot) {
		_, _ = sess.Ptmx.Write([]byte(fmt.Sprintf("cd %q\n", sess.WorkspaceRoot)))
		cwd = sess.WorkspaceRoot
	}

	cleaned, truncated, fullLogPath := guard.SanitizeAndTruncate(m.guardCfg, cmdID, rawOutput, activeSecrets)

	return tunnelv1.PtyExecResponse{
		CmdID:       cmdID,
		SessionID:   sess.ID,
		Output:      cleaned,
		ExitCode:    exitCode,
		Cwd:         cwd,
		TimedOut:    timedOut,
		Truncated:   truncated,
		FullLogPath: fullLogPath,
	}
}

// CloseAll terminates all active PTY sessions cleanly.
func (m *Manager) CloseAll() {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, s := range m.sessions {
		if s.ShellPID > 0 {
			signalShellChildren(s.ShellPID, syscall.SIGTERM)
		}
		_ = s.Ptmx.Close()
		if s.Cmd != nil && s.Cmd.Process != nil {
			_ = s.Cmd.Process.Signal(syscall.SIGTERM)
		}
	}
}
