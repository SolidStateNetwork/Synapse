import fs from "fs";
import path from "path";
import crypto from "crypto";
import {
  atomicWriteTextSync,
  ensureProjectVault,
  getProjectDir,
  mutateProjectStateSync,
  type AuditEntry,
  type ChatAttachment,
  type McpApiKey,
  type PromptCacheMetrics,
} from "../vault";

const MAX_AUDIT_FILE_BYTES = 2 * 1024 * 1024; // 2 MB auto-rotation threshold
const MAX_CHAT_FILE_BYTES = 4 * 1024 * 1024; // 4 MB auto-rotation threshold
const SENSITIVE_ARG_KEY_RX =
  /(secret|password|passwd|api_key|apikey|token|private_key|authorization)/i;
const INLINE_SECRET_VALUE_RX =
  /\b(sk-[a-zA-Z0-9_-]{12,}|syn_mcp_[a-zA-Z0-9_-]{12,}|Bearer\s+[a-zA-Z0-9._-]{12,})\b/g;

function redactInlineStringSecrets(text: string): string {
  return text.replace(INLINE_SECRET_VALUE_RX, (match) =>
    match.startsWith("Bearer ") ? "Bearer [REDACTED]" : "[REDACTED]"
  );
}

function redactSensitiveArgs(
  args?: Record<string, unknown>
): Record<string, unknown> | undefined {
  if (!args || typeof args !== "object") return args;
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args)) {
    if (
      SENSITIVE_ARG_KEY_RX.test(k) &&
      k !== "secret_keys_available" &&
      k !== "inject_secret_keys" &&
      k !== "api_key_secret_name"
    ) {
      clean[k] = "[REDACTED]";
    } else if (k === "value" && typeof args.key === "string") {
      clean[k] = "[REDACTED]";
    } else if (typeof v === "string") {
      clean[k] = redactInlineStringSecrets(v);
    } else {
      clean[k] = v;
    }
  }
  return clean;
}

function readTailLinesSync(filePath: string, maxLines: number): string[] {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const stat = fs.statSync(filePath);
  if (stat.size === 0) {
    return [];
  }
  const windowBytes = Math.min(stat.size, Math.max(65536, maxLines * 1024));
  if (stat.size <= windowBytes) {
    return fs
      .readFileSync(filePath, "utf8")
      .split("\n")
      .filter((l) => l.trim().length > 0);
  }
  const fd = fs.openSync(filePath, "r");
  try {
    const buffer = Buffer.allocUnsafe(windowBytes);
    const bytesRead = fs.readSync(
      fd,
      buffer,
      0,
      windowBytes,
      stat.size - windowBytes
    );
    const rawChunk = buffer.toString("utf8", 0, bytesRead);
    const firstNewline = rawChunk.indexOf("\n");
    const completeChunk =
      firstNewline >= 0 ? rawChunk.slice(firstNewline + 1) : rawChunk;
    return completeChunk.split("\n").filter((l) => l.trim().length > 0);
  } finally {
    fs.closeSync(fd);
  }
}

export function computeAuditEntryHash(
  entry: AuditEntry,
  prevHash: string
): string {
  const canonical = JSON.stringify({
    timestamp: entry.timestamp,
    actor: entry.actor,
    tool_name: entry.tool_name,
    node_id: entry.node_id || null,
    status: entry.status,
    summary: entry.summary,
    args: entry.args || null,
    prev_hash: prevHash,
  });
  return crypto.createHash("sha256").update(canonical).digest("hex");
}

function resolveLastAuditHashSync(auditPath: string): string {
  const tail = readTailLinesSync(auditPath, 5);
  for (let i = tail.length - 1; i >= 0; i--) {
    try {
      const parsed = JSON.parse(tail[i]) as AuditEntry;
      if (parsed && typeof parsed.entry_hash === "string" && parsed.entry_hash) {
        return parsed.entry_hash;
      }
    } catch {
      // ignore malformed tail line
    }
  }
  return "GENESIS";
}

export function appendAuditLog(projectId: string, entry: AuditEntry): void {
  ensureProjectVault(projectId);
  const dir = getProjectDir(projectId);
  const auditPath = path.join(dir, "Audit.jsonl");
  try {
    if (fs.existsSync(auditPath)) {
      const stat = fs.statSync(auditPath);
      if (stat.size > MAX_AUDIT_FILE_BYTES) {
        const recentLines = readTailLinesSync(auditPath, 500);
        const archivePath = path.join(dir, "Audit.1.jsonl");
        try {
          fs.copyFileSync(auditPath, archivePath);
        } catch {
          // Non-fatal archive copy
        }
        atomicWriteTextSync(auditPath, recentLines.join("\n") + "\n");
      }
    }
  } catch {
    // Non-fatal rotation check
  }
  const prevHash = resolveLastAuditHashSync(auditPath);
  const safeEntry: AuditEntry = {
    ...entry,
    summary:
      typeof entry.summary === "string"
        ? redactInlineStringSecrets(entry.summary)
        : entry.summary,
    args: entry.args ? redactSensitiveArgs(entry.args) : undefined,
    prev_hash: prevHash,
  };
  safeEntry.entry_hash = computeAuditEntryHash(safeEntry, prevHash);
  fs.appendFileSync(auditPath, JSON.stringify(safeEntry) + "\n", "utf8");
}

export function verifyAuditChain(projectId: string): {
  valid: boolean;
  total_entries: number;
  chained_entries: number;
  head_hash: string;
  last_hash: string;
  broken_at_index?: number;
} {
  ensureProjectVault(projectId);
  const auditPath = path.join(getProjectDir(projectId), "Audit.jsonl");
  if (!fs.existsSync(auditPath)) {
    return {
      valid: true,
      total_entries: 0,
      chained_entries: 0,
      head_hash: "GENESIS",
      last_hash: "GENESIS",
    };
  }
  const lines = fs
    .readFileSync(auditPath, "utf8")
    .split("\n")
    .filter((l) => l.trim().length > 0);
  let expectedPrev = "GENESIS";
  let chainedCount = 0;
  for (let idx = 0; idx < lines.length; idx++) {
    let parsed: AuditEntry;
    try {
      parsed = JSON.parse(lines[idx]) as AuditEntry;
    } catch {
      return {
        valid: false,
        total_entries: lines.length,
        chained_entries: chainedCount,
        head_hash: expectedPrev,
        last_hash: expectedPrev,
        broken_at_index: idx,
      };
    }
    if (typeof parsed.entry_hash === "string" && parsed.entry_hash.length > 0) {
      const actualPrev = parsed.prev_hash || "GENESIS";
      const recomputed = computeAuditEntryHash(parsed, actualPrev);
      if (
        (chainedCount > 0 && actualPrev !== expectedPrev) ||
        recomputed !== parsed.entry_hash
      ) {
        return {
          valid: false,
          total_entries: lines.length,
          chained_entries: chainedCount,
          head_hash: expectedPrev,
          last_hash: expectedPrev,
          broken_at_index: idx,
        };
      }
      expectedPrev = parsed.entry_hash;
      chainedCount += 1;
    }
  }
  return {
    valid: true,
    total_entries: lines.length,
    chained_entries: chainedCount,
    head_hash: expectedPrev,
    last_hash: expectedPrev,
  };
}

export function readAuditLogs(projectId: string, limit = 100): AuditEntry[] {
  ensureProjectVault(projectId);
  const auditPath = path.join(getProjectDir(projectId), "Audit.jsonl");
  const lines = readTailLinesSync(auditPath, Math.max(limit, 50));
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
    atomicWriteTextSync(chatPath, JSON.stringify(welcome) + "\n");
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
    atomicWriteTextSync(
      chatPath,
      out.map((m) => JSON.stringify(m)).join("\n") + "\n"
    );
  }
  return out;
}

export function appendChatMessage(
  projectId: string,
  msg: PersistedChatMessage
): void {
  ensureProjectVault(projectId);
  const dir = getProjectDir(projectId);
  const chatPath = path.join(dir, "Chat.jsonl");
  try {
    if (fs.existsSync(chatPath)) {
      const stat = fs.statSync(chatPath);
      if (stat.size > MAX_CHAT_FILE_BYTES) {
        const recentLines = readTailLinesSync(chatPath, 200);
        const archivePath = path.join(dir, "Chat.1.jsonl");
        try {
          fs.copyFileSync(chatPath, archivePath);
        } catch {
          // Non-fatal archive copy
        }
        atomicWriteTextSync(chatPath, recentLines.join("\n") + "\n");
      }
    }
  } catch {
    // Non-fatal rotation check
  }
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
  atomicWriteTextSync(chatPath, JSON.stringify(resetMsg) + "\n");
  return [resetMsg];
}

export function createMcpApiKey(
  projectId: string,
  name: string,
  scopes: Array<"read" | "execute" | "admin"> = ["read", "execute"],
  rateLimitPerMin?: number
): { key: McpApiKey; plaintext_token: string } {
  const randomSecret = crypto.randomBytes(24).toString("base64url");
  const plaintextToken = `syn_mcp_${randomSecret}`;
  const tokenSha256 = crypto
    .createHash("sha256")
    .update(plaintextToken)
    .digest("hex");

  const cleanLimit =
    typeof rateLimitPerMin === "number" &&
    Number.isFinite(rateLimitPerMin) &&
    rateLimitPerMin >= 1 &&
    rateLimitPerMin <= 1200
      ? Math.floor(rateLimitPerMin)
      : undefined;

  const entry: McpApiKey = {
    key_id: `mcp-${Date.now().toString(36)}`,
    name: name.trim() || "External AI / MCP Client",
    token_prefix: `${plaintextToken.slice(0, 14)}...`,
    token_sha256: tokenSha256,
    scopes: scopes.length > 0 ? scopes : ["read", "execute"],
    ...(cleanLimit !== undefined ? { rate_limit_per_min: cleanLimit } : {}),
    created_at: new Date().toISOString(),
  };

  mutateProjectStateSync(projectId, (state) => {
    if (!Array.isArray(state.mcp_api_keys)) {
      state.mcp_api_keys = [];
    }
    state.mcp_api_keys.push(entry);
  });

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
  let remaining: McpApiKey[] = [];
  mutateProjectStateSync(projectId, (state) => {
    state.mcp_api_keys = (state.mcp_api_keys || []).filter(
      (k) => k.key_id !== keyId
    );
    remaining = state.mcp_api_keys;
  });
  appendAuditLog(projectId, {
    timestamp: new Date().toISOString(),
    actor: "user",
    tool_name: "mcp_revoke_api_key",
    status: "executed",
    summary: `Revoked External AI / MCP API Token ${keyId}`,
  });
  return remaining;
}

export function verifyMcpApiKey(
  projectId: string,
  rawToken: string
): McpApiKey | null {
  if (!rawToken || !rawToken.startsWith("syn_mcp_")) {
    return null;
  }
  const hash = crypto
    .createHash("sha256")
    .update(rawToken.trim())
    .digest("hex");
  let verifiedKey: McpApiKey | null = null;
  mutateProjectStateSync(projectId, (state) => {
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
      verifiedKey = { ...matched };
    }
  });
  return verifiedKey;
}

export function verifyMcpRequestSignature(
  secret: string,
  rawBody: string,
  signatureHeader?: string | null,
  timestampHeader?: string | null
): { valid: boolean; reason?: string; error?: string } {
  const requireSig = process.env.SYNAPSE_MCP_REQUIRE_SIGNATURE === "1";
  const hasSig = Boolean(signatureHeader && signatureHeader.trim());
  const hasTs = Boolean(timestampHeader && timestampHeader.trim());
  if (!hasSig && !hasTs) {
    if (requireSig) {
      const msg = "Missing required X-Synapse-Signature header";
      return { valid: false, reason: msg, error: msg };
    }
    return { valid: true };
  }
  if (!hasSig || !hasTs) {
    const msg = "Missing companion X-Synapse-Signature or X-Synapse-Timestamp header";
    return { valid: false, reason: msg, error: msg };
  }
  const rawTs = Number(timestampHeader!.trim());
  const tsMs = rawTs < 1e11 ? rawTs * 1000 : rawTs;
  if (!Number.isFinite(tsMs) || Math.abs(Date.now() - tsMs) > 300_000) {
    const msg = "Replay guard: X-Synapse-Timestamp outside 300s replay window";
    return { valid: false, reason: msg, error: msg };
  }
  const effectiveSecret =
    process.env.SYNAPSE_MCP_HMAC_SECRET || secret || "synapse-mcp-hmac";
  const payload = `${timestampHeader!.trim()}.${rawBody}`;
  const expectedHex = crypto
    .createHmac("sha256", effectiveSecret)
    .update(payload)
    .digest("hex");
  const cleanSig = signatureHeader!.trim().replace(/^sha256=/i, "");
  try {
    const sigBuf = Buffer.from(cleanSig, "hex");
    const expBuf = Buffer.from(expectedHex, "hex");
    if (sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf)) {
      return { valid: true };
    }
  } catch {
    // invalid hex
  }
  const errMsg = "Invalid X-Synapse-Signature HMAC-SHA256 digest";
  return { valid: false, reason: errMsg, error: errMsg };
}

export function isReadOnlyMcpToolCall(
  toolName: string,
  args: Record<string, unknown>
): boolean {
  const act = args.action;
  return (
    toolName === "synapse_list_peers" ||
    toolName === "synapse_get_project_state" ||
    toolName === "core_vault_search" ||
    toolName === "core_tail_service_logs" ||
    toolName === "core_get_node_telemetry_history" ||
    toolName === "node_deep_search" ||
    (toolName === "core_system_ota_status" &&
      (!act || act === "status" || act === "check")) ||
    (toolName === "node_fs_operation" &&
      ["read_file", "list_dir", "stat"].includes(String(args.operation || ""))) ||
    ((toolName === "core_manage_secret" || toolName === "core_manage_secrets") &&
      (!act || act === "list_keys" || act === "list")) ||
    ((toolName === "node_firewall_control" || toolName === "core_manage_firewall") &&
      (!act || act === "inspect")) ||
    ((toolName === "core_manage_backup" ||
      toolName === "core_disaster_RecoveryVault" ||
      toolName === "core_manage_checkpoint") &&
      (!act ||
        act === "list" ||
        act === "list_backups" ||
        act === "verify_backup_integrity")) ||
    (toolName === "core_manage_alerts" && (!act || act === "inspect")) ||
    (toolName === "core_intrusion_scan" && (!act || act === "scan")) ||
    (toolName === "core_hot_reload_service_code" && (!act || act === "inspect")) ||
    (toolName === "core_sqlite_studio" && !args.custom_sql && !args.insert_row) ||
    (toolName === "core_manage_cron_jobs" && (!act || act === "list")) ||
    (toolName === "core_manage_self_healing" && (!act || act === "inspect")) ||
    (toolName === "core_probe_service_mesh" &&
      (!act || act === "probe_service" || act === "probe_link")) ||
    (toolName === "core_manage_blueprint" && (!act || act === "list")) ||
    (toolName === "core_manage_domain_tls" && (!act || act === "list")) ||
    (toolName === "core_manage_cartridges" && (!act || act === "list")) ||
    ((toolName === "core_manage_cluster_nodes" ||
      toolName === "core_manage_node_enrollment") &&
      (!act || act === "list" || act === "list_nodes")) ||
    (toolName === "core_manage_projects" &&
      (!act || act === "list" || act === "audit_trail")) ||
    (toolName === "core_run_platform_self_test" && (!act || act === "self_test")) ||
    (toolName === "core_manage_playbooks" && (!act || act === "list")) ||
    (toolName === "core_manage_approvals" && (!act || act === "list")) ||
    (toolName === "core_invoke_service_action" &&
      (!args.method || String(args.method).toUpperCase() === "GET")) ||
    ((toolName === "core_manage_auth_and_ai" ||
      toolName === "core_configure_ai_engine") &&
      (!act || act === "inspect_auth" || act === "get")) ||
    (toolName === "core_manage_topology_bundle" && (!act || act === "export")) ||
    (toolName === "core_cluster_canary_exec" &&
      (!act || act === "verify_fleet_health")) ||
    (toolName === "core_manage_mcp_keys" && (!act || act === "list"))
  );
}

export function isAdminOnlyMcpToolCall(
  toolName: string,
  args: Record<string, unknown>
): boolean {
  if (isReadOnlyMcpToolCall(toolName, args)) {
    return false;
  }
  const act = String(args.action || "");
  return (
    toolName === "synapse_create_join_token" ||
    toolName === "core_manage_mcp_keys" ||
    toolName === "core_manage_secret" ||
    toolName === "core_manage_secrets" ||
    toolName === "core_manage_auth_and_ai" ||
    toolName === "core_configure_ai_engine" ||
    toolName === "core_manage_firewall" ||
    toolName === "node_firewall_control" ||
    toolName === "core_manage_cluster_nodes" ||
    toolName === "core_manage_node_enrollment" ||
    ((toolName === "core_manage_backup" ||
      toolName === "core_disaster_RecoveryVault") &&
      ["restore", "restore_backup", "delete"].includes(act)) ||
    (toolName === "core_manage_approvals" &&
      ["approve", "reject"].includes(act)) ||
    (toolName === "core_system_ota_status" &&
      ["apply_update", "update", "upgrade", "rollback_update"].includes(act))
  );
}


