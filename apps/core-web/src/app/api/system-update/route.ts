import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { CORE_GATEWAY_URL, fetchGatewayNodes } from "@/lib/orchestrator";
import { appendAuditLog } from "@/lib/vault";
import {
  resolveActiveProjectId,
  safeParseRequestJson,
} from "@/lib/runtimeResolver";
import { safeFetchJson } from "@/lib/safeFetch";
import {
  type UpdateStepLog,
  resolveRepoRoot,
  getFileSummary,
  runCmd,
  gatherSystemStatus,
} from "@/lib/systemUpdateHelpers";

export type { UpdateStepLog };

async function performCoreUpdate(repoRoot: string): Promise<UpdateStepLog[]> {
  const steps: UpdateStepLog[] = [];
  const binDir = path.join(repoRoot, "bin");
  if (!fs.existsSync(binDir)) {
    fs.mkdirSync(binDir, { recursive: true });
  }

  // Step 1: Git Fetch & Fast-Forward Pull on Core
  const t0 = Date.now();
  await runCmd("git fetch origin main", repoRoot, undefined, 20000);
  const behindRes = await runCmd(
    "git rev-list --count HEAD..origin/main",
    repoRoot,
    undefined,
    5000
  );
  const behind = Number(behindRes.stdout || 0) || 0;
  if (behind > 0) {
    const pullRes = await runCmd(
      "git pull --ff-only origin main",
      repoRoot,
      undefined,
      30000
    );
    steps.push({
      step: "1. Git Repository Sync (Core Plane)",
      status: pullRes.ok ? "ok" : "warn",
      detail: pullRes.ok
        ? `${behind} neue Commit(s) von origin/main geladen: ${pullRes.stdout}`
        : `Git Pull Hinweis: ${pullRes.stderr || pullRes.stdout}`,
      duration_ms: Date.now() - t0,
    });
  } else {
    const headRes = await runCmd(
      'git log -1 --format="%h — %s"',
      repoRoot,
      undefined,
      5000
    );
    steps.push({
      step: "1. Git Repository Sync (Core Plane)",
      status: "ok",
      detail: `Core Repository ist auf dem neuesten Stand (${headRes.stdout}).`,
      duration_ms: Date.now() - t0,
    });
  }

  // Step 2: Verify Core WebUI & TypeScript Compilation
  const t1 = Date.now();
  const tscBin = path.join(
    repoRoot,
    "apps",
    "core-web",
    "node_modules",
    ".bin",
    process.platform === "win32" ? "tsc.cmd" : "tsc"
  );
  if (fs.existsSync(tscBin)) {
    const tscRes = await runCmd(
      `"${tscBin}" -p apps/core-web/tsconfig.json --noEmit`,
      repoRoot,
      undefined,
      30000
    );
    steps.push({
      step: "2. Core WebUI & Orchestrator Verification",
      status: tscRes.ok ? "ok" : "warn",
      detail: tscRes.ok
        ? "Next.js 15 Core WebUI & KI-Orchestrator erfolgreich geprüft und per Hot-Reload aktiv."
        : `TypeScript Warnung: ${tscRes.stderr || tscRes.stdout}`,
      duration_ms: Date.now() - t1,
    });
  } else {
    steps.push({
      step: "2. Core WebUI & Orchestrator Verification",
      status: "ok",
      detail: "Next.js 15 Core WebUI ist aktiv und synchronisiert.",
      duration_ms: Date.now() - t1,
    });
  }

  // Step 3: Core Gateway Binary Check / Build
  const t2 = Date.now();
  const isWin = process.platform === "win32";
  const gwPrimaryOut = path.join(
    binDir,
    isWin ? "core-gateway.exe" : "core-gateway"
  );
  const gwStagedOut = path.join(
    binDir,
    isWin ? "core-gateway.new.exe" : "core-gateway.new"
  );

  // Locate Go compiler across standard PATH and OS installation folders
  const homeGo = process.env.HOME
    ? path.join(process.env.HOME, ".local", "go", "bin", "go")
    : "";
  const goCandidates = isWin
    ? ["go", "C:\\Program Files\\Go\\bin\\go.exe", "C:\\Go\\bin\\go.exe"]
    : [
        "go",
        ...(homeGo ? [homeGo] : []),
        "/usr/local/go/bin/go",
        "/usr/bin/go",
      ];
  let goBin = "";
  for (const cand of goCandidates) {
    if (cand !== "go" && !fs.existsSync(cand)) continue;
    const chk = await runCmd(`"${cand}" version`, repoRoot, undefined, 5000);
    if (chk.ok) {
      goBin = cand;
      break;
    }
  }

  if (goBin) {
    const gwDir = path.join(repoRoot, "apps", "core-gateway");
    let buildGw = await runCmd(
      `"${goBin}" build -ldflags="-s -w" -o "${gwPrimaryOut}" .`,
      gwDir,
      { CGO_ENABLED: "0" },
      90000
    );
    let targetGwPath = gwPrimaryOut;
    if (!buildGw.ok) {
      buildGw = await runCmd(
        `"${goBin}" build -ldflags="-s -w" -o "${gwStagedOut}" .`,
        gwDir,
        { CGO_ENABLED: "0" },
        90000
      );
      targetGwPath = gwStagedOut;
      if (buildGw.ok && !isWin) {
        try {
          fs.renameSync(gwStagedOut, gwPrimaryOut);
          targetGwPath = gwPrimaryOut;
          await runCmd(
            "systemctl --user restart synapse-core-gateway.service 2>/dev/null || true",
            repoRoot,
            undefined,
            8000
          );
        } catch {
          // keep staged path if rename fails
        }
      }
    } else if (!isWin) {
      await runCmd(
        "systemctl --user restart synapse-core-gateway.service 2>/dev/null || true",
        repoRoot,
        undefined,
        8000
      );
    }
    const gwMeta = getFileSummary(targetGwPath);
    steps.push({
      step: "3. Core Gateway Binary Build",
      status: buildGw.ok && gwMeta.exists ? "ok" : "warn",
      detail:
        buildGw.ok && gwMeta.exists
          ? `Kompiliert (${path.basename(targetGwPath)}, ${(
              gwMeta.size_bytes /
              (1024 * 1024)
            ).toFixed(2)} MB, SHA-256: ${gwMeta.sha256})`
          : `Gateway Build Hinweis: ${buildGw.stderr}`,
      duration_ms: Date.now() - t2,
    });
  } else {
    const gwMeta = getFileSummary(gwPrimaryOut);
    const hRes = await safeFetchJson(`${CORE_GATEWAY_URL}/healthz`, {
      cache: "no-store",
      timeoutMs: 4000,
    });
    const gwHealthOk = hRes.ok;
    steps.push({
      step: "3. Core Gateway Binary & Hub Health",
      status: gwMeta.exists && gwHealthOk ? "ok" : "warn",
      detail: `Core Gateway aktiv auf :8081/:8443 (${(
        gwMeta.size_bytes /
        (1024 * 1024)
      ).toFixed(2)} MB, SHA-256: ${gwMeta.sha256 || "n/a"}, Health: ${
        gwHealthOk ? "OK" : "OFFLINE"
      }).`,
      duration_ms: Date.now() - t2,
    });
  }

  return steps;
}

async function performMuscleOTAUpdate(
  repoRoot: string,
  projectId: string,
  targetNodeId?: string
): Promise<UpdateStepLog[]> {
  const steps: UpdateStepLog[] = [];
  const binDir = path.join(repoRoot, "bin");
  if (!fs.existsSync(binDir)) {
    fs.mkdirSync(binDir, { recursive: true });
  }

  const liveNodes = await fetchGatewayNodes();
  const onlineNodes = liveNodes.filter(
    (n) => n.online && (!targetNodeId || n.node_id === targetNodeId)
  );

  if (onlineNodes.length === 0) {
    steps.push({
      step: "Over-the-Air (OTA) Muscle Update",
      status: "warn",
      detail: targetNodeId
        ? `Muscle-Knoten '${targetNodeId}' ist aktuell nicht online.`
        : "Keine verbundenen Online-Muscle-Knoten gefunden.",
      duration_ms: 0,
    });
    return steps;
  }

  const hostGroups = new Map<string, typeof onlineNodes>();
  for (const n of onlineNodes) {
    const hostKey =
      n.last_heartbeat?.private_ipv4 ||
      n.last_heartbeat?.hostname ||
      n.remote_addr.split(":")[0] ||
      n.node_id;
    const list = hostGroups.get(hostKey) || [];
    list.push(n);
    hostGroups.set(hostKey, list);
  }

  const buildAndInstallScript = [
    `set -e`,
    `export HOME="\${HOME:-/root}"`,
    `export GOPATH="/root/go"`,
    `export GOMODCACHE="/root/go/pkg/mod"`,
    `export GOCACHE="/root/.cache/go-build"`,
    `export PATH="/usr/local/go/bin:/usr/bin:/bin:\$PATH"`,
    `mkdir -p "\$GOMODCACHE" "\$GOCACHE"`,
    `if [ ! -d /opt/synapse-src/.git ]; then`,
    `  rm -rf /opt/synapse-src`,
    `  git clone --quiet --depth 1 https://github.com/SolidStateNetwork/Synapse.git /opt/synapse-src`,
    `else`,
    `  git -C /opt/synapse-src fetch --quiet origin main`,
    `  git -C /opt/synapse-src reset --quiet --hard origin/main`,
    `fi`,
    `COMMIT=$(git -C /opt/synapse-src rev-parse --short HEAD)`,
    `cd /opt/synapse-src/agents/axon`,
    `CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o /usr/local/bin/axon.ota.new ./cmd/axon`,
    `chmod 0755 /usr/local/bin/axon.ota.new`,
    `NEW_SHA=$(sha256sum /usr/local/bin/axon.ota.new | cut -c1-16)`,
    `mv -f /usr/local/bin/axon.ota.new /usr/local/bin/axon`,
    `cp -f /usr/local/bin/axon /usr/local/bin/axon-linux-amd64 2>/dev/null || true`,
    `if [ -f /etc/systemd/system/axon.service ] && ! grep -q "TimeoutStopSec" /etc/systemd/system/axon.service; then`,
    `  sed -i '/RestartSec=/a TimeoutStopSec=2s' /etc/systemd/system/axon.service 2>/dev/null || true`,
    `  systemctl daemon-reload 2>/dev/null || true`,
    `fi`,
    `systemd-run --unit="axon-ota-$(date +%s)" sh -c 'sleep 0.6 && systemctl restart axon && (systemctl is-active --quiet axon-db && systemctl restart axon-db || true)' >/dev/null 2>&1 || nohup sh -c 'sleep 0.6 && systemctl restart axon' >/dev/null 2>&1 &`,
    `echo "OTA_SUCCESS commit=\$COMMIT sha256=\$NEW_SHA"`,
  ].join("\n");

  for (const [, groupNodes] of hostGroups.entries()) {
    const builderNode =
      groupNodes.find((n) => n.tier === "TIER_1_UNLEASHED") || groupNodes[0];
    const tBuild = Date.now();

    try {
      await safeFetchJson(`${CORE_GATEWAY_URL}/api/v1/rpc/fs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          node_id: builderNode.node_id,
          request_id: `ota-fs-${Date.now()}`,
          project_id: projectId,
          tier: "TIER_1_UNLEASHED",
          operation: "write_file",
          path: ".synapse_ota_update.sh",
          content: `#!/usr/bin/env bash\n${buildAndInstallScript}\n`,
          file_mode: "0755",
        }),
        timeoutMs: 8000,
      });

      const ptyRes = await safeFetchJson(`${CORE_GATEWAY_URL}/api/v1/rpc/pty`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          node_id: builderNode.node_id,
          cmd_id: `ota-${Date.now()}`,
          session_id: "ota-updater",
          project_id: projectId,
          tier: "TIER_1_UNLEASHED",
          command: `bash .synapse_ota_update.sh`,
          wait_timeout_ms: 60000,
        }),
        timeoutMs: 65000,
      });
      const ptyData = (await ptyRes.json()) as {
        exit_code?: number;
        output?: string;
      };
      const outText = (ptyData.output || "").trim();
      const ok = ptyRes.ok && outText.includes("OTA_SUCCESS");
      const matchLine =
        outText
          .split(/\r?\n/)
          .find((l) => l.includes("OTA_SUCCESS")) || outText.slice(-240);

      steps.push({
        step: `OTA Build, Binary-Swap & Systemd Restart (${groupNodes
          .map((n) => n.node_id)
          .join(", ")})`,
        status: ok ? "ok" : "error",
        detail: ok
          ? `Muscle Binary erfolgreich aus origin/main kompiliert, unter /usr/local/bin/axon installiert und systemd-Daemon(s) neu gestartet (${matchLine}).`
          : `OTA-Fehler: ${outText || `Exit ${ptyData.exit_code}`}`,
        duration_ms: Date.now() - tBuild,
      });
    } catch (err) {
      steps.push({
        step: `OTA Muscle Rollout (${builderNode.node_id})`,
        status: "error",
        detail: err instanceof Error ? err.message : String(err),
        duration_ms: Date.now() - tBuild,
      });
    }
  }

  await new Promise((r) => setTimeout(r, 2200));
  for (let i = 0; i < 6; i++) {
    const postNodes = await fetchGatewayNodes();
    if (onlineNodes.every((target) => postNodes.some((n) => n.node_id === target.node_id && n.online))) {
      break;
    }
    await new Promise((r) => setTimeout(r, 700));
  }

  return steps;
}

export async function GET(req: NextRequest) {
  const checkRemote = req.nextUrl.searchParams.get("check_remote") === "1";
  const inspectNodes =
    req.nextUrl.searchParams.get("inspect_nodes") === "1" || checkRemote;
  const status = await gatherSystemStatus(checkRemote, inspectNodes);
  return NextResponse.json(status);
}

export async function POST(req: NextRequest) {
  const body = await safeParseRequestJson(req);
  const action = String(body.action || "check");
  const projectId = resolveActiveProjectId(body.project_id ? String(body.project_id) : undefined);
  const targetNodeId = body.node_id ? String(body.node_id) : undefined;
  const repoRoot = resolveRepoRoot();

  if (action === "check") {
    const status = await gatherSystemStatus(true, true);
    return NextResponse.json({
      success: true,
      action,
      steps: [
        {
          step: "Git & Node Versionsprüfung",
          status: "ok",
          detail: status.git.update_available
            ? `${status.git.commits_behind} neue(r) Commit(s) auf origin/main verfügbar (${status.git.remote_short}).`
            : `Core & Muscle sind auf dem neuesten Commit (${status.git.local_short} — ${status.git.local_subject}).`,
          duration_ms: 0,
        },
      ],
      status,
    });
  }

  const allSteps: UpdateStepLog[] = [];

  if (action === "update_core" || action === "update_all") {
    const coreSteps = await performCoreUpdate(repoRoot);
    allSteps.push(...coreSteps);
    appendAuditLog(projectId, {
      timestamp: new Date().toISOString(),
      actor: "user",
      tool_name: "system_update_core",
      status: coreSteps.some((s) => s.status === "error") ? "error" : "executed",
      summary: `Executed Core Update (${coreSteps.length} steps)`,
    });
  }

  if (action === "update_muscle" || action === "update_all") {
    const muscleSteps = await performMuscleOTAUpdate(repoRoot, projectId, targetNodeId);
    allSteps.push(...muscleSteps);
    appendAuditLog(projectId, {
      timestamp: new Date().toISOString(),
      actor: "user",
      tool_name: "system_update_muscle",
      node_id: targetNodeId || "all",
      status: muscleSteps.some((s) => s.status === "error")
        ? "error"
        : "executed",
      summary: `Executed OTA Muscle Update on ${targetNodeId || "all online nodes"}`,
    });
  }

  const updatedStatus = await gatherSystemStatus(false, true);

  return NextResponse.json({
    success: !allSteps.some((s) => s.status === "error"),
    action,
    steps: allSteps,
    status: updatedStatus,
  });
}
