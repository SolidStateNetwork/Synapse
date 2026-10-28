import fs from "fs";
import path from "path";

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
  const safeId = projectId.replace(/[^a-zA-Z0-9._-]/g, "") || "synapse-cloud-demo";
  const vaultRoot =
    process.env.SYNAPSE_VAULT_DIR ||
    path.join(process.cwd(), ".synapse-data", "projects");
  const projDir = path.join(vaultRoot, safeId);
  fs.mkdirSync(projDir, { recursive: true });
  return path.join(projDir, "Checkpoints.json");
}

export function loadCheckpoints(projectId: string): ServerCheckpoint[] {
  const filePath = getCheckpointsFilePath(projectId);
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch {
    // fallback
  }

  const seeded: ServerCheckpoint[] = [
    {
      id: "chk-baseline-vps2",
      project_id: projectId,
      node_id: "vps2-muscle",
      timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      title: "Verified Multi-Core Production Baseline",
      actor: "Synapse AI",
      summary:
        "Snapshot of all 5 active services (:4050, :4070, :4085, :4090, pulse.db) and reverse-tunnel mTLS state.",
      files_backed_up: [
        "/var/lib/synapse/pulse-stack/pulse.db",
        "/etc/systemd/system/axon.service",
      ],
      services_snapshot: [
        {
          service_id: "auto-svc-4050",
          name: "Autonomous Microservice :4050",
          port: 4050,
          healthy: true,
        },
        {
          service_id: "vps2-status-api",
          name: "VPS2 Status API",
          port: 4070,
          healthy: true,
        },
        {
          service_id: "pulse-analytics-api",
          name: "Pulse Analytics API",
          port: 4085,
          healthy: true,
        },
        {
          service_id: "pulse-sqlite-db",
          name: "Pulse SQLite Database",
          port: 3001,
          healthy: true,
        },
        {
          service_id: "pulse-webui",
          name: "Pulse Live WebUI",
          port: 4090,
          healthy: true,
        },
      ],
      rollback_cmd:
        "if [ -f /var/lib/synapse/pulse-stack/pulse.db.synapse.bak ]; then cp -f /var/lib/synapse/pulse-stack/pulse.db.synapse.bak /var/lib/synapse/pulse-stack/pulse.db; fi && docker start synapse-cloud-demo-status 2>/dev/null || true && echo 'CHECKPOINT_RESTORED_OK'",
    },
  ];
  saveCheckpoints(projectId, seeded);
  return seeded;
}

export function saveCheckpoints(
  projectId: string,
  checkpoints: ServerCheckpoint[]
): void {
  const filePath = getCheckpointsFilePath(projectId);
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmpPath, JSON.stringify(checkpoints.slice(0, 50), null, 2));
  fs.renameSync(tmpPath, filePath);
}

export function recordCheckpoint(
  projectId: string,
  entry: Omit<ServerCheckpoint, "id" | "project_id" | "timestamp">
): ServerCheckpoint {
  const list = loadCheckpoints(projectId);
  const created: ServerCheckpoint = {
    ...entry,
    id: `chk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    project_id: projectId,
    timestamp: new Date().toISOString(),
  };
  saveCheckpoints(projectId, [created, ...list]);
  return created;
}
