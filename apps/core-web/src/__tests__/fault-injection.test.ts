import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";

const faultVaultDir = fs.mkdtempSync(
  path.join(os.tmpdir(), "synapse-fault-test-")
);
process.env.SYNAPSE_VAULT_DIR = faultVaultDir;
process.env.SYNAPSE_MASTER_KEY = "unit-test-fault-injection-master-key-2026";

import {
  createMcpApiKey,
  ensureProjectVault,
  getProjectDir,
  revokeMcpApiKey,
  verifyMcpApiKey,
  withProjectStateTransaction,
} from "../lib/vault.ts";
import { loadAlertConfig, saveAlertConfig } from "../lib/alerts.ts";
import {
  hashPassword,
  loadAuthConfig,
  saveAuthConfig,
  verifyLogin,
  verifySessionToken,
} from "../lib/auth.ts";
import { loadCheckpoints, saveCheckpoints } from "../lib/checkpoints.ts";
import {
  loadSelfHealingStore,
  saveSelfHealingStore,
  loadServiceLinks,
  saveServiceLinks,
} from "../lib/self-healing.ts";
import { loadCronJobs, saveCronJobs } from "../lib/v070-studio.ts";
import { interceptAndExecuteTool } from "../lib/orchestrator.ts";
import { safeFetchJson } from "../lib/safeFetch.ts";

describe("Synapse Production Fault-Injection & Chaos Test Suite", () => {
  const faultProjId = "chaos-fault-proj";
  let mockServer: http.Server;
  let mockPort = 0;

  before(async () => {
    ensureProjectVault(faultProjId, "Chaos Fault Project");
    mockServer = http.createServer((req, res) => {
      if (req.url === "/html-502") {
        res.writeHead(502, { "Content-Type": "text/html; charset=utf-8" });
        res.end("<!DOCTYPE html><html><body><h1>502 Bad Gateway</h1></body></html>");
        return;
      }
      if (req.url === "/empty-500") {
        res.writeHead(500);
        res.end("");
        return;
      }
      if (req.url === "/slow-timeout") {
        setTimeout(() => {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true }));
        }, 400);
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, status: "healthy" }));
    });
    await new Promise<void>((resolve) => {
      mockServer.listen(0, "127.0.0.1", () => {
        const addr = mockServer.address();
        if (addr && typeof addr === "object") {
          mockPort = addr.port;
        }
        resolve();
      });
    });
  });

  after(async () => {
    mockServer.closeAllConnections?.();
    await new Promise<void>((resolve) => mockServer.close(() => resolve()));
    try {
      fs.rmSync(faultVaultDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  it("17. All JSON Stores (State, Alerts, Auth, Checkpoints, SelfHealing, ServiceLinks, CronJobs) self-heal from .bak upon corruption", async () => {
    const projDir = getProjectDir(faultProjId);

    // 1. State.json
    await withProjectStateTransaction(faultProjId, (draft) => {
      draft.description = "Intact Before Corruption";
    });
    fs.writeFileSync(path.join(projDir, "State.json"), "{ truncated-state", "utf8");
    const healedState = ensureProjectVault(faultProjId);
    assert.equal(healedState.description, "Intact Before Corruption");

    // 2. Alerts.json
    const alertCfg = loadAlertConfig(faultProjId);
    alertCfg.cpu_threshold = 77;
    saveAlertConfig(faultProjId, alertCfg);
    fs.writeFileSync(path.join(projDir, "Alerts.json"), "<<<corrupt>>>", "utf8");
    assert.equal(loadAlertConfig(faultProjId).cpu_threshold, 77);

    // 3. Checkpoints.json
    const chks = loadCheckpoints(faultProjId);
    chks[0].title = "Snapshot Before Disk Corruption";
    saveCheckpoints(faultProjId, chks);
    fs.writeFileSync(path.join(projDir, "Checkpoints.json"), "[{broken", "utf8");
    assert.equal(loadCheckpoints(faultProjId)[0].title, "Snapshot Before Disk Corruption");

    // 4. SelfHealing.json
    const shStore = loadSelfHealingStore(faultProjId);
    shStore.policy.max_latency_ms = 1234;
    saveSelfHealingStore(faultProjId, shStore);
    fs.writeFileSync(path.join(projDir, "SelfHealing.json"), "{corrupt", "utf8");
    assert.equal(loadSelfHealingStore(faultProjId).policy.max_latency_ms, 1234);

    // 5. ServiceLinks.json
    saveServiceLinks(faultProjId, [
      { id: "svc-a->svc-b", fromServiceId: "svc-a", toServiceId: "svc-b", protocol: "HTTP REST" },
    ]);
    fs.writeFileSync(path.join(projDir, "ServiceLinks.json"), "[corrupt", "utf8");
    assert.equal(loadServiceLinks(faultProjId)[0].id, "svc-a->svc-b");

    // 6. CronJobs.json
    const jobs = loadCronJobs(faultProjId);
    jobs[0].name = "Healed Cron Runbook";
    saveCronJobs(faultProjId, jobs);
    fs.writeFileSync(path.join(projDir, "CronJobs.json"), "{not-an-array", "utf8");
    assert.equal(loadCronJobs(faultProjId)[0].name, "Healed Cron Runbook");

    // 7. .synapse-auth.json
    const authCfg = loadAuthConfig();
    authCfg.enabled = true;
    authCfg.totp_pin = "9876";
    authCfg.admin_password_hash = hashPassword("vault-admin-pass");
    saveAuthConfig(authCfg);
    const authPath = path.join(faultVaultDir, ".synapse-auth.json");
    fs.writeFileSync(authPath, "{broken-auth", "utf8");
    const healedAuth = loadAuthConfig();
    assert.equal(healedAuth.enabled, true);
    assert.equal(healedAuth.totp_pin, "9876");
  });

  it("18. safeFetchJson gracefully handles HTML 502 Bad Gateway, empty 500 responses, AbortController timeouts, and ECONNREFUSED", async () => {
    // 18a. HTML 502 response never throws SyntaxError
    const res502 = await safeFetchJson(`http://127.0.0.1:${mockPort}/html-502`);
    assert.equal(res502.ok, false);
    assert.equal(res502.status, 502);
    const body502 = await res502.json();
    assert.equal(body502.ok, false);
    assert.ok(String(body502.error).includes("502"));

    // 18b. Empty 500 body never throws
    const res500 = await safeFetchJson(`http://127.0.0.1:${mockPort}/empty-500`);
    assert.equal(res500.ok, false);
    assert.equal(res500.status, 500);
    const body500 = await res500.json();
    assert.equal(body500.ok, false);

    // 18c. Timeout aborts hanging request cleanly
    const resTimeout = await safeFetchJson(
      `http://127.0.0.1:${mockPort}/slow-timeout`,
      { timeoutMs: 40 }
    );
    assert.equal(resTimeout.ok, false);
    assert.equal(resTimeout.status, 0);

    // 18d. Unreachable port (ECONNREFUSED) returns structured failure
    const resRefused = await safeFetchJson("http://127.0.0.1:59997/unreachable", {
      timeoutMs: 500,
    });
    assert.equal(resRefused.ok, false);
    assert.equal(resRefused.status, 0);
  });

  it("19. Policy Interceptor & Orchestrator resist malformed LLM tool payloads, unknown tools, and high-concurrency mutations", async () => {
    // Unknown tool in Planning-Only Mode (0 nodes) is blocked first by planning gate
    const blockedUnknown = await interceptAndExecuteTool(
      faultProjId,
      "non_existent_hallucinated_tool",
      {}
    );
    assert.equal(blockedUnknown.status, "blocked_planning_mode");

    // Assign a node in TIER_2_WORKSPACE_JAIL and verify unknown tool returns deterministic "error"
    await withProjectStateTransaction(faultProjId, (draft) => {
      draft.assigned_nodes = [
        { node_id: "edge-node-01", tier: "TIER_2_WORKSPACE_JAIL" },
      ];
    });
    const unknownRes = await interceptAndExecuteTool(
      faultProjId,
      "non_existent_hallucinated_tool",
      {}
    );
    assert.equal(unknownRes.status, "error");

    // Missing/malformed arguments on core_manage_secret
    const badSecretRes = await interceptAndExecuteTool(
      faultProjId,
      "core_manage_secret",
      { action: "set", key: "", value: "" }
    );
    assert.equal(badSecretRes.status, "error");

    // 25 parallel state transactions must serialize without lost updates
    await Promise.all(
      Array.from({ length: 25 }, (_, i) =>
        withProjectStateTransaction(faultProjId, (draft) => {
          draft.registered_services.push({
            service_id: `concurrent-svc-${i}`,
            name: `Concurrent ${i}`,
            node_id: "edge-node-01",
            port: 5100 + i,
            protocol: "http",
            path: "/",
            healthy: true,
            updated_at: new Date().toISOString(),
          });
        })
      )
    );
    const finalState = ensureProjectVault(faultProjId);
    const concurrentCount = finalState.registered_services.filter((s) =>
      s.service_id.startsWith("concurrent-svc-")
    ).length;
    assert.equal(concurrentCount, 25, "All 25 concurrent transactions must persist");
  });

  it("20. RBAC Session Verification, MCP Scope Enforcement & < 600 Line Modularization Gate", () => {
    // Forged session token must be rejected when auth is enabled
    const forged = verifySessionToken("syn_sess_forged_invalid_token");
    assert.equal(forged.valid, false);

    // Wrong password must be rejected
    const badLogin = verifyLogin("wrong-password", "9876");
    assert.equal(badLogin.ok, false);

    // MCP key revocation & scope verification
    const issuedRead = createMcpApiKey(faultProjId, "ReadOnly Agent", ["read"]);
    const verifiedRead = verifyMcpApiKey(
      faultProjId,
      issuedRead.plaintext_token
    );
    assert.ok(verifiedRead);
    assert.deepEqual(verifiedRead?.scopes, ["read"]);
    assert.equal(verifiedRead?.scopes.includes("execute"), false);

    revokeMcpApiKey(faultProjId, issuedRead.key.key_id);
    assert.equal(
      verifyMcpApiKey(faultProjId, issuedRead.plaintext_token),
      null
    );

    // Enforce < 600 lines modularization rule across the entire repository
    const repoRoot = path.resolve(import.meta.dirname, "../../../..");
    const codeDirs = [
      path.join(repoRoot, "apps/core-web/src"),
      path.join(repoRoot, "apps/core-gateway"),
      path.join(repoRoot, "agents/axon"),
    ];
    const oversized: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (
          /\.(ts|tsx|go)$/.test(entry.name) &&
          !entry.name.endsWith(".pb.go")
        ) {
          const lineCount = fs.readFileSync(full, "utf8").split("\n").length;
          // Note: wc -l counts newline characters; split("\n").length - 1 if trailing newline
          const content = fs.readFileSync(full, "utf8");
          const lines = content.endsWith("\n")
            ? content.split("\n").length - 1
            : lineCount;
          if (lines >= 600) {
            oversized.push(`${path.relative(repoRoot, full)} (${lines} lines)`);
          }
        }
      }
    };
    for (const d of codeDirs) walk(d);
    assert.deepEqual(
      oversized,
      [],
      `All code files must be < 600 lines, but found: ${oversized.join(", ")}`
    );
  });
});
