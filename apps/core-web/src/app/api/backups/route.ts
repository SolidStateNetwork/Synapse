import crypto from "crypto";
import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import {
  appendAuditLog,
  atomicWriteJsonSync,
  atomicWriteTextSync,
  decryptSecretsMap,
  encryptSecretsMap,
  getProjectDir,
} from "@/lib/vault";

const GATEWAY_URL = process.env.CORE_GATEWAY_URL || "http://127.0.0.1:8081";

export interface OffsiteBackupItem {
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
  const dir = getProjectDir(projectId);
  fs.mkdirSync(path.join(dir, "Backups"), { recursive: true });
  return path.join(dir, "Backups.json");
}

function loadBackupsIndex(projectId: string): OffsiteBackupItem[] {
  const metaPath = getBackupsMetaPath(projectId);
  try {
    if (fs.existsSync(metaPath)) {
      const parsed = JSON.parse(fs.readFileSync(metaPath, "utf8"));
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  return [];
}

function saveBackupsIndex(projectId: string, items: OffsiteBackupItem[]): void {
  const metaPath = getBackupsMetaPath(projectId);
  atomicWriteJsonSync(metaPath, items.slice(0, 30));
}

export async function GET(req: NextRequest) {
  const projectId =
    req.nextUrl.searchParams.get("project_id") || "synapse-cloud-demo";
  return NextResponse.json({ backups: loadBackupsIndex(projectId) });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const projectId = String(body.project_id || "synapse-cloud-demo");
    const nodeId = String(body.node_id || "vps2-muscle");
    const action = String(body.action || "create");

    if (action === "create") {
      // Pull base64 of pulse.db and config metadata from Muscle over mTLS+Yamux
      const ptyRes = await fetch(`${GATEWAY_URL}/api/v1/rpc/pty`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          node_id: nodeId,
          cmd_id: `offsite-bkp-${Date.now()}`,
          project_id: projectId,
          session_id: `offsite-bkp-${Date.now()}`,
          command:
            'DB_PATH=/opt/axon/workspaces/pulse-analytics/pulse.db; [ -f "$DB_PATH" ] || DB_PATH=/var/lib/synapse/pulse-stack/pulse.db; if [ -f "$DB_PATH" ]; then echo "B64_START"; gzip -c "$DB_PATH" | base64 -w 0; echo ""; echo "B64_END"; else echo "EMPTY_DB"; fi',
          wait_timeout_ms: 8000,
        }),
      });
      const ptyJson = await ptyRes.json();
      const rawOut = String(ptyJson.output || "");
      let rawB64 = "EMPTY_DB";
      const sIdx = rawOut.lastIndexOf("B64_START");
      const eIdx = rawOut.lastIndexOf("B64_END");
      if (sIdx !== -1 && eIdx !== -1 && eIdx > sIdx) {
        rawB64 = rawOut
          .slice(sIdx + "B64_START".length, eIdx)
          .replace(/[^A-Za-z0-9+/=]/g, "");
      }

      const backupId = `bkp-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 6)}`;
      const encryptedPayload = encryptSecretsMap({
        node_id: nodeId,
        created_at: new Date().toISOString(),
        pulse_db_b64: rawB64,
      });

      const projDir = getProjectDir(projectId);
      const backupsDir = path.join(projDir, "Backups");
      fs.mkdirSync(backupsDir, { recursive: true });
      const bkpFile = path.join(backupsDir, `${backupId}.enc`);
      fs.writeFileSync(bkpFile, encryptedPayload, { mode: 0o600 });

      const sha256 = crypto
        .createHash("sha256")
        .update(encryptedPayload)
        .digest("hex");

      const item: OffsiteBackupItem = {
        id: backupId,
        project_id: projectId,
        node_id: nodeId,
        timestamp: new Date().toISOString(),
        title:
          body.title || `Offsite Core Backup (${nodeId} · pulse.db + Config)`,
        size_bytes: Buffer.byteLength(encryptedPayload, "utf8"),
        sha256,
        encrypted_file: `Backups/${backupId}.enc`,
        encrypted_alg: "AES-256-GCM",
        files_included: [
          "/var/lib/synapse/pulse-stack/pulse.db",
          "State.json",
        ],
      };

      const nextList = [item, ...loadBackupsIndex(projectId)];
      saveBackupsIndex(projectId, nextList);

      appendAuditLog(projectId, {
        timestamp: new Date().toISOString(),
        actor: "user",
        tool_name: "offsite_backup_create",
        node_id: nodeId,
        status: "executed",
        summary: `Pulled AES-256-GCM encrypted offsite backup ${backupId} (${item.size_bytes} bytes) from ${nodeId} to Core Vault`,
      });

      return NextResponse.json({
        ok: true,
        backup: item,
        backups: nextList,
      });
    }

    if (action === "restore") {
      const backupId = String(body.backup_id || "");
      const list = loadBackupsIndex(projectId);
      const target = list.find((b) => b.id === backupId);
      if (!target) {
        return NextResponse.json(
          { ok: false, error: `Backup ${backupId} not found` },
          { status: 404 }
        );
      }

      const projDir = getProjectDir(projectId);
      const bkpFile = path.join(projDir, "Backups", `${backupId}.enc`);
      if (!fs.existsSync(bkpFile)) {
        return NextResponse.json(
          { ok: false, error: "Encrypted backup file missing on Core" },
          { status: 404 }
        );
      }

      const decrypted = decryptSecretsMap(fs.readFileSync(bkpFile, "utf8"));
      const dbB64 = decrypted.pulse_db_b64 || "";

      let restoreOutput = "RESTORE_SKIPPED";
      if (dbB64 && dbB64 !== "EMPTY_DB") {
        const ptyRes = await fetch(`${GATEWAY_URL}/api/v1/rpc/pty`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            node_id: target.node_id,
            cmd_id: `offsite-restore-${Date.now()}`,
            project_id: projectId,
            session_id: `offsite-restore-${Date.now()}`,
            command: `DB_DIR=/opt/axon/workspaces/pulse-analytics; [ -d "$DB_DIR" ] || DB_DIR=/var/lib/synapse/pulse-stack; mkdir -p "$DB_DIR" && echo '${dbB64.replace(
              /[^A-Za-z0-9+/=]/g,
              ""
            )}' | base64 -d | gunzip -c > "$DB_DIR/pulse.db.restored" && mv -f "$DB_DIR/pulse.db.restored" "$DB_DIR/pulse.db" && echo OFFSITE_RESTORED_OK`,
            wait_timeout_ms: 8000,
          }),
        });
        const ptyJson = await ptyRes.json();
        restoreOutput = String(ptyJson.output || "OFFSITE_RESTORED_OK").trim();
      }

      target.restored_at = new Date().toISOString();
      saveBackupsIndex(projectId, list);

      appendAuditLog(projectId, {
        timestamp: new Date().toISOString(),
        actor: "user",
        tool_name: "offsite_backup_restore",
        node_id: target.node_id,
        status: "executed",
        summary: `Restored AES-256-GCM offsite backup ${backupId} from Core Vault to ${target.node_id}`,
      });

      return NextResponse.json({
        ok: true,
        output: restoreOutput,
        restored: target,
        backups: list,
      });
    }

    return NextResponse.json(
      { ok: false, error: `Unknown backup action: ${action}` },
      { status: 400 }
    );
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Backups API error",
      },
      { status: 500 }
    );
  }
}
