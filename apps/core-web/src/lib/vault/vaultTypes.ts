import type { AutonomyTier, NodeHeartbeat } from "@proto/tunnel";

export interface AssignedNode {
  node_id: string;
  tier: AutonomyTier;
  hostname?: string;
  os_arch?: string;
  os_info?: string;
  status?: "ONLINE" | "OFFLINE";
  online?: boolean;
  last_seen_unix?: number;
  active_cores?: number;
  connected_cores?: string[];
  network?: {
    public_ipv4?: string | null;
    private_ipv4?: string;
  };
  active_pty_sessions?: Array<{
    session_id: string;
    cwd: string;
    running_cmd?: string | null;
  }>;
}

export interface ServiceHealthCheckSpec {
  type: "HTTP" | "TCP" | "EXEC";
  target: string;
  interval_sec: number;
  status?: "HEALTHY" | "UNHEALTHY";
  last_checked?: string;
  last_error?: string;
}

export interface ServiceEndpointAction {
  id: string;
  label: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "SQL";
  path: string;
  description?: string;
  sample_payload?: string;
}

export interface RegisteredService {
  service_id: string;
  name: string;
  node_id: string;
  category?: "webui" | "backend" | "database" | "worker";
  description?: string;
  db_path?: string;
  endpoints?: ServiceEndpointAction[];
  runtime?: "docker" | "systemd" | "pm2" | "binary";
  unit_or_container?: string;
  bind_address?: string;
  protocol: "http" | "tcp" | "exec";
  port: number;
  path?: string;
  enable_preview_tunnel?: boolean;
  auto_heal?: boolean;
  consecutive_failures?: number;
  last_auto_heal_at?: string;
  health_check?: ServiceHealthCheckSpec;
  healthy?: boolean;
  registered_at: string;
}

export interface ChatAttachment {
  id: string;
  name: string;
  mime_type: string;
  data_url: string;
  size_bytes?: number;
}

export interface FileRollbackSnapshot {
  snapshot_id: string;
  node_id: string;
  path: string;
  existed: boolean;
  previous_content: string;
  file_mode?: string;
  created_at: string;
}

export interface PromptCacheMetrics {
  cached_tokens: number;
  prompt_tokens: number;
  completion_tokens?: number;
  tool_cache_hits: number;
  provider_cache_active: boolean;
}

export interface PendingApproval {
  approval_id: string;
  tool_name: string;
  node_id: string;
  arguments: Record<string, unknown>;
  created_at: string;
  status: "pending" | "approved" | "rejected";
}

export interface PeerMeshLink {
  link_id: string;
  source_node_id: string;
  target_node_id: string;
  local_port: number;
  remote_port: number;
  target_port?: number;
  protocol: "tcp" | "http";
  alias_env?: string;
  description?: string;
  created_at: string;
}

export interface ScheduledPlaybook {
  playbook_id: string;
  name: string;
  cron_expression: string;
  cron?: string;
  prompt: string;
  target_node_id?: string;
  enabled: boolean;
  last_run_at?: string;
  last_status?: string;
}

export interface AIProviderSettings {
  provider: string; // "openai-compatible" | "openrouter" | "ollama" | "anthropic" | "synapse-autonomous"
  base_url: string;
  model: string;
  api_key_secret_name?: string;
  enable_prompt_caching?: boolean;
  enable_auto_watchdog?: boolean;
  custom_headers?: Record<string, string>;
}

export interface McpApiKey {
  key_id: string;
  name: string;
  token_prefix: string;
  token_sha256: string;
  scopes: Array<"read" | "execute" | "admin">;
  created_at: string;
  last_used_at?: string;
}

export interface FirewallPortItem {
  port: number;
  protocol: "tcp" | "udp";
  bind_address: string;
  exposure: "public" | "local";
  process: string;
  pid?: number;
  service_name?: string;
  shielded: boolean;
  system_protected?: boolean;
}

export interface FirewallIpRule {
  rule_id: string;
  ip_or_cidr: string;
  action: "allow" | "block";
  port?: number | null;
  protocol?: "tcp" | "udp" | "any";
  note?: string;
  created_at: string;
}

export interface FirewallNodePolicy {
  node_id: string;
  profile: "web_standard" | "synapse_stealth" | "custom";
  backend?: string;
  anti_lockout_active: boolean;
  rollback_guard_seconds: number;
  ssh_port: number;
  shielded_ports: number[];
  ip_rules: FirewallIpRule[];
  detected_ports?: FirewallPortItem[];
  last_synced_at: string;
}

export interface ProjectState {
  project_id: string;
  name: string;
  description: string;
  planning_only: boolean;
  assigned_nodes: AssignedNode[];
  active_cartridges: string[];
  registered_services: RegisteredService[];
  dismissed_services?: string[];
  peer_mesh_links?: PeerMeshLink[];
  scheduled_playbooks?: ScheduledPlaybook[];
  mcp_api_keys?: McpApiKey[];
  firewall_policies?: Record<string, FirewallNodePolicy>;
  active_pty_sessions: string[];
  telemetry: Record<string, NodeHeartbeat>;
  pending_approvals: PendingApproval[];
  rollback_snapshots?: FileRollbackSnapshot[];
  ai_settings?: AIProviderSettings;
  created_at: string;
  updated_at: string;
}

export interface AuditEntry {
  timestamp: string;
  actor: "ai_orchestrator" | "user" | "policy_interceptor";
  tool_name: string;
  node_id?: string;
  status:
    | "executed"
    | "paused_tier3"
    | "approved"
    | "rejected"
    | "blocked_planning_mode"
    | "error";
  summary: string;
  args?: Record<string, unknown>;
}
