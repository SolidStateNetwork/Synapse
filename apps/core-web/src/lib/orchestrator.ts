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
  getDecryptedSecrets,
  listSecretKeys,
  readBrainDoc,
  saveProjectState,
  setSecret,
  writeBrainDoc,
  type ProjectState,
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
        "Update Architecture.md (living Mermaid system topology & remote file layout) or Memory.md (chronological engineering journal) inside the Project Brain Vault.",
      parameters: {
        type: "object",
        properties: {
          document: {
            type: "string",
            enum: ["Architecture.md", "Memory.md"],
          },
          mode: {
            type: "string",
            enum: ["overwrite", "append"],
          },
          content: {
            type: "string",
            description: "Markdown content to write or append.",
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
        "Register a remote node application port in State.json for 5-second health checks and Live-Preview Reverse Proxy tunneling (/preview/<project_id>/<node_id>/<port>).",
      parameters: {
        type: "object",
        properties: {
          service_id: { type: "string" },
          name: { type: "string" },
          node_id: { type: "string" },
          protocol: { type: "string", enum: ["http", "tcp"] },
          port: { type: "number" },
          path: { type: "string" },
        },
        required: ["service_id", "name", "node_id", "protocol", "port"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "core_manage_secret",
      description:
        "Manage AES-256-GCM encrypted secrets in Secrets.enc. Secret values are injected into remote PTY sessions and automatically scrubbed ([REDACTED_SECRET:KEY]) from LLM output.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["set", "delete", "list"] },
          key: { type: "string" },
          value: { type: "string" },
        },
        required: ["action"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "node_pty_exec",
      description:
        "Execute a shell command inside a persistent stateful Linux PTY session on an assigned Axon Muscle Node using deterministic sentinel framing.",
      parameters: {
        type: "object",
        properties: {
          node_id: { type: "string" },
          session_id: { type: "string" },
          command: { type: "string" },
          wait_timeout_ms: { type: "number" },
        },
        required: ["node_id", "command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "node_fs_operation",
      description:
        "Perform an atomic filesystem operation (read_file, write_file, apply_unified_diff, list_dir, stat, delete) on an assigned Axon Muscle Node.",
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
          path: { type: "string" },
          content: { type: "string" },
          diff: { type: "string" },
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

/**
 * Policy Interceptor & Tool Dispatcher:
 * - Enforces Planning-Only Mode when zero Connector Nodes are assigned.
 * - Enforces TIER_3_SUPERVISED by pausing write/exec tools and creating an approval request.
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
    const mode = args.mode === "append" ? "append" : "overwrite";
    const content = String(args.content || "");
    const updated = writeBrainDoc(projectId, doc, content, mode);
    appendAuditLog(projectId, {
      timestamp: new Date().toISOString(),
      actor: "ai_orchestrator",
      tool_name: toolName,
      status: "executed",
      summary: `Updated ${doc} (${mode}, ${content.length} chars)`,
      args,
    });
    return {
      tool_name: toolName,
      status: "executed",
      output: { document: doc, mode, length: updated.length },
    };
  }

  if (toolName === "core_register_service") {
    const svc = {
      service_id: String(args.service_id || `svc-${Date.now()}`),
      name: String(args.name || "App Service"),
      node_id: String(args.node_id || state.assigned_nodes[0]?.node_id || ""),
      protocol: (args.protocol === "tcp" ? "tcp" : "http") as "http" | "tcp",
      port: Number(args.port || 3000),
      path: String(args.path || "/"),
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

    // Push updated health targets to Core Gateway -> Axon node
    if (svc.node_id) {
      const nodeTargets = state.registered_services
        .filter((s) => s.node_id === svc.node_id)
        .map((s) => ({
          service_id: s.service_id,
          name: s.name,
          protocol: s.protocol,
          port: s.port,
          path: s.path || "/",
        }));
      try {
        await fetch(`${CORE_GATEWAY_URL}/api/v1/nodes/health-targets`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ node_id: svc.node_id, targets: nodeTargets }),
        });
      } catch {
        // Non-fatal if node is offline
      }
    }

    appendAuditLog(projectId, {
      timestamp: new Date().toISOString(),
      actor: "ai_orchestrator",
      tool_name: toolName,
      node_id: svc.node_id,
      status: "executed",
      summary: `Registered service ${svc.name} (${svc.protocol}://127.0.0.1:${svc.port}) on ${svc.node_id}`,
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
    const key = String(args.key || "");
    const value = String(args.value || "");
    let keys: string[] = [];
    if (action === "set" && key) {
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
      summary: `Secret vault action '${action}' on key '${key.toUpperCase() || "*"}'`,
      args: { action, key: key.toUpperCase() },
    });
    return {
      tool_name: toolName,
      status: "executed",
      output: { action, keys },
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
    const cmdId = `cmd-${crypto.randomBytes(4).toString("hex")}`;
    const secrets = getDecryptedSecrets(projectId);
    const payload = {
      node_id: targetNodeId,
      cmd_id: cmdId,
      session_id: String(args.session_id || `default-${projectId}`),
      project_id: projectId,
      tier,
      command: String(args.command || ""),
      wait_timeout_ms: Number(args.wait_timeout_ms || 15000),
      secrets,
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
    const payload = {
      node_id: targetNodeId,
      request_id: reqId,
      project_id: projectId,
      tier,
      operation: String(args.operation || "read_file") as FsOperation,
      path: String(args.path || "."),
      content: String(args.content || ""),
      diff: String(args.diff || ""),
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
        actor: "ai_orchestrator",
        tool_name: toolName,
        node_id: targetNodeId,
        status: data.success ? "executed" : "error",
        summary: `FS [${targetNodeId}] ${payload.operation} ${payload.path} -> ${
          data.success ? "OK" : data.error
        }`,
        args: {
          operation: payload.operation,
          path: payload.path,
          success: data.success,
        },
      });
      return {
        tool_name: toolName,
        status: data.success ? "executed" : "error",
        output: data,
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

export function buildSystemPrompt(projectId: string): string {
  const state = ensureProjectVault(projectId);
  const archDoc = readBrainDoc(projectId, "Architecture.md");
  const memDoc = readBrainDoc(projectId, "Memory.md");
  const secretKeys = listSecretKeys(projectId);
  const allCartridges = listCartridges();
  const activeCartridges = allCartridges.filter((c) =>
    state.active_cartridges.includes(c.id)
  );

  const cartridgeBlock = activeCartridges
    .map((c) => `### Rule Cartridge: ${c.name} (${c.id})\n${c.content}`)
    .join("\n\n");

  return `You are the **Synapse Core AI Orchestrator ("The Brain")** managing project "${state.name}" (${state.project_id}).
ARCHITECTURAL LAW: The Core Control Plane NEVER compiles or executes user code locally. All remote file and shell operations happen strictly on assigned Axon Muscle Nodes over mTLS + Yamux.

## Current Project State
- Mode: ${
    state.planning_only
      ? "LOCKED IN PLANNING-ONLY MODE (No Axon Connector Nodes assigned)"
      : "ACTIVE EXECUTION MODE"
  }
- Assigned Nodes: ${JSON.stringify(state.assigned_nodes)}
- Registered Services: ${JSON.stringify(state.registered_services)}
- Available Secret Keys (auto-injected & scrubbed in PTY): ${JSON.stringify(
    secretKeys
  )}

## Active Rule Cartridges
${cartridgeBlock || "None selected."}

## Living System Topology (Architecture.md)
${archDoc}

## Engineering Journal (Memory.md)
${memDoc}
`;
}
