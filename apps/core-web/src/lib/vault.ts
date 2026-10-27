import crypto from "crypto";
import fs from "fs";
import path from "path";
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
  protocol: "tcp" | "http";
  description?: string;
  created_at: string;
}

export interface ScheduledPlaybook {
  playbook_id: string;
  name: string;
  cron_expression: string;
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

export interface ProjectState {
  project_id: string;
  name: string;
  description: string;
  planning_only: boolean;
  assigned_nodes: AssignedNode[];
  active_cartridges: string[];
  registered_services: RegisteredService[];
  peer_mesh_links?: PeerMeshLink[];
  scheduled_playbooks?: ScheduledPlaybook[];
  mcp_api_keys?: McpApiKey[];
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

function resolveVaultBaseDir(): string {
  const configured =
    process.env.SYNAPSE_VAULT_DIR || "/var/lib/synapse/projects";
  try {
    fs.mkdirSync(configured, { recursive: true });
    fs.accessSync(configured, fs.constants.W_OK);
    return configured;
  } catch {
    const fallback = path.join(process.cwd(), ".synapse-data", "projects");
    fs.mkdirSync(fallback, { recursive: true });
    return fallback;
  }
}

function getMasterKey(): Buffer {
  const rawKey =
    process.env.SYNAPSE_MASTER_KEY ||
    "synapse-default-aes-256-gcm-master-secret-key-2026";
  return crypto.createHash("sha256").update(rawKey).digest();
}

export function encryptSecretsMap(secrets: Record<string, string>): string {
  const key = getMasterKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(secrets), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return JSON.stringify({
    alg: "AES-256-GCM",
    iv: iv.toString("hex"),
    tag: authTag.toString("hex"),
    ciphertext: encrypted.toString("base64"),
  });
}

export function decryptSecretsMap(rawEnc: string): Record<string, string> {
  if (!rawEnc || !rawEnc.trim()) {
    return {};
  }
  try {
    const parsed = JSON.parse(rawEnc);
    const key = getMasterKey();
    const iv = Buffer.from(parsed.iv, "hex");
    const tag = Buffer.from(parsed.tag, "hex");
    const ciphertext = Buffer.from(parsed.ciphertext, "base64");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return JSON.parse(decrypted.toString("utf8"));
  } catch {
    return {};
  }
}

export function sanitizeProjectId(id: string): string {
  const cleaned = id.toLowerCase().replace(/[^a-z0-9-_]/g, "-");
  return cleaned || "default-project";
}

export function getProjectDir(projectId: string): string {
  const base = resolveVaultBaseDir();
  return path.join(base, sanitizeProjectId(projectId));
}

export function ensureProjectVault(
  projectId: string,
  name?: string,
  description?: string
): ProjectState {
  const cleanId = sanitizeProjectId(projectId);
  const dir = getProjectDir(cleanId);
  fs.mkdirSync(dir, { recursive: true });

  const archPath = path.join(dir, "Architecture.md");
  const statePath = path.join(dir, "State.json");
  const memPath = path.join(dir, "Memory.md");
  const secPath = path.join(dir, "Secrets.enc");
  const auditPath = path.join(dir, "Audit.jsonl");

  if (!fs.existsSync(archPath)) {
    const defaultArch = `# System Architecture — ${name || cleanId}

\`\`\`mermaid
flowchart LR
    Core["Synapse Core Brain\n(Control Plane)"] ===|"mTLS + Yamux Tunnel"| Node["Axon Muscle Node\n(/opt/axon/workspaces/${cleanId})"]
    Node --> App["127.0.0.1:3000\nApplication Service"]
\`\`\`

## Remote File Layout
- \`/opt/axon/workspaces/${cleanId}/\` — Primary project workspace on assigned Axon Muscle Node(s).
`;
    fs.writeFileSync(archPath, defaultArch, "utf8");
  }

  if (!fs.existsSync(memPath)) {
    const defaultMem = `# Engineering Journal & Memory — ${name || cleanId}

- **[${new Date().toISOString()}]** Project Brain Vault initialized on Synapse Core.
`;
    fs.writeFileSync(memPath, defaultMem, "utf8");
  }

  if (!fs.existsSync(secPath)) {
    fs.writeFileSync(secPath, encryptSecretsMap({}), {
      encoding: "utf8",
      mode: 0o600,
    });
  }

  if (!fs.existsSync(auditPath)) {
    const initAudit: AuditEntry = {
      timestamp: new Date().toISOString(),
      actor: "user",
      tool_name: "vault_init",
      status: "executed",
      summary: `Initialized Project Brain Vault for ${cleanId}`,
    };
    fs.writeFileSync(auditPath, JSON.stringify(initAudit) + "\n", "utf8");
  }

  if (fs.existsSync(statePath)) {
    try {
      const existing = JSON.parse(
        fs.readFileSync(statePath, "utf8")
      ) as ProjectState;
      existing.planning_only = (existing.assigned_nodes || []).length === 0;
      return existing;
    } catch {
      // Fall through to recreate default state
    }
  }

  const now = new Date().toISOString();
  const initialState: ProjectState = {
    project_id: cleanId,
    name: name || cleanId,
    description:
      description ||
      "Distributed AI DevOps project managed via Synapse Brain & Muscle architecture.",
    planning_only: true,
    assigned_nodes: [],
    active_cartridges: ["docker-first", "zero-trust-networking"],
    registered_services: [],
    peer_mesh_links: [],
    scheduled_playbooks: [
      {
        playbook_id: "pb-nightly-health",
        name: "Nightly Disk & Container Hygiene",
        cron_expression: "0 3 * * *",
        prompt:
          "Check disk utilization, prune dangling container logs, and record a summary in Memory.md.",
        enabled: true,
        last_status: "Scheduled (03:00 UTC)",
      },
      {
        playbook_id: "pb-security-audit",
        name: "Weekly Zero-Trust Port Audit",
        cron_expression: "0 9 * * 1",
        prompt:
          "Verify all listening ports bind to 127.0.0.1 and update Architecture.md.",
        enabled: true,
        last_status: "Scheduled (Mon 09:00 UTC)",
      },
    ],
    active_pty_sessions: [],
    telemetry: {},
    pending_approvals: [],
    rollback_snapshots: [],
    ai_settings: {
      provider: "openai-compatible",
      base_url: "https://api.openai.com/v1",
      model: "gpt-4o",
      api_key_secret_name: "LLM_API_KEY",
      enable_prompt_caching: true,
      enable_auto_watchdog: true,
    },
    created_at: now,
    updated_at: now,
  };

  atomicWriteJsonSync(statePath, initialState);
  return initialState;
}

function atomicWriteJsonSync(targetPath: string, data: unknown): void {
  const dir = path.dirname(targetPath);
  fs.mkdirSync(dir, { recursive: true });
  const tmpPath = path.join(
    dir,
    `.state-tmp-${process.pid}-${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}.json`
  );
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tmpPath, targetPath);
}

export function listProjects(): ProjectState[] {
  const base = resolveVaultBaseDir();
  const entries = fs.readdirSync(base, { withFileTypes: true });
  const projects: ProjectState[] = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      projects.push(ensureProjectVault(entry.name));
    }
  }
  if (projects.length === 0) {
    projects.push(
      ensureProjectVault(
        "synapse-cloud-demo",
        "Synapse Cloud Demo",
        "Reference Full-Stack Microservice orchestrated via Axon mTLS Muscle Nodes."
      )
    );
  }
  return projects;
}

export function saveProjectState(state: ProjectState): ProjectState {
  const dir = getProjectDir(state.project_id);
  fs.mkdirSync(dir, { recursive: true });
  state.planning_only = (state.assigned_nodes || []).length === 0;
  state.updated_at = new Date().toISOString();
  atomicWriteJsonSync(path.join(dir, "State.json"), state);
  return state;
}

export function recordRollbackSnapshot(
  projectId: string,
  snapshot: FileRollbackSnapshot
): FileRollbackSnapshot {
  const state = ensureProjectVault(projectId);
  const existing = state.rollback_snapshots || [];
  state.rollback_snapshots = [snapshot, ...existing].slice(0, 35);
  saveProjectState(state);
  return snapshot;
}

export function getRollbackSnapshot(
  projectId: string,
  snapshotId: string
): FileRollbackSnapshot | undefined {
  const state = ensureProjectVault(projectId);
  return (state.rollback_snapshots || []).find(
    (s) => s.snapshot_id === snapshotId
  );
}

export function readBrainDoc(
  projectId: string,
  doc: "Architecture.md" | "Memory.md"
): string {
  ensureProjectVault(projectId);
  const filePath = path.join(getProjectDir(projectId), doc);
  return fs.readFileSync(filePath, "utf8");
}

export function writeBrainDoc(
  projectId: string,
  doc: "Architecture.md" | "Memory.md",
  content: string,
  mode:
    | "overwrite"
    | "overwrite_full"
    | "append"
    | "replace_section" = "overwrite",
  sectionHeader?: string
): string {
  ensureProjectVault(projectId);
  const filePath = path.join(getProjectDir(projectId), doc);
  const existing = fs.existsSync(filePath)
    ? fs.readFileSync(filePath, "utf8")
    : "";

  if (mode === "append") {
    const next = existing.endsWith("\n")
      ? `${existing}${content}\n`
      : `${existing}\n${content}\n`;
    fs.writeFileSync(filePath, next, "utf8");
    return next;
  }

  if (mode === "replace_section" && sectionHeader && sectionHeader.trim()) {
    const lines = existing.split("\n");
    const targetHeader = sectionHeader
      .trim()
      .replace(/^#+\s*/, "")
      .toLowerCase();
    let startIdx = -1;
    let startLevel = 2;

    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/^(#{1,6})\s+(.*)$/);
      if (m) {
        const headingText = m[2].trim().toLowerCase();
        if (
          headingText === targetHeader ||
          lines[i].trim().toLowerCase() === sectionHeader.trim().toLowerCase()
        ) {
          startIdx = i;
          startLevel = m[1].length;
          break;
        }
      }
    }

    if (startIdx !== -1) {
      let endIdx = lines.length;
      for (let j = startIdx + 1; j < lines.length; j++) {
        const m = lines[j].match(/^(#{1,6})\s+/);
        if (m && m[1].length <= startLevel) {
          endIdx = j;
          break;
        }
      }
      const headerLine = content.trim().startsWith("#")
        ? content.trim()
        : `${lines[startIdx]}\n\n${content.trim()}`;
      const updatedLines = [
        ...lines.slice(0, startIdx),
        headerLine,
        "",
        ...lines.slice(endIdx),
      ];
      const next = updatedLines.join("\n");
      fs.writeFileSync(filePath, next, "utf8");
      return next;
    } else {
      const prefixHeader = sectionHeader.trim().startsWith("#")
        ? sectionHeader.trim()
        : `## ${sectionHeader.trim()}`;
      const next = `${existing.trimEnd()}\n\n${prefixHeader}\n\n${content.trim()}\n`;
      fs.writeFileSync(filePath, next, "utf8");
      return next;
    }
  }

  fs.writeFileSync(filePath, content, "utf8");
  return content;
}

export function generateRandomSecret(
  projectId: string,
  key: string,
  length = 32
): string[] {
  const safeLen = Math.max(8, Math.min(128, Number(length) || 32));
  const randomVal = crypto
    .randomBytes(Math.ceil(safeLen * 0.75))
    .toString("base64url")
    .slice(0, safeLen);
  return setSecret(projectId, key, randomVal);
}

export function listSecretKeys(projectId: string): string[] {
  ensureProjectVault(projectId);
  const secPath = path.join(getProjectDir(projectId), "Secrets.enc");
  const map = decryptSecretsMap(fs.readFileSync(secPath, "utf8"));
  return Object.keys(map).sort();
}

export function getDecryptedSecrets(projectId: string): Record<string, string> {
  ensureProjectVault(projectId);
  const secPath = path.join(getProjectDir(projectId), "Secrets.enc");
  return decryptSecretsMap(fs.readFileSync(secPath, "utf8"));
}

export function setSecret(
  projectId: string,
  key: string,
  value: string
): string[] {
  ensureProjectVault(projectId);
  const secPath = path.join(getProjectDir(projectId), "Secrets.enc");
  const current = decryptSecretsMap(fs.readFileSync(secPath, "utf8"));
  current[key.trim().toUpperCase()] = value;
  fs.writeFileSync(secPath, encryptSecretsMap(current), {
    encoding: "utf8",
    mode: 0o600,
  });
  return Object.keys(current).sort();
}

export function deleteSecret(projectId: string, key: string): string[] {
  ensureProjectVault(projectId);
  const secPath = path.join(getProjectDir(projectId), "Secrets.enc");
  const current = decryptSecretsMap(fs.readFileSync(secPath, "utf8"));
  delete current[key.trim().toUpperCase()];
  fs.writeFileSync(secPath, encryptSecretsMap(current), {
    encoding: "utf8",
    mode: 0o600,
  });
  return Object.keys(current).sort();
}

export function appendAuditLog(projectId: string, entry: AuditEntry): void {
  ensureProjectVault(projectId);
  const auditPath = path.join(getProjectDir(projectId), "Audit.jsonl");
  fs.appendFileSync(auditPath, JSON.stringify(entry) + "\n", "utf8");
}

export function readAuditLogs(projectId: string, limit = 100): AuditEntry[] {
  ensureProjectVault(projectId);
  const auditPath = path.join(getProjectDir(projectId), "Audit.jsonl");
  if (!fs.existsSync(auditPath)) {
    return [];
  }
  const lines = fs
    .readFileSync(auditPath, "utf8")
    .split("\n")
    .filter((l) => l.trim().length > 0);
  const parsed: AuditEntry[] = [];
  for (const line of lines.slice(-limit)) {
    try {
      parsed.push(JSON.parse(line));
    } catch {
      // Ignore malformed line
    }
  }
  return parsed.reverse();
}

export interface PersistedChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  attachments?: ChatAttachment[];
  thinking?: string;
  cacheMetrics?: PromptCacheMetrics;
  toolResults?: Array<{
    tool_name: string;
    status: string;
    output: unknown;
    approval_id?: string;
    cached?: boolean;
    rollback_snapshot_id?: string;
    rollback_path?: string;
  }>;
}

const DEFAULT_CONTROL_CENTER_WELCOME =
  "Welcome to **Synapse Control Center**. Your interactive overlay topology, Muscle Peers, `Rule Cartridges`, and `Brain Vault` are mapped on the main canvas.\n\n- **Drag & Drop Vision:** Drop screenshots, architecture diagrams, or log images (or paste with `Ctrl+V`) directly into this chat.\n- **Smart Context Mentions:** Type `@` to reference peers, services, or Brain Vault docs.\n- **Prompt & Tool Caching:** Static system layers and read-only file calls are automatically cached.";

export function readChatHistory(
  projectId: string,
  limit = 100
): PersistedChatMessage[] {
  ensureProjectVault(projectId);
  const chatPath = path.join(getProjectDir(projectId), "Chat.jsonl");
  if (!fs.existsSync(chatPath)) {
    const welcome: PersistedChatMessage = {
      role: "assistant",
      content: DEFAULT_CONTROL_CENTER_WELCOME,
      timestamp: new Date().toISOString(),
    };
    fs.writeFileSync(chatPath, JSON.stringify(welcome) + "\n", "utf8");
    return [welcome];
  }
  const lines = fs
    .readFileSync(chatPath, "utf8")
    .split("\n")
    .filter((l) => l.trim().length > 0);
  const out: PersistedChatMessage[] = [];
  let migratedLegacyWelcome = false;
  for (const line of lines.slice(-limit)) {
    try {
      const parsed = JSON.parse(line) as PersistedChatMessage;
      if (
        parsed.role === "assistant" &&
        typeof parsed.content === "string" &&
        parsed.content.includes("Synapse Studio")
      ) {
        parsed.content = DEFAULT_CONTROL_CENTER_WELCOME;
        migratedLegacyWelcome = true;
      }
      out.push(parsed);
    } catch {
      // ignore malformed line
    }
  }
  if (migratedLegacyWelcome) {
    fs.writeFileSync(
      chatPath,
      out.map((m) => JSON.stringify(m)).join("\n") + "\n",
      "utf8"
    );
  }
  return out;
}

export function appendChatMessage(
  projectId: string,
  msg: PersistedChatMessage
): void {
  ensureProjectVault(projectId);
  const chatPath = path.join(getProjectDir(projectId), "Chat.jsonl");
  fs.appendFileSync(chatPath, JSON.stringify(msg) + "\n", "utf8");
}

export function clearChatHistory(projectId: string): PersistedChatMessage[] {
  ensureProjectVault(projectId);
  const chatPath = path.join(getProjectDir(projectId), "Chat.jsonl");
  const resetMsg: PersistedChatMessage = {
    role: "assistant",
    content:
      "Conversation context compacted and cleared. Ready for new instructions (Prompt Cache & Vision active).",
    timestamp: new Date().toISOString(),
  };
  fs.writeFileSync(chatPath, JSON.stringify(resetMsg) + "\n", "utf8");
  return [resetMsg];
}

export function createMcpApiKey(
  projectId: string,
  name: string,
  scopes: Array<"read" | "execute" | "admin"> = ["read", "execute"]
): { key: McpApiKey; plaintext_token: string } {
  const state = ensureProjectVault(projectId);
  const randomSecret = crypto.randomBytes(24).toString("base64url");
  const plaintextToken = `syn_mcp_${randomSecret}`;
  const tokenSha256 = crypto
    .createHash("sha256")
    .update(plaintextToken)
    .digest("hex");

  const entry: McpApiKey = {
    key_id: `mcp-${Date.now().toString(36)}`,
    name: name.trim() || "External AI / MCP Client",
    token_prefix: `${plaintextToken.slice(0, 14)}...`,
    token_sha256: tokenSha256,
    scopes: scopes.length > 0 ? scopes : ["read", "execute"],
    created_at: new Date().toISOString(),
  };

  if (!Array.isArray(state.mcp_api_keys)) {
    state.mcp_api_keys = [];
  }
  state.mcp_api_keys.push(entry);
  saveProjectState(state);

  appendAuditLog(projectId, {
    timestamp: new Date().toISOString(),
    actor: "user",
    tool_name: "mcp_create_api_key",
    status: "executed",
    summary: `Created External AI / MCP API Token '${entry.name}' (${entry.token_prefix})`,
  });

  return { key: entry, plaintext_token: plaintextToken };
}

export function revokeMcpApiKey(projectId: string, keyId: string): McpApiKey[] {
  const state = ensureProjectVault(projectId);
  state.mcp_api_keys = (state.mcp_api_keys || []).filter(
    (k) => k.key_id !== keyId
  );
  saveProjectState(state);
  appendAuditLog(projectId, {
    timestamp: new Date().toISOString(),
    actor: "user",
    tool_name: "mcp_revoke_api_key",
    status: "executed",
    summary: `Revoked External AI / MCP API Token ${keyId}`,
  });
  return state.mcp_api_keys;
}

export function verifyMcpApiKey(
  projectId: string,
  rawToken: string
): McpApiKey | null {
  if (!rawToken || !rawToken.startsWith("syn_mcp_")) {
    return null;
  }
  const state = ensureProjectVault(projectId);
  const hash = crypto
    .createHash("sha256")
    .update(rawToken.trim())
    .digest("hex");
  const matched = (state.mcp_api_keys || []).find((k) => {
    try {
      return crypto.timingSafeEqual(
        Buffer.from(k.token_sha256, "hex"),
        Buffer.from(hash, "hex")
      );
    } catch {
      return false;
    }
  });
  if (matched) {
    matched.last_used_at = new Date().toISOString();
    saveProjectState(state);
    return matched;
  }
  return null;
}
