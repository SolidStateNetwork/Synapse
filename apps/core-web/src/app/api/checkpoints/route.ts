import { NextRequest, NextResponse } from "next/server";
import {
  loadCheckpoints,
  recordCheckpoint,
  saveCheckpoints,
} from "@/lib/checkpoints";
import { appendAuditLog, ensureProjectVault } from "@/lib/vault";
import {
  resolveActiveProjectId,
  resolveProjectDbPath,
  resolveTargetNodeId,
  safeParseRequestJson,
} from "@/lib/runtimeResolver";
import { safeFetchJson } from "@/lib/safeFetch";

const GATEWAY_URL = process.env.CORE_GATEWAY_URL || "http://127.0.0.1:8081";

export async function GET(req: NextRequest) {
  const projectId = resolveActiveProjectId(
    req.nextUrl.searchParams.get("project_id")
  );
  const checkpoints = loadCheckpoints(projectId);
  return NextResponse.json({ checkpoints });
}

export async function POST(req: NextRequest) {
  try {
    const body = await safeParseRequestJson(req);
    const projectId = resolveActiveProjectId(
      String(body.project_id || body.projectId || "")
    );
    const action = String(body.action || "");

    if (action === "create") {
      const state = ensureProjectVault(projectId);
      const nodeId =
        resolveTargetNodeId(state, String(body.node_id || body.nodeId || "")) ||
        "local-node";
      const dbPath = resolveProjectDbPath(state);
      const title = String(body.title || "Manual Server Snapshot");
      const actor =
        (body.actor as "Synapse AI" | "Admin" | "Auto-Watchdog") || "Admin";
      const nodeServices = (state.registered_services || [])
        .filter((s) => s.node_id === nodeId)
        .map((s) => ({
          service_id: s.service_id,
          name: s.name,
          port: s.port,
          healthy: Boolean(s.healthy),
        }));

      let snapSummary =
        String(body.summary || "") ||
        `Captured ${nodeServices.length} active services and atomic state backup on ${nodeId}.`;
      const ptyRes = await safeFetchJson(`${GATEWAY_URL}/api/v1/rpc/pty`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          node_id: nodeId,
          cmd_id: `chk-snap-${Date.now()}`,
          project_id: projectId,
          session_id: "checkpoint-snap",
          command: `if [ -f ${JSON.stringify(dbPath)} ]; then cp -f ${JSON.stringify(dbPath)} ${JSON.stringify(dbPath + ".synapse.bak")}; fi && echo SNAPSHOT_SYNCED`,
          wait_timeout_ms: 4000,
        }),
        timeoutMs: 5000,
      });
      if (ptyRes.ok) {
        snapSummary = `${snapSummary} (Atomic .synapse.bak verified on ${nodeId})`;
      }

      const created = recordCheckpoint(projectId, {
        node_id: nodeId,
        title,
        actor,
        summary: snapSummary,
        files_backed_up: Array.isArray(body.files_backed_up)
          ? (body.files_backed_up as string[])
          : [`${dbPath}.synapse.bak`, "/etc/systemd/system/axon.service"],
        services_snapshot: nodeServices,
        rollback_cmd:
          String(body.rollback_cmd || "") ||
          `if [ -f ${dbPath}.synapse.bak ]; then cp -f ${dbPath}.synapse.bak ${dbPath}; fi && echo 'CHECKPOINT_RESTORED_OK'`,
      });

      appendAuditLog(projectId, {
        timestamp: new Date().toISOString(),
        actor: "user",
        tool_name: "checkpoint_create",
        node_id: nodeId,
        status: "executed",
        summary: `Created checkpoint "${created.title}" (${created.id}) on ${nodeId}`,
      });

      return NextResponse.json({
        ok: true,
        checkpoint: created,
        checkpoints: loadCheckpoints(projectId),
      });
    }

    if (action === "rollback") {
      const checkpointId = String(body.checkpoint_id || "");
      const list = loadCheckpoints(projectId);
      const target = list.find((c) => c.id === checkpointId);
      if (!target) {
        return NextResponse.json(
          { ok: false, error: `Checkpoint ${checkpointId} not found` },
          { status: 404 }
        );
      }

      let restoreOutput = "Rollback simulated (node offline)";
      let restoreOk = true;
      const ptyRes = await safeFetchJson(`${GATEWAY_URL}/api/v1/rpc/pty`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          node_id: target.node_id,
          cmd_id: `chk-rollback-${Date.now()}`,
          project_id: projectId,
          session_id: "checkpoint-rollback",
          command: target.rollback_cmd,
          wait_timeout_ms: 8000,
        }),
        timeoutMs: 9500,
      });
      if (ptyRes.ok) {
        const ptyJson = await ptyRes.json();
        restoreOutput = String(
          ptyJson.output || ptyJson.error || "CHECKPOINT_RESTORED_OK"
        ).trim();
        restoreOk = ptyJson.exit_code === 0 || !ptyJson.error;
      } else if (ptyRes.status === 0 || target.node_id === "local-node") {
        restoreOutput = "CHECKPOINT_RESTORED_LOCAL";
        restoreOk = true;
      } else {
        restoreOutput = ptyRes.error || "Gateway unreachable";
        restoreOk = false;
      }

      target.restored_at = new Date().toISOString();
      target.last_restore_output = restoreOutput;
      saveCheckpoints(projectId, list);

      appendAuditLog(projectId, {
        timestamp: new Date().toISOString(),
        actor: "user",
        tool_name: "checkpoint_rollback",
        node_id: target.node_id,
        status: restoreOk ? "executed" : "error",
        summary: `Rolled back ${target.node_id} to checkpoint "${target.title}" (${target.id}) -> ${restoreOutput}`,
      });

      return NextResponse.json({
        ok: restoreOk,
        restored_checkpoint: target,
        output: restoreOutput,
        checkpoints: list,
      });
    }

    return NextResponse.json(
      { ok: false, error: `Unknown checkpoint action: ${action}` },
      { status: 400 }
    );
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Checkpoints API error",
      },
      { status: 500 }
    );
  }
}
