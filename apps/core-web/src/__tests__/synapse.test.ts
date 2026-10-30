import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Point SYNAPSE_VAULT_DIR to an isolated temporary directory before importing vault/orchestrator
const tempVaultDir = fs.mkdtempSync(
  path.join(os.tmpdir(), "synapse-unit-test-")
);
process.env.SYNAPSE_VAULT_DIR = tempVaultDir;
process.env.SYNAPSE_MASTER_KEY =
  "test-master-key-for-aes-256-gcm-unit-tests-2026";

const {
  ensureProjectVault,
  getProjectDir,
  withProjectStateTransaction,
  setSecret,
  getDecryptedSecrets,
  listSecretKeys,
  deleteSecret,
  appendAuditLog,
  readAuditLogs,
  createMcpApiKey,
  verifyMcpApiKey,
  revokeMcpApiKey,
  recordRollbackSnapshot,
  getRollbackSnapshot,
  readBrainDoc,
} = await import("../lib/vault.ts");

const {
  buildCacheOptimizedSystemPromptParts,
  interceptAndExecuteTool,
} = await import("../lib/orchestrator.ts");

describe("Synapse Core TypeScript Unit Test Suite", () => {
  const testProjectId = "unit-test-project";

  before(() => {
    ensureProjectVault(testProjectId);
  });

  after(() => {
    fs.rmSync(tempVaultDir, { recursive: true, force: true });
  });

  it("1. AES-256-GCM Secret Vault encrypts secrets on disk and never stores plaintext", () => {
    const rawSecret = "sk-ant-api03-TopSecretLiveTestKey9876543210";
    setSecret(testProjectId, "ANTHROPIC_API_KEY", rawSecret);
    setSecret(testProjectId, "DB_PASSWORD", "postgres-super-secret-pw");

    const keys = listSecretKeys(testProjectId);
    assert.deepEqual(keys.sort(), ["ANTHROPIC_API_KEY", "DB_PASSWORD"]);

    // Verify raw file on disk does NOT contain the plaintext secret
    const secretsEncPath = path.join(getProjectDir(testProjectId), "Secrets.enc");
    const rawDiskJson = fs.readFileSync(secretsEncPath, "utf8");
    assert.equal(
      rawDiskJson.includes(rawSecret),
      false,
      "Plaintext secret must never appear in Secrets.enc on disk"
    );

    const decrypted = getDecryptedSecrets(testProjectId);
    assert.equal(decrypted.ANTHROPIC_API_KEY, rawSecret);
    assert.equal(decrypted.DB_PASSWORD, "postgres-super-secret-pw");

    deleteSecret(testProjectId, "DB_PASSWORD");
    assert.deepEqual(listSecretKeys(testProjectId), ["ANTHROPIC_API_KEY"]);
  });

  it("2. withProjectStateTransaction serializes concurrent mutations without lost updates", async () => {
    await Promise.all(
      Array.from({ length: 8 }, (_, idx) =>
        withProjectStateTransaction(testProjectId, (draft) => {
          const svcs = draft.registered_services || [];
          svcs.push({
            service_id: `svc-${idx}`,
            node_id: "vps2-muscle",
            name: `Service ${idx}`,
            port: 5000 + idx,
            protocol: "http",
            registered_at: new Date().toISOString(),
          });
          draft.registered_services = svcs;
        })
      )
    );

    const finalState = ensureProjectVault(testProjectId);
    assert.equal(
      finalState.registered_services?.length,
      8,
      "All 8 concurrent transactions must be preserved without race overwrite"
    );
  });

  it("3. appendAuditLog redacts sensitive tokens, Bearer headers, and secret keys", () => {
    const leakedKey = "sk-live-99887766554433221100aabbccddeeff";
    appendAuditLog(testProjectId, {
      timestamp: new Date().toISOString(),
      actor: "ai_orchestrator",
      tool_name: "node_pty_exec",
      status: "executed",
      summary: `Executed curl with Authorization: Bearer ${leakedKey}`,
      args: {
        api_key: leakedKey,
        command: `export TOKEN=${leakedKey}`,
      },
    });

    const logs = readAuditLogs(testProjectId, 10);
    assert.ok(logs.length >= 1);
    const latest = logs[0];
    const serialized = JSON.stringify(latest);
    assert.equal(
      serialized.includes(leakedKey),
      false,
      "Redacted audit log must never contain raw secret token"
    );
    assert.equal(latest.args?.api_key, "[REDACTED]");
  });

  it("4. MCP API Key lifecycle hashes tokens with SHA-256 and supports revocation", () => {
    const created = createMcpApiKey(testProjectId, "Cursor IDE Test Key", [
      "read",
      "execute",
    ]);
    assert.ok(created.plaintext_token.startsWith("syn_mcp_"));

    const verified = verifyMcpApiKey(testProjectId, created.plaintext_token);
    assert.ok(verified);
    assert.equal(verified?.key_id, created.key.key_id);

    const remaining = revokeMcpApiKey(testProjectId, created.key.key_id);
    assert.equal(
      remaining.some((k) => k.key_id === created.key.key_id),
      false
    );

    const afterRevoke = verifyMcpApiKey(testProjectId, created.plaintext_token);
    assert.equal(afterRevoke, null);
  });

  it("5. File Rollback Snapshots store pre-write file state and retrieve accurately", () => {
    const snap = recordRollbackSnapshot(testProjectId, {
      snapshot_id: "snap-test-001",
      node_id: "vps2-muscle",
      path: "service/server.js",
      existed: true,
      previous_content: "console.log('v1');\n",
      file_mode: "0644",
      created_at: new Date().toISOString(),
    });

    assert.equal(snap.snapshot_id, "snap-test-001");
    const loaded = getRollbackSnapshot(testProjectId, "snap-test-001");
    assert.ok(loaded);
    assert.equal(loaded?.previous_content, "console.log('v1');\n");
    assert.equal(loaded?.path, "service/server.js");
  });

  it("6. buildCacheOptimizedSystemPromptParts separates static prefix & dynamic suffix without leaking secret values", () => {
    const parts = buildCacheOptimizedSystemPromptParts(testProjectId);
    assert.ok(
      parts.staticPrefix.includes("LAYER 1: IMMUTABLE CORE IDENTITY"),
      "Static prefix must include Layer 1 laws"
    );
    assert.ok(
      parts.dynamicSuffix.includes("<assigned_infrastructure>"),
      "Dynamic suffix must include assigned_infrastructure"
    );
    assert.ok(parts.dynamicSuffix.includes("ANTHROPIC_API_KEY"));
    assert.equal(
      parts.fullPrompt.includes("sk-ant-api03-TopSecretLiveTestKey9876543210"),
      false,
      "System prompt must never contain decrypted secret values"
    );
  });

  it("7. Policy Interceptor enforces Planning-Only Mode (0 nodes) and TIER_3_SUPERVISED approval gate", async () => {
    const policyProjId = "policy-test-proj";
    ensureProjectVault(policyProjId);

    // 7a. In Planning-Only Mode (0 assigned nodes), core_update_brain_doc is allowed
    const brainRes = await interceptAndExecuteTool(
      policyProjId,
      "core_update_brain_doc",
      {
        document: "Architecture.md",
        mode: "overwrite_full",
        content: "# Planned Architecture\n- Zero Trust Mesh\n",
      }
    );
    assert.equal(brainRes.status, "executed");
    assert.ok(
      readBrainDoc(policyProjId, "Architecture.md").includes("Zero Trust Mesh")
    );

    // 7b. In Planning-Only Mode (0 assigned nodes), node_pty_exec is blocked
    const blockedRes = await interceptAndExecuteTool(
      policyProjId,
      "node_pty_exec",
      {
        node_id: "vps2-muscle",
        command: "uname -a",
      }
    );
    assert.equal(blockedRes.status, "blocked_planning_mode");

    // 7c. Assign a node in TIER_3_SUPERVISED and verify write/exec tools pause for approval
    await withProjectStateTransaction(policyProjId, (draft) => {
      draft.assigned_nodes = [
        {
          node_id: "vps2-muscle",
          tier: "TIER_3_SUPERVISED",
        },
      ];
    });

    const tier3Res = await interceptAndExecuteTool(
      policyProjId,
      "node_pty_exec",
      {
        node_id: "vps2-muscle",
        command: "systemctl restart nginx",
      }
    );
    assert.equal(tier3Res.status, "paused_tier3");
    assert.ok(tier3Res.approval_id?.startsWith("appr-"));

    const updatedState = ensureProjectVault(policyProjId);
    assert.equal(updatedState.pending_approvals?.length, 1);
    assert.equal(
      updatedState.pending_approvals?.[0]?.approval_id,
      tier3Res.approval_id
    );
  });

  it("8. Zero-Trust RBAC Auth Engine hashes passwords, enforces 2FA PIN, and separates Admin vs Operator roles", async () => {
    const { hashPassword, loadAuthConfig, saveAuthConfig, verifyLogin } =
      await import("../lib/auth.ts");

    const cfg = loadAuthConfig();
    cfg.enabled = true;
    cfg.admin_password_hash = hashPassword("admin-secret-2026");
    cfg.operator_password_hash = hashPassword("operator-readonly-2026");
    cfg.totp_pin = "4242";
    saveAuthConfig(cfg);

    // Reject missing or wrong PIN
    const wrongPin = verifyLogin("admin-secret-2026", "0000");
    assert.equal(wrongPin.ok, false);

    // Operator login succeeds with role === "operator"
    const opRes = verifyLogin("operator-readonly-2026", "4242");
    assert.equal(opRes.ok, true);
    assert.equal(opRes.role, "operator");
    assert.ok(opRes.session?.token.startsWith("syn_sess_"));

    // Admin login succeeds with role === "admin"
    const admRes = verifyLogin("admin-secret-2026", "4242");
    assert.equal(admRes.ok, true);
    assert.equal(admRes.role, "admin");
  });

  it("9. Time-Machine Checkpoints & 24/7 Watchdog Alert Engine persist snapshots and dispatch alerts", async () => {
    const { loadCheckpoints, saveCheckpoints } = await import(
      "../lib/checkpoints.ts"
    );
    const { loadAlertConfig, dispatchAlertEvent } = await import(
      "../lib/alerts.ts"
    );
    const { SERVICE_BLUEPRINTS } = await import(
      "../lib/templates/serviceTemplates.ts"
    );

    const initialChks = loadCheckpoints(testProjectId);
    assert.ok(initialChks.length >= 1);

    initialChks.unshift({
      id: "chk-unit-test-1",
      project_id: testProjectId,
      node_id: "vps2-muscle",
      timestamp: new Date().toISOString(),
      title: "Unit Test Multi-Core Snapshot",
      actor: "Admin",
      summary: "Verified 2 active Cores",
      files_backed_up: ["/etc/axon/config.json"],
      services_snapshot: [],
      rollback_cmd: "echo OK",
    });
    saveCheckpoints(testProjectId, initialChks);
    const reloadedChks = loadCheckpoints(testProjectId);
    assert.equal(reloadedChks[0].id, "chk-unit-test-1");

    const evt = await dispatchAlertEvent(testProjectId, {
      severity: "INFO",
      title: "Multi-Core Tunnel Verified",
      message: "vps2-muscle connected to 2 Cores simultaneously",
      node_id: "vps2-muscle",
    });
    assert.ok(evt.id.startsWith("alt-"));
    const alertCfg = loadAlertConfig(testProjectId);
    assert.equal(alertCfg.events[0].title, "Multi-Core Tunnel Verified");
    assert.equal(SERVICE_BLUEPRINTS.length, 3);
  });

  it("10. Autonomous Self-Healing Engine executes recovery runbook, persists SelfHealingEvent, and updates policy", async () => {
    const {
      executeAutonomousSelfHeal,
      loadSelfHealingStore,
      updateSelfHealingPolicy,
    } = await import("../lib/self-healing.ts");

    const updatedStore = updateSelfHealingPolicy(testProjectId, {
      max_latency_ms: 950,
      failure_threshold: 2,
    });
    assert.equal(updatedStore.policy.max_latency_ms, 950);

    const healEvt = await executeAutonomousSelfHeal({
      projectId: testProjectId,
      nodeId: "vps2-muscle",
      serviceId: "uptime-beacon-4060",
      serviceName: "Uptime- & Latenz-Beacon :4060",
      port: 4060,
      trigger: "crash_simulation",
      simulateCrash: true,
    });

    assert.equal(healEvt.status, "RECOVERED");
    assert.equal(healEvt.port, 4060);
    assert.equal(healEvt.trigger, "crash_simulation");
    assert.ok(healEvt.mttr_ms >= 50);
    assert.equal(healEvt.runbook_steps.length, 4);

    const storeAfter = loadSelfHealingStore(testProjectId);
    assert.ok(storeAfter.events.length >= 1);
    assert.equal(storeAfter.events[0].id, healEvt.id);
  });

  it("11. v0.6.0 Custom Service Builder & Service-Mesh Link Probe persist services and link telemetry", async () => {
    const {
      deployCustomServiceOnMuscle,
      loadServiceLinks,
      probeServiceLinkOnMuscle,
    } = await import("../lib/self-healing.ts");

    const deployed = await deployCustomServiceOnMuscle({
      projectId: testProjectId,
      nodeId: "vps2-muscle",
      name: "Edge Telemetry API",
      port: 4095,
      category: "backend",
      runtime: "python_http",
      autoHeal: true,
    });
    assert.equal(deployed.ok, true);
    assert.equal(deployed.service.port, 4095);
    assert.equal(deployed.service.healthy, true);

    const linkRes = await probeServiceLinkOnMuscle({
      projectId: testProjectId,
      nodeId: "vps2-muscle",
      fromServiceId: "edge-telemetry-api-4095",
      toServiceId: "pulse-analytics-api",
      fromPort: 4095,
      toPort: 4085,
      protocol: "JSON Telemetry",
    });
    assert.equal(linkRes.ok, true);
    assert.equal(linkRes.link.protocol, "JSON Telemetry");
    assert.ok((linkRes.link.latency_ms ?? 0) >= 1);

    const savedLinks = loadServiceLinks(testProjectId);
    assert.ok(
      savedLinks.some(
        (l) => l.id === "edge-telemetry-api-4095->pulse-analytics-api"
      )
    );
  });

  it("12. v0.7.0 Live Code Hot-Reload, SQLite Data Studio & Scheduled Cron-Runbooks execute and persist state", async () => {
    const {
      loadServiceCodeFromMuscle,
      hotReloadServiceCodeOnMuscle,
      executeSqliteStudioAction,
      loadCronJobs,
      runCronJobNowOnMuscle,
    } = await import("../lib/v070-studio.ts");

    const codeInfo = await loadServiceCodeFromMuscle({
      projectId: testProjectId,
      nodeId: "vps2-muscle",
      serviceId: "edge-telemetry-api-4095",
      port: 4095,
    });
    assert.equal(codeInfo.ok, true);
    assert.ok(codeInfo.code.includes("4095"));

    const reloadRes = await hotReloadServiceCodeOnMuscle({
      projectId: testProjectId,
      nodeId: "vps2-muscle",
      serviceId: "edge-telemetry-api-4095",
      port: 4095,
      filePath: codeInfo.file_path,
      code: codeInfo.code + "\n# v0.7.0 hot-reload test\n",
    });
    assert.equal(reloadRes.ok, true);
    assert.ok(reloadRes.snapshot_id.startsWith("snap-hotreload-"));

    const sqliteRes = await executeSqliteStudioAction({
      projectId: testProjectId,
      nodeId: "vps2-muscle",
      table: "events",
    });
    assert.equal(sqliteRes.ok, true);
    assert.ok(sqliteRes.tables.includes("events"));
    assert.ok(Array.isArray(sqliteRes.rows));

    const cronJobs = loadCronJobs(testProjectId);
    assert.ok(cronJobs.length >= 2);
    const runRes = await runCronJobNowOnMuscle({
      projectId: testProjectId,
      jobId: cronJobs[0].id,
    });
    assert.equal(runRes.ok, true);
    assert.equal(runRes.job.last_exit_code, 0);
  });

  it("13. v0.7.0 Power-Polish: generated Python microservices implement GET/POST/PUT/DELETE/OPTIONS and Canvas wheel scroll zones are isolated", async () => {
    const { loadServiceCodeFromMuscle } = await import("../lib/v070-studio.ts");
    const codeInfo = await loadServiceCodeFromMuscle({
      projectId: testProjectId,
      nodeId: "vps2-muscle",
      serviceId: "edge-telemetry-api-4095",
      port: 4095,
    });
    assert.equal(codeInfo.ok, true);
    assert.ok(
      codeInfo.code.includes("def do_GET") &&
        codeInfo.code.includes("def do_POST") &&
        codeInfo.code.includes("def do_OPTIONS") &&
        (codeInfo.code.includes("def do_PUT") ||
          codeInfo.code.includes("do_PUT = do_POST")) &&
        (codeInfo.code.includes("def do_DELETE") ||
          codeInfo.code.includes("do_DELETE = do_POST")),
      "Generated microservice must support GET, POST, PUT, DELETE, and OPTIONS without HTTP 501"
    );

    const viewportHookSrc = fs.readFileSync(
      path.resolve(
        import.meta.dirname,
        "../components/canvas/useCanvasViewportAndLayout.ts"
      ),
      "utf8"
    );
    assert.ok(
      viewportHookSrc.includes("[data-canvas-scroll-zone='true']"),
      "useCanvasViewportAndLayout must isolate [data-canvas-scroll-zone='true'] from background Canvas wheel zoom"
    );
  });
});
