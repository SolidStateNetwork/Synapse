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
  readAuditLogs,
  readBrainDoc,
  recordRollbackSnapshot,
  saveProjectState,
  setSecret,
  writeBrainDoc,
  type FileRollbackSnapshot,
  type ProjectState,
  type RegisteredService,
  type ServiceEndpointAction,
} from "./vault";
import { listCartridges } from "./cartridges";
import { recordCheckpoint } from "./checkpoints";
import {
  executeFirewallAction,
  type FirewallActionInput,
} from "./firewall";

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

import { SYNAPSE_TOOL_SCHEMAS } from "./orchestrator/toolSchemas";
export { SYNAPSE_TOOL_SCHEMAS };

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

import {
  buildDefaultServiceEndpoints,
  pushNodeHealthTargets,
} from "@/lib/orchestrator/servicePresets";

export { buildDefaultServiceEndpoints, pushNodeHealthTargets };

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

    const rawName = String(args.name || existingSvc?.name || serviceId);
    const rawCat = String(args.category || existingSvc?.category || "").toLowerCase();
    let category: RegisteredService["category"] = "backend";
    if (
      rawCat === "webui" ||
      rawCat === "backend" ||
      rawCat === "database" ||
      rawCat === "worker"
    ) {
      category = rawCat;
    } else if (/db|sqlite|postgres|mysql|redis|mongo|sql/i.test(`${serviceId} ${rawName}`)) {
      category = "database";
    } else if (/web|ui|frontend|dashboard|portal|app|next|vite/i.test(`${serviceId} ${rawName}`)) {
      category = "webui";
    }

    const dbPath = args.db_path
      ? String(args.db_path)
      : existingSvc?.db_path ||
        (category === "database" || /pulse|sqlite/i.test(`${serviceId} ${rawName}`)
          ? `/opt/axon/workspaces/${projectId}/pulse.db`
          : undefined);

    let endpoints: ServiceEndpointAction[] = [];
    if (Array.isArray(args.endpoints) && args.endpoints.length > 0) {
      endpoints = args.endpoints.map((ep: Record<string, unknown>, idx: number) => ({
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
          ep.sample_payload !== undefined ? String(ep.sample_payload) : undefined,
      }));
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
      state.peer_mesh_links = (state.peer_mesh_links || []).filter(
        (l) => l.link_id !== linkId
      );
      saveProjectState(state);
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

    state.peer_mesh_links = [
      ...(state.peer_mesh_links || []).filter((l) => l.link_id !== linkId),
      link,
    ];
    saveProjectState(state);

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
    const rawQuery = String(args.query || "").trim();
    const scope = String(args.scope || "all").toLowerCase();
    const archDoc = readBrainDoc(projectId, "Architecture.md");
    const memDoc = readBrainDoc(projectId, "Memory.md");
    const auditLogs = readAuditLogs(projectId, 80);
    const cartridges = listCartridges();
    const secretKeys = listSecretKeys(projectId);

    const filterLines = (text: string, q: string): string[] => {
      if (!q) return text.split("\n").slice(0, 60);
      try {
        const rx = new RegExp(q, "i");
        const lines = text.split("\n");
        const matched: string[] = [];
        lines.forEach((line, idx) => {
          if (rx.test(line)) {
            const start = Math.max(0, idx - 1);
            const end = Math.min(lines.length - 1, idx + 1);
            matched.push(
              lines
                .slice(start, end + 1)
                .map((l, i) => `L${start + i + 1}: ${l}`)
                .join("\n")
            );
          }
        });
        return matched.slice(0, 30);
      } catch {
        return text
          .split("\n")
          .filter((l) => l.toLowerCase().includes(q.toLowerCase()))
          .slice(0, 30);
      }
    };

    const resultPayload: Record<string, unknown> = {
      project_id: projectId,
      query: rawQuery || "*",
      scope,
    };

    if (scope === "all" || scope === "services") {
      resultPayload.registered_services = state.registered_services.filter(
        (s) =>
          !rawQuery ||
          JSON.stringify(s).toLowerCase().includes(rawQuery.toLowerCase())
      );
      resultPayload.assigned_nodes = state.assigned_nodes;
      resultPayload.peer_mesh_links = state.peer_mesh_links || [];
      resultPayload.scheduled_playbooks = state.scheduled_playbooks || [];
      resultPayload.secret_keys_available = secretKeys;
    }

    if (scope === "all" || scope === "architecture") {
      resultPayload.architecture_matches = filterLines(archDoc, rawQuery);
    }

    if (scope === "all" || scope === "memory") {
      resultPayload.memory_matches = filterLines(memDoc, rawQuery);
    }

    if (scope === "all" || scope === "audit") {
      resultPayload.recent_audit_matches = auditLogs
        .filter(
          (a) =>
            !rawQuery ||
            JSON.stringify(a).toLowerCase().includes(rawQuery.toLowerCase())
        )
        .slice(0, 15)
        .map((a) => ({
          timestamp: a.timestamp,
          actor: a.actor,
          tool_name: a.tool_name,
          node_id: a.node_id,
          status: a.status,
          summary: a.summary,
        }));
    }

    if (scope === "all" || scope === "cartridges") {
      resultPayload.active_cartridges = state.active_cartridges;
      resultPayload.available_cartridges = cartridges.map((c) => ({
        id: c.id,
        name: c.name,
        category: c.category,
        active: state.active_cartridges.includes(c.id),
        description: c.description,
      }));
    }

    appendAuditLog(projectId, {
      timestamp: new Date().toISOString(),
      actor: "ai_orchestrator",
      tool_name: toolName,
      status: "executed",
      summary: `Vault search (scope=${scope}, query='${rawQuery || "*"}')`,
      args,
    });

    return {
      tool_name: toolName,
      status: "executed",
      output: resultPayload,
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

  if (toolName === "node_deep_search") {
    const searchMode = String(args.search_mode || "process_and_port_map");
    const rawQuery = String(args.query || "").trim();
    const targetDir = String(
      args.target_dir || `/opt/axon/workspaces`
    ).trim();
    const fileGlob = String(args.file_glob || "").trim();
    const contextLines = Math.max(
      0,
      Math.min(10, Number(args.context_lines ?? 2))
    );
    const registeredPorts = state.registered_services
      .filter((s) => s.node_id === targetNodeId)
      .map((s) => s.port);

    const pyScript = `
import os, sys, glob, re, json, sqlite3, subprocess, time, urllib.request

MODE = ${JSON.stringify(searchMode)}
QUERY = ${JSON.stringify(rawQuery)}
TARGET_DIR = ${JSON.stringify(targetDir)}
FILE_GLOB = ${JSON.stringify(fileGlob)}
CTX = ${JSON.stringify(contextLines)}
REG_PORTS = ${JSON.stringify(registeredPorts)}

def sh(cmd, timeout=12):
    try:
        out = subprocess.check_output(cmd, shell=True, stderr=subprocess.STDOUT, timeout=timeout, text=True)
        return out.strip()
    except subprocess.CalledProcessError as e:
        return (e.output or "").strip()
    except Exception as e:
        return f"[error: {e}]"

if MODE == "content_grep":
    print(f"=== [DEEP CONTENT GREP] dir={TARGET_DIR} query={QUERY!r} glob={FILE_GLOB!r} ===")
    pattern = QUERY or "def |class |PORT|http|sqlite|error|listen"
    try:
        rx = re.compile(pattern, re.IGNORECASE)
    except Exception:
        rx = re.compile(re.escape(pattern), re.IGNORECASE)
    matches = 0
    for root, dirs, files in os.walk(TARGET_DIR):
        dirs[:] = [d for d in dirs if d not in (".git", "node_modules", "__pycache__", ".next", "venv")]
        for f in sorted(files):
            if f == ".synapse_deep_search.py":
                continue
            if FILE_GLOB and not glob.fnmatch.fnmatch(f, FILE_GLOB):
                continue
            fp = os.path.join(root, f)
            try:
                if os.path.getsize(fp) > 2_000_000:
                    continue
                with open(fp, "r", encoding="utf-8", errors="ignore") as fh:
                    lines = fh.readlines()
                for idx, line in enumerate(lines):
                    if rx.search(line):
                        matches += 1
                        start = max(0, idx - CTX)
                        end = min(len(lines), idx + CTX + 1)
                        snippet = "".join(f"  L{i+1}: {lines[i]}" for i in range(start, end))
                        print(f"\\n[MATCH #{matches}] {fp}:{idx+1}\\n{snippet.rstrip()}")
                        if matches >= 80:
                            break
            except Exception:
                pass
        if matches >= 80:
            break
    if matches == 0:
        print("No matching lines found.")

elif MODE == "file_find":
    print(f"=== [DEEP FILE & DIRECTORY INVENTORY] dir={TARGET_DIR} filter={QUERY or FILE_GLOB or '*'} ===")
    count = 0
    for root, dirs, files in os.walk(TARGET_DIR):
        dirs[:] = [d for d in dirs if d not in (".git", "node_modules", "__pycache__", ".next")]
        for f in sorted(files):
            if f == ".synapse_deep_search.py":
                continue
            fp = os.path.join(root, f)
            if FILE_GLOB and not glob.fnmatch.fnmatch(f, FILE_GLOB):
                continue
            if QUERY and QUERY.lower() not in fp.lower():
                continue
            try:
                st = os.stat(fp)
                mode_oct = oct(st.st_mode & 0o777)
                mtime = time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime(st.st_mtime))
                line_info = ""
                if st.st_size < 500_000 and not fp.endswith((".db", ".sqlite", ".png", ".jpg", ".gz")):
                    with open(fp, "rb") as bf:
                        line_info = f" ({bf.read().count(b'\\n') + 1} lines)"
                print(f"{mode_oct} | {st.st_size:>8} bytes | {mtime} | {fp}{line_info}")
                count += 1
            except Exception:
                pass
    print(f"Total files matched: {count}")

elif MODE == "log_scan":
    print(f"=== [DEEP LOG & JOURNAL FORENSICS] query={QUERY or 'ERROR|WARN|Traceback|Exception|CRITICAL|Fail'} ===")
    pat = QUERY or r"error|warn|traceback|exception|critical|fail|panic|killed|refused"
    rx = re.compile(pat, re.IGNORECASE)
    log_dirs = [TARGET_DIR, "/tmp", "/var/log"]
    seen = set()
    for d in log_dirs:
        if not os.path.exists(d):
            continue
        for root, dirs, files in os.walk(d):
            if root.count(os.sep) - d.count(os.sep) > 3:
                continue
            for f in sorted(files):
                if not (f.endswith(".log") or "synapse" in f or "axon" in f or f in ("syslog", "auth.log", "dmesg")):
                    continue
                fp = os.path.join(root, f)
                if fp in seen:
                    continue
                seen.add(fp)
                try:
                    with open(fp, "r", encoding="utf-8", errors="ignore") as fh:
                        lines = fh.readlines()
                    hits = [f"L{i+1}: {l.strip()}" for i, l in enumerate(lines) if rx.search(l)]
                    tail = [l.strip() for l in lines[-8:] if l.strip()]
                    print(f"\\n--- LOG FILE: {fp} ({len(lines)} total lines, {len(hits)} pattern hits) ---")
                    if hits:
                        print("  [Pattern Hits (latest 12)]:")
                        for h in hits[-12:]:
                            print("   ", h[:200])
                    if tail:
                        print("  [Latest Tail]:")
                        for t in tail[-5:]:
                            print("   ", t[:200])
                except Exception as e:
                    print(f"--- LOG FILE: {fp} [unreadable: {e}] ---")
    print("\\n--- SYSTEMD JOURNAL (latest 25 entries) ---")
    print(sh("journalctl -n 25 --no-pager 2>/dev/null || dmesg | tail -n 20"))
    print("\\n--- DOCKER CONTAINER LOGS ---")
    print(sh("for c in $(docker ps -q 2>/dev/null); do name=$(docker inspect --format '{{.Name}}' $c); echo 'Container:' $name; docker logs --tail 15 $c 2>&1; done"))

elif MODE == "process_and_port_map":
    print("=== [1. HOST SYSTEM & RESOURCES] ===")
    print(sh("uname -a && uptime && free -h && df -h / /opt/axon/workspaces 2>/dev/null"))
    print("\\n=== [2. LISTENING NETWORK SOCKETS (ss -tulpn)] ===")
    print(sh("ss -tulpn"))
    print("\\n=== [3. TOP RUNNING PROCESSES & WORKSPACE DAEMONS] ===")
    print(sh("ps -eo pid,ppid,user,%cpu,%mem,etime,args --sort=-%mem | head -n 30"))
    print("\\n=== [4. DOCKER CONTAINERS & SYSTEMD SERVICES] ===")
    print(sh("docker ps -a --format 'table {{.Names}}\\t{{.Image}}\\t{{.Status}}\\t{{.Ports}}' 2>/dev/null || echo 'Docker not active'"))
    print(sh("systemctl list-units --type=service --state=running --no-pager 2>/dev/null | head -n 25"))
    print("\\n=== [5. LIVE HTTP/TCP PROBES ON REGISTERED SERVICE PORTS] ===")
    ports_to_check = sorted(list(set(REG_PORTS + [4050, 4070, 4085, 4090])))
    for p in ports_to_check:
        try:
            req = urllib.request.Request(f"http://127.0.0.1:{p}/", headers={"User-Agent": "Synapse-DevOps-Scanner"})
            with urllib.request.urlopen(req, timeout=3) as resp:
                body = resp.read(400).decode("utf-8", errors="ignore")
                hdrs = dict(resp.getheaders())
                print(f"Port :{p} -> HTTP {resp.status} | Headers: {json.dumps(hdrs)} | Body: {body[:180]}")
        except Exception as e:
            print(f"Port :{p} -> UNREACHABLE or NON-HTTP ({e})")

elif MODE == "sqlite_inspect":
    print(f"=== [DEEP SQLITE DATABASE DISCOVERY & INTEGRITY AUDIT] dir={TARGET_DIR} ===")
    db_files = []
    for root, dirs, files in os.walk(TARGET_DIR):
        for f in sorted(files):
            if f.endswith((".db", ".sqlite", ".sqlite3")):
                db_files.append(os.path.join(root, f))
    if not db_files:
        print("No SQLite database files found.")
    for dbf in db_files:
        try:
            st = os.stat(dbf)
            print(f"\\n>>> DATABASE: {dbf} (size={st.st_size} bytes, mode={oct(st.st_mode & 0o777)})")
            conn = sqlite3.connect(dbf)
            cur = conn.cursor()
            integrity = cur.execute("PRAGMA integrity_check;").fetchall()
            print(f"  PRAGMA integrity_check: {integrity}")
            tables = cur.execute("SELECT name, sql FROM sqlite_master WHERE type='table';").fetchall()
            print(f"  Tables ({len(tables)}):")
            for tname, tsql in tables:
                cnt = cur.execute(f"SELECT COUNT(*) FROM \\"{tname}\\";").fetchone()[0]
                sample = cur.execute(f"SELECT * FROM \\"{tname}\\" ORDER BY rowid DESC LIMIT 3;").fetchall()
                print(f"    - Table '{tname}': {cnt} row(s) | Schema: {tsql}")
                print(f"      Latest rows: {sample}")
            conn.close()
        except Exception as e:
            print(f"  [SQLite Error on {dbf}]: {e}")

elif MODE == "security_forensics":
    print("=== [1. PUBLIC VS LOOPBACK NETWORK BINDINGS (ss -tulpn)] ===")
    print(sh("ss -tulpn"))
    print("\\n=== [2. SSH DAEMON CONFIGURATION & HARDENING] ===")
    print(sh("grep -E -v '^[[:space:]]*(#|$)' /etc/ssh/sshd_config /etc/ssh/sshd_config.d/*.conf 2>/dev/null || true"))
    print("\\n=== [3. RECENT SSH / AUTHENTICATION SECURITY EVENTS] ===")
    print(sh("journalctl -u ssh -u sshd -n 25 --no-pager 2>/dev/null || tail -n 25 /var/log/auth.log 2>/dev/null || echo 'No auth log entries'"))
    print("\\n=== [4. FIREWALL & PACKET FILTER STATUS (UFW / IPTABLES / NFTABLES)] ===")
    print(sh("ufw status verbose 2>/dev/null; iptables -L -n -v 2>/dev/null | head -n 35; nft list ruleset 2>/dev/null | head -n 35"))
    print("\\n=== [5. KERNEL NETWORK SECURITY SYSCTL FLAGS] ===")
    print(sh("sysctl net.ipv4.ip_forward net.ipv4.conf.all.rp_filter net.ipv4.tcp_syncookies net.ipv4.conf.all.accept_redirects 2>/dev/null"))
    print("\\n=== [6. WORKSPACE FILE PERMISSIONS & SENSITIVE FILES] ===")
    print(sh(f"find {TARGET_DIR} -maxdepth 4 -not -name '.synapse_deep_search.py' -printf '%M %u:%g %s %p\\n' 2>/dev/null"))
    print("\\n=== [7. PLAINTEXT SECRET / KEY SCAN IN WORKSPACE] ===")
    print(sh(f"grep -rnI --exclude='.synapse_deep_search.py' -E '(API_KEY|SECRET|PASSWORD|PRIVATE KEY|BEGIN OPENSSH|Bearer )' {TARGET_DIR} 2>/dev/null | head -n 30 || echo 'No plaintext secret patterns found'"))
    print("\\n=== [8. HTTP SECURITY HEADERS ON ACTIVE LOCAL SERVICES] ===")
    for p in sorted(list(set(REG_PORTS + [4050, 4070, 4085, 4090]))):
        try:
            req = urllib.request.Request(f"http://127.0.0.1:{p}/")
            with urllib.request.urlopen(req, timeout=3) as resp:
                hdrs = {k.lower(): v for k, v in resp.getheaders()}
                sec = {h: hdrs.get(h, "MISSING") for h in ["x-powered-by", "x-content-type-options", "x-frame-options", "content-security-policy", "strict-transport-security", "access-control-allow-origin"]}
                print(f"Port :{p} (HTTP {resp.status}) Security Headers -> {json.dumps(sec)}")
        except Exception as e:
            print(f"Port :{p} -> Not HTTP / Offline ({e})")
`;

    const cmdId = `search-${crypto.randomBytes(4).toString("hex")}`;
    try {
      // 1. Write the diagnostic script directly via atomic FS RPC (avoids 4096-byte Linux PTY canonical line limit)
      await fetch(`${CORE_GATEWAY_URL}/api/v1/rpc/fs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          node_id: targetNodeId,
          request_id: `fs-${cmdId}`,
          project_id: projectId,
          tier,
          operation: "write_file",
          path: ".synapse_deep_search.py",
          content: pyScript,
          file_mode: "0755",
        }),
      });

      // 2. Execute the diagnostic script via PTY RPC
      const payload = {
        node_id: targetNodeId,
        cmd_id: cmdId,
        session_id: `deep-search-v3-${projectId}`,
        project_id: projectId,
        tier,
        command: `python3 .synapse_deep_search.py`,
        wait_timeout_ms: 30000,
        secrets: {},
        send_signal: "NONE",
      };

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
        status: "executed",
        summary: `Deep Search [${targetNodeId}] mode=${searchMode} query='${
          rawQuery || "*"
        }'`,
        args: {
          search_mode: searchMode,
          query: rawQuery,
          target_dir: targetDir,
          file_glob: fileGlob,
        },
      });
      return {
        tool_name: toolName,
        status: "executed",
        output: {
          search_mode: searchMode,
          node_id: targetNodeId,
          query: rawQuery || "*",
          findings: data.output,
          exit_code: data.exit_code,
        },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        tool_name: toolName,
        status: "error",
        output: { error: `Failed to execute node_deep_search: ${msg}` },
      };
    }
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
        fsReadCache.set(cacheKey, {
          cachedAt: Date.now(),
          response: data,
        });
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
6. LANGUAGE MATCHING RULE (CRITICAL): Always respond in the exact natural language used by the user in their latest message. If the user writes to you in English, you MUST write your entire response, explanations, section headings, and tables in English. If the user writes to you in German, you MUST write your entire response, explanations, section headings, and tables in German.

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
When developing web applications, backend APIs, or databases on any node, always bind dev servers to \`127.0.0.1:<port>\` (or container port mapped to \`127.0.0.1:<port>\`) and call \`core_register_service\` with:
- \`enable_preview_tunnel: true\`
- \`category\`: \`"webui"\`, \`"backend"\`, or \`"database"\`
- \`description\`: Clear summary of how the user can reach and use this component via the Reverse Proxy
- \`db_path\`: Path to the SQLite file (when SQLite is used)
- \`endpoints\`: Clickable interactive options (\`GET\`, \`POST\`, \`PUT\`, \`DELETE\`, or \`SQL\`) with pre-filled \`sample_payload\` inputs so the user gets an interactive clickable Reverse-Proxy & Live-Preview Explorer Box right in the Core WebUI.`;

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
