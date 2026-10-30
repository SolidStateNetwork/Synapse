export type AutonomyTier =
  | "TIER_1_UNLEASHED"
  | "TIER_2_WORKSPACE_JAIL"
  | "TIER_3_SUPERVISED";

export type FlowView = "peers" | "ai-agent" | "groups" | "networks";

export interface HeartbeatServiceStatus {
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
}

export interface TelemetrySample {
  ts: number;
  cpu: number;
  ram: number;
  disk: number;
  latency_ms: number;
}

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
  disk_percent: number;
  load_avg_1?: number;
  uptime_sec?: number;
  services?: HeartbeatServiceStatus[];
  telemetry_history?: TelemetrySample[];
  active_pty_sessions: string[];
  active_cores?: number;
  connected_cores?: string[];
  timestamp_unix: number;
}

export interface GatewayNode {
  node_id: string;
  tier: AutonomyTier;
  remote_addr: string;
  connected_at: string;
  online: boolean;
  last_heartbeat?: NodeHeartbeat;
}

export interface CartridgeMeta {
  id: string;
  name: string;
  description: string;
  category: string;
  content: string;
}

export interface RegisteredService {
  service_id: string;
  node_id: string;
  name: string;
  category?: "webui" | "backend" | "database" | "worker";
  description?: string;
  db_path?: string;
  latency_ms?: number;
  auto_discovered?: boolean;
  process_name?: string;
  container_name?: string;
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
    latency_ms?: number;
    last_error?: string;
  };
}

export interface CheckpointItem {
  id: string;
  node_id: string;
  timestamp: string;
  title: string;
  actor: string;
  summary: string;
  files_backed_up: string[];
  services_snapshot: Array<{
    service_id: string;
    name: string;
    port: number;
    healthy: boolean;
  }>;
  restored_at?: string;
  last_restore_output?: string;
}

export interface AlertEventItem {
  id: string;
  timestamp: string;
  severity: "CRITICAL" | "WARNING" | "INFO" | "RESOLVED";
  title: string;
  message: string;
  node_id?: string;
  dispatched_to: string[];
}

export interface AlertConfigState {
  enabled: boolean;
  telegram_enabled: boolean;
  telegram_bot_token: string;
  telegram_chat_id: string;
  discord_enabled: boolean;
  discord_webhook_url: string;
  webhook_enabled: boolean;
  webhook_url: string;
  cpu_threshold: number;
  ram_threshold: number;
  disk_threshold: number;
  auto_heal_services: boolean;
  events: AlertEventItem[];
}

export interface ServiceMeshLink {
  id: string;
  fromServiceId: string;
  toServiceId: string;
  protocol: string;
  latency_ms?: number;
  healthy?: boolean;
  last_probed_at?: string;
}

export interface BlueprintItem {
  id: string;
  name: string;
  category: "webui" | "backend" | "database";
  port: number;
  container_name: string;
  description: string;
  secret_key_prefix: string;
}

export interface OffsiteBackupItem {
  id: string;
  node_id: string;
  timestamp: string;
  title: string;
  size_bytes: number;
  sha256: string;
  encrypted_file: string;
  restored_at?: string;
}

export interface DomainBindingItem {
  service_id: string;
  domain: string;
  auto_tls: boolean;
  target_port: number;
  node_id: string;
  updated_at: string;
}

export interface IntrusionScanState {
  failed_count_24h: number;
  accepted_count_24h: number;
  top_attackers: Array<{ ip: string; attempts: number }>;
  blocked_ips: string[];
}

export interface SelfHealingEventItem {
  id: string;
  node_id: string;
  service_id: string;
  service_name: string;
  port: number;
  trigger:
    | "auto_watchdog"
    | "quick_restart"
    | "crash_simulation"
    | "latency_threshold";
  status: "HEALING" | "RECOVERED" | "FAILED";
  mttr_ms: number;
  http_status: number;
  latency_ms: number;
  log_snapshot: string[];
  runbook_steps: Array<{ step: string; detail: string; elapsed_ms: number }>;
  timestamp: string;
}

export interface ChaosResultState {
  mttr_ms: number;
  recovered: boolean;
  steps: Array<{ step: string; detail: string; elapsed_ms: number }>;
}

export interface InteractiveControlCenterCanvasProps {
  flowView: FlowView;
  gatewayNodes: GatewayNode[];
  primaryNode: string;
  activeCartridges: string[];
  cartridges: CartridgeMeta[];
  registeredServices: RegisteredService[];
  secretKeysCount: number;
  modelName: string;
  baseUrl: string;
  joinTier: AutonomyTier;
  onSelectNode: (nodeId: string) => void;
  onToggleCartridge: (cartridgeId: string) => void;
  onOpenAddPeer: () => void;
  onOpenPty: () => void;
  onOpenAiSettings: () => void;
  onOpenBrainDoc: (doc: "Architecture.md" | "Memory.md") => void;
  onOpenSecretsVault: () => void;
  onOpenReverseProxy: (port?: number) => void;
  onOpenAccessControl: () => void;
  onOpenRemoteFiles: () => void;
  onDeployDemoService: () => void;
  onHealService: (port: number) => void;
  firewallPolicies?: Record<
    string,
    {
      profile: "web_standard" | "synapse_stealth" | "custom";
      shielded_ports?: number[];
      detected_ports?: Array<{ port: number; shielded?: boolean }>;
      ip_rules?: unknown[];
    }
  >;
  onOpenFirewall?: (nodeId?: string) => void;
  onOpenSettings?: (tab?: string) => void;
}

export interface CanvasPos {
  x: number;
  y: number;
}

export interface CanvasEdge {
  id: string;
  from: string;
  to: string;
  color: string;
  active: boolean;
}

export type InspectedTarget =
  | { kind: "peer"; nodeId: string }
  | { kind: "core" }
  | { kind: "service"; serviceId: string }
  | null;
