import crypto from "crypto";
import fs from "fs";
import path from "path";
import type {
  AIProviderSettings,
  AssignedNode,
  AuditEntry,
  ChatAttachment,
  FileRollbackSnapshot,
  FirewallIpRule,
  FirewallNodePolicy,
  FirewallPortItem,
  McpApiKey,
  PeerMeshLink,
  PendingApproval,
  ProjectState,
  PromptCacheMetrics,
  RegisteredService,
  ScheduledPlaybook,
  ServiceEndpointAction,
  ServiceHealthCheckSpec,
} from "./vault/vaultTypes";

export type {
  AIProviderSettings,
  AssignedNode,
  AuditEntry,
  ChatAttachment,
  FileRollbackSnapshot,
  FirewallIpRule,
  FirewallNodePolicy,
  FirewallPortItem,
  McpApiKey,
  PeerMeshLink,
  PendingApproval,
  ProjectState,
  PromptCacheMetrics,
  RegisteredService,
  ScheduledPlaybook,
  ServiceEndpointAction,
  ServiceHealthCheckSpec,
};

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
  const cleaned = String(id || "")
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "-");
  return cleaned || "default-project";
}

export function getProjectDir(projectId: string): string {
  const base = resolveVaultBaseDir();
  return path.join(base, sanitizeProjectId(projectId));
}

export function atomicWriteTextSync(
  targetPath: string,
  content: string,
  mode?: number
): void {
  const dir = path.dirname(targetPath);
  fs.mkdirSync(dir, { recursive: true });
  const tmpPath = path.join(
    dir,
    `.tmp-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
  fs.writeFileSync(
    tmpPath,
    content,
    mode !== undefined ? { encoding: "utf8", mode } : "utf8"
  );
  fs.renameSync(tmpPath, targetPath);
}

/**
 * Atomically writes JSON to targetPath and maintains a `<targetPath>.bak` recovery copy.
 */
export function atomicWriteJsonSync(targetPath: string, data: unknown): void {
  const serialized = JSON.stringify(data, null, 2);
  atomicWriteTextSync(targetPath, serialized);
  try {
    atomicWriteTextSync(`${targetPath}.bak`, serialized);
  } catch {
    // ignore backup write errors
  }
}

/**
 * Safely reads and parses a JSON file, automatically falling back to and restoring from
 * `<targetPath>.bak` if the primary file is corrupted or truncated.
 */
export function safeReadJsonWithBackupSync<T>(
  targetPath: string,
  fallback: T
): T {
  if (fs.existsSync(targetPath)) {
    try {
      const raw = fs.readFileSync(targetPath, "utf8").replace(/^\uFEFF/, "");
      if (raw.trim()) {
        return JSON.parse(raw) as T;
      }
    } catch {
      // Primary file corrupted; try .bak recovery below
    }
  }
  const bakPath = `${targetPath}.bak`;
  if (fs.existsSync(bakPath)) {
    try {
      const rawBak = fs.readFileSync(bakPath, "utf8").replace(/^\uFEFF/, "");
      if (rawBak.trim()) {
        const parsed = JSON.parse(rawBak) as T;
        try {
          atomicWriteTextSync(targetPath, rawBak);
        } catch {
          // ignore self-heal write failure
        }
        return parsed;
      }
    } catch {
      // Backup also unreadable
    }
  }
  return fallback;
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

  const existing = safeReadJsonWithBackupSync<ProjectState | null>(
    statePath,
    null
  );
  if (existing && typeof existing === "object" && existing.project_id) {
    existing.assigned_nodes = Array.isArray(existing.assigned_nodes)
      ? existing.assigned_nodes
      : [];
    existing.registered_services = Array.isArray(existing.registered_services)
      ? existing.registered_services
      : [];
    existing.planning_only = existing.assigned_nodes.length === 0;
    return existing;
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

const projectStateLocks = new Map<string, Promise<unknown>>();

export async function withProjectStateTransaction(
  projectId: string,
  mutator: (state: ProjectState) => Promise<void> | void
): Promise<ProjectState>;
export async function withProjectStateTransaction<T>(
  projectId: string,
  mutator: (state: ProjectState) => Promise<T> | T
): Promise<T>;
export async function withProjectStateTransaction<T = ProjectState>(
  projectId: string,
  mutator: (state: ProjectState) => Promise<T | void> | T | void
): Promise<T | ProjectState> {
  const cleanId = sanitizeProjectId(projectId);
  const prevLock = projectStateLocks.get(cleanId) || Promise.resolve();
  let releaseLock!: () => void;
  const currentLock = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });
  projectStateLocks.set(
    cleanId,
    prevLock.then(() => currentLock, () => currentLock)
  );

  await prevLock.catch(() => {});
  try {
    const state = ensureProjectVault(cleanId);
    const result = await mutator(state);
    const saved = saveProjectState(state);
    return result !== undefined ? result : (saved as unknown as T);
  } finally {
    releaseLock();
    if (projectStateLocks.get(cleanId) === currentLock) {
      projectStateLocks.delete(cleanId);
    }
  }
}

export function mutateProjectStateSync(
  projectId: string,
  mutator: (state: ProjectState) => void
): ProjectState {
  const state = ensureProjectVault(projectId);
  mutator(state);
  return saveProjectState(state);
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
    const defaultId = sanitizeProjectId(
      process.env.SYNAPSE_DEFAULT_PROJECT || "default-project"
    );
    projects.push(
      ensureProjectVault(
        defaultId,
        "Default Infrastructure Workspace",
        "Distributed Microservice Mesh orchestrated via Axon mTLS Muscle Nodes."
      )
    );
  }
  projects.sort((a, b) => {
    const scoreA =
      (a.assigned_nodes?.length || 0) * 10 +
      (a.registered_services?.length || 0);
    const scoreB =
      (b.assigned_nodes?.length || 0) * 10 +
      (b.registered_services?.length || 0);
    if (scoreB !== scoreA) return scoreB - scoreA;
    return a.project_id.localeCompare(b.project_id);
  });
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
  mutateProjectStateSync(projectId, (state) => {
    const existing = state.rollback_snapshots || [];
    state.rollback_snapshots = [snapshot, ...existing].slice(0, 35);
  });
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
    atomicWriteTextSync(filePath, next);
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
      atomicWriteTextSync(filePath, next);
      return next;
    } else {
      const prefixHeader = sectionHeader.trim().startsWith("#")
        ? sectionHeader.trim()
        : `## ${sectionHeader.trim()}`;
      const next = `${existing.trimEnd()}\n\n${prefixHeader}\n\n${content.trim()}\n`;
      atomicWriteTextSync(filePath, next);
      return next;
    }
  }

  atomicWriteTextSync(filePath, content);
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
  atomicWriteTextSync(secPath, encryptSecretsMap(current), 0o600);
  return Object.keys(current).sort();
}

export function deleteSecret(projectId: string, key: string): string[] {
  ensureProjectVault(projectId);
  const secPath = path.join(getProjectDir(projectId), "Secrets.enc");
  const current = decryptSecretsMap(fs.readFileSync(secPath, "utf8"));
  delete current[key.trim().toUpperCase()];
  atomicWriteTextSync(secPath, encryptSecretsMap(current), 0o600);
  return Object.keys(current).sort();
}

export {
  appendAuditLog,
  readAuditLogs,
  readChatHistory,
  appendChatMessage,
  clearChatHistory,
  createMcpApiKey,
  revokeMcpApiKey,
  verifyMcpApiKey,
  type PersistedChatMessage,
} from "./vault/auditChatAndMcp";
