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
  const safeEntry: AuditEntry = {
    ...entry,
    summary:
      typeof entry.summary === "string"
        ? redactInlineStringSecrets(entry.summary)
        : entry.summary,
    args: entry.args ? redactSensitiveArgs(entry.args) : undefined,
  };
  fs.appendFileSync(auditPath, JSON.stringify(safeEntry) + "\n", "utf8");
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
  scopes: Array<"read" | "execute" | "admin"> = ["read", "execute"]
): { key: McpApiKey; plaintext_token: string } {
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
