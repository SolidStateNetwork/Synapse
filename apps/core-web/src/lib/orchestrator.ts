import crypto from "crypto";
import type {
  AutonomyTier,
  FsOperation,
  FsResponse,
  NodeHeartbeat,
  PtyExecResponse,
} from "@proto/tunnel";
import {
  appendAuditLog,
  deleteSecret,
  ensureProjectVault,
  generateRandomSecret,
  getDecryptedSecrets,
  getRollbackSnapshot,
  listSecretKeys,
  readBrainDoc,
  recordRollbackSnapshot,
  saveProjectState,
  setSecret,
  writeBrainDoc,
  type FileRollbackSnapshot,
  type ProjectState,
  type RegisteredService,
} from "./vault";
import { listCartridges } from "./cartridges";

export const CORE_GATEWAY_URL =
  process.env.CORE_GATEWAY_URL || "http://127.0.0.1:8081";

export interface GatewayNodeSummary {
  node_id: string;
  tier: AutonomyTier;
  remote_addr: string;
  connected_at: string;
  online: boolean;
  last_heartbeat?: NodeHeartbeat;
}

/**
 * In-Memory Read-Only Tool & File Cache (`read_file`, `list_dir`, `stat`)
 * Automatically invalidated whenever a write/diff/delete or PTY command runs on that node.
 */
interface CachedFsResult {
  cachedAt: number;
  response: FsResponse;
}

const FS_READ_CACHE_TTL_MS = 45_000;
const fsReadCache = new Map<string, CachedFsResult>();

function makeFsCacheKey(
  projectId: string,
  nodeId: string,
  operation: string,
  targetPath: string
): string {
  return `${projectId}::${nodeId}::${operation}::${targetPath.trim() || "."}`;
}

export function invalidateNodeReadCache(projectId: string, nodeId?: string): void {
  const prefix = nodeId ? `${projectId}::${nodeId}::` : `${projectId}::`;
  for (const key of fsReadCache.keys()) {
    if (key.startsWith(prefix)) {
      fsReadCache.delete(key);
    }
  }
}

export async function fetchGatewayNodes(): Promise<GatewayNodeSummary[]> {
  try {
    const res = await fetch(`${CORE_GATEWAY_URL}/api/v1/nodes`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.nodes || [];
  } catch {
    return [];
  }
}

export const SYNAPSE_TOOL_SCHEMAS = [
  {
    type: "function",
    function: {
      name: "core_update_brain_doc",
      description:
        "Updates project documentation (Architecture.md or Memory.md) in the Core Vault. Must be called after every structural change on a node.",
      parameters: {
        type: "object",
        properties: {
          document: {
            type: "string",
            enum: ["Architecture.md", "Memory.md"],
            description: "Target document in the Core project vault.",
          },
          mode: {
            type: "string",
            enum: ["replace_section", "append", "overwrite_full", "overwrite"],
            description: "Type of update operation.",
          },
          section_header: {
            type: "string",
            description:
              "Exact Markdown heading (required only when mode is replace_section).",
          },
          content: {
            type: "string",
            description:
              "New Markdown content (including updated Mermaid graphs or remote file paths).",
          },
        },
        required: ["document", "mode", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "core_register_service",
      description:
        "Registers, updates, or removes a service running on a Connector in State.json and activates real-time health monitoring and Live-Preview tunneling.",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["upsert", "remove"],
            default: "upsert",
          },
          service_id: {
            type: "string",
            description: "Unique slug, e.g. svc-api-backend",
          },
          node_id: {
            type: "string",
            description: "ID of the Connector where the service runs.",
          },
          name: { type: "string" },
          runtime: {
            type: "string",
            enum: ["docker", "systemd", "pm2", "binary"],
          },
          unit_or_container: {
            type: "string",
            description: "Name of the Docker container or systemd unit.",
          },
          bind_address: {
            type: "string",
            description: "IP address, e.g. 127.0.0.1, 0.0.0.0, or VLAN IP.",
          },
          port: { type: "integer" },
          enable_preview_tunnel: {
            type: "boolean",
            description:
              "When true, exposes the port through the Connector tunnel for the Live-Preview iframe in the Core WebUI.",
          },
          auto_heal: {
            type: "boolean",
            description:
              "When true, the Proactive Auto-Watchdog automatically diagnoses and restarts this service if its health probe fails.",
          },
          health_check: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["HTTP", "TCP", "EXEC"] },
              target: {
                type: "string",
                description: "URL, IP:Port, or shell command on the node.",
              },
              interval_sec: { type: "integer", default: 15 },
            },
            required: ["type", "target"],
          },
        },
        required: ["service_id", "node_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "core_manage_secret",
      description:
        "Generates or stores a secret inside the encrypted Core Vault (Secrets.enc) without exposing plaintext in logs or LLM context.",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["generate_random", "set_value", "set", "delete", "list"],
          },
          key: {
            type: "string",
            description: "Env-compliant name, e.g. DB_ROOT_PASSWORD",
          },
          value: {
            type: "string",
            description: "Required only when action is set_value.",
          },
          length: {
            type: "integer",
            default: 32,
            description: "Character length when action is generate_random.",
          },
        },
        required: ["action", "key"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "node_pty_exec",
      description:
        "Executes a shell command in a persistent PTY session on an assigned Connector. Working directory and environment variables persist across calls.",
      parameters: {
        type: "object",
        properties: {
          node_id: {
            type: "string",
            description: "Target Connector ID from State.json.",
          },
          session_id: {
            type: "string",
            description:
              "Name of the PTY session (created automatically if it does not exist), e.g. 'default' or 'db-setup'.",
          },
          command: {
            type: "string",
            description: "Bash command to execute.",
          },
          inject_secret_keys: {
            type: "array",
            items: { type: "string" },
            description:
              "List of secret keys from the Core Vault to inject as environment variables into the shell before execution.",
          },
          wait_timeout_ms: {
            type: "integer",
            default: 30000,
            description:
              "Max wait time for completion. For background daemons/dev servers, returns partial output after timeout while process keeps running.",
          },
          send_signal: {
            type: "string",
            enum: ["NONE", "SIGINT", "SIGTERM", "SIGKILL"],
            default: "NONE",
            description:
              "Optional signal sent to the foreground process of the session (e.g. SIGINT for Ctrl+C).",
          },
        },
        required: ["node_id", "session_id", "command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "node_fs_operation",
      description:
        "Direct, atomic filesystem operations on a Connector over the mTLS stream (faster and safer than echo/cat over the shell).",
      parameters: {
        type: "object",
        properties: {
          node_id: { type: "string" },
          operation: {
            type: "string",
            enum: [
              "read_file",
              "write_file",
              "apply_unified_diff",
              "list_dir",
              "stat",
              "delete",
            ],
          },
          path: {
            type: "string",
            description: "Path on the target Connector.",
          },
          content_or_patch: {
            type: "string",
            description:
              "Full file content (for write_file) or Unified-Diff patch (for apply_unified_diff).",
          },
          file_mode: {
            type: "string",
            default: "0644",
            description: "Octal file permissions, e.g. 0755 for scripts.",
          },
        },
        required: ["node_id", "operation", "path"],
      },
    },
  },
];

export interface ToolDispatchResult {
  tool_name: string;
  status:
    | "executed"
    | "paused_tier3"
    | "blocked_planning_mode"
    | "error";
  output: unknown;
  approval_id?: string;
  cached?: boolean;
  rollback_snapshot_id?: string;
  rollback_path?: string;
}

function resolveNodeTier(
  state: ProjectState,
  liveNodes: GatewayNodeSummary[],
  nodeId: string
): AutonomyTier {
  const live = liveNodes.find((n) => n.node_id === nodeId);
  if (live) return live.tier;
  const assigned = state.assigned_nodes.find((n) => n.node_id === nodeId);
  if (assigned) return assigned.tier;
  return "TIER_2_WORKSPACE_JAIL";
}

function isWriteOrExecTool(
  toolName: string,
  args: Record<string, unknown>
): boolean {
  if (toolName === "node_pty_exec") {
    return true;
  }
  if (toolName === "node_fs_operation") {
    const op = String(args.operation || "");
    return (
      op === "write_file" || op === "apply_unified_diff" || op === "delete"
    );
  }
  return false;
}

export async function pushNodeHealthTargets(
  state: ProjectState,
  nodeId: string
): Promise<void> {
  if (!nodeId) return;
  const nodeTargets = state.registered_services
    .filter((s) => s.node_id === nodeId)
    .map((s) => ({
      service_id: s.service_id,
      name: s.name,
      protocol: (
        s.health_check?.type ||
        s.protocol ||
        "http"
      ).toLowerCase(),
      port: s.port,
      path: s.path || "/",
      target:
        s.health_check?.target ||
        (s.protocol === "http"
          ? `http://127.0.0.1:${s.port}${s.path || "/"}`
          : `127.0.0.1:${s.port}`),
      interval_sec: s.health_check?.interval_sec || 15,
    }));
  try {
    await fetch(`${CORE_GATEWAY_URL}/api/v1/nodes/health-targets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ node_id: nodeId, targets: nodeTargets }),
    });
  } catch {
    // Non-fatal if node is offline
  }
}

/**
 * Restores a pre-write file snapshot created before an AI write/diff mutation.
 */
export async function executeRollbackSnapshot(
  projectId: string,
  snapshotId: string
): Promise<{
  success: boolean;
  snapshot?: FileRollbackSnapshot;
  error?: string;
}> {
  const snap = getRollbackSnapshot(projectId, snapshotId);
  if (!snap) {
    return { success: false, error: `Snapshot ${snapshotId} not found.` };
  }

  invalidateNodeReadCache(projectId, snap.node_id);

  const reqId = `rollback-${crypto.randomBytes(4).toString("hex")}`;
  const payload = snap.existed
    ? {
        node_id: snap.node_id,
        request_id: reqId,
        project_id: projectId,
        operation: "write_file",
        path: snap.path,
        content: snap.previous_content,
        file_mode: snap.file_mode || "0644",
      }
    : {
        node_id: snap.node_id,
        request_id: reqId,
        project_id: projectId,
        operation: "delete",
        path: snap.path,
      };

  try {
    const res = await fetch(`${CORE_GATEWAY_URL}/api/v1/rpc/fs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as FsResponse;
    appendAuditLog(projectId, {
      timestamp: new Date().toISOString(),
      actor: "user",
      tool_name: "rollback_snapshot",
      node_id: snap.node_id,
      status: data.success ? "executed" : "error",
      summary: `Rolled back ${snap.path} on ${snap.node_id} using snapshot ${snapshotId}`,
    });
    if (!data.success) {
      return { success: false, snapshot: snap, error: data.error };
    }
    return { success: true, snapshot: snap };
  } catch (err) {
    return {
      success: false,
      snapshot: snap,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Policy Interceptor & Tool Dispatcher:
 * - Enforces Planning-Only Mode when zero Connector Nodes are assigned.
 * - Enforces TIER_3_SUPERVISED by pausing write/exec tools and creating an approval request.
 * - Caches read-only FS operations (`read_file`, `list_dir`, `stat`) per node & invalidates on writes.
 * - Automatically captures pre-write file snapshots for 1-click rollback.
 * - Records every action in the append-only Audit.jsonl log.
 */
export async function interceptAndExecuteTool(
  projectId: string,
  toolName: string,
  args: Record<string, unknown>,
  bypassTier3Approval = false
): Promise<ToolDispatchResult> {
  const state = ensureProjectVault(projectId);
  const liveNodes = await fetchGatewayNodes();

  // 1. Core Brain Tools (always allowed even in Planning-Only Mode)
  if (toolName === "core_update_brain_doc") {
    const doc =
      args.document === "Memory.md" ? "Memory.md" : "Architecture.md";
    const rawMode = String(args.mode || "overwrite_full");
    const mode =
      rawMode === "append"
        ? "append"
        : rawMode === "replace_section"
        ? "replace_section"
        : "overwrite_full";
    const sectionHeader = args.section_header
      ? String(args.section_header)
      : undefined;
    const content = String(args.content || "");
    const updated = writeBrainDoc(
      projectId,
      doc,
      content,
      mode,
      sectionHeader
    );
    appendAuditLog(projectId, {
      timestamp: new Date().toISOString(),
      actor: "ai_orchestrator",
      tool_name: toolName,
      status: "executed",
      summary: `Updated ${doc} (${mode}${
        sectionHeader ? ` [${sectionHeader}]` : ""
      }, ${content.length} chars)`,
      args,
    });
    return {
      tool_name: toolName,
      status: "executed",
      output: {
        document: doc,
        mode,
        section_header: sectionHeader,
        length: updated.length,
      },
    };
  }

  if (toolName === "core_register_service") {
    const action = String(args.action || "upsert");
    const serviceId = String(args.service_id || `svc-${Date.now()}`);
    const nodeId = String(
      args.node_id || state.assigned_nodes[0]?.node_id || ""
    );

    if (action === "remove") {
      state.registered_services = state.registered_services.filter(
        (s) => s.service_id !== serviceId
      );
      saveProjectState(state);
      await pushNodeHealthTargets(state, nodeId);
      appendAuditLog(projectId, {
        timestamp: new Date().toISOString(),
        actor: "ai_orchestrator",
        tool_name: toolName,
        node_id: nodeId,
        status: "executed",
        summary: `Removed service ${serviceId} from ${nodeId}`,
        args,
      });
      return {
        tool_name: toolName,
        status: "executed",
        output: { removed: serviceId, node_id: nodeId },
      };
    }

    const hcRaw = (args.health_check || {}) as Record<string, unknown>;
    const port = Number(args.port || 3000);
    const pathStr = String(args.path || "/");
    const hcType = (
      String(hcRaw.type || args.protocol || "HTTP").toUpperCase() === "TCP"
        ? "TCP"
        : String(hcRaw.type || "").toUpperCase() === "EXEC"
        ? "EXEC"
        : "HTTP"
    ) as "HTTP" | "TCP" | "EXEC";
    const hcTarget = String(
      hcRaw.target ||
        (hcType === "HTTP"
          ? `http://127.0.0.1:${port}${pathStr}`
          : `127.0.0.1:${port}`)
    );

    const existingSvc = state.registered_services.find(
      (s) => s.service_id === serviceId
    );

    const svc: RegisteredService = {
      service_id: serviceId,
      name: String(args.name || serviceId),
      node_id: nodeId,
      runtime: (args.runtime as RegisteredService["runtime"]) || "binary",
      unit_or_container: args.unit_or_container
        ? String(args.unit_or_container)
        : undefined,
      bind_address: String(args.bind_address || "127.0.0.1"),
      protocol: hcType.toLowerCase() as "http" | "tcp" | "exec",
      port,
      path: pathStr,
      enable_preview_tunnel:
        args.enable_preview_tunnel !== undefined
          ? Boolean(args.enable_preview_tunnel)
          : true,
      auto_heal:
        args.auto_heal !== undefined
          ? Boolean(args.auto_heal)
          : existingSvc?.auto_heal ?? true,
      consecutive_failures: 0,
      health_check: {
        type: hcType,
        target: hcTarget,
        interval_sec: Number(hcRaw.interval_sec || 15),
        status: "HEALTHY",
        last_checked: new Date().toISOString(),
      },
      healthy: true,
      registered_at: new Date().toISOString(),
    };

    state.registered_services = [
      ...state.registered_services.filter(
        (s) => s.service_id !== svc.service_id
      ),
      svc,
    ];
    saveProjectState(state);
    await pushNodeHealthTargets(state, svc.node_id);

    appendAuditLog(projectId, {
      timestamp: new Date().toISOString(),
      actor: "ai_orchestrator",
      tool_name: toolName,
      node_id: svc.node_id,
      status: "executed",
      summary: `Registered service ${svc.name} (${svc.bind_address}:${svc.port}, ${svc.health_check?.type}, auto_heal=${svc.auto_heal}) on ${svc.node_id}`,
      args,
    });

    return {
      tool_name: toolName,
      status: "executed",
      output: {
        registered: svc,
        live_preview_url: `/preview/${projectId}/${svc.node_id}/${svc.port}`,
      },
    };
  }

  if (toolName === "core_manage_secret") {
    const action = String(args.action || "list");
    const key = String(args.key || "").trim().toUpperCase();
    const value = String(args.value || "");
    const length = Number(args.length || 32);
    let keys: string[] = [];

    if (action === "generate_random" && key) {
      keys = generateRandomSecret(projectId, key, length);
    } else if ((action === "set_value" || action === "set") && key) {
      keys = setSecret(projectId, key, value);
    } else if (action === "delete" && key) {
      keys = deleteSecret(projectId, key);
    } else {
      keys = listSecretKeys(projectId);
    }

    appendAuditLog(projectId, {
      timestamp: new Date().toISOString(),
      actor: "ai_orchestrator",
      tool_name: toolName,
      status: "executed",
      summary: `Secret vault action '${action}' on key '${key || "*"}'`,
      args: {
        action,
        key,
        length: action === "generate_random" ? length : undefined,
      },
    });
    return {
      tool_name: toolName,
      status: "executed",
      output: {
        action,
        key,
        secret_keys_available: keys,
        note:
          action === "generate_random"
            ? `Generated ${length}-char secret '${key}' in Secrets.enc (never exposed in plaintext).`
            : undefined,
      },
    };
  }

  // 2. Remote Node Tools: Enforce Planning-Only Mode Lock
  if (state.assigned_nodes.length === 0) {
    const msg =
      "ARCHITECTURAL LOCK (Planning-Only Mode): Project has zero assigned Connector Nodes. Remote execution tools (`node_pty_exec`, `node_fs_operation`) are locked until at least one Axon Muscle Node is assigned.";
    appendAuditLog(projectId, {
      timestamp: new Date().toISOString(),
      actor: "policy_interceptor",
      tool_name: toolName,
      status: "blocked_planning_mode",
      summary: msg,
      args,
    });
    return {
      tool_name: toolName,
      status: "blocked_planning_mode",
      output: { error: msg },
    };
  }

  const targetNodeId = String(
    args.node_id || state.assigned_nodes[0]?.node_id || ""
  );
  const tier = resolveNodeTier(state, liveNodes, targetNodeId);

  // 3. Enforce TIER_3_SUPERVISED Interceptor Approval Gate
  if (
    tier === "TIER_3_SUPERVISED" &&
    !bypassTier3Approval &&
    isWriteOrExecTool(toolName, args)
  ) {
    const approvalId = `appr-${crypto.randomBytes(4).toString("hex")}`;
    const pending = {
      approval_id: approvalId,
      tool_name: toolName,
      node_id: targetNodeId,
      arguments: { ...args, node_id: targetNodeId },
      created_at: new Date().toISOString(),
      status: "pending" as const,
    };
    state.pending_approvals = [pending, ...(state.pending_approvals || [])];
    saveProjectState(state);

    appendAuditLog(projectId, {
      timestamp: new Date().toISOString(),
      actor: "policy_interceptor",
      tool_name: toolName,
      node_id: targetNodeId,
      status: "paused_tier3",
      summary: `Paused ${toolName} on ${targetNodeId} (TIER_3_SUPERVISED requires explicit user approval ${approvalId})`,
      args,
    });

    return {
      tool_name: toolName,
      status: "paused_tier3",
      approval_id: approvalId,
      output: {
        message: `Execution paused by Core Policy Interceptor (Node ${targetNodeId} is in TIER_3_SUPERVISED). Awaiting user approval in WebUI (${approvalId}).`,
        approval_id: approvalId,
      },
    };
  }

  // 4. Dispatch Remote Node Tool via Core Gateway mTLS Yamux Tunnel
  if (toolName === "node_pty_exec") {
    // Any shell execution may mutate files on the node -> invalidate read cache
    invalidateNodeReadCache(projectId, targetNodeId);

    const cmdId = `cmd-${crypto.randomBytes(4).toString("hex")}`;
    const allSecrets = getDecryptedSecrets(projectId);
    let injectedSecrets: Record<string, string> = allSecrets;

    if (
      Array.isArray(args.inject_secret_keys) &&
      args.inject_secret_keys.length > 0
    ) {
      injectedSecrets = {};
      for (const rawKey of args.inject_secret_keys) {
        const k = String(rawKey).trim().toUpperCase();
        if (allSecrets[k] !== undefined) {
          injectedSecrets[k] = allSecrets[k];
        }
      }
    }

    const payload = {
      node_id: targetNodeId,
      cmd_id: cmdId,
      session_id: String(args.session_id || `default-${projectId}`),
      project_id: projectId,
      tier,
      command: String(args.command || ""),
      wait_timeout_ms: Number(args.wait_timeout_ms || 30000),
      secrets: injectedSecrets,
      send_signal: String(args.send_signal || "NONE"),
    };

    try {
      const res = await fetch(`${CORE_GATEWAY_URL}/api/v1/rpc/pty`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as PtyExecResponse;
      appendAuditLog(projectId, {
        timestamp: new Date().toISOString(),
        actor: "ai_orchestrator",
        tool_name: toolName,
        node_id: targetNodeId,
        status: data.blocked_by_guardrail ? "error" : "executed",
        summary: `PTY [${targetNodeId}] (${data.cwd || "~"}): ${String(
          args.command
        ).slice(0, 80)} -> exit=${data.exit_code}`,
        args: {
          command: args.command,
          session_id: payload.session_id,
          send_signal: payload.send_signal,
          exit_code: data.exit_code,
          cwd: data.cwd,
          truncated: data.truncated,
          blocked_by_guardrail: data.blocked_by_guardrail,
        },
      });
      return {
        tool_name: toolName,
        status: data.blocked_by_guardrail ? "error" : "executed",
        output: data,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        tool_name: toolName,
        status: "error",
        output: { error: `Failed to reach Core Gateway PTY RPC: ${msg}` },
      };
    }
  }

  if (toolName === "node_fs_operation") {
    const reqId = `fs-${crypto.randomBytes(4).toString("hex")}`;
    const operation = String(args.operation || "read_file") as FsOperation;
    const targetPath = String(args.path || ".");
    const isReadOnlyOp =
      operation === "read_file" ||
      operation === "list_dir" ||
      operation === "stat";

    // Check Read-Only Tool Cache first
    if (isReadOnlyOp && state.ai_settings?.enable_prompt_caching !== false) {
      const cacheKey = makeFsCacheKey(
        projectId,
        targetNodeId,
        operation,
        targetPath
      );
      const hit = fsReadCache.get(cacheKey);
      if (hit && Date.now() - hit.cachedAt < FS_READ_CACHE_TTL_MS) {
        return {
          tool_name: toolName,
          status: "executed",
          cached: true,
          output: {
            ...hit.response,
            _cached: true,
          },
        };
      }
    }

    const contentOrPatch =
      args.content_or_patch !== undefined
        ? String(args.content_or_patch)
        : undefined;

    // Pre-Write Snapshot for 1-Click Rollback before mutating files
    let rollbackSnapshotId: string | undefined;
    if (
      operation === "write_file" ||
      operation === "apply_unified_diff" ||
      operation === "delete"
    ) {
      try {
        const preReadRes = await fetch(`${CORE_GATEWAY_URL}/api/v1/rpc/fs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            node_id: targetNodeId,
            request_id: `snap-read-${reqId}`,
            project_id: projectId,
            tier,
            operation: "read_file",
            path: targetPath,
          }),
        });
        const preReadData = (await preReadRes.json()) as FsResponse;
        const snapId = `snap-${crypto.randomBytes(4).toString("hex")}`;
        recordRollbackSnapshot(projectId, {
          snapshot_id: snapId,
          node_id: targetNodeId,
          path: targetPath,
          existed: Boolean(preReadData.success),
          previous_content: preReadData.success
            ? String(preReadData.content || "")
            : "",
          file_mode: String(args.file_mode || "0644"),
          created_at: new Date().toISOString(),
        });
        rollbackSnapshotId = snapId;
      } catch {
        // Non-fatal if pre-read fails
      }

      invalidateNodeReadCache(projectId, targetNodeId);
    }

    const payload = {
      node_id: targetNodeId,
      request_id: reqId,
      project_id: projectId,
      tier,
      operation,
      path: targetPath,
      content:
        operation === "write_file"
          ? contentOrPatch ?? String(args.content || "")
          : String(args.content || ""),
      diff:
        operation === "apply_unified_diff"
          ? contentOrPatch ?? String(args.diff || "")
          : String(args.diff || ""),
      file_mode: String(args.file_mode || "0644"),
    };

    try {
      const res = await fetch(`${CORE_GATEWAY_URL}/api/v1/rpc/fs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as FsResponse;

      if (isReadOnlyOp && data.success) {
        const cacheKey = makeFsCacheKey(
          projectId,
          targetNodeId,
          operation,
          targetPath
        );
        fsReadCache.set(cacheKey, {
          cachedAt: Date.now(),
          response: data,
        });
      }

      appendAuditLog(projectId, {
        timestamp: new Date().toISOString(),
        actor: "ai_orchestrator",
        tool_name: toolName,
        node_id: targetNodeId,
        status: data.success ? "executed" : "error",
        summary: `FS [${targetNodeId}] ${payload.operation} ${payload.path} (${
          payload.file_mode
        }) -> ${data.success ? "OK" : data.error}${
          rollbackSnapshotId ? ` [snapshot: ${rollbackSnapshotId}]` : ""
        }`,
        args: {
          operation: payload.operation,
          path: payload.path,
          file_mode: payload.file_mode,
          success: data.success,
          rollback_snapshot_id: rollbackSnapshotId,
        },
      });
      return {
        tool_name: toolName,
        status: data.success ? "executed" : "error",
        output: data,
        rollback_snapshot_id: data.success ? rollbackSnapshotId : undefined,
        rollback_path: data.success ? targetPath : undefined,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        tool_name: toolName,
        status: "error",
        output: { error: `Failed to reach Core Gateway FS RPC: ${msg}` },
      };
    }
  }

  return {
    tool_name: toolName,
    status: "error",
    output: { error: `Unknown tool: ${toolName}` },
  };
}

/**
 * Cache-Optimized 5-Layer System Prompt Split:
 * - `staticPrefix`: Layers 1 (Core Laws), 3 (Rule Cartridges), 4 (Architecture.md & Memory.md), and 5 (Execution Protocol).
 *   Placed FIRST so OpenAI automatic prefix caching and Anthropic `cache_control: { type: "ephemeral" }` achieve near-100% cache hits across turns.
 * - `dynamicSuffix`: Layer 2 (`<assigned_infrastructure>` with live 5-second CPU/RAM/heartbeat timestamps).
 */
export function buildCacheOptimizedSystemPromptParts(projectId: string): {
  staticPrefix: string;
  dynamicSuffix: string;
  fullPrompt: string;
} {
  const state = ensureProjectVault(projectId);
  const archDoc = readBrainDoc(projectId, "Architecture.md");
  const memDoc = readBrainDoc(projectId, "Memory.md");
  const secretKeys = listSecretKeys(projectId);
  const allCartridges = listCartridges();
  const activeCartridges = allCartridges.filter((c) =>
    state.active_cartridges.includes(c.id)
  );

  const cartridgeBlock = activeCartridges
    .map(
      (c) =>
        `### Cartridge: ${c.name} (ID: ${c.id})\n${c.content.replace(
          /^---[\s\S]*?---\s*/,
          ""
        )}`
    )
    .join("\n\n");

  const staticPrefix = `<!-- ===================================================================== -->
<!-- LAYER 1: IMMUTABLE CORE IDENTITY & BRAIN-MUSCLE PARADIGM              -->
<!-- ===================================================================== -->
You are the Principal Autonomous DevOps & Software Engineering Engine operating on a "Brain & Muscle" architecture.

CRITICAL ARCHITECTURAL LAWS:
1. NO LOCAL EXECUTION ON CORE: You reside in the stateless "Brain" (Control Plane). You DO NOT have a local shell or local code workspace on the Core. All application code, builds, databases, and configurations MUST be created and executed directly on the assigned Remote Connectors ("Muscles") using \`node_*\` tools.
2. ZERO-CONNECTOR LOCK: Inspect \`<assigned_infrastructure>\` below. If \`assigned_nodes\` is empty, you are in PLANNING-ONLY MODE. You may only use \`core_update_brain_doc\` to design architectures and must instruct the user to assign at least one Connector in the UI before implementation.
3. STATE SYNCHRONIZATION DUTY: Because application code lives exclusively on remote servers, the Core relies entirely on your discipline to stay informed:
   - Whenever you create/move directories or change system topology on a node, you MUST update \`Architecture.md\` via \`core_update_brain_doc\`.
   - Whenever you expose a port, start a daemon/container, or configure a database, you MUST register it via \`core_register_service\` so the Core UI can monitor health and open Live-Preview tunnels.
   - Whenever you solve a non-trivial bug or server quirk, record the lesson in \`Memory.md\`.
4. SELF-PRESERVATION: Never stop \`axon\` / \`muscle-agent\`, never flush firewall rules without preserving the outbound connection to the Core Hub, and never expose raw database ports to \`0.0.0.0\` without firewall restrictions.
5. MULTIMODAL VISION & CONTEXT MENTIONS: When the user attaches screenshots, architecture diagrams, or error photos, inspect the visual details carefully and translate them directly into concrete file changes, service configurations, or fixes on the target node.

<!-- ===================================================================== -->
<!-- LAYER 3: PLUGGABLE RULE CARTRIDGES (USER-SELECTED IN PROJECT UI)      -->
<!-- ===================================================================== -->
<active_rule_cartridges>
${cartridgeBlock || "No active rule cartridges selected."}
</active_rule_cartridges>

<!-- ===================================================================== -->
<!-- LAYER 4: PROJECT BRAIN CONTEXT (ARCHITECTURE & LONG-TERM MEMORY)      -->
<!-- ===================================================================== -->
<project_architecture>
${archDoc}
</project_architecture>

<project_memory>
${memDoc}
</project_memory>

<!-- ===================================================================== -->
<!-- LAYER 5: EXECUTION PROTOCOL                                           -->
<!-- ===================================================================== -->
When developing web applications on any node, always bind dev servers to \`127.0.0.1:<port>\` (or container port mapped to \`127.0.0.1:<port>\`) and call \`core_register_service\` with \`enable_preview_tunnel: true\` so the user can immediately view the live application inside the Core WebUI preview iframe.`;

  const assignedNodesMap: Record<string, unknown> = {};
  for (const n of state.assigned_nodes) {
    const hb = state.telemetry?.[n.node_id];
    assignedNodesMap[n.node_id] = {
      hostname: hb?.hostname || n.hostname || n.node_id,
      status: n.online !== false ? "ONLINE" : "OFFLINE",
      autonomy_tier: n.tier,
      network: {
        public_ipv4: hb?.public_ipv4 || n.network?.public_ipv4 || null,
        private_ipv4:
          hb?.private_ipv4 || n.network?.private_ipv4 || "127.0.0.1",
      },
      os_info: hb?.os_info || n.os_info || hb?.os_arch || "Linux x86_64",
      telemetry: hb
        ? {
            cpu_load_1m: Number((hb.cpu_percent / 100).toFixed(2)),
            ram_used_mb: Math.round(hb.ram_used_bytes / (1024 * 1024)),
            ram_total_mb: Math.round(hb.ram_total_bytes / (1024 * 1024)),
            disk_free_gb: Number(
              (
                (hb.disk_total_bytes - hb.disk_used_bytes) /
                (1024 * 1024 * 1024)
              ).toFixed(1)
            ),
            last_heartbeat: new Date(hb.timestamp_unix * 1000).toISOString(),
          }
        : undefined,
      active_pty_sessions:
        hb?.pty_session_details ||
        n.active_pty_sessions ||
        (hb?.active_pty_sessions || []).map((sid) => ({
          session_id: sid,
          cwd: `/opt/axon/workspaces/${state.project_id}`,
          running_cmd: null,
        })),
    };
  }

  const injectedStateJson = JSON.stringify(
    {
      project_id: state.project_id,
      project_name: state.name,
      updated_at: state.updated_at,
      active_cartridges: state.active_cartridges,
      assigned_nodes: assignedNodesMap,
      registered_services: state.registered_services,
      secret_keys_available: secretKeys,
    },
    null,
    2
  );

  const dynamicSuffix = `<!-- ===================================================================== -->
<!-- LAYER 2: DYNAMICALLY INJECTED INFRASTRUCTURE & AUTONOMY TIERS         -->
<!-- ===================================================================== -->
<assigned_infrastructure>
${injectedStateJson}
</assigned_infrastructure>

AUTONOMY TIER BEHAVIOR PER NODE:
- For nodes in \`TIER_1_UNLEASHED\`: Execute full-stack provisioning autonomously. Verify system state (\`systemctl status\`, \`docker ps\`, \`ss -tulpn\`) after changes.
- For nodes in \`TIER_2_WORKSPACE_JAIL\`: All file paths MUST reside within \`/opt/axon/workspaces/${state.project_id}/\`. Do not attempt host-level package installations (\`apt\`); use local runtimes or rootless containers.
- For nodes in \`TIER_3_SUPERVISED\`: Your write and execution tool calls will pause for human approval in the UI. Group related shell commands logically and explain the exact impact before invoking the tool.`;

  return {
    staticPrefix,
    dynamicSuffix,
    fullPrompt: `${staticPrefix}\n\n${dynamicSuffix}`,
  };
}

export function buildSystemPrompt(projectId: string): string {
  return buildCacheOptimizedSystemPromptParts(projectId).fullPrompt;
}
