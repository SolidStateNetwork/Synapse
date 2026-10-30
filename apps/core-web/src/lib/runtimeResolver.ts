import {
  ensureProjectVault,
  listProjects,
  sanitizeProjectId,
  type ProjectState,
} from "./vault";

/**
 * Dynamically resolves the active project ID from an optional request parameter,
 * environment variable, or the first active project stored in the Brain Vault.
 */
export function resolveActiveProjectId(
  requestedId?: unknown,
  fallbackId?: unknown
): string {
  const reqStr = typeof requestedId === "string" ? requestedId.trim() : "";
  if (reqStr) {
    return sanitizeProjectId(reqStr);
  }
  const fbStr = typeof fallbackId === "string" ? fallbackId.trim() : "";
  if (fbStr) {
    return sanitizeProjectId(fbStr);
  }
  const envDefault = process.env.SYNAPSE_DEFAULT_PROJECT?.trim();
  if (envDefault) {
    return sanitizeProjectId(envDefault);
  }
  try {
    const existing = listProjects();
    if (existing.length > 0 && existing[0]?.project_id) {
      return existing[0].project_id;
    }
  } catch {
    // ignore fs read errors
  }
  return "default-project";
}

/**
 * Dynamically resolves the target Muscle node ID for a given project from an explicit request
 * argument, an online assigned node in the project's state, or a neutral fallback identifier.
 */
export function resolveTargetNodeId(
  projectOrId: ProjectState | string,
  requestedNodeId?: unknown,
  liveNodes?: Array<{ node_id?: string; online?: boolean }>
): string {
  const reqStr =
    typeof requestedNodeId === "string" ? requestedNodeId.trim() : "";
  if (reqStr) {
    return reqStr;
  }

  let state: ProjectState | null = null;
  if (typeof projectOrId === "string" && projectOrId.trim()) {
    try {
      state = ensureProjectVault(projectOrId);
    } catch {
      state = null;
    }
  } else if (projectOrId && typeof projectOrId === "object") {
    state = projectOrId;
  }

  if (state && Array.isArray(state.assigned_nodes)) {
    const onlineAssigned = state.assigned_nodes.find(
      (n) => n.online || n.status === "ONLINE"
    );
    if (onlineAssigned?.node_id) {
      return onlineAssigned.node_id;
    }
    if (state.assigned_nodes[0]?.node_id) {
      return state.assigned_nodes[0].node_id;
    }
  }

  if (Array.isArray(liveNodes) && liveNodes.length > 0) {
    const onlineLive = liveNodes.find((n) => n.online && n.node_id);
    if (onlineLive?.node_id) {
      return onlineLive.node_id;
    }
    if (liveNodes[0]?.node_id) {
      return liveNodes[0].node_id;
    }
  }

  return "edge-node-01";
}

/**
 * Builds the set of known local and assigned-node IPv4/IPv6 addresses so security scanners
 * never treat the host's own interface IPs as external brute-force attackers.
 */
export function resolveKnownNodeIps(state: ProjectState): Set<string> {
  const ips = new Set<string>(["127.0.0.1", "::1", "0.0.0.0", "localhost"]);
  for (const node of state.assigned_nodes || []) {
    if (node.network?.public_ipv4) {
      ips.add(node.network.public_ipv4.trim());
    }
    if (node.network?.private_ipv4) {
      ips.add(node.network.private_ipv4.trim());
    }
  }
  for (const hb of Object.values(state.telemetry || {})) {
    if (hb?.public_ipv4) {
      ips.add(hb.public_ipv4.trim());
    }
    if (hb?.private_ipv4) {
      ips.add(hb.private_ipv4.trim());
    }
  }
  return ips;
}

/**
 * Dynamically resolves the SQLite database path for a project from an explicit argument,
 * a registered database service's `db_path`, or the project's workspace directory.
 */
export function resolveProjectDbPath(
  projectOrId: ProjectState | string,
  requestedDbPath?: unknown
): string {
  const reqStr =
    typeof requestedDbPath === "string" ? requestedDbPath.trim() : "";
  if (reqStr) {
    return reqStr;
  }

  let state: ProjectState | null = null;
  let projectId = "default-project";
  if (typeof projectOrId === "string") {
    projectId = resolveActiveProjectId(projectOrId);
    try {
      state = ensureProjectVault(projectId);
    } catch {
      state = null;
    }
  } else if (projectOrId && typeof projectOrId === "object") {
    state = projectOrId;
    projectId = state.project_id || "default-project";
  }

  const dbSvc = (state?.registered_services || []).find(
    (s) => s.db_path && s.db_path.trim().length > 0
  );
  if (dbSvc?.db_path) {
    return dbSvc.db_path.trim();
  }

  return `/opt/axon/workspaces/${projectId}/app.db`;
}

/**
 * Safely parses a JSON request body from a Next.js Request without throwing on empty or malformed payloads.
 */
export async function safeParseRequestJson<
  T extends Record<string, unknown> = Record<string, unknown>,
>(req: Request): Promise<T> {
  try {
    const text = await req.text();
    if (!text || !text.trim()) {
      return {} as T;
    }
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as T;
    }
    return {} as T;
  } catch {
    return {} as T;
  }
}
