// Code generated from proto/tunnel.proto. DO NOT EDIT.
package tunnelv1

import (
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
)

type StreamType int32

const (
	StreamTypeUnspecified StreamType = 0
	StreamTypeRpcFs       StreamType = 1
	StreamTypePty         StreamType = 2
	StreamTypePortForward StreamType = 3
	StreamTypeTelemetry   StreamType = 4
)

type AutonomyTier string

const (
	AutonomyTierUnspecified AutonomyTier = "UNSPECIFIED"
	Tier1Unleashed          AutonomyTier = "TIER_1_UNLEASHED"
	Tier2WorkspaceJail      AutonomyTier = "TIER_2_WORKSPACE_JAIL"
	Tier3Supervised         AutonomyTier = "TIER_3_SUPERVISED"
)

type StreamHeader struct {
	StreamType StreamType `json:"stream_type"`
	ProjectID  string     `json:"project_id,omitempty"`
	SessionID  string     `json:"session_id,omitempty"`
	TargetPort uint32     `json:"target_port,omitempty"`
}

type FsOperation string

const (
	FsOpReadFile         FsOperation = "read_file"
	FsOpWriteFile        FsOperation = "write_file"
	FsOpApplyUnifiedDiff FsOperation = "apply_unified_diff"
	FsOpListDir          FsOperation = "list_dir"
	FsOpStat             FsOperation = "stat"
	FsOpDelete           FsOperation = "delete"
)

type FsRequest struct {
	RequestID string       `json:"request_id"`
	ProjectID string       `json:"project_id"`
	Tier      AutonomyTier `json:"tier"`
	Operation FsOperation  `json:"operation"`
	Path      string       `json:"path"`
	Content   []byte       `json:"content,omitempty"`
	Diff      string       `json:"diff,omitempty"`
	FileMode  string       `json:"file_mode,omitempty"`
}

type FsEntry struct {
	Name    string `json:"name"`
	Path    string `json:"path"`
	IsDir   bool   `json:"is_dir"`
	Size    int64  `json:"size"`
	ModTime int64  `json:"mod_time"`
	Mode    string `json:"mode"`
}

type FsResponse struct {
	RequestID string    `json:"request_id"`
	Success   bool      `json:"success"`
	Error     string    `json:"error,omitempty"`
	Content   []byte    `json:"content,omitempty"`
	Entries   []FsEntry `json:"entries,omitempty"`
}

type PtyExecRequest struct {
	CmdID         string            `json:"cmd_id"`
	SessionID     string            `json:"session_id"`
	ProjectID     string            `json:"project_id"`
	Tier          AutonomyTier      `json:"tier"`
	Command       string            `json:"command"`
	WaitTimeoutMs uint32            `json:"wait_timeout_ms"`
	Secrets       map[string]string `json:"secrets,omitempty"`
	Cols          uint16            `json:"cols,omitempty"`
	Rows          uint16            `json:"rows,omitempty"`
	SendSignal    string            `json:"send_signal,omitempty"`
}

type PtyExecResponse struct {
	CmdID              string `json:"cmd_id"`
	SessionID          string `json:"session_id"`
	Output             string `json:"output"`
	ExitCode           int    `json:"exit_code"`
	Cwd                string `json:"cwd"`
	TimedOut           bool   `json:"timed_out"`
	Truncated          bool   `json:"truncated"`
	FullLogPath        string `json:"full_log_path,omitempty"`
	BlockedByGuardrail bool   `json:"blocked_by_guardrail"`
	GuardrailReason    string `json:"guardrail_reason,omitempty"`
}

type PtySessionMeta struct {
	SessionID  string `json:"session_id"`
	Cwd        string `json:"cwd"`
	RunningCmd string `json:"running_cmd,omitempty"`
}

// PtyLiveFrame is sent over interactive PTY mirroring streams for xterm.js
type PtyLiveFrame struct {
	SessionID string `json:"session_id"`
	Type      string `json:"type"` // "data", "resize", "input"
	Data      []byte `json:"data,omitempty"`
	Cols      uint16 `json:"cols,omitempty"`
	Rows      uint16 `json:"rows,omitempty"`
}

type ServiceHealthTarget struct {
	ServiceID      string `json:"service_id"`
	Name           string `json:"name"`
	Protocol       string `json:"protocol"` // "tcp", "http", "exec"
	Port           uint32 `json:"port"`
	Path           string `json:"path,omitempty"`
	Target         string `json:"target,omitempty"`
	IntervalSec    uint32 `json:"interval_sec,omitempty"`
	AutoDiscovered bool   `json:"auto_discovered,omitempty"`
	ProcessName    string `json:"process_name,omitempty"`
	ContainerName  string `json:"container_name,omitempty"`
	Category       string `json:"category,omitempty"`
}

type ServiceHealthStatus struct {
	ServiceID      string `json:"service_id"`
	Name           string `json:"name"`
	Port           uint32 `json:"port"`
	Healthy        bool   `json:"healthy"`
	StatusCode     int    `json:"status_code,omitempty"`
	LatencyMs      int64  `json:"latency_ms"`
	LastError      string `json:"last_error,omitempty"`
	AutoDiscovered bool   `json:"auto_discovered,omitempty"`
	ProcessName    string `json:"process_name,omitempty"`
	ContainerName  string `json:"container_name,omitempty"`
	Category       string `json:"category,omitempty"`
}

type TelemetrySample struct {
	TimestampUnix int64   `json:"ts"`
	CPUPercent    float64 `json:"cpu"`
	RAMPercent    float64 `json:"ram"`
	DiskPercent   float64 `json:"disk"`
	AvgLatencyMs  int64   `json:"latency_ms"`
}

type NodeHeartbeat struct {
	NodeID            string                `json:"node_id"`
	Hostname          string                `json:"hostname"`
	OSArch            string                `json:"os_arch"`
	OSInfo            string                `json:"os_info,omitempty"`
	PrivateIPv4       string                `json:"private_ipv4,omitempty"`
	PublicIPv4        string                `json:"public_ipv4,omitempty"`
	Tier              AutonomyTier          `json:"tier"`
	CPUPercent        float64               `json:"cpu_percent"`
	RAMPercent        float64               `json:"ram_percent"`
	RAMUsedBytes      uint64                `json:"ram_used_bytes"`
	RAMTotalBytes     uint64                `json:"ram_total_bytes"`
	DiskPercent       float64               `json:"disk_percent"`
	DiskUsedBytes     uint64                `json:"disk_used_bytes"`
	DiskTotalBytes    uint64                `json:"disk_total_bytes"`
	LoadAvg1          float64               `json:"load_avg_1,omitempty"`
	UptimeSec         uint64                `json:"uptime_sec,omitempty"`
	TimestampUnix     int64                 `json:"timestamp_unix"`
	Services          []ServiceHealthStatus `json:"services"`
	TelemetryHistory  []TelemetrySample     `json:"telemetry_history,omitempty"`
	ActivePtySessions []string              `json:"active_pty_sessions"`
	PtySessionDetails []PtySessionMeta      `json:"pty_session_details,omitempty"`
}

type CSRBootstrapRequest struct {
	JoinToken string       `json:"join_token"`
	NodeID    string       `json:"node_id"`
	Hostname  string       `json:"hostname"`
	CSRPerm   []byte       `json:"csr_pem"`
	Tier      AutonomyTier `json:"tier"`
}

type CSRBootstrapResponse struct {
	Success    bool   `json:"success"`
	Error      string `json:"error,omitempty"`
	NodeID     string `json:"node_id"`
	CertPEM    []byte `json:"cert_pem"`
	CACertPEM  []byte `json:"ca_cert_pem"`
	TunnelPort int    `json:"tunnel_port"`
}

const MaxFrameSize = 32 * 1024 * 1024 // 32 MB

// WriteFrame writes a length-prefixed JSON wire frame to w in a single contiguous buffer write.
func WriteFrame(w io.Writer, msg any) error {
	payload, err := json.Marshal(msg)
	if err != nil {
		return fmt.Errorf("marshal frame: %w", err)
	}
	if len(payload) > MaxFrameSize {
		return fmt.Errorf("frame size %d exceeds maximum %d", len(payload), MaxFrameSize)
	}
	frame := make([]byte, 4+len(payload))
	binary.BigEndian.PutUint32(frame[:4], uint32(len(payload)))
	copy(frame[4:], payload)
	written := 0
	for written < len(frame) {
		n, err := w.Write(frame[written:])
		if err != nil {
			return fmt.Errorf("write frame: %w", err)
		}
		if n <= 0 {
			return io.ErrShortWrite
		}
		written += n
	}
	return nil
}

// ReadFrame reads a length-prefixed JSON wire frame from r into dst.
func ReadFrame(r io.Reader, dst any) error {
	var lenBuf [4]byte
	if _, err := io.ReadFull(r, lenBuf[:]); err != nil {
		return err
	}
	size := binary.BigEndian.Uint32(lenBuf[:])
	if size > MaxFrameSize {
		return fmt.Errorf("incoming frame size %d exceeds maximum %d", size, MaxFrameSize)
	}
	payload := make([]byte, size)
	if _, err := io.ReadFull(r, payload); err != nil {
		return fmt.Errorf("read frame payload: %w", err)
	}
	if err := json.Unmarshal(payload, dst); err != nil {
		return fmt.Errorf("unmarshal frame: %w", err)
	}
	return nil
}
