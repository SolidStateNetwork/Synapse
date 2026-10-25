// Generated TypeScript types matching proto/tunnel.proto

export enum StreamType {
  UNSPECIFIED = 0,
  RPC_FS = 1,
  PTY = 2,
  PORT_FORWARD = 3,
  TELEMETRY = 4,
}

export type AutonomyTier =
  | "TIER_1_UNLEASHED"
  | "TIER_2_WORKSPACE_JAIL"
  | "TIER_3_SUPERVISED";

export type FsOperation =
  | "read_file"
  | "write_file"
  | "apply_unified_diff"
  | "list_dir"
  | "stat"
  | "delete";

export interface FsRequest {
  request_id: string;
  project_id: string;
  tier: AutonomyTier;
  operation: FsOperation;
  path: string;
  content?: string; // base64 encoded when sent over JSON API
  diff?: string;
  file_mode?: string;
}

export interface FsEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  mod_time: number;
  mode: string;
}

export interface FsResponse {
  request_id: string;
  success: boolean;
  error?: string;
  content?: string;
  entries?: FsEntry[];
}

export interface PtyExecRequest {
  cmd_id: string;
  session_id: string;
  project_id: string;
  tier: AutonomyTier;
  command: string;
  wait_timeout_ms: number;
  secrets?: Record<string, string>;
  cols?: number;
  rows?: number;
  send_signal?: "NONE" | "SIGINT" | "SIGTERM" | "SIGKILL";
}

export interface PtyExecResponse {
  cmd_id: string;
  session_id: string;
  output: string;
  exit_code: number;
  cwd: string;
  timed_out: boolean;
  truncated: boolean;
  full_log_path?: string;
  blocked_by_guardrail: boolean;
  guardrail_reason?: string;
}

export interface PtySessionMeta {
  session_id: string;
  cwd: string;
  running_cmd?: string | null;
}

export interface ServiceHealthStatus {
  service_id: string;
  name: string;
  port: number;
  healthy: boolean;
  status_code?: number;
  latency_ms: number;
  last_error?: string;
}

export interface NodeHeartbeat {
  node_id: string;
  hostname: string;
  os_arch: string;
  os_info?: string;
  private_ipv4?: string;
  public_ipv4?: string;
  tier: AutonomyTier;
  cpu_percent: number;
  ram_percent: number;
  ram_used_bytes: number;
  ram_total_bytes: number;
  disk_percent: number;
  disk_used_bytes: number;
  disk_total_bytes: number;
  timestamp_unix: number;
  services: ServiceHealthStatus[];
  active_pty_sessions: string[];
  pty_session_details?: PtySessionMeta[];
}
