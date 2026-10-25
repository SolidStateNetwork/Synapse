import crypto from "crypto";
import fs from "fs";
import path from "path";
import type { AutonomyTier, NodeHeartbeat } from "@proto/tunnel";

export interface AssignedNode {
  node_id: string;
  tier: AutonomyTier;
  hostname?: string;
  os_arch?: string;
  online?: boolean;
  last_seen_unix?: number;
}

export interface RegisteredService {
  service_id: string;
  name: string;
  node_id: string;
  protocol: "http" | "tcp";
  port: number;
  path?: string;
  healthy?: boolean;
  registered_at: string;
}

export interface PendingApproval {
  approval_id: string;
  tool_name: string;
  node_id: string;
  arguments: Record<string, unknown>;
  created_at: string;
  status: "pending" | "approved" | "rejected";
}

export interface AIProviderSettings {
  provider: string; // "openai-compatible" | "openrouter" | "ollama" | "anthropic" | "synapse-autonomous"
  base_url: string;
  model: string;
  api_key_secret_name?: string;
  custom_headers?: Record<string, string>;
}

export interface ProjectState {
  project_id: string;
  name: string;
  description: string;
  planning_only: boolean;
  assigned_nodes: AssignedNode[];
  active_cartridges: string[];
  registered_services: RegisteredService[];
  active_pty_sessions: string[];
  telemetry: Record<string, NodeHeartbeat>;
  pending_approvals: PendingApproval[];
  ai_settings?: AIProviderSettings;
  created_at: string;
  updated_at: string;
}

export interface AuditEntry {
  timestamp: string;
  actor: "ai_orchestrator" | "user" | "policy_interceptor";
  tool_name: string;
  node_id?: string;
  status: "executed" | "paused_tier3" | "approved" | "rejected" | "blocked_planning_mode" | "error";
  summary: string;
  args?: Record<string, unknown>;
}

function resolveVaultBaseDir(): string {
  const configured = process.env.SYNAPSE_VAULT_DIR || "/var/lib/synapse/projects";
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
    fs.writeFileSync(secPath, encryptSecretsMap({}), { encoding: "utf8", mode: 0o600 });
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
      const existing = JSON.parse(fs.readFileSync(statePath, "utf8")) as ProjectState;
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
    active_pty_sessions: [],
    telemetry: {},
    pending_approvals: [],
    ai_settings: {
      provider: "openai-compatible",
      base_url: "https://api.openai.com/v1",
      model: "gpt-4o",
      api_key_secret_name: "LLM_API_KEY",
    },
    created_at: now,
    updated_at: now,
  };

  fs.writeFileSync(statePath, JSON.stringify(initialState, null, 2), "utf8");
  return initialState;
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
  fs.writeFileSync(
    path.join(dir, "State.json"),
    JSON.stringify(state, null, 2),
    "utf8"
  );
  return state;
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
  mode: "overwrite" | "append" = "overwrite"
): string {
  ensureProjectVault(projectId);
  const filePath = path.join(getProjectDir(projectId), doc);
  if (mode === "append") {
    const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
    const next = existing.endsWith("\n")
      ? `${existing}${content}\n`
      : `${existing}\n${content}\n`;
    fs.writeFileSync(filePath, next, "utf8");
    return next;
  }
  fs.writeFileSync(filePath, content, "utf8");
  return content;
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

export function setSecret(projectId: string, key: string, value: string): string[] {
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
