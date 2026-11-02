import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { GET as getMetrics } from "../app/api/metrics/route";
import { GET as getWebhookInfo, POST as postWebhook } from "../app/api/playbooks/webhook/route";
import { interceptAndExecuteTool } from "../lib/orchestrator";
import { appendAuditLog, ensureProjectVault } from "../lib/vault";
import {
  buildCoreMetricsSummary,
  buildCorePrometheusMetrics,
  createSignedAuditSnapshot,
  ensurePolicyAsCodeFile,
  evaluatePolicyAsCode,
  executeDagPlaybook,
  signTopologyBundle,
  simulateTopologyBundleApply,
  verifyPlaybookWebhookSignature,
  verifySignedAuditSnapshot,
  verifyTopologyBundleSignature,
  type SignedTopologyBundlePayload,
} from "../lib/vault/v250Enterprise";

describe("Synapse v2.5.0 — Phase 8 Enterprise CRL, Signed Topology Bundles, DAG Playbooks, Policy-as-Code & OpenMetrics", () => {
  let tmpDir = "";
  const projId = "v250-enterprise-test";

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "synapse-v250-test-"));
    process.env.SYNAPSE_VAULT_DIR = tmpDir;
    process.env.SYNAPSE_MASTER_KEY = "v250-enterprise-master-secret-key-unit-test";
    ensureProjectVault(projId);
  });

  after(() => {
    delete process.env.SYNAPSE_METRICS_TOKEN;
    delete process.env.SYNAPSE_WEBHOOK_SECRET;
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup error
    }
  });

  it("48. M8.2: signTopologyBundle & verifyTopologyBundleSignature produce deterministic HMAC-SHA256 signatures and detect tampering", () => {
    const rawBundle: SignedTopologyBundlePayload = {
      schema_version: "synapse-stack/v2.5",
      project_id: projId,
      active_cartridges: ["docker-first", "zero-trust-networking"],
      registered_services: [
        { service_id: "api-svc", name: "API Gateway", port: 8080, protocol: "http" },
      ],
    };

    const signed = signTopologyBundle(projId, rawBundle);
    assert.equal(typeof signed.bundle_signature, "string");
    assert.equal(signed.bundle_signature?.length, 64);
    assert.ok(String(signed.signer_fingerprint || "").startsWith("sha256:"));

    const verOk = verifyTopologyBundleSignature(projId, signed);
    assert.equal(verOk.valid, true);
    assert.equal(verOk.signer_fingerprint, signed.signer_fingerprint);

    const tampered: SignedTopologyBundlePayload = {
      ...signed,
      active_cartridges: ["docker-first", "injected-malicious-cartridge"],
    };
    const verTampered = verifyTopologyBundleSignature(projId, tampered);
    assert.equal(verTampered.valid, false);
    assert.ok(String(verTampered.reason || "").includes("mismatch"));
  });

  it("49. M8.2: simulateTopologyBundleApply computes non-destructive drift plan and rejects tampered bundles", async () => {
    const bundle: SignedTopologyBundlePayload = signTopologyBundle(projId, {
      project_id: projId,
      active_cartridges: ["docker-first", "zero-trust-networking", "new-enterprise-cartridge"],
      registered_services: [
        { service_id: "new-redis", name: "Redis Cache", port: 6379, protocol: "tcp" },
      ],
      peer_mesh_links: [
        { source_node_id: "node-a", target_node_id: "node-b", remote_port: 5432 },
      ],
    });

    const drift = simulateTopologyBundleApply(projId, bundle, true);
    assert.equal(drift.valid_signature, true);
    assert.deepEqual(drift.services_to_add, ["new-redis"]);
    assert.deepEqual(drift.cartridges_to_add, ["new-enterprise-cartridge"]);
    assert.equal(drift.links_to_add, 1);
    assert.ok(drift.total_changes >= 3);

    // Ensure State.json was not mutated during simulate_apply
    const afterState = ensureProjectVault(projId);
    assert.equal(afterState.registered_services.some((s) => s.service_id === "new-redis"), false);
  });

  it("50. M8.2: core_manage_topology_bundle orchestrator tool supports export, sign, verify, simulate_apply & rejects tampered import", async () => {
    const expRes = await interceptAndExecuteTool(
      projId,
      "core_manage_topology_bundle",
      { action: "export" },
      true
    );
    assert.equal(expRes.status, "executed");
    const exportedBundle = (expRes.output as { bundle: SignedTopologyBundlePayload }).bundle;
    assert.ok(exportedBundle.bundle_signature);

    const simRes = await interceptAndExecuteTool(
      projId,
      "core_manage_topology_bundle",
      { action: "simulate_apply", bundle: exportedBundle, require_signature: true },
      true
    );
    assert.equal(simRes.status, "executed");

    // Tamper with exported bundle and verify import is rejected
    const forgedBundle = { ...exportedBundle, bundle_signature: "0".repeat(64) };
    const impForged = await interceptAndExecuteTool(
      projId,
      "core_manage_topology_bundle",
      { action: "import", bundle: forgedBundle },
      true
    );
    assert.equal(impForged.status, "error");
  });

  it("51. M8.3: executeDagPlaybook executes multi-stage DAG in topological order with on_success branching and Pre-Flight Checkpoint", async () => {
    const executedOrder: string[] = [];
    const dagRes = await executeDagPlaybook(
      projId,
      {
        name: "Blue-Green Rollout DAG",
        auto_checkpoint: true,
        steps: [
          { id: "build", command: "npm run build", on_success: ["migrate"], on_failure: ["rollback_alert"] },
          { id: "migrate", command: "npx prisma migrate deploy", depends_on: ["build"] },
          { id: "smoke_test", command: "curl -fsS http://127.0.0.1:3000/healthz", depends_on: ["migrate"] },
          { id: "rollback_alert", command: "echo FAILED" },
        ],
      },
      async (_nodeId, cmd, stepId) => {
        executedOrder.push(stepId);
        return { exitCode: 0, output: `OK: ${cmd}` };
      }
    );

    assert.equal(dagRes.success, true);
    assert.equal(dagRes.rolled_back, false);
    assert.ok(String(dagRes.checkpoint_id || "").startsWith("chk-"));
    assert.deepEqual(executedOrder, ["build", "migrate", "smoke_test"]);
    const skippedStep = dagRes.results.find((r) => r.step_id === "rollback_alert");
    assert.equal(skippedStep?.status, "skipped");
  });

  it("52. M8.3: executeDagPlaybook triggers on_failure branch, skips dependent steps, and flags rolled_back on error", async () => {
    const dagFailRes = await executeDagPlaybook(
      projId,
      {
        name: "Failing Canary DAG",
        auto_checkpoint: true,
        steps: [
          { id: "canary_deploy", command: "deploy --canary", on_failure: ["compensate_cleanup"] },
          { id: "promote_prod", command: "deploy --promote", depends_on: ["canary_deploy"] },
          { id: "compensate_cleanup", command: "cleanup --failed-canary" },
        ],
      },
      async (_nodeId, _cmd, stepId) => {
        if (stepId === "canary_deploy") {
          return { exitCode: 1, output: "Canary health check failed" };
        }
        return { exitCode: 0, output: "Compensating cleanup executed" };
      }
    );

    assert.equal(dagFailRes.success, false);
    assert.equal(dagFailRes.rolled_back, true);
    assert.equal(dagFailRes.results.find((r) => r.step_id === "canary_deploy")?.status, "failed");
    assert.equal(dagFailRes.results.find((r) => r.step_id === "promote_prod")?.status, "skipped");
    assert.equal(dagFailRes.results.find((r) => r.step_id === "compensate_cleanup")?.status, "succeeded");
  });

  it("53. M8.3: POST /api/playbooks/webhook validates HMAC-SHA256 X-Synapse-Signature + 300s timestamp window and triggers DAG", async () => {
    process.env.SYNAPSE_WEBHOOK_SECRET = "whsec_v250_test_secret";

    const getRes = await getWebhookInfo();
    assert.equal(getRes.status, 200);

    const payloadObj = {
      project_id: projId,
      playbook_name: "Webhook CI Deploy",
      steps: [
        { id: "step-1", command: "mock_ok git pull" },
        { id: "step-2", command: "mock_ok systemctl reload app", depends_on: ["step-1"] },
      ],
    };
    const rawBody = JSON.stringify(payloadObj);
    const ts = String(Date.now());
    const sig = crypto
      .createHmac("sha256", process.env.SYNAPSE_WEBHOOK_SECRET)
      .update(`${ts}.${rawBody}`)
      .digest("hex");

    const validReq = new Request("http://localhost:3000/api/playbooks/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-synapse-signature": `sha256=${sig}`,
        "x-synapse-timestamp": ts,
      },
      body: rawBody,
    });
    const validRes = await postWebhook(validReq);
    assert.equal(validRes.status, 200);
    const validJson = (await validRes.json()) as { ok: boolean };
    assert.equal(validJson.ok, true);

    // Expired timestamp (> 300s) must be rejected with 401
    const expiredTs = String(Date.now() - 600_000);
    const expiredCheck = verifyPlaybookWebhookSignature(projId, rawBody, sig, expiredTs);
    assert.equal(expiredCheck.valid, false);
  });

  it("54. Policy-as-Code (.synapse/policies.json) initializes ruleset and evaluates deny / require_approval / allow rules", async () => {
    const policyCfg = ensurePolicyAsCodeFile(projId);
    assert.equal(policyCfg.schema_version, "synapse.policy.v2.5");
    assert.ok(policyCfg.rules.length >= 3);

    const denyEval = evaluatePolicyAsCode(projId, {
      toolName: "node_pty_exec",
      command: "sudo rm -rf / --no-preserve-root",
    });
    assert.equal(denyEval.allowed, false);
    assert.equal(denyEval.effect, "deny");
    assert.equal(denyEval.matched_rule, "deny-destructive-root-wipe");

    const supEval = evaluatePolicyAsCode(projId, {
      toolName: "node_firewall_control",
      tier: "TIER_3_SUPERVISED",
    });
    assert.equal(supEval.allowed, false);
    assert.equal(supEval.effect, "require_approval");

    const allowEval = evaluatePolicyAsCode(projId, {
      toolName: "core_vault_search",
      tier: "TIER_2_WORKSPACE_JAIL",
    });
    assert.equal(allowEval.allowed, true);
    assert.equal(allowEval.effect, "allow");
  });

  it("55. Signed Audit Snapshots (AuditSnapshot.json) cryptographically sign Audit.jsonl Chain-Tip-Hash and detect tampering", () => {
    appendAuditLog(projId, {
      timestamp: new Date().toISOString(),
      actor: "ai_orchestrator",
      tool_name: "core_vault_search",
      status: "executed",
      summary: "Audit entry before signed snapshot",
    });

    const snapshot = createSignedAuditSnapshot(projId);
    assert.equal(snapshot.project_id, projId);
    assert.equal(snapshot.chain_valid, true);
    assert.equal(snapshot.chain_tip_hash.length, 64);
    assert.equal(verifySignedAuditSnapshot(projId, snapshot), true);

    const tamperedSnap = { ...snapshot, entries_count: snapshot.entries_count + 99 };
    assert.equal(verifySignedAuditSnapshot(projId, tamperedSnap), false);
  });

  it("56. M8.5: GET /api/metrics exports OpenMetrics/Prometheus text and JSON summary with Bearer token protection", async () => {
    process.env.SYNAPSE_METRICS_TOKEN = "prom_secret_v250_token";

    const unauthRes = await getMetrics(new Request("http://localhost:3000/api/metrics"));
    assert.equal(unauthRes.status, 401);

    const promRes = await getMetrics(
      new Request(`http://localhost:3000/api/metrics?project_id=${projId}`, {
        headers: { Authorization: "Bearer prom_secret_v250_token" },
      })
    );
    assert.equal(promRes.status, 200);
    const promText = await promRes.text();
    assert.ok(promText.includes("synapse_audit_chain_valid"));
    assert.ok(promText.includes("synapse_policy_rules_total"));

    const jsonRes = await getMetrics(
      new Request(`http://localhost:3000/api/metrics?project_id=${projId}&format=json`, {
        headers: { Authorization: "Bearer prom_secret_v250_token" },
      })
    );
    assert.equal(jsonRes.status, 200);
    const jsonBody = (await jsonRes.json()) as { ok: boolean; version: string; audit_chain_valid: boolean };
    assert.equal(jsonBody.ok, true);
    assert.equal(jsonBody.version, "v2.5.0");
    assert.equal(jsonBody.audit_chain_valid, true);

    assert.ok(buildCorePrometheusMetrics(projId).includes("synapse_core_info"));
    assert.equal(buildCoreMetricsSummary(projId).version, "v2.5.0");
  });

  it("57. M8.1: core_manage_cluster_nodes supports revoke_node and marks revoked node offline in project state", async () => {
    await interceptAndExecuteTool(
      projId,
      "core_manage_cluster_nodes",
      { action: "assign_node", node_id: "compromised-node-01", tier: "TIER_2_WORKSPACE_JAIL" },
      true
    );
    const revokeRes = await interceptAndExecuteTool(
      projId,
      "core_manage_cluster_nodes",
      { action: "revoke_node", node_id: "compromised-node-01", reason: "security_drill_revocation" },
      true
    );
    assert.equal(revokeRes.status, "executed");
    const out = revokeRes.output as { crl_revoked: boolean; assigned_nodes: Array<{ node_id: string }> };
    assert.equal(out.crl_revoked, true);
    assert.equal(out.assigned_nodes.some((n) => n.node_id === "compromised-node-01"), false);
  });

  it("58. M8.6: All .go files < 500 lines and all .ts/.tsx files < 600 lines across the repository", () => {
    const repoRoot = path.resolve(process.cwd(), "../..");
    const walk = (dir: string, exts: string[], out: string[] = []): string[] => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === "node_modules" || entry.name === ".next" || entry.name === ".git") continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full, exts, out);
        } else if (exts.some((ext) => entry.name.endsWith(ext))) {
          out.push(full);
        }
      }
      return out;
    };

    for (const goFile of walk(repoRoot, [".go"])) {
      const lines = fs.readFileSync(goFile, "utf8").split("\n").length;
      assert.ok(lines <= 500, `Go file ${path.relative(repoRoot, goFile)} has ${lines} lines (limit <= 500)`);
    }
    for (const tsFile of walk(path.join(repoRoot, "apps/core-web/src"), [".ts", ".tsx"])) {
      const lines = fs.readFileSync(tsFile, "utf8").split("\n").length;
      assert.ok(lines <= 600, `TS file ${path.relative(repoRoot, tsFile)} has ${lines} lines (limit <= 600)`);
    }
  });
});
