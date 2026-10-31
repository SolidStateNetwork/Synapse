import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { NextRequest } from "next/server";

const tmpTestRoot = fs.mkdtempSync(path.join(os.tmpdir(), "synapse-api-routes-test-"));
process.env.SYNAPSE_DATA_DIR = tmpTestRoot;
process.env.SYNAPSE_VAULT_DIR = path.join(tmpTestRoot, "projects");
process.env.SYNAPSE_MASTER_KEY = "api-routes-test-master-key-2026-aes256gcm";
process.env.CORE_GATEWAY_URL = "http://127.0.0.1:59998"; // Unreachable port -> ECONNREFUSED
process.env.CORE_GATEWAY_INTERNAL_URL = "http://127.0.0.1:59998";

import { GET as getProjects, POST as postProjects } from "../app/api/projects/route";
import { GET as getAuth, POST as postAuth } from "../app/api/auth/route";
import { GET as getAlerts, POST as postAlerts } from "../app/api/alerts/route";
import { GET as getCheckpoints, POST as postCheckpoints } from "../app/api/checkpoints/route";
import { GET as getBackups, POST as postBackups } from "../app/api/backups/route";
import { GET as getServiceOps, POST as postServiceOps } from "../app/api/service-ops/route";
import { GET as getFirewall, POST as postFirewall } from "../app/api/firewall/route";
import { GET as getBlueprints, POST as postBlueprints } from "../app/api/blueprints/route";
import { POST as postTokens } from "../app/api/tokens/route";
import { GET as getDebug, POST as postDebug } from "../app/api/debug/route";
import { GET as getSystemUpdate, POST as postSystemUpdate } from "../app/api/system-update/route";
import { GET as getMcp, POST as postMcp } from "../app/api/mcp/route";
import { POST as postOrchestrator } from "../app/api/orchestrator/route";

function makeGetReq(urlPath: string, headers?: Record<string, string>): NextRequest {
  return new NextRequest(`http://localhost:3000${urlPath}`, {
    method: "GET",
    headers,
  });
}

function makePostReq(
  urlPath: string,
  body: unknown,
  headers?: Record<string, string>,
  rawBody = false
): NextRequest {
  return new NextRequest(`http://localhost:3000${urlPath}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(headers || {}),
    },
    body: rawBody ? String(body) : JSON.stringify(body),
  });
}

describe("Synapse Next.js API-Route Integration & v0.5.0 Release Readiness Suite", () => {
  const projId = "api-test-project";

  before(() => {
    fs.mkdirSync(tmpTestRoot, { recursive: true });
  });

  after(() => {
    fs.rmSync(tmpTestRoot, { recursive: true, force: true });
  });

  it("21. Core Project, Auth, Alerts, Checkpoints & Backups API Routes handle offline Gateway and malformed bodies gracefully", async () => {
    // 1. /api/projects
    const pCreateRes = await postProjects(
      makePostReq("/api/projects", {
        action: "create_project",
        new_project_id: projId,
        name: "API Integration Project",
      })
    );
    assert.equal(pCreateRes.status, 200);
    const pCreateJson = await pCreateRes.json();
    assert.equal(pCreateJson.project.project_id, projId);

    const pGetRes = await getProjects(makeGetReq(`/api/projects?project_id=${projId}`));
    assert.equal(pGetRes.status, 200);
    const pGetJson = await pGetRes.json();
    assert.equal(pGetJson.active_project.project_id, projId);

    const pMalformedRes = await postProjects(
      makePostReq("/api/projects", "{invalid-json", undefined, true)
    );
    assert.equal(pMalformedRes.status, 400);

    // 2. /api/auth
    const authGetRes = await getAuth(makeGetReq("/api/auth"));
    assert.equal(authGetRes.status, 200);

    const authCfgRes = await postAuth(
      makePostReq("/api/auth", {
        action: "configure",
        enabled: true,
        admin_password: "ApiAdminPassword!2026",
        totp_pin: "654321",
      })
    );
    assert.equal(authCfgRes.status, 200);
    const authCfgJson = await authCfgRes.json();
    assert.equal(authCfgJson.ok, true);

    const authLoginRes = await postAuth(
      makePostReq("/api/auth", {
        action: "login",
        password: "ApiAdminPassword!2026",
        pin: "654321",
      })
    );
    assert.equal(authLoginRes.status, 200);
    const authLoginJson = await authLoginRes.json();
    assert.equal(authLoginJson.ok, true);
    assert.equal(authLoginJson.role, "admin");

    const authMalformedRes = await postAuth(
      makePostReq("/api/auth", "{not-valid-json", undefined, true)
    );
    assert.equal(authMalformedRes.status, 400);

    // 3. /api/alerts
    const alertsGetRes = await getAlerts(makeGetReq(`/api/alerts?project_id=${projId}`));
    assert.equal(alertsGetRes.status, 200);

    const alertsEvalRes = await postAlerts(
      makePostReq("/api/alerts", { action: "evaluate", project_id: projId })
    );
    assert.equal(alertsEvalRes.status, 200);
    const alertsEvalJson = await alertsEvalRes.json();
    assert.equal(alertsEvalJson.ok, true);

    const alertsTestRes = await postAlerts(
      makePostReq("/api/alerts", {
        action: "test_alert",
        project_id: projId,
        message: "API Route Integration Test Alert",
      })
    );
    assert.equal(alertsTestRes.status, 200);

    // 4. /api/checkpoints
    const chkCreateRes = await postCheckpoints(
      makePostReq("/api/checkpoints", {
        action: "create",
        project_id: projId,
        title: "API Route Checkpoint",
      })
    );
    assert.equal(chkCreateRes.status, 200);
    const chkCreateJson = await chkCreateRes.json();
    assert.equal(chkCreateJson.ok, true);
    const chkId = chkCreateJson.checkpoint.id;

    const chkGetRes = await getCheckpoints(makeGetReq(`/api/checkpoints?project_id=${projId}`));
    assert.equal(chkGetRes.status, 200);

    const chkRollbackRes = await postCheckpoints(
      makePostReq("/api/checkpoints", {
        action: "rollback",
        project_id: projId,
        checkpoint_id: chkId,
      })
    );
    assert.equal(chkRollbackRes.status, 200);
    const chkRollbackJson = await chkRollbackRes.json();
    assert.equal(chkRollbackJson.ok, true);

    // 5. /api/backups
    const bkpCreateRes = await postBackups(
      makePostReq("/api/backups", {
        action: "create",
        project_id: projId,
        title: "API Route Offsite Backup",
      })
    );
    assert.equal(bkpCreateRes.status, 200);
    const bkpCreateJson = await bkpCreateRes.json();
    assert.equal(bkpCreateJson.ok, true);
    const bkpId = bkpCreateJson.backup.id;

    const bkpGetRes = await getBackups(makeGetReq(`/api/backups?project_id=${projId}`));
    assert.equal(bkpGetRes.status, 200);

    const bkpRestoreRes = await postBackups(
      makePostReq("/api/backups", {
        action: "restore",
        project_id: projId,
        backup_id: bkpId,
      })
    );
    assert.equal(bkpRestoreRes.status, 200);
    const bkpRestoreJson = await bkpRestoreRes.json();
    assert.equal(bkpRestoreJson.ok, true);
  });

  it("22. Service-Ops, Firewall, Blueprints, Tokens, Debug, System-Update & MCP API Routes respond deterministically under offline Gateway", async () => {
    // 1. /api/service-ops
    const opsGetRes = await getServiceOps(makeGetReq(`/api/service-ops?project_id=${projId}`));
    assert.equal(opsGetRes.status, 200);

    for (const payload of [
      { action: "tail_logs", project_id: projId, port: 4050, service_id: "svc-4050" },
      { action: "intrusion_scan", project_id: projId },
      { action: "block_attacker", project_id: projId, ip: "198.51.100.42" },
      { action: "configure_domain", project_id: projId, service_id: "svc-4050", port: 4050, domain: "api.example.org" },
      { action: "chaos_test", project_id: projId, service_id: "svc-4050", port: 4050 },
      { action: "self_heal", project_id: projId, service_id: "svc-4050", port: 4050 },
      { action: "probe_service", project_id: projId, service_id: "svc-4050", port: 4050 },
      { action: "deploy_custom_service", project_id: projId, name: "API Test Service", port: 4096, category: "backend" },
      { action: "get_service_code", project_id: projId, service_id: "svc-4096", port: 4096 },
      { action: "hot_reload_service_code", project_id: projId, service_id: "svc-4096", port: 4096, code: "print('ok')\n" },
      { action: "sqlite_studio", project_id: projId, table: "events" },
      { action: "run_cron_job", project_id: projId, id: "cron-health-audit" },
    ]) {
      const res = await postServiceOps(makePostReq("/api/service-ops", payload));
      assert.equal(res.status, 200, `Expected 200 for service-ops action=${payload.action}`);
      const data = await res.json();
      assert.equal(data.ok, true, `Expected ok=true for service-ops action=${payload.action}`);
    }

    // 2. /api/firewall
    const fwGetRes = await getFirewall(makeGetReq(`/api/firewall?project_id=${projId}`));
    assert.equal(fwGetRes.status, 200);

    const fwProfileRes = await postFirewall(
      makePostReq("/api/firewall", {
        action: "set_profile",
        project_id: projId,
        profile: "synapse_stealth",
      })
    );
    assert.equal(fwProfileRes.status, 200);

    const fwLockoutRes = await postFirewall(
      makePostReq("/api/firewall", {
        action: "shield_port",
        project_id: projId,
        port: 22,
      })
    );
    assert.equal(fwLockoutRes.status, 400);

    // 3. /api/blueprints
    const bpGetRes = await getBlueprints();
    assert.equal(bpGetRes.status, 200);
    const bpGetJson = await bpGetRes.json();
    assert.ok(Array.isArray(bpGetJson.blueprints) && bpGetJson.blueprints.length > 0);

    const bpDeployRes = await postBlueprints(
      makePostReq("/api/blueprints", {
        action: "deploy",
        project_id: projId,
        blueprint_id: bpGetJson.blueprints[0].id,
      })
    );
    assert.equal(bpDeployRes.status, 200);

    // 4. /api/tokens
    const tokRes = await postTokens(
      makePostReq("/api/tokens", { project_id: projId, tier: "TIER_2_WORKSPACE_JAIL" })
    );
    assert.ok(tokRes.status === 200 || tokRes.status === 201);
    const tokJson = await tokRes.json();
    assert.ok(String(tokJson.token || "").startsWith("syn_join_"));

    // 5. /api/debug
    const dbgGetRes = await getDebug(makeGetReq(`/api/debug?project_id=${projId}`));
    assert.equal(dbgGetRes.status, 200);
    const dbgGetJson = await dbgGetRes.json();
    assert.equal(typeof dbgGetJson.gateway.reachable, "boolean");

    const dbgSelfTestRes = await postDebug(
      makePostReq("/api/debug", { action: "run_self_test", project_id: projId })
    );
    assert.equal(dbgSelfTestRes.status, 200);
    const dbgSelfTestJson = await dbgSelfTestRes.json();
    assert.equal(dbgSelfTestJson.ok, true);

    // 6. /api/system-update
    const sysGetRes = await getSystemUpdate(makeGetReq("/api/system-update"));
    assert.equal(sysGetRes.status, 200);

    const sysPostRes = await postSystemUpdate(
      makePostReq("/api/system-update", { action: "check", project_id: projId })
    );
    assert.equal(sysPostRes.status, 200);

    // 7. /api/mcp
    const mcpGetRes = await getMcp(makeGetReq(`/api/mcp?project_id=${projId}`));
    assert.equal(mcpGetRes.status, 200);
    const mcpGetJson = await mcpGetRes.json();
    assert.equal(mcpGetJson.serverInfo.version, "0.7.0");

    const mcpKeyRes = await postMcp(
      makePostReq("/api/mcp", {
        action: "create_key",
        project_id: projId,
        name: "Integration Test Key",
        scopes: ["read", "execute"],
      })
    );
    assert.equal(mcpKeyRes.status, 201);
    const mcpKeyJson = await mcpKeyRes.json();
    const apiKey = mcpKeyJson.plaintext_token;

    const mcpCallRes = await postMcp(
      makePostReq(
        "/api/mcp",
        {
          jsonrpc: "2.0",
          id: 42,
          project_id: projId,
          method: "tools/call",
          params: {
            name: "synapse_create_join_token",
            arguments: { tier: "TIER_2_WORKSPACE_JAIL" },
          },
        },
        { authorization: `Bearer ${apiKey}` }
      )
    );
    assert.equal(mcpCallRes.status, 200);
    const mcpCallJson = await mcpCallRes.json();
    assert.equal(mcpCallJson.result.isError, false);

    // 8. /api/orchestrator (13th App Router Route: malformed body, list_models offline, rollback_snapshot error, direct_tool & autonomous workflow)
    const orchBadBodyRes = await postOrchestrator(
      makePostReq("/api/orchestrator", "{invalid-json", undefined, true)
    );
    assert.equal(orchBadBodyRes.status, 200);

    const orchModelsRes = await postOrchestrator(
      makePostReq("/api/orchestrator", {
        action: "list_models",
        project_id: projId,
        base_url: "http://127.0.0.1:59998/v1",
      })
    );
    assert.equal(orchModelsRes.status, 200);
    const orchModelsJson = await orchModelsRes.json();
    assert.deepEqual(orchModelsJson.models, []);

    const orchRollbackRes = await postOrchestrator(
      makePostReq("/api/orchestrator", {
        action: "rollback_snapshot",
        project_id: projId,
        snapshot_id: "non-existent-snap",
      })
    );
    assert.equal(orchRollbackRes.status, 400);

    const orchDirectRes = await postOrchestrator(
      makePostReq("/api/orchestrator", {
        project_id: projId,
        direct_tool: {
          name: "core_manage_secret",
          arguments: { action: "list", key: "ALL" },
        },
      })
    );
    assert.equal(orchDirectRes.status, 200);
    const orchDirectJson = await orchDirectRes.json();
    assert.equal(orchDirectJson.execution.status, "executed");

    const orchChatRes = await postOrchestrator(
      makePostReq("/api/orchestrator", {
        project_id: projId,
        prompt: "Check system status",
      })
    );
    assert.equal(orchChatRes.status, 200);
    const orchChatJson = await orchChatRes.json();
    assert.ok(typeof orchChatJson.reply === "string" && orchChatJson.reply.length > 0);
  });

  it("23. v0.7.0 Version Synchronization & Hardened Installer Script Parity across Core & Muscle", () => {
    const repoRoot = path.resolve(process.cwd(), "../..");
    const gwMain = fs.readFileSync(path.join(repoRoot, "apps/core-gateway/main.go"), "utf8");
    const axonMain = fs.readFileSync(path.join(repoRoot, "agents/axon/cmd/axon/main.go"), "utf8");
    const pkgJson = JSON.parse(
      fs.readFileSync(path.join(repoRoot, "apps/core-web/package.json"), "utf8")
    );
    const securityMd = fs.readFileSync(path.join(repoRoot, "SECURITY.md"), "utf8");
    const changelogMd = fs.readFileSync(path.join(repoRoot, "CHANGELOG.md"), "utf8");
    const installAxonSh = fs.readFileSync(path.join(repoRoot, "scripts/install-axon.sh"), "utf8");
    const deployCoreSh = fs.readFileSync(path.join(repoRoot, "scripts/deploy-core.sh"), "utf8");

    assert.ok(gwMain.includes('"version":         "v0.7.0"'), "core-gateway /healthz must report v0.7.0");
    assert.ok(axonMain.includes('version = "v0.7.0"'), "axon main.go must default to v0.7.0");
    assert.equal(pkgJson.version, "0.7.0", "core-web package.json must report 0.7.0");
    assert.ok(securityMd.includes("0.7.x"), "SECURITY.md must list 0.7.x");
    assert.ok(changelogMd.includes("## [v0.7.0]"), "CHANGELOG.md must document v0.7.0");

    assert.ok(installAxonSh.includes("download_url()"), "install-axon.sh must include curl/wget fallback");
    assert.ok(installAxonSh.includes("verify_sha256()"), "install-axon.sh must include SHA-256 verification");
    assert.ok(installAxonSh.includes("#!/sbin/openrc-run"), "install-axon.sh must support OpenRC (Alpine)");
    assert.ok(deployCoreSh.includes("http_get()"), "deploy-core.sh must include curl/wget fallback");
  });
});
