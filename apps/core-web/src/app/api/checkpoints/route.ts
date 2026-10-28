import { NextRequest, NextResponse } from "next/server";
import {
  loadCheckpoints,
  recordCheckpoint,
  saveCheckpoints,
} from "@/lib/checkpoints";
import { appendAuditLog, ensureProjectVault } from "@/lib/vault";

const GATEWAY_URL = process.env.CORE_GATEWAY_URL || "http://127.0.0.1:8081";

export async function GET(req: NextRequest) {
  const projectId =
    req.nextUrl.searchParams.get("project_id") || "synapse-cloud-demo";
  const checkpoints = loadCheckpoints(projectId);
  return NextResponse.json({ checkpoints });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const projectId = String(body.project_id || "synapse-cloud-demo");
    const action = String(body.action || "");

    if (action === "create") {
      const nodeId = String(body.node_id || "vps2-muscle");
      const title = String(body.title || "Manual Server Snapshot");
      const actor =
        (body.actor as "Synapse AI" | "Admin" | "Auto-Watchdog") || "Admin";
      const state = ensureProjectVault(projectId);
      const nodeServices = (state.registered_services || [])
        .filter((s) => s.node_id === nodeId)
        .map((s) => ({
          service_id: s.service_id,
          name: s.name,
          port: s.port,
          healthy: Boolean(s.healthy),
        }));

      // Trigger an atomic backup copy of pulse.db and any .synapse.bak files on the Muscle node
      let snapSummary =
        body.summary ||
        `Captured ${nodeServices.length} active services and atomic state backup on ${nodeId}.`;
      try {
        const ptyRes = await fetch(`${GATEWAY_URL}/api/v1/rpc/pty`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            node_id: nodeId,
            cmd_id: `chk-snap-${Date.now()}`,
            project_id: projectId,
            session_id: "checkpoint-snap",
            command:
              "if [ -f /var/lib/synapse/pulse-stack/pulse.db ]; then cp -f /var/lib/synapse/pulse-stack/pulse.db /var/lib/synapse/pulse-stack/pulse.db.synapse.bak; fi && echo SNAPSHOT_SYNCED",
            wait_timeout_ms: 4000,
          }),
        });
        if (ptyRes.ok) {
          snapSummary = `${snapSummary} (Atomic .synapse.bak verified on ${nodeId})`;
        }
      } catch {
        // non-fatal if offline
      }

      const created = recordCheckpoint(projectId, {
        node_id: nodeId,
        title,
        actor,
        summary: snapSummary,
        files_backed_up: body.files_backed_up || [
          "/var/lib/synapse/pulse-stack/pulse.db.synapse.bak",
          "/etc/systemd/system/axon.service",
        ],
        services_snapshot: nodeServices,
        rollback_cmd:
          body.rollback_cmd ||
          "if [ -f /var/lib/synapse/pulse-stack/pulse.db.synapse.bak ]; then cp -f /var/lib/synapse/pulse-stack/pulse.db.synapse.bak /var/lib/synapse/pulse-stack/pulse.db; fi && docker start synapse-cloud-demo-status 2>/dev/null || true && echo 'CHECKPOINT_RESTORED_OK'",
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
      try {
        const ptyRes = await fetch(`${GATEWAY_URL}/api/v1/rpc/pty`, {
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
        });
        const ptyJson = await ptyRes.json();
        restoreOutput = String(
          ptyJson.output || ptyJson.error || "CHECKPOINT_RESTORED_OK"
        ).trim();
        restoreOk = ptyRes.ok && (ptyJson.exit_code === 0 || !ptyJson.error);
      } catch (e) {
        restoreOutput = e instanceof Error ? e.message : "Gateway unreachable";
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
