package pty

import (
	"fmt"
	"os"
	"regexp"
	"strconv"
	"strings"
	"syscall"

	creackpty "github.com/creack/pty"
)

func (s *Session) isClosed() bool {
	s.subMu.Lock()
	defer s.subMu.Unlock()
	return s.closed
}

var liveSentinelFilter = regexp.MustCompile(`(?m)\r?\n?__SYNAPSE_EOF_[^:\r\n]+:-?\d+__\r?\n?`)

func (s *Session) broadcastLive(chunk []byte) {
	if len(chunk) == 0 {
		return
	}
	s.subMu.Lock()
	for sub := range s.subscribers {
		select {
		case sub <- chunk:
		default:
		}
	}
	s.subMu.Unlock()
}

func (s *Session) readLoop() {
	defer func() {
		if r := recover(); r != nil {
			s.subMu.Lock()
			s.closed = true
			s.subMu.Unlock()
		}
	}()
	buf := make([]byte, 4096)
	for {
		n, err := s.Ptmx.Read(buf)
		if n > 0 {
			chunk := make([]byte, n)
			copy(chunk, buf[:n])

			s.subMu.Lock()
			if s.captureCh != nil {
				select {
				case s.captureCh <- chunk:
				default:
				}
			}
			cleanForLive := liveSentinelFilter.ReplaceAll(chunk, nil)
			if len(cleanForLive) > 0 {
				for sub := range s.subscribers {
					select {
					case sub <- cleanForLive:
					default:
					}
				}
			}
			s.subMu.Unlock()
		}
		if err != nil {
			s.subMu.Lock()
			s.closed = true
			for sub := range s.subscribers {
				close(sub)
				delete(s.subscribers, sub)
			}
			s.subMu.Unlock()
			return
		}
	}
}

// SubscribeLive attaches a byte channel that mirrors real-time PTY output for xterm.js.
func (s *Session) SubscribeLive() (chan []byte, func()) {
	ch := make(chan []byte, 128)
	s.subMu.Lock()
	if s.closed {
		close(ch)
		s.subMu.Unlock()
		return ch, func() {}
	}
	s.subscribers[ch] = struct{}{}
	s.subMu.Unlock()

	unsubscribe := func() {
		s.subMu.Lock()
		if _, ok := s.subscribers[ch]; ok {
			delete(s.subscribers, ch)
			close(ch)
		}
		s.subMu.Unlock()
	}
	return ch, unsubscribe
}

// WriteInteractive writes raw bytes from xterm.js directly into the PTY master.
func (s *Session) WriteInteractive(data []byte) error {
	_, err := s.Ptmx.Write(data)
	return err
}

// Resize updates the PTY window dimensions.
func (s *Session) Resize(cols, rows uint16) error {
	if cols == 0 || rows == 0 {
		return nil
	}
	return creackpty.Setsize(s.Ptmx, &creackpty.Winsize{
		Cols: cols,
		Rows: rows,
	})
}

// ResolveCWD reads /proc/<shell_pid>/cwd on Linux to determine the persistent shell's current directory.
func (s *Session) ResolveCWD() string {
	procCwd := fmt.Sprintf("/proc/%d/cwd", s.ShellPID)
	if target, err := os.Readlink(procCwd); err == nil && target != "" {
		return target
	}
	return s.WorkspaceRoot
}

func signalShellChildren(shellPID int, sig syscall.Signal) {
	if shellPID <= 1 {
		return
	}
	childrenPath := fmt.Sprintf("/proc/%d/task/%d/children", shellPID, shellPID)
	if data, err := os.ReadFile(childrenPath); err == nil {
		for _, field := range strings.Fields(string(data)) {
			if childPID, convErr := strconv.Atoi(field); convErr == nil && childPID > 1 && childPID != shellPID {
				_ = syscall.Kill(childPID, sig)
			}
		}
	}
}

var envKeyRegex = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_]*$`)

func isValidEnvKey(k string) bool {
	return envKeyRegex.MatchString(k)
}

func checkTier2CommandJail(cmd string, workspaceRoot string, projectID string) (bool, string) {
	lower := strings.ToLower(cmd)
	forbidden := []string{
		"sudo ",
		"su -",
		"chroot ",
		"mount ",
		"umount ",
		"systemctl ",
		"ufw ",
		"iptables ",
		"useradd ",
		"usermod ",
	}
	for _, tok := range forbidden {
		if strings.Contains(lower, tok) {
			return true, fmt.Sprintf("Autonomy Tier Violation (TIER_2_WORKSPACE_JAIL): host administration command %q is prohibited inside workspace jail", strings.TrimSpace(tok))
		}
	}
	return false, ""
}
