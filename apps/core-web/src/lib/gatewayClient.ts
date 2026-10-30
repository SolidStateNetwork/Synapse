import crypto from "crypto";
import type {
  AutonomyTier,
  FsOperation,
  FsResponse,
  NodeHeartbeat,
  PtyExecResponse,
} from "@proto/tunnel";
import { resolveActiveProjectId } from "./runtimeResolver";
import { safeFetchJson } from "./safeFetch";

export const CORE_GATEWAY_URL =
  process.env.CORE_GATEWAY_URL || "http://127.0.0.1:8081";

export interface GatewayLiveNode {
  node_id: string;
  tier: AutonomyTier;
  remote_addr: string;
  connected_at: string;
  online: boolean;
  last_heartbeat?: NodeHeartbeat;
}

export interface NormalizedApiParams {
  projectId: string;
  nodeId: string;
  serviceId: string;
  action: string;
}

/**
 * Normalizes both camelCase and snake_case API request parameters into a consistent shape.
 */
export function normalizeApiParams(
  body: Record<string, unknown>,
  defaultProjectId?: string
): NormalizedApiParams {
  const rawProjectId = String(
    body.projectId || body.project_id || defaultProjectId || ""
  ).trim();
  const projectId = resolveActiveProjectId(rawProjectId);
  const nodeId = String(body.nodeId || body.node_id || "").trim();
  const serviceId = String(body.serviceId || body.service_id || "").trim();
  const action = String(body.action || "").trim();
  return { projectId, nodeId, serviceId, action };
}

export async function gatewayFetchLiveNodes(
  timeoutMs = 4000
): Promise<GatewayLiveNode[]> {
  const res = await safeFetchJson(`${CORE_GATEWAY_URL}/api/v1/nodes`, {
    cache: "no-store",
    timeoutMs,
  });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data?.nodes) ? data.nodes : [];
}

export async function gatewayExecPty(params: {
  node_id: string;
  project_id?: string;
  session_id?: string;
  command: string;
  wait_timeout_ms?: number;
  tier?: AutonomyTier;
  cmd_id?: string;
}): Promise<PtyExecResponse> {
  const cmdId =
    params.cmd_id || `pty-${crypto.randomBytes(4).toString("hex")}`;
  const waitMs = params.wait_timeout_ms ?? 10000;
  const projectId = resolveActiveProjectId(params.project_id);
  const res = await safeFetchJson(`${CORE_GATEWAY_URL}/api/v1/rpc/pty`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      node_id: params.node_id,
      cmd_id: cmdId,
      project_id: projectId,
      session_id: params.session_id || "default",
      tier: params.tier,
      command: params.command,
      wait_timeout_ms: waitMs,
    }),
    timeoutMs: waitMs + 4000,
  });
  if (res.ok) {
    return (await res.json()) as PtyExecResponse;
  }
  return {
    cmd_id: cmdId,
    session_id: params.session_id || "default",
    output: res.error || "Gateway PTY RPC failed",
    exit_code: 1,
    cwd: "",
    timed_out: false,
    truncated: false,
    blocked_by_guardrail: false,
  };
}

export async function gatewayFsOperation(params: {
  node_id: string;
  project_id?: string;
  operation: FsOperation;
  path: string;
  content?: string;
  file_mode?: string;
  request_id?: string;
}): Promise<FsResponse> {
  const reqId =
    params.request_id || `fs-${crypto.randomBytes(4).toString("hex")}`;
  const projectId = resolveActiveProjectId(params.project_id);
  const res = await safeFetchJson(`${CORE_GATEWAY_URL}/api/v1/rpc/fs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      node_id: params.node_id,
      request_id: reqId,
      project_id: projectId,
      operation: params.operation,
      path: params.path,
      content: params.content || "",
      file_mode: params.file_mode || "0644",
    }),
    timeoutMs: 12000,
  });
  if (res.ok) {
    return (await res.json()) as FsResponse;
  }
  return {
    request_id: reqId,
    success: false,
    error: res.error || "Gateway FS RPC failed",
  };
}

export async function gatewayPushHealthTargets(
  nodeId: string,
  targets: Array<{
    service_id: string;
    name: string;
    protocol: string;
    port: number;
    path: string;
    target: string;
    interval_sec: number;
  }>
): Promise<boolean> {
  if (!nodeId) return false;
  const res = await safeFetchJson(
    `${CORE_GATEWAY_URL}/api/v1/nodes/health-targets`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ node_id: nodeId, targets }),
      timeoutMs: 4000,
    }
  );
  return res.ok;
}
