export type AutonomyTier =
  | "TIER_1_UNLEASHED"
  | "TIER_2_WORKSPACE_JAIL"
  | "TIER_3_SUPERVISED";

export type NavSection =
  | "control-center"
  | "peers"
  | "firewall"
  | "access-control"
  | "reverse-proxy"
  | "brain-vault"
  | "workspace"
  | "activity"
  | "settings";

export type FlowView = "peers" | "ai-agent" | "groups" | "networks";

export interface NodeHeartbeat {
  node_id: string;
  hostname: string;
  os_arch: string;
  os_info?: string;
  public_ipv4?: string;
  private_ipv4?: string;
  tier: AutonomyTier;
  cpu_percent: number;
  ram_percent: number;
  ram_used_bytes: number;
  ram_total_bytes: number;
  disk_percent: number;
  active_pty_sessions: string[];
  pty_session_details?: Array<{
    session_id: string;
    cwd: string;
    running_cmd?: string | null;
  }>;
  load_avg_1?: number;
  uptime_sec?: number;
  telemetry_history?: Array<{
    ts: number;
    cpu: number;
    ram: number;
    disk: number;
    latency_ms: number;
  }>;
  services?: Array<{
    service_id: string;
    name: string;
    port: number;
    protocol?: string;
    healthy: boolean;
    status_code?: number;
    latency_ms?: number;
    last_error?: string;
    auto_discovered?: boolean;
    process_name?: string;
    container_name?: string;
    category?: string;
  }>;
  active_cores?: number;
  connected_cores?: string[];
  timestamp_unix: number;
}

export interface PendingApproval {
  approval_id: string;
  created_at: string;
  tool_name: string;
  node_id: string;
  arguments: Record<string, unknown>;
  status: "pending" | "approved" | "rejected";
}

export interface AIProviderSettings {
  provider: string;
  base_url: string;
  model: string;
  api_key_secret_name: string;
  enable_prompt_caching?: boolean;
  enable_auto_watchdog?: boolean;
}

export interface FirewallDetectedPort {
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

export interface NodeFirewallPolicyState {
  node_id: string;
  profile: "web_standard" | "synapse_stealth" | "custom";
  backend?: string;
  anti_lockout_active: boolean;
  rollback_guard_seconds: number;
  ssh_port: number;
  shielded_ports: number[];
  ip_rules: FirewallIpRule[];
  detected_ports?: FirewallDetectedPort[];
  last_synced_at: string;
}

export interface ProjectState {
  project_id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
  planning_only: boolean;
  assigned_nodes: Array<{
    node_id: string;
    tier: AutonomyTier;
    online: boolean;
    hostname?: string;
    os_arch?: string;
    os_info?: string;
    last_seen_unix?: number;
  }>;
  active_cartridges: string[];
  registered_services: Array<{
    service_id: string;
    node_id: string;
    name: string;
    category?: "webui" | "backend" | "database" | "worker";
    description?: string;
    db_path?: string;
    endpoints?: Array<{
      id: string;
      label: string;
      method: "GET" | "POST" | "PUT" | "DELETE" | "SQL";
      path: string;
      description?: string;
      sample_payload?: string;
    }>;
    port: number;
    protocol: "http" | "tcp";
    path?: string;
    healthy?: boolean;
    health_check?: {
      type: "HTTP" | "TCP" | "SYSTEMD" | "EXEC";
      target: string;
      interval_sec: number;
      status: "HEALTHY" | "UNHEALTHY" | "UNKNOWN";
      last_checked?: string;
      last_error?: string;
    };
    auto_discovered?: boolean;
    process_name?: string;
    container_name?: string;
    auto_heal?: boolean;
  }>;
  dismissed_services?: string[];
  active_pty_sessions: string[];
  telemetry: Record<string, NodeHeartbeat>;
  pending_approvals: PendingApproval[];
  ai_settings?: AIProviderSettings;
  peer_mesh_links?: Array<{
    link_id: string;
    source_node_id: string;
    target_node_id: string;
    target_port?: number;
    remote_port?: number;
    local_port?: number;
    protocol: "tcp" | "http";
    alias_env?: string;
    description?: string;
    created_at: string;
  }>;
  scheduled_playbooks?: Array<{
    playbook_id: string;
    name: string;
    cron?: string;
    cron_expression?: string;
    prompt: string;
    target_node_id?: string;
    enabled: boolean;
    last_run_at?: string;
    last_status?: string;
  }>;
  mcp_api_keys?: Array<{
    key_id: string;
    name: string;
    token_prefix: string;
    scopes: Array<"read" | "execute" | "admin">;
    created_at: string;
    last_used_at?: string;
  }>;
  firewall_policies?: Record<string, NodeFirewallPolicyState>;
}

export interface StackBlueprint {
  id: string;
  name: string;
  category: string;
  description: string;
  cartridges?: string[];
  recommendedCartridges?: string[];
  prompt?: string;
  promptCommand?: string;
}

export interface AuditEntry {
  timestamp: string;
  actor: "ai" | "user" | "policy_interceptor";
  tool_name: string;
  node_id?: string;
  status:
    | "executed"
    | "blocked"
    | "requires_approval"
    | "approved"
    | "rejected"
    | "error";
  summary: string;
  args?: Record<string, unknown>;
}

export interface CartridgeMeta {
  id: string;
  name: string;
  description: string;
  category: string;
  content: string;
}

export interface GatewayNode {
  node_id: string;
  tier: AutonomyTier;
  remote_addr: string;
  connected_at: string;
  online: boolean;
  last_heartbeat?: NodeHeartbeat;
}

export interface FsEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  mode: string;
  mod_time_unix: number;
}

export interface ChatAttachment {
  id: string;
  name: string;
  mime_type: string;
  data_url: string;
  size_bytes?: number;
}

export interface PromptCacheMetrics {
  cached_tokens: number;
  prompt_tokens: number;
  completion_tokens?: number;
  tool_cache_hits: number;
  provider_cache_active: boolean;
}

export interface ToolResultItem {
  tool_name: string;
  status: string;
  output: unknown;
  cached?: boolean;
  rollback_snapshot_id?: string;
  rollback_path?: string;
}

export interface ChatItem {
  role: "user" | "assistant";
  content: string;
  attachments?: ChatAttachment[];
  thinking?: string;
  cacheMetrics?: PromptCacheMetrics;
  toolResults?: ToolResultItem[];
}

export const PROVIDER_PRESETS: Record<
  string,
  { label: string; defaultUrl: string; defaultModel: string }
> = {
  "openai-compatible": {
    label: "Custom OpenAI-Compatible (vLLM / LiteLLM / OpenAI)",
    defaultUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o",
  },
  openrouter: {
    label: "OpenRouter.ai",
    defaultUrl: "https://openrouter.ai/api/v1",
    defaultModel: "anthropic/claude-3.5-sonnet",
  },
  ollama: {
    label: "Ollama / Local vLLM",
    defaultUrl: "http://127.0.0.1:11434/v1",
    defaultModel: "llama3.1",
  },
  anthropic: {
    label: "Anthropic Messages API",
    defaultUrl: "https://api.anthropic.com/v1",
    defaultModel: "claude-3-5-sonnet-latest",
  },
  "synapse-autonomous": {
    label: "Synapse Deterministic Engine",
    defaultUrl: "builtin://synapse-core",
    defaultModel: "synapse-v1-deterministic",
  },
};
