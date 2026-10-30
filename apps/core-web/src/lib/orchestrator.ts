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
  ensureProjectVault,
  getDecryptedSecrets,
  getRollbackSnapshot,
  recordRollbackSnapshot,
  withProjectStateTransaction,
  type FileRollbackSnapshot,
  type ProjectState,
} from "./vault";
import { recordCheckpoint } from "./checkpoints";
import { executeFirewallAction, type FirewallActionInput } from "./firewall";
import { SYNAPSE_TOOL_SCHEMAS } from "./orchestrator/toolSchemas";
import {
  buildDefaultServiceEndpoints,
  pushNodeHealthTargets,
} from "@/lib/orchestrator/servicePresets";
import {
  buildCacheOptimizedSystemPromptParts,
  buildSystemPrompt,
} from "@/lib/orchestrator/promptBuilder";
import {
  executeCoreVaultSearch,
  executeNodeDeepSearch,
} from "@/lib/orchestrator/searchEngine";
import { dispatchCoreBrainTool } from "@/lib/orchestrator/coreTools";
import { safeFetchJson } from "./safeFetch";

export {
  SYNAPSE_TOOL_SCHEMAS,
  buildDefaultServiceEndpoints,
  pushNodeHealthTargets,
  buildCacheOptimizedSystemPromptParts,
  buildSystemPrompt,
};

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

interface CachedFsResult {
  cachedAt: number;
  response: FsResponse;
}

const FS_READ_CACHE_TTL_MS = 45_000;
const MAX_FS_CACHE_ENTRIES = 128;
const MAX_FS_CACHE_CONTENT_CHARS = 512 * 1024;
const fsReadCache = new Map<string, CachedFsResult>();

function makeFsCacheKey(
  projectId: string,
  nodeId: string,
  operation: string,
  targetPath: string
): string {
  return `${projectId}::${nodeId}::${operation}::${targetPath.trim() || "."}`;
}

function setBoundedFsReadCache(key: string, response: FsResponse): void {
  const contentLen = response.content ? String(response.content).length : 0;
  if (contentLen > MAX_FS_CACHE_CONTENT_CHARS) return;
  const now = Date.now();
  if (fsReadCache.has(key)) {
    fsReadCache.delete(key);
  } else if (fsReadCache.size >= MAX_FS_CACHE_ENTRIES) {
    for (const [k, v] of fsReadCache.entries()) {
      if (now - v.cachedAt >= FS_READ_CACHE_TTL_MS) {
        fsReadCache.delete(k);
      }
    }
    if (fsReadCache.size >= MAX_FS_CACHE_ENTRIES) {
      const oldestKey = fsReadCache.keys().next().value;
      if (oldestKey !== undefined) fsReadCache.delete(oldestKey);
    }
  }
  fsReadCache.set(key, { cachedAt: now, response });
}

export function invalidateNodeReadCache(projectId: string, nodeId?: string): void {
  const prefix = nodeId ? `${projectId}::${nodeId}::` : `${projectId}::`;
  for (const key of fsReadCache.keys()) {
    if (key.startsWith(prefix)) fsReadCache.delete(key);
  }
}

export async function fetchGatewayNodes(): Promise<GatewayNodeSummary[]> {
  const res = await safeFetchJson(`${CORE_GATEWAY_URL}/api/v1/nodes`, {
    cache: "no-store",
    timeoutMs: 4000,
  });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data?.nodes) ? data.nodes : [];
}

export interface ToolDispatchResult {
  tool_name: string;
  status: "executed" | "paused_tier3" | "blocked_planning_mode" | "error";
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
  const assigned = state.assigned_nodes.find((n) => n.node_id === nodeId);
  if (assigned?.tier) return assigned.tier;
  const live = liveNodes.find((n) => n.node_id === nodeId);
  if (live?.tier) return live.tier;
  return "TIER_2_WORKSPACE_JAIL";
}

function isWriteOrExecTool(toolName: string, args: Record<string, unknown>): boolean {
  if (toolName === "node_pty_exec") return true;
  if (toolName === "node_firewall_control" || toolName === "core_manage_firewall") {
    return String(args.action || "inspect") !== "inspect";
  }
  if (toolName === "node_fs_operation") {
    const op = String(args.operation || "");
    return op === "write_file" || op === "apply_unified_diff" || op === "delete";
  }
  return false;
}

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
    const res = await safeFetchJson(`${CORE_GATEWAY_URL}/api/v1/rpc/fs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      timeoutMs: 12000,
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

export async function interceptAndExecuteTool(
  projectId: string,
  toolName: string,
  args: Record<string, unknown>,
  bypassTier3Approval = false
): Promise<ToolDispatchResult> {
  const state = ensureProjectVault(projectId);
  const liveNodes = await fetchGatewayNodes();

  const coreToolOut = await dispatchCoreBrainTool(
    CORE_GATEWAY_URL,
    projectId,
    state,
    toolName,
    args
  );
  if (coreToolOut) return coreToolOut;

  if (toolName === "core_vault_search") {
    return executeCoreVaultSearch(projectId, state, toolName, args);
  }

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

  const targetNodeId = String(args.node_id || state.assigned_nodes[0]?.node_id || "");
  const tier = resolveNodeTier(state, liveNodes, targetNodeId);

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
    await withProjectStateTransaction(projectId, (draft) => {
      draft.pending_approvals = [pending, ...(draft.pending_approvals || [])];
    });

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

  if (toolName === "node_pty_exec") {
    invalidateNodeReadCache(projectId, targetNodeId);
    const cmdId = `cmd-${crypto.randomBytes(4).toString("hex")}`;
    const allSecrets = getDecryptedSecrets(projectId);
    let injectedSecrets: Record<string, string> = allSecrets;

    if (Array.isArray(args.inject_secret_keys) && args.inject_secret_keys.length > 0) {
      injectedSecrets = {};
      for (const rawKey of args.inject_secret_keys) {
        const k = String(rawKey).trim().toUpperCase();
        if (allSecrets[k] !== undefined) injectedSecrets[k] = allSecrets[k];
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
      const res = await safeFetchJson(`${CORE_GATEWAY_URL}/api/v1/rpc/pty`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        timeoutMs: payload.wait_timeout_ms + 5000,
      });
      if (!res.ok) {
        return {
          tool_name: toolName,
          status: "error",
          output: { error: `Failed to reach Core Gateway PTY RPC: ${res.error || `HTTP ${res.status}`}` },
        };
      }
      const data = (await res.json()) as PtyExecResponse;
      appendAuditLog(projectId, {
        timestamp: new Date().toISOString(),
        actor: "ai_orchestrator",
        tool_name: toolName,
        node_id: targetNodeId,
        status: data.blocked_by_guardrail ? "error" : "executed",
        summary: `PTY [${targetNodeId}] (${data.cwd || "~"}): ${String(args.command).slice(0, 80)} -> exit=${data.exit_code}`,
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

  if (toolName === "node_deep_search") {
    return executeNodeDeepSearch(
      CORE_GATEWAY_URL,
      projectId,
      state,
      targetNodeId,
      tier,
      toolName,
      args
    );
  }

  if (toolName === "node_firewall_control" || toolName === "core_manage_firewall") {
    try {
      const fwInput: FirewallActionInput = {
        action: (args.action as FirewallActionInput["action"]) || "inspect",
        node_id: targetNodeId,
        profile: args.profile as FirewallActionInput["profile"],
        port: args.port !== undefined ? Number(args.port) : undefined,
        ip_or_cidr: args.ip_or_cidr ? String(args.ip_or_cidr) : undefined,
        rule_action: args.rule_action as FirewallActionInput["rule_action"],
        note: args.note ? String(args.note) : undefined,
        rule_id: args.rule_id ? String(args.rule_id) : undefined,
        actor: "ai_orchestrator",
      };
      const fwRes = await executeFirewallAction(projectId, fwInput);
      return { tool_name: toolName, status: "executed", output: fwRes };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { tool_name: toolName, status: "error", output: { error: msg } };
    }
  }

  if (toolName === "node_fs_operation") {
    const reqId = `fs-${crypto.randomBytes(4).toString("hex")}`;
    const operation = String(args.operation || "read_file") as FsOperation;
    const targetPath = String(args.path || ".");
    const isReadOnlyOp =
      operation === "read_file" || operation === "list_dir" || operation === "stat";

    if (isReadOnlyOp && state.ai_settings?.enable_prompt_caching !== false) {
      const cacheKey = makeFsCacheKey(projectId, targetNodeId, operation, targetPath);
      const hit = fsReadCache.get(cacheKey);
      if (hit && Date.now() - hit.cachedAt < FS_READ_CACHE_TTL_MS) {
        return {
          tool_name: toolName,
          status: "executed",
          cached: true,
          output: { ...hit.response, _cached: true },
        };
      }
    }

    const contentOrPatch =
      args.content_or_patch !== undefined ? String(args.content_or_patch) : undefined;

    let rollbackSnapshotId: string | undefined;
    if (
      operation === "write_file" ||
      operation === "apply_unified_diff" ||
      operation === "delete"
    ) {
      try {
        const preReadRes = await safeFetchJson(`${CORE_GATEWAY_URL}/api/v1/rpc/fs`, {
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
          timeoutMs: 8000,
        });
        const preReadData = (await preReadRes.json()) as FsResponse;
        const snapId = `snap-${crypto.randomBytes(4).toString("hex")}`;
        recordRollbackSnapshot(projectId, {
          snapshot_id: snapId,
          node_id: targetNodeId,
          path: targetPath,
          existed: Boolean(preReadData.success),
          previous_content: preReadData.success ? String(preReadData.content || "") : "",
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
      const res = await safeFetchJson(`${CORE_GATEWAY_URL}/api/v1/rpc/fs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        timeoutMs: 12000,
      });
      if (!res.ok) {
        return {
          tool_name: toolName,
          status: "error",
          output: { error: `Failed to reach Core Gateway FS RPC: ${res.error || `HTTP ${res.status}`}` },
        };
      }
      const data = (await res.json()) as FsResponse;

      if (isReadOnlyOp && data.success) {
        const cacheKey = makeFsCacheKey(projectId, targetNodeId, operation, targetPath);
        setBoundedFsReadCache(cacheKey, data);
      }

      if (!isReadOnlyOp && data.success) {
        try {
          recordCheckpoint(projectId, {
            node_id: targetNodeId,
            title: `AI ${operation}: ${targetPath}`,
            actor: "Synapse AI",
            summary: `Pre-mutation snapshot before ${operation} on ${targetPath}`,
            files_backed_up: [`${targetPath}.synapse.bak`],
            services_snapshot: (state.registered_services || [])
              .filter((s) => s.node_id === targetNodeId)
              .map((s) => ({
                service_id: s.service_id,
                name: s.name,
                port: s.port,
                healthy: Boolean(s.healthy),
              })),
            rollback_cmd: `if [ -f "${targetPath}.synapse.bak" ]; then cp -f "${targetPath}.synapse.bak" "${targetPath}"; fi && echo 'CHECKPOINT_RESTORED_OK'`,
          });
        } catch {
          // non-fatal
        }
      }

      appendAuditLog(projectId, {
        timestamp: new Date().toISOString(),
        actor: "ai_orchestrator",
        tool_name: toolName,
        node_id: targetNodeId,
        status: data.success ? "executed" : "error",
        summary: `FS [${targetNodeId}] ${payload.operation} ${payload.path} (${payload.file_mode}) -> ${data.success ? "OK" : data.error}${rollbackSnapshotId ? ` [snapshot: ${rollbackSnapshotId}]` : ""}`,
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
