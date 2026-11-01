import { recordCheckpoint } from "../checkpoints";
import { resolveTargetNodeId } from "../runtimeResolver";
import {
  executeSqliteStudioAction,
  hotReloadServiceCodeOnMuscle,
  loadCronJobs,
  loadServiceCodeFromMuscle,
  runCronJobNowOnMuscle,
  saveCronJobs,
} from "../v070-studio";
import type { ProjectState } from "../vault";
import type { ToolDispatchResult } from "../orchestrator";

export async function dispatchStudioDevOpsTool(
  projectId: string,
  state: ProjectState,
  toolName: string,
  args: Record<string, unknown>
): Promise<ToolDispatchResult | null> {
  const nodeId = resolveTargetNodeId(state, args.node_id ? String(args.node_id) : undefined) || "local-node";

  if (toolName === "core_hot_reload_service_code") {
    const action = String(args.action || "inspect");
    const port = Number(args.port || 4050);
    const serviceId = String(args.service_id || `svc-${port}`);

    if (action === "inspect") {
      const snap = await loadServiceCodeFromMuscle({ projectId, nodeId, serviceId, port });
      return { tool_name: toolName, status: "executed", output: snap };
    }

    if (action === "hot_reload") {
      const code = String(args.code || "");
      if (!code.trim()) {
        return { tool_name: toolName, status: "error", output: { ok: false, error: "Code cannot be empty" } };
      }
      const res = await hotReloadServiceCodeOnMuscle({
        projectId,
        nodeId,
        serviceId,
        port,
        filePath: args.file_path ? String(args.file_path) : undefined,
        code,
      });
      return { tool_name: toolName, status: res.ok ? "executed" : "error", output: res };
    }
  }

  if (toolName === "core_sqlite_studio") {
    const res = await executeSqliteStudioAction({
      projectId,
      nodeId,
      dbPath: args.db_path ? String(args.db_path) : undefined,
      table: args.table ? String(args.table) : undefined,
      customSql: args.custom_sql ? String(args.custom_sql) : undefined,
      insertRow:
        args.insert_row && typeof args.insert_row === "object"
          ? (args.insert_row as Record<string, string>)
          : undefined,
    });
    return { tool_name: toolName, status: res.ok ? "executed" : "error", output: res };
  }

  if (toolName === "core_manage_cron_jobs") {
    const action = String(args.action || "list");
    const jobs = loadCronJobs(projectId);

    if (action === "list") {
      return { tool_name: toolName, status: "executed", output: { ok: true, cron_jobs: jobs } };
    }

    if (action === "save") {
      const jobId = String(args.id || `cron-${Date.now().toString(36)}`);
      const preFlightCp = recordCheckpoint(projectId, {
        node_id: nodeId,
        title: `Pre-Flight Cron Runbook Save: ${jobId}`,
        actor: "Auto-Watchdog",
        summary: `Automatic pre-flight checkpoint before saving cron runbook '${jobId}' on ${nodeId}.`,
        files_backed_up: [`/opt/axon/workspaces/${projectId}`],
        services_snapshot: (state.registered_services || []).map((s) => ({
          service_id: s.service_id,
          name: s.name,
          port: s.port,
          healthy: s.healthy !== false,
        })),
        rollback_cmd: "echo 'CHECKPOINT_RESTORED_OK'",
      });
      const existingIdx = jobs.findIndex((j) => j.id === jobId);
      const job = {
        id: jobId,
        name: String(args.name || "Scheduled Cron Runbook").trim(),
        cron_expression: String(args.cron_expression || "*/15 * * * *").trim(),
        node_id: nodeId,
        command: String(args.command || "uptime").trim(),
        enabled: args.enabled !== false,
        last_run_at: existingIdx >= 0 ? jobs[existingIdx].last_run_at : undefined,
        last_exit_code: existingIdx >= 0 ? jobs[existingIdx].last_exit_code : undefined,
        last_duration_ms: existingIdx >= 0 ? jobs[existingIdx].last_duration_ms : undefined,
        last_output: existingIdx >= 0 ? jobs[existingIdx].last_output : undefined,
      };
      if (existingIdx >= 0) jobs[existingIdx] = job;
      else jobs.unshift(job);
      saveCronJobs(projectId, jobs);
      return {
        tool_name: toolName,
        status: "executed",
        output: { ok: true, job, cron_jobs: jobs, checkpoint_id: preFlightCp.id },
      };
    }

    if (action === "delete") {
      const jobId = String(args.id || "");
      const preFlightCp = recordCheckpoint(projectId, {
        node_id: nodeId,
        title: `Pre-Flight Cron Runbook Delete: ${jobId}`,
        actor: "Auto-Watchdog",
        summary: `Automatic pre-flight checkpoint before deleting cron runbook '${jobId}'.`,
        files_backed_up: [`/opt/axon/workspaces/${projectId}`],
        services_snapshot: (state.registered_services || []).map((s) => ({
          service_id: s.service_id,
          name: s.name,
          port: s.port,
          healthy: s.healthy !== false,
        })),
        rollback_cmd: "echo 'CHECKPOINT_RESTORED_OK'",
      });
      const remaining = jobs.filter((j) => j.id !== jobId);
      saveCronJobs(projectId, remaining);
      return {
        tool_name: toolName,
        status: "executed",
        output: { ok: true, cron_jobs: remaining, checkpoint_id: preFlightCp.id },
      };
    }

    if (action === "run_now") {
      const res = await runCronJobNowOnMuscle({
        projectId,
        jobId: String(args.id || jobs[0]?.id || "cron-health-audit"),
        nodeId,
      });
      return { tool_name: toolName, status: res.ok ? "executed" : "error", output: res };
    }
  }

  return null;
}
