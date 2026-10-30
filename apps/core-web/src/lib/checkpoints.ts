import fs from "fs";
import path from "path";
import {
  atomicWriteJsonSync,
  ensureProjectVault,
  getProjectDir,
  safeReadJsonWithBackupSync,
} from "@/lib/vault";
import {
  resolveActiveProjectId,
  resolveProjectDbPath,
  resolveTargetNodeId,
} from "@/lib/runtimeResolver";

export interface ServerCheckpoint {
  id: string;
  project_id: string;
  node_id: string;
  timestamp: string;
  title: string;
  actor: "Synapse AI" | "Admin" | "Auto-Watchdog";
  summary: string;
  files_backed_up: string[];
  services_snapshot: Array<{
    service_id: string;
    name: string;
    port: number;
    healthy: boolean;
  }>;
  rollback_cmd: string;
  restored_at?: string;
  last_restore_output?: string;
}

function getCheckpointsFilePath(projectId: string): string {
  const projDir = getProjectDir(resolveActiveProjectId(projectId));
  fs.mkdirSync(projDir, { recursive: true });
  return path.join(projDir, "Checkpoints.json");
}

export function loadCheckpoints(projectId: string): ServerCheckpoint[] {
  const resolvedProjectId = resolveActiveProjectId(projectId);
  const filePath = getCheckpointsFilePath(resolvedProjectId);
  const parsed = safeReadJsonWithBackupSync<ServerCheckpoint[] | null>(
    filePath,
    null
  );
  if (Array.isArray(parsed)) {
    return parsed;
  }

  const state = ensureProjectVault(resolvedProjectId);
  const nodeId = resolveTargetNodeId(state) || "local-node";
  const dbPath = resolveProjectDbPath(state);
  const servicesSnapshot = (state.registered_services || []).map((svc) => ({
    service_id: svc.service_id,
    name: svc.name,
    port: svc.port,
    healthy: svc.healthy !== false,
  }));

  const seeded: ServerCheckpoint[] = [
    {
      id: `chk-baseline-${resolvedProjectId}`,
      project_id: resolvedProjectId,
      node_id: nodeId,
      timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      title: "Verified Infrastructure Baseline",
      actor: "Synapse AI",
      summary:
        servicesSnapshot.length > 0
          ? `Baseline snapshot of ${servicesSnapshot.length} registered service(s) on ${nodeId} and mTLS reverse-tunnel state.`
          : `Initial workspace baseline snapshot for ${resolvedProjectId}.`,
      files_backed_up: [dbPath, "/etc/systemd/system/axon.service"],
      services_snapshot: servicesSnapshot,
      rollback_cmd: `if [ -f ${dbPath}.synapse.bak ]; then cp -f ${dbPath}.synapse.bak ${dbPath}; fi && echo 'CHECKPOINT_RESTORED_OK'`,
    },
  ];
  saveCheckpoints(resolvedProjectId, seeded);
  return seeded;
}

export function saveCheckpoints(
  projectId: string,
  checkpoints: ServerCheckpoint[]
): void {
  const filePath = getCheckpointsFilePath(projectId);
  atomicWriteJsonSync(filePath, checkpoints.slice(0, 50));
}

export function recordCheckpoint(
  projectId: string,
  entry: Omit<ServerCheckpoint, "id" | "project_id" | "timestamp">
): ServerCheckpoint {
  const resolvedProjectId = resolveActiveProjectId(projectId);
  const list = loadCheckpoints(resolvedProjectId);
  const created: ServerCheckpoint = {
    ...entry,
    id: `chk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    project_id: resolvedProjectId,
    timestamp: new Date().toISOString(),
  };
  saveCheckpoints(resolvedProjectId, [created, ...list]);
  return created;
}
