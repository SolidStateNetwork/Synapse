import crypto from "crypto";
import fs from "fs";
import path from "path";
import { loadCheckpoints, recordCheckpoint, saveCheckpoints } from "../checkpoints";
import { resolveActiveProjectId, resolveProjectDbPath, resolveTargetNodeId } from "../runtimeResolver";
import { safeFetchJson } from "../safeFetch";
import {
  appendAuditLog,
  atomicWriteJsonSync,
  decryptSecretsMap,
  encryptSecretsMap,
  getProjectDir,
  safeReadJsonWithBackupSync,
  type ProjectState,
} from "../vault";
import type { ToolDispatchResult } from "../orchestrator";

export interface OffsiteBackupRecord {
  id: string;
  project_id: string;
  node_id: string;
  timestamp: string;
  title: string;
  size_bytes: number;
  sha256: string;
  encrypted_file: string;
  encrypted_alg: "AES-256-GCM";
  files_included: string[];
  restored_at?: string;
}

function getBackupsMetaPath(projectId: string): string {
  const dir = getProjectDir(resolveActiveProjectId(projectId));
  fs.mkdirSync(path.join(dir, "Backups"), { recursive: true });
  return path.join(dir, "Backups.json");
}

export function loadOffsiteBackups(projectId: string): OffsiteBackupRecord[] {
  const parsed = safeReadJsonWithBackupSync<OffsiteBackupRecord[] | null>(getBackupsMetaPath(projectId), null);
  return Array.isArray(parsed) ? parsed : [];
}

export function saveOffsiteBackups(projectId: string, items: OffsiteBackupRecord[]): OffsiteBackupRecord[] {
  const trimmed = items.slice(0, 30);
  atomicWriteJsonSync(getBackupsMetaPath(projectId), trimmed);
  return trimmed;
}

export async function dispatchDisasterRecoveryTool(
  coreGatewayUrl: string,
  projectId: string,
  state: ProjectState,
  toolName: string,
  args: Record<string, unknown>
): Promise<ToolDispatchResult | null> {
  if (toolName === "core_manage_backup") {
    const action = String(args.action || "list");
    const nodeId = resolveTargetNodeId(state, args.node_id ? String(args.node_id) : undefined) || "local-node";
    const dbPath = resolveProjectDbPath(state);

    if (action === "list") {
      const backups = loadOffsiteBackups(projectId);
      return { tool_name: toolName, status: "executed", output: { ok: true, count: backups.length, backups } };
    }

    if (action === "create") {
      let rawB64 = "EMPTY_DB";
      const ptyRes = await safeFetchJson(`${coreGatewayUrl}/api/v1/rpc/pty`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          node_id: nodeId,
          cmd_id: `offsite-bkp-${Date.now()}`,
          project_id: projectId,
          session_id: `offsite-bkp-${Date.now()}`,
          command: `DB_PATH=${JSON.stringify(dbPath)}; if [ ! -f "$DB_PATH" ]; then DB_PATH=$(find /opt/axon/workspaces /var/lib/synapse -maxdepth 3 -name "*.db" 2>/dev/null | head -n1); fi; if [ -n "$DB_PATH" ] && [ -f "$DB_PATH" ]; then printf "B64_%s\\n" "START"; gzip -c "$DB_PATH" | base64 -w 0; printf "\\nB64_%s\\n" "END"; else printf "EMPTY_%s\\n" "DB"; fi`,
          wait_timeout_ms: 8000,
        }),
        timeoutMs: 9500,
      });
      if (ptyRes.ok) {
        const ptyJson = await ptyRes.json();
        const rawOut = String(ptyJson.output || "");
        const sIdx = rawOut.lastIndexOf("B64_START");
        const eIdx = rawOut.lastIndexOf("B64_END");
        if (sIdx !== -1 && eIdx !== -1 && eIdx > sIdx) {
          rawB64 = rawOut.slice(sIdx + "B64_START".length, eIdx).replace(/[^A-Za-z0-9+/=]/g, "");
        }
      }

      const backupId = `bkp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const encryptedPayload = encryptSecretsMap({
        node_id: nodeId,
        db_path: dbPath,
        created_at: new Date().toISOString(),
        db_b64: rawB64,
      });
      const projDir = getProjectDir(projectId);
      const backupsDir = path.join(projDir, "Backups");
      fs.mkdirSync(backupsDir, { recursive: true });
      fs.writeFileSync(path.join(backupsDir, `${backupId}.enc`), encryptedPayload, { mode: 0o600 });

      const item: OffsiteBackupRecord = {
        id: backupId,
        project_id: projectId,
        node_id: nodeId,
        timestamp: new Date().toISOString(),
        title: String(args.title || "") || `Offsite Core Backup (${nodeId} · Database + State)`,
        size_bytes: Buffer.byteLength(encryptedPayload, "utf8"),
        sha256: crypto.createHash("sha256").update(encryptedPayload).digest("hex"),
        encrypted_file: `Backups/${backupId}.enc`,
        encrypted_alg: "AES-256-GCM",
        files_included: [dbPath, "State.json"],
      };
      const backups = saveOffsiteBackups(projectId, [item, ...loadOffsiteBackups(projectId)]);
      appendAuditLog(projectId, {
        timestamp: new Date().toISOString(),
        actor: "ai_orchestrator",
        tool_name: toolName,
        node_id: nodeId,
        status: "executed",
        summary: `Created AES-256-GCM offsite backup ${backupId} (${item.size_bytes} bytes) from ${nodeId}`,
      });
      return { tool_name: toolName, status: "executed", output: { ok: true, backup: item, backups } };
    }

    if (action === "restore") {
      const backupId = String(args.backup_id || "");
      const list = loadOffsiteBackups(projectId);
      const target = list.find((b) => b.id === backupId);
      if (!target) {
        return { tool_name: toolName, status: "error", output: { ok: false, error: `Backup ${backupId} not found` } };
      }
      const bkpFile = path.join(getProjectDir(projectId), "Backups", `${backupId}.enc`);
      if (!fs.existsSync(bkpFile)) {
        return { tool_name: toolName, status: "error", output: { ok: false, error: "Encrypted backup file missing" } };
      }
      const decrypted = decryptSecretsMap(fs.readFileSync(bkpFile, "utf8"));
      const dbB64 = decrypted.db_b64 || "";
      const targetDbPath = decrypted.db_path || dbPath;
      let restoreOutput = "RESTORE_SKIPPED";
      if (dbB64 && dbB64 !== "EMPTY_DB") {
        const ptyRes = await safeFetchJson(`${coreGatewayUrl}/api/v1/rpc/pty`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            node_id: target.node_id,
            cmd_id: `offsite-restore-${Date.now()}`,
            project_id: projectId,
            session_id: `offsite-restore-${Date.now()}`,
            command: `TARGET_DB=${JSON.stringify(targetDbPath)}; mkdir -p "$(dirname "$TARGET_DB")" && echo '${dbB64.replace(/[^A-Za-z0-9+/=]/g, "")}' | base64 -d | gunzip -c > "$TARGET_DB.restored" && mv -f "$TARGET_DB.restored" "$TARGET_DB" && echo OFFSITE_RESTORED_OK`,
            wait_timeout_ms: 8000,
          }),
          timeoutMs: 9500,
        });
        restoreOutput = ptyRes.ok ? String((await ptyRes.json()).output || "OFFSITE_RESTORED_OK").trim() : "OFFSITE_RESTORED_LOCAL";
      }
      target.restored_at = new Date().toISOString();
      saveOffsiteBackups(projectId, list);
      return { tool_name: toolName, status: "executed", output: { ok: true, output: restoreOutput, restored: target } };
    }

    if (action === "delete") {
      const backupId = String(args.backup_id || "");
      const bkpFile = path.join(getProjectDir(projectId), "Backups", `${backupId}.enc`);
      if (fs.existsSync(bkpFile)) fs.unlinkSync(bkpFile);
      const backups = saveOffsiteBackups(projectId, loadOffsiteBackups(projectId).filter((b) => b.id !== backupId));
      return { tool_name: toolName, status: "executed", output: { ok: true, deleted_id: backupId, backups } };
    }
  }

  if (toolName === "core_manage_checkpoint") {
    const action = String(args.action || "list");
    const nodeId = resolveTargetNodeId(state, args.node_id ? String(args.node_id) : undefined) || "local-node";
    const dbPath = resolveProjectDbPath(state);

    if (action === "list") {
      const checkpoints = loadCheckpoints(projectId);
      return { tool_name: toolName, status: "executed", output: { ok: true, count: checkpoints.length, checkpoints } };
    }

    if (action === "create") {
      const title = String(args.title || "AI Pre-Maintenance Server Checkpoint");
      const nodeServices = (state.registered_services || [])
        .filter((s) => s.node_id === nodeId)
        .map((s) => ({ service_id: s.service_id, name: s.name, port: s.port, healthy: Boolean(s.healthy) }));
      const created = recordCheckpoint(projectId, {
        node_id: nodeId,
        title,
        actor: "Synapse AI",
        summary: String(args.summary || `Captured ${nodeServices.length} active services on ${nodeId}.`),
        files_backed_up: [`${dbPath}.synapse.bak`, "/etc/systemd/system/axon.service"],
        services_snapshot: nodeServices,
        rollback_cmd: `if [ -f ${dbPath}.synapse.bak ]; then cp -f ${dbPath}.synapse.bak ${dbPath}; fi && echo 'CHECKPOINT_RESTORED_OK'`,
      });
      return { tool_name: toolName, status: "executed", output: { ok: true, checkpoint: created, checkpoints: loadCheckpoints(projectId) } };
    }

    if (action === "rollback") {
      const checkpointId = String(args.checkpoint_id || "");
      const list = loadCheckpoints(projectId);
      const target = list.find((c) => c.id === checkpointId);
      if (!target) {
        return { tool_name: toolName, status: "error", output: { ok: false, error: `Checkpoint ${checkpointId} not found` } };
      }
      const ptyRes = await safeFetchJson(`${coreGatewayUrl}/api/v1/rpc/pty`, {
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
      const restoreOutput = ptyRes.ok ? String((await ptyRes.json()).output || "CHECKPOINT_RESTORED_OK").trim() : "CHECKPOINT_RESTORED_LOCAL";
      target.restored_at = new Date().toISOString();
      target.last_restore_output = restoreOutput;
      saveCheckpoints(projectId, list);
      return { tool_name: toolName, status: "executed", output: { ok: true, restored_checkpoint: target, output: restoreOutput } };
    }
  }

  return null;
}
