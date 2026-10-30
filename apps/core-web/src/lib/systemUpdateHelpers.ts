import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { CORE_GATEWAY_URL, fetchGatewayNodes } from "@/lib/orchestrator";
import { resolveActiveProjectId } from "@/lib/runtimeResolver";
import { safeFetchJson } from "./safeFetch";

const execAsync = promisify(exec);

export interface UpdateStepLog {
  step: string;
  status: "ok" | "warn" | "error";
  detail: string;
  duration_ms: number;
}

export function resolveRepoRoot(): string {
  if (process.env.SYNAPSE_REPO_ROOT && fs.existsSync(process.env.SYNAPSE_REPO_ROOT)) {
    return process.env.SYNAPSE_REPO_ROOT;
  }
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    if (
      fs.existsSync(path.join(dir, "agents", "axon")) &&
      fs.existsSync(path.join(dir, "apps", "core-gateway"))
    ) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

export function getFileSummary(filePath: string): {
  exists: boolean;
  path: string;
  size_bytes: number;
  updated_at: string | null;
  sha256: string | null;
} {
  try {
    if (!fs.existsSync(filePath)) {
      return {
        exists: false,
        path: filePath,
        size_bytes: 0,
        updated_at: null,
        sha256: null,
      };
    }
    const stat = fs.statSync(filePath);
    const buf = fs.readFileSync(filePath);
    const sha256 = crypto
      .createHash("sha256")
      .update(buf)
      .digest("hex")
      .slice(0, 16);
    return {
      exists: true,
      path: filePath,
      size_bytes: stat.size,
      updated_at: stat.mtime.toISOString(),
      sha256,
    };
  } catch {
    return {
      exists: false,
      path: filePath,
      size_bytes: 0,
      updated_at: null,
      sha256: null,
    };
  }
}

export async function runCmd(
  command: string,
  cwd: string,
  envOverrides?: Record<string, string>,
  timeoutMs = 60000
): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd,
      timeout: timeoutMs,
      env: {
        ...process.env,
        ...(envOverrides || {}),
      },
    });
    return {
      ok: true,
      stdout: (stdout || "").trim(),
      stderr: (stderr || "").trim(),
    };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    return {
      ok: false,
      stdout: (e.stdout || "").trim(),
      stderr: (e.stderr || e.message || String(err)).trim(),
    };
  }
}

export async function gatherSystemStatus(fetchRemoteGit = false, inspectNodes = false) {
  const repoRoot = resolveRepoRoot();
  const binDir = path.join(repoRoot, "bin");
  if (!fs.existsSync(binDir)) {
    fs.mkdirSync(binDir, { recursive: true });
  }

  if (fetchRemoteGit) {
    await runCmd("git fetch origin main", repoRoot, undefined, 15000);
  }

  const branchRes = await runCmd(
    "git rev-parse --abbrev-ref HEAD",
    repoRoot,
    undefined,
    5000
  );
  const localLogRes = await runCmd(
    'git log -1 --format="%h|%H|%ci|%s"',
    repoRoot,
    undefined,
    5000
  );
  const remoteLogRes = await runCmd(
    'git log -1 origin/main --format="%h|%H|%ci|%s"',
    repoRoot,
    undefined,
    5000
  );
  const behindRes = await runCmd(
    "git rev-list --count HEAD..origin/main",
    repoRoot,
    undefined,
    5000
  );
  const aheadRes = await runCmd(
    "git rev-list --count origin/main..HEAD",
    repoRoot,
    undefined,
    5000
  );
  const localAxonRes = await runCmd(
    "git rev-parse --short=12 HEAD:agents/axon",
    repoRoot,
    undefined,
    5000
  );

  const [localShort, localFull, localDate, localSubject] = (
    localLogRes.stdout || "unknown|unknown||"
  ).split("|");
  const [remoteShort, remoteFull, remoteDate, remoteSubject] = (
    remoteLogRes.stdout || "unknown|unknown||"
  ).split("|");
  const localAxonShort = (localAxonRes.stdout || "").trim();

  const commitsBehind = Number(behindRes.stdout || 0) || 0;
  const commitsAhead = Number(aheadRes.stdout || 0) || 0;

  const isWin = process.platform === "win32";
  const coreBinPath = path.join(
    binDir,
    isWin ? "core-gateway.exe" : "core-gateway"
  );
  const coreStagedPath = path.join(
    binDir,
    isWin ? "core-gateway.new.exe" : "core-gateway.new"
  );
  const axonPrimaryPath = path.join(binDir, "axon");
  const axonLinuxAmd64Path = path.join(binDir, "axon-linux-amd64");

  const coreBin = getFileSummary(
    fs.existsSync(coreStagedPath) ? coreStagedPath : coreBinPath
  );
  const axonBin = getFileSummary(
    fs.existsSync(axonPrimaryPath) ? axonPrimaryPath : axonLinuxAmd64Path
  );

  const liveNodes = await fetchGatewayNodes();
  const activeProjId = resolveActiveProjectId();
  const nodeStatuses: Array<{
    node_id: string;
    online: boolean;
    tier: string;
    remote_addr: string;
    os_arch?: string;
    installed_sha256?: string | null;
    installed_mtime?: string | null;
    source_commit?: string | null;
    systemd_status?: string | null;
    up_to_date?: boolean;
  }> = [];

  for (const n of liveNodes) {
    let installedSha: string | null = null;
    let installedMtime: string | null = null;
    let sourceCommit: string | null = null;
    let axonSourceCommit: string | null = null;
    let systemdStatus: string | null = null;

    if (inspectNodes && n.online) {
      try {
        const ptyRes = await safeFetchJson(`${CORE_GATEWAY_URL}/api/v1/rpc/pty`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            node_id: n.node_id,
            cmd_id: `ver-${Date.now()}`,
            session_id: "sys-update-check",
            project_id: activeProjId,
            tier: "TIER_1_UNLEASHED",
            command:
              "echo \"SHA=$(sha256sum /usr/local/bin/axon 2>/dev/null | cut -c1-16)\"; echo \"MTIME=$(stat -c '%y' /usr/local/bin/axon 2>/dev/null | cut -d. -f1)\"; echo \"SVC=$(systemctl is-active axon 2>/dev/null || true)\"; echo \"SRC=$(git -C /opt/synapse-src rev-parse --short HEAD 2>/dev/null || echo release)\"; echo \"AXON_SRC=$(git -C /opt/synapse-src rev-parse --short=12 HEAD:agents/axon 2>/dev/null || echo '')\"",
            wait_timeout_ms: 8000,
          }),
          timeoutMs: 9500,
        });
        if (ptyRes.ok) {
          const ptyData = (await ptyRes.json()) as { output?: string };
          const lines = (ptyData.output || "")
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter(Boolean);
          for (const line of lines) {
            if (line.startsWith("SHA=")) {
              const val = line.slice(4).trim();
              if (/^[0-9a-f]{16}$/i.test(val)) installedSha = val;
            } else if (line.startsWith("MTIME=")) {
              installedMtime = line.slice(6).trim() || null;
            } else if (line.startsWith("SVC=")) {
              systemdStatus = line.slice(4).trim() || "active";
            } else if (line.startsWith("SRC=")) {
              sourceCommit = line.slice(4).trim() || null;
            } else if (line.startsWith("AXON_SRC=")) {
              axonSourceCommit = line.slice(9).trim() || null;
            }
          }
        }
      } catch {
        // ignore
      }
    }

    const matchesCommit =
      Boolean(sourceCommit && localShort) && sourceCommit === localShort;
    const matchesAxonCommit =
      Boolean(axonSourceCommit && localAxonShort) &&
      axonSourceCommit === localAxonShort;
    const matchesSha =
      Boolean(installedSha && axonBin.sha256) &&
      installedSha === axonBin.sha256;

    nodeStatuses.push({
      node_id: n.node_id,
      online: n.online,
      tier: n.tier,
      remote_addr: n.remote_addr,
      os_arch: n.last_heartbeat?.os_arch || "linux/amd64",
      installed_sha256: installedSha,
      installed_mtime: installedMtime,
      source_commit:
        matchesAxonCommit && commitsBehind === 0 ? localShort : sourceCommit,
      systemd_status: systemdStatus,
      up_to_date: !inspectNodes
        ? true
        : matchesCommit ||
          matchesAxonCommit ||
          matchesSha ||
          Boolean(installedSha && !axonBin.exists && sourceCommit === "release"),
    });
  }

  return {
    repo_root: repoRoot,
    checked_at: new Date().toISOString(),
    git: {
      branch: branchRes.stdout || "main",
      local_short: localShort,
      local_full: localFull,
      local_date: localDate,
      local_subject: localSubject,
      remote_short: remoteShort,
      remote_full: remoteFull,
      remote_date: remoteDate,
      remote_subject: remoteSubject,
      commits_behind: commitsBehind,
      commits_ahead: commitsAhead,
      update_available: commitsBehind > 0,
    },
    binaries: {
      core_gateway: coreBin,
      axon_linux_amd64: axonBin,
    },
    nodes: nodeStatuses,
  };
}
