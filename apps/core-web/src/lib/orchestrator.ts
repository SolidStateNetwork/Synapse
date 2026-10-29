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
  recordRollbackSnapshot,
  setSecret,
  withProjectStateTransaction,
  writeBrainDoc,
  type FileRollbackSnapshot,
  type ProjectState,
  type RegisteredService,
  type ServiceEndpointAction,
} from "./vault";
import { recordCheckpoint } from "./checkpoints";
import {
  executeFirewallAction,
  type FirewallActionInput,
} from "./firewall";
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

/**
 * Bounded In-Memory Read-Only Tool & File Cache (`read_file`, `list_dir`, `stat`)
 * Automatically invalidated whenever a write/diff/delete or PTY command runs on that node.
 */
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
  if (contentLen > MAX_FS_CACHE_CONTENT_CHARS) {
    return;
  }
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
      if (oldestKey !== undefined) {
        fsReadCache.delete(oldestKey);
      }
    }
  }
  fsReadCache.set(key, { cachedAt: now, response });
}

export function invalidateNodeReadCache(
  projectId: string,
  nodeId?: string
): void {
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
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.nodes || [];
  } catch {
    return [];
  }
}

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
  const assigned = state.assigned_nodes.find((n) => n.node_id === nodeId);
  if (assigned?.tier) return assigned.tier;
  const live = liveNodes.find((n) => n.node_id === nodeId);
  if (live?.tier) return live.tier;
  return "TIER_2_WORKSPACE_JAIL";
}

function isWriteOrExecTool(
  toolName: string,
  args: Record<string, unknown>
): boolean {
  if (toolName === "node_pty_exec") {
    return true;
  }
  if (toolName === "node_firewall_control") {
    return String(args.action || "inspect") !== "inspect";
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
      const updatedState = await withProjectStateTransaction(
        projectId,
        (draft) => {
          draft.registered_services = draft.registered_services.filter(
            (s) => s.service_id !== serviceId
          );
          return draft;
        }
      );
      await pushNodeHealthTargets(updatedState, nodeId);
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

    const rawName = String(args.name || existingSvc?.name || serviceId);
    const rawCat = String(
      args.category || existingSvc?.category || ""
    ).toLowerCase();
    let category: RegisteredService["category"] = "backend";
    if (
      rawCat === "webui" ||
      rawCat === "backend" ||
      rawCat === "database" ||
      rawCat === "worker"
    ) {
      category = rawCat;
    } else if (
      /db|sqlite|postgres|mysql|redis|mongo|sql/i.test(
        `${serviceId} ${rawName}`
      )
    ) {
      category = "database";
    } else if (
      /web|ui|frontend|dashboard|portal|app|next|vite/i.test(
        `${serviceId} ${rawName}`
      )
    ) {
      category = "webui";
    }

    const dbPath = args.db_path
      ? String(args.db_path)
      : existingSvc?.db_path ||
        (category === "database" ||
        /pulse|sqlite/i.test(`${serviceId} ${rawName}`)
          ? `/opt/axon/workspaces/${projectId}/pulse.db`
          : undefined);

    let endpoints: ServiceEndpointAction[] = [];
    if (Array.isArray(args.endpoints) && args.endpoints.length > 0) {
      endpoints = args.endpoints.map(
        (ep: Record<string, unknown>, idx: number) => ({
          id: String(ep.id || `ep-${idx + 1}`),
          label: String(ep.label || `${ep.method || "GET"} ${ep.path || "/"}`),
          method: (["GET", "POST", "PUT", "DELETE", "SQL"].includes(
            String(ep.method || "GET").toUpperCase()
          )
            ? String(ep.method || "GET").toUpperCase()
            : "GET") as ServiceEndpointAction["method"],
          path: String(ep.path || "/"),
          description: ep.description ? String(ep.description) : undefined,
          sample_payload:
            ep.sample_payload !== undefined
              ? String(ep.sample_payload)
              : undefined,
        })
      );
    } else if (existingSvc?.endpoints && existingSvc.endpoints.length > 0) {
      endpoints = existingSvc.endpoints;
    } else {
      endpoints = buildDefaultServiceEndpoints(
        projectId,
        serviceId,
        rawName,
        category,
        pathStr,
        dbPath
      );
    }

    const description = args.description
      ? String(args.description)
      : existingSvc?.description ||
        (category === "webui"
          ? `Interactive WebUI reachable from outside via Synapse Reverse Proxy (127.0.0.1:${port})`
          : category === "database"
          ? `Interactive Database & Storage Engine on ${nodeId} (127.0.0.1:${port})`
          : `Reachable Backend REST API via Synapse Reverse Proxy (127.0.0.1:${port})`);

    const svc: RegisteredService = {
      service_id: serviceId,
      name: rawName,
      node_id: nodeId,
      category,
      description,
      db_path: dbPath,
      endpoints,
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

    const updatedState = await withProjectStateTransaction(
      projectId,
      (draft) => {
        draft.registered_services = [
          ...draft.registered_services.filter(
            (s) => s.service_id !== svc.service_id
          ),
          svc,
        ];
        return draft;
      }
    );
    await pushNodeHealthTargets(updatedState, svc.node_id);

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
    const key = String(args.key || args.key_name || "").trim().toUpperCase();
    const value = String(args.value || args.secret_value || "");
    const length = Number(args.length || 32);
    let keys: string[] = [];

    if (action === "generate_random" && key) {
      keys = generateRandomSecret(projectId, key, length);
    } else if (
      (action === "set_value" || action === "set" || action === "set_secret") &&
      key
    ) {
      keys = setSecret(projectId, key, value);
    } else if ((action === "delete" || action === "delete_secret") && key) {
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

  if (toolName === "core_link_peers") {
    const action = String(args.action || "upsert");
    const sourceNodeId = String(
      args.source_node_id || state.assigned_nodes[0]?.node_id || "node-a"
    );
    const targetNodeId = String(
      args.target_node_id || state.assigned_nodes[1]?.node_id || "node-b"
    );
    const remotePort = Number(args.remote_port || 5432);
    const localPort = Number(args.local_port || remotePort);
    const linkId = String(
      args.link_id || `mesh-${sourceNodeId}-${targetNodeId}-${remotePort}`
    );

    if (action === "remove") {
      await withProjectStateTransaction(projectId, (draft) => {
        draft.peer_mesh_links = (draft.peer_mesh_links || []).filter(
          (l) => l.link_id !== linkId
        );
      });
      try {
        await fetch(`${CORE_GATEWAY_URL}/api/v1/rpc/pty`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            node_id: sourceNodeId,
            cmd_id: `mesh-rm-${Date.now()}`,
            session_id: `mesh-${projectId}`,
            project_id: projectId,
            tier: "TIER_1_UNLEASHED",
            command: `pkill -f "synapse-mesh-${localPort}.py" 2>/dev/null || true`,
            wait_timeout_ms: 4000,
          }),
        });
      } catch {
        // Non-fatal if source node offline
      }
      appendAuditLog(projectId, {
        timestamp: new Date().toISOString(),
        actor: "ai_orchestrator",
        tool_name: toolName,
        node_id: sourceNodeId,
        status: "executed",
        summary: `Removed peer mesh link ${linkId} (${sourceNodeId} -> ${targetNodeId}:${remotePort})`,
        args,
      });
      return {
        tool_name: toolName,
        status: "executed",
        output: { removed: linkId },
      };
    }

    const link = {
      link_id: linkId,
      source_node_id: sourceNodeId,
      target_node_id: targetNodeId,
      local_port: localPort,
      remote_port: remotePort,
      target_port: remotePort,
      protocol: (String(args.protocol || "tcp").toLowerCase() === "http"
        ? "http"
        : "tcp") as "tcp" | "http",
      alias_env: args.alias_env
        ? String(args.alias_env)
        : "PEER_SERVICE_URL",
      description: args.description
        ? String(args.description)
        : `Encrypted mTLS mesh route ${sourceNodeId} (127.0.0.1:${localPort}) -> ${targetNodeId} (127.0.0.1:${remotePort})`,
      created_at: new Date().toISOString(),
    };

    await withProjectStateTransaction(projectId, (draft) => {
      draft.peer_mesh_links = [
        ...(draft.peer_mesh_links || []).filter((l) => l.link_id !== linkId),
        link,
      ];
    });

    // Spawn active loopback mesh relay on sourceNodeId (127.0.0.1:<localPort> -> Core Hub Yamux -> targetNodeId:<remotePort>)
    if (localPort !== remotePort || sourceNodeId !== targetNodeId) {
      const relayScript = `import http.server, urllib.request, sys
TARGET_BASE = "http://127.0.0.1:8081/preview/${projectId}/${targetNodeId}/${remotePort}"
class MeshRelay(http.server.BaseHTTPRequestHandler):
    def log_message(self, format, *args): pass
    def _proxy(self):
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length) if length > 0 else None
        url = TARGET_BASE + (self.path if self.path.startswith("/") else "/" + self.path)
        req = urllib.request.Request(url, data=body, method=self.command)
        for k, v in self.headers.items():
            if k.lower() not in ("host", "content-length"):
                req.add_header(k, v)
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = resp.read()
                self.send_response(resp.status)
                for hk, hv in resp.getheaders():
                    if hk.lower() not in ("transfer-encoding", "content-length"):
                        self.send_header(hk, hv)
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)
        except Exception as e:
            msg = str(e).encode()
            self.send_response(502)
            self.send_header("Content-Length", str(len(msg)))
            self.end_headers()
            self.wfile.write(msg)
    def do_GET(self): self._proxy()
    def do_POST(self): self._proxy()
    def do_PUT(self): self._proxy()
    def do_DELETE(self): self._proxy()
http.server.ThreadingHTTPServer(("127.0.0.1", ${localPort}), MeshRelay).serve_forever()
`;
      const b64Relay = Buffer.from(relayScript, "utf8").toString("base64");
      try {
        await fetch(`${CORE_GATEWAY_URL}/api/v1/rpc/pty`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            node_id: sourceNodeId,
            cmd_id: `mesh-up-${Date.now()}`,
            session_id: `mesh-${projectId}`,
            project_id: projectId,
            tier: "TIER_1_UNLEASHED",
            command: `pkill -f "synapse-mesh-${localPort}.py" 2>/dev/null || true; echo "${b64Relay}" | base64 -d > /tmp/synapse-mesh-${localPort}.py && (nohup python3 /tmp/synapse-mesh-${localPort}.py >/tmp/synapse-mesh-${localPort}.log 2>&1 &); sleep 0.3`,
            wait_timeout_ms: 6000,
          }),
        });
      } catch {
        // Non-fatal if source node offline
      }
    }

    appendAuditLog(projectId, {
      timestamp: new Date().toISOString(),
      actor: "ai_orchestrator",
      tool_name: toolName,
      node_id: sourceNodeId,
      status: "executed",
      summary: `Established Peer-to-Peer Mesh Tunnel: ${sourceNodeId} (127.0.0.1:${localPort}) <=> ${targetNodeId} (127.0.0.1:${remotePort})`,
      args,
    });

    return {
      tool_name: toolName,
      status: "executed",
      output: {
        mesh_link: link,
        note: `Peer ${sourceNodeId} can now reach ${targetNodeId}:${remotePort} directly via 127.0.0.1:${localPort}.`,
      },
    };
  }

  if (toolName === "core_vault_search") {
    return executeCoreVaultSearch(projectId, state, toolName, args);
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

  // 4. Dispatch Remote Node Tool via Core Gateway mTLS Yamux Tunnel
  if (toolName === "node_pty_exec") {
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

  if (toolName === "node_firewall_control") {
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
      return {
        tool_name: toolName,
        status: "executed",
        output: fwRes,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        tool_name: toolName,
        status: "error",
        output: { error: msg },
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
