import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { NextRequest } from "next/server";

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "synapse-deep-test-"));
const vaultRoot = path.join(tmpRoot, "vault");
const cartridgesRoot = path.join(tmpRoot, "cartridges");
fs.mkdirSync(vaultRoot, { recursive: true });
fs.mkdirSync(cartridgesRoot, { recursive: true });

process.env.SYNAPSE_VAULT_DIR = vaultRoot;
process.env.SYNAPSE_CARTRIDGES_DIR = cartridgesRoot;
process.env.SYNAPSE_MASTER_KEY = "synapse-deep-test-master-key-32bytes!";

import {
  ensureProjectVault,
  recordRollbackSnapshot,
  setSecret,
  withProjectStateTransaction,
} from "../lib/vault";
import {
  deleteCustomCartridge,
  listCartridges,
  saveCustomCartridge,
} from "../lib/cartridges";
import {
  executeCoreVaultSearch,
  executeNodeDeepSearch,
} from "../lib/orchestrator/searchEngine";
import { executeServiceAction } from "../lib/projects/serviceActionRunner";
import { resetBackgroundCronCooldown } from "../lib/projects/projectTelemetrySync";
import {
  deleteGitStackOnMuscle,
  deployGitStackOnMuscle,
  loadGitStacks,
  triggerGitOpsWebhookRedeploy,
} from "../lib/projects/gitopsDeployer";
import {
  fetchNodeTelemetryHistory,
  tailServiceLogs,
} from "../lib/self-healing";
import {
  parseCronIntervalMinutes,
  runDueCronJobsOnMuscle,
  saveCronJobs,
} from "../lib/v070-studio";
import { loadAlertConfig } from "../lib/alerts";
import { runDeterministicAutonomousWorkflow } from "../lib/orchestrator/autonomousFallback";
import * as projectsRoute from "../app/api/projects/route";
import * as mcpRoute from "../app/api/mcp/route";
import * as serviceOpsRoute from "../app/api/service-ops/route";

function makeReq(
  urlPath: string,
  method = "GET",
  body?: unknown,
  headers?: Record<string, string>
): NextRequest {
  const init: { method: string; headers: Record<string, string>; body?: string } = {
    method,
    headers: { "content-type": "application/json", ...(headers || {}) },
  };
  if (body !== undefined) {
    init.body = typeof body === "string" ? body : JSON.stringify(body);
  }
  return new NextRequest(`http://127.0.0.1:3000${urlPath}`, init);
}

describe("Synapse Core-Web Deep Coverage Suite (SearchEngine, ServiceRunner, Cartridges, Projects & MCP)", () => {
  let mockServer: http.Server;
  let mockBaseUrl = "";

  before(async () => {
    fs.writeFileSync(
      path.join(cartridgesRoot, "docker-first.md"),
      "---\nname: Docker First\ndescription: Built-in Docker rule\ncategory: containers\n---\n# Docker First\nAlways use containers.\n",
      "utf8"
    );

    mockServer = http.createServer((req, res) => {
      if (req.url === "/api/v1/nodes") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            nodes: [
              {
                node_id: "local-node",
                history: [
                  { timestamp_unix: 1730000000, cpu_percent: 12.5, ram_percent: 44.2, disk_percent: 31.0 },
                  { timestamp_unix: 1730000005, cpu_percent: 14.1, ram_percent: 44.5, disk_percent: 31.0 },
                ],
              },
            ],
          })
        );
        return;
      }
      if (req.url === "/api/v1/rpc/fs") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
        return;
      }
      if (req.url === "/api/v1/rpc/pty") {
        const chunks: Buffer[] = [];
        req.on("data", (c: Buffer) => chunks.push(c));
        req.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          let output = '{"db_path":"/tmp/test.db","rows_count":1,"rows":[{"id":1}]}';
          if (raw.includes("GITOPS_RESULT")) {
            output = "Cloned stack\nGITOPS_RESULT|a1b2c3d|0\n";
          } else if (raw.includes("fail-cron-cmd")) {
            output = "CRON_START\nDisk check failed: /var full\nCRON_EXIT|2\n";
          } else if (raw.includes("CRON_")) {
            output = "CRON_START\nCron OK\nCRON_EXIT|0\n";
          } else if (raw.includes("LOG_")) {
            output = "LOG_START\n2026-10-31 INFO Ready\n2026-10-31 ERROR Connection timeout\nLOG_END\n";
          }
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ cmd_id: "mock-cmd", exit_code: 0, output, cwd: "/workspace" }));
        });
        return;
      }
      if (req.url?.startsWith("/preview/")) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ proxied: true, path: req.url }));
        return;
      }
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("error");
    });

    await new Promise<void>((resolve) => {
      mockServer.listen(0, "127.0.0.1", () => {
        const addr = mockServer.address();
        if (addr && typeof addr === "object") {
          mockBaseUrl = `http://127.0.0.1:${addr.port}`;
        }
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise<void>((resolve) => mockServer.close(() => resolve()));
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("24. searchEngine.ts: executeCoreVaultSearch & executeNodeDeepSearch cover all scopes, regex fallbacks, and RPC paths", async () => {
    const projectId = "proj-search-deep";
    const state = ensureProjectVault(projectId, "Search Project");

    for (const [query, scope] of [
      ["Architecture|Synapse", "all"],
      ["[unclosed-regex", "architecture"],
      ["", "all"],
    ]) {
      const res = executeCoreVaultSearch(projectId, state, "core_vault_search", { query, scope });
      assert.equal(res.status, "executed");
    }

    const deepOk = await executeNodeDeepSearch(
      mockBaseUrl,
      projectId,
      state,
      "node-search-1",
      "TIER_1_UNLEASHED",
      "node_deep_search",
      { search_mode: "content_grep", query: "listen", target_dir: "/workspace", file_glob: "*.py", context_lines: 3 }
    );
    assert.equal(deepOk.status, "executed");

    const deepFail = await executeNodeDeepSearch(
      `${mockBaseUrl}/fail`,
      projectId,
      state,
      "node-search-1",
      "TIER_1_UNLEASHED",
      "node_deep_search",
      { search_mode: "log_scan" }
    );
    assert.equal(deepFail.status, "error");
  });

  it("25. cartridges.ts & serviceActionRunner.ts: custom cartridge CRUD and SQL/HTTP service actions", async () => {
    const saved = saveCustomCartridge({
      name: "Zero Downtime Blue-Green",
      description: "Blue-green deployment rules",
      category: "deployment",
      content: "Ensure healthchecks pass before switching traffic.",
    });
    assert.equal(saved.id, "zero-downtime-blue-green");
    assert.ok(saved.content.startsWith("# Zero Downtime Blue-Green"));

    const all = listCartridges();
    assert.ok(all.some((c) => c.id === "zero-downtime-blue-green"));
    assert.ok(all.some((c) => c.id === "docker-first"));

    assert.equal(deleteCustomCartridge("docker-first"), false);
    assert.equal(deleteCustomCartridge("zero-downtime-blue-green"), true);
    assert.equal(deleteCustomCartridge("zero-downtime-blue-green"), false);

    const projectId = "proj-svc-runner";
    ensureProjectVault(projectId);
    await withProjectStateTransaction(projectId, (draft) => {
      draft.assigned_nodes = [{ node_id: "node-sql-1", tier: "TIER_1_UNLEASHED", online: true }];
    });

    const sqlRes = await executeServiceAction({
      projectId,
      nodeId: "node-sql-1",
      port: 4050,
      method: "SQL",
      rawPath: "custom.db",
      payload: "SELECT 1;",
    });
    assert.equal(sqlRes.method, "SQL");
    assert.ok(sqlRes.proxy_url.includes("sqlite://node-sql-1"));

    const httpRes = await executeServiceAction({
      projectId,
      nodeId: "node-sql-1",
      port: 4050,
      method: "POST",
      rawPath: "api/items",
      payload: JSON.stringify({ title: "item-1" }),
    });
    assert.equal(httpRes.method, "POST");
  });

  it("26. /api/projects route: exercises all 19 POST actions and approval lifecycle", async () => {
    const projectId = "proj-api-full";
    ensureProjectVault(projectId);
    setSecret(projectId, "LLM_API_KEY", "sk-test-secret-value");
    const nowIso = new Date().toISOString();
    await withProjectStateTransaction(projectId, (draft) => {
      draft.ai_settings = {
        provider: "openai-compatible",
        base_url: "https://api.openai.com/v1",
        model: "gpt-4o",
        api_key_secret_name: "LLM_API_KEY",
        enable_prompt_caching: true,
        enable_auto_watchdog: true,
      };
      draft.registered_services.push({
        service_id: "svc-heal-1",
        name: "Heal Target",
        node_id: "node-1",
        protocol: "http",
        port: 4050,
        auto_heal: true,
        registered_at: nowIso,
      });
      draft.pending_approvals.push(
        {
          approval_id: "appr-reject-1",
          tool_name: "core_update_brain_doc",
          node_id: "node-1",
          arguments: { document: "Memory.md", mode: "append", content: "x" },
          created_at: nowIso,
          status: "pending",
        },
        {
          approval_id: "appr-approve-1",
          tool_name: "core_update_brain_doc",
          node_id: "node-1",
          arguments: { document: "Memory.md", mode: "append", content: "Approved entry" },
          created_at: nowIso,
          status: "pending",
        }
      );
    });

    assert.equal((await projectsRoute.GET(makeReq(`/api/projects?project_id=${projectId}&light=1`))).status, 200);
    assert.equal(
      (await projectsRoute.POST(makeReq("/api/projects", "POST", { project_id: projectId, action: "assign_node", node_id: "" }))).status,
      400
    );

    for (const payload of [
      { action: "create_project", new_project_id: "proj-cloned-1", name: "Cloned Project" },
      { action: "clear_chat" },
      { action: "assign_node", node_id: "node-p1", tier: "TIER_2_WORKSPACE_JAIL" },
      { action: "assign_node", node_id: "node-p1", tier: "TIER_1_UNLEASHED" },
      { action: "unassign_node", node_id: "node-p1" },
      { action: "toggle_cartridge", cartridge_id: "docker-first" },
      { action: "toggle_cartridge", cartridge_id: "docker-first" },
      { action: "create_custom_cartridge", name: "My Custom Rule", content: "# Rule\nStrict mode." },
      { action: "delete_custom_cartridge", cartridge_id: "my-custom-rule" },
      { action: "upsert_playbook", playbook_id: "pb-1", name: "Nightly Audit" },
      { action: "delete_playbook", playbook_id: "pb-1" },
      { action: "upsert_mesh_link", source_node_id: "node-a", target_node_id: "node-b", remote_port: 5432 },
      { action: "remove_mesh_link", link_id: "mesh-node-a-node-b-5432" },
      { action: "toggle_service_auto_heal", service_id: "svc-heal-1" },
      { action: "save_doc", document: "Memory.md", content: "- Entry", mode: "append" },
      { action: "set_secret", key: "API_TOKEN", value: "tok-123" },
      { action: "delete_secret", key: "API_TOKEN" },
      { action: "save_ai_settings", provider: "openai-compatible", model: "gpt-4o-mini", api_key: "sk-new-key" },
      { action: "invoke_service_action", node_id: "node-1", port: 4050, method: "GET", path: "/health" },
      { action: "resolve_approval", approval_id: "appr-reject-1", decision: "reject" },
      { action: "resolve_approval", approval_id: "appr-approve-1", decision: "approve" },
    ]) {
      const r = await projectsRoute.POST(makeReq("/api/projects", "POST", { project_id: projectId, ...payload }));
      assert.equal(r.status, 200);
    }

    assert.equal(
      (await projectsRoute.POST(makeReq("/api/projects", "POST", { project_id: projectId, action: "resolve_approval", approval_id: "missing" }))).status,
      404
    );
    assert.equal(
      (await projectsRoute.POST(makeReq("/api/projects", "POST", { project_id: projectId, action: "unknown_action_xyz" }))).status,
      400
    );
  });

  it("27. /api/mcp route & autonomousFallback.ts: JSON-RPC 2.0 tools/call, resources/read, scopes & deterministic workflows", async () => {
    const projectId = "proj-mcp-deep";
    ensureProjectVault(projectId);
    const snap = recordRollbackSnapshot(projectId, {
      snapshot_id: "snap-mcp-1",
      node_id: "node-mcp-1",
      path: "app.py",
      existed: true,
      previous_content: "print('v1')\n",
      file_mode: "0644",
      created_at: new Date().toISOString(),
    });

    const roKeyRes = await mcpRoute.POST(
      makeReq("/api/mcp", "POST", { project_id: projectId, action: "create_key", name: "RO Key", scopes: ["read"] })
    );
    const roKeyData = (await roKeyRes.json()) as { plaintext_token: string; key: { key_id: string } };

    const roCallRes = await mcpRoute.POST(
      makeReq(
        "/api/mcp",
        "POST",
        { project_id: projectId, jsonrpc: "2.0", id: 10, method: "tools/call", params: { name: "synapse_create_join_token", arguments: {} } },
        { "x-synapse-api-key": roKeyData.plaintext_token }
      )
    );
    const roCallJson = (await roCallRes.json()) as { result: { isError: boolean } };
    assert.equal(roCallJson.result.isError, true);

    for (const rpcBody of [
      { jsonrpc: "2.0", id: 1, method: "initialize" },
      { jsonrpc: "2.0", id: 2, method: "ping" },
      { jsonrpc: "2.0", id: 3, method: "tools/list" },
      { jsonrpc: "2.0", id: 4, method: "resources/list" },
      { jsonrpc: "2.0", id: 5, method: "prompts/list" },
      { jsonrpc: "2.0", id: 6, method: "unsupported/method" },
      { jsonrpc: "2.0", id: 7, method: "resources/read", params: { uri: `synapse://${projectId}/Architecture.md` } },
      { jsonrpc: "2.0", id: 8, method: "resources/read", params: { uri: `synapse://${projectId}/Memory.md` } },
      { jsonrpc: "2.0", id: 9, method: "resources/read", params: { uri: `synapse://${projectId}/Audit.jsonl` } },
      { jsonrpc: "2.0", id: 10, method: "resources/read", params: { uri: `synapse://${projectId}/State.json` } },
      { jsonrpc: "2.0", id: 11, method: "tools/call", params: { name: "synapse_list_peers", arguments: {} } },
      { jsonrpc: "2.0", id: 12, method: "tools/call", params: { name: "synapse_get_project_state", arguments: {} } },
      { jsonrpc: "2.0", id: 13, method: "tools/call", params: { name: "synapse_create_join_token", arguments: { tier: "TIER_2_WORKSPACE_JAIL" } } },
      { jsonrpc: "2.0", id: 14, method: "tools/call", params: { name: "synapse_rollback_snapshot", arguments: { snapshot_id: "missing-snap" } } },
      { jsonrpc: "2.0", id: 15, method: "tools/call", params: { name: "synapse_rollback_snapshot", arguments: { snapshot_id: snap.snapshot_id } } },
      { tool: "core_vault_search", arguments: { query: "Synapse", scope: "all" } },
    ]) {
      const r = await mcpRoute.POST(makeReq("/api/mcp", "POST", { project_id: projectId, internal_ui_test: true, ...rpcBody }));
      assert.equal(r.status, 200);
    }

    await mcpRoute.POST(makeReq("/api/mcp", "POST", { project_id: projectId, action: "revoke_key", key_id: roKeyData.key.key_id }));
    assert.equal((await mcpRoute.POST(makeReq("/api/mcp", "POST", { project_id: projectId, internal_ui_test: true }))).status, 400);

    await withProjectStateTransaction(projectId, (draft) => {
      draft.planning_only = false;
      draft.assigned_nodes = [{ node_id: "node-wf-1", tier: "TIER_1_UNLEASHED", online: true }];
    });
    const promptParts = { staticPrefix: "System Prefix", dynamicSuffix: "Dynamic Suffix", fullPrompt: "System Prefix\nDynamic Suffix" };

    for (const prompt of [
      "deploy microservice 4050",
      "diagnose 4050",
      "exec: uname -a",
      "ls",
      "journal: verified deployment",
      "register service 4060",
      "checksystem",
      "checkopsec",
      "skillsearch",
      "status probe",
    ]) {
      const wf = await runDeterministicAutonomousWorkflow(projectId, prompt, undefined, promptParts);
      assert.ok(wf.reply.length > 0);
    }

    const visionWf = await runDeterministicAutonomousWorkflow(
      projectId,
      "inspect architecture screenshot",
      [{ id: "att-1", name: "arch.png", mime_type: "image/png", data_url: "data:image/png;base64,AA==" }],
      promptParts
    );
    assert.ok(visionWf.reply.includes("Multimodal Vision Analysis"));
  });

  it("29. v0.6.0 Option A/B/C: tailServiceLogs, fetchNodeTelemetryHistory, gitopsDeployer & runDueCronJobsOnMuscle", async () => {
    const projectId = "proj-v060-milestone";
    ensureProjectVault(projectId, "v0.6.0 Milestone Project");
    setSecret(projectId, "API_TOKEN", "sec-v060-value");
    const prevGw = process.env.CORE_GATEWAY_URL;
    process.env.CORE_GATEWAY_URL = mockBaseUrl;

    try {
      // Option A: tailServiceLogs & fetchNodeTelemetryHistory
      const logDocker = await tailServiceLogs({ projectId, containerName: "synapse-api", port: 4010 });
      assert.equal(logDocker.ok, true);
      assert.equal(logDocker.has_error, true);

      const logUnit = await tailServiceLogs({ projectId, unitName: "axon.service", port: 4011 });
      assert.equal(logUnit.ok, true);

      const logSqlite = await tailServiceLogs({ projectId, serviceId: "sqlite-db", port: 3001 });
      assert.equal(logSqlite.ok, true);

      const logDefault = await tailServiceLogs({ projectId, serviceId: "web-app", port: 4012 });
      assert.equal(logDefault.ok, true);

      const histRes = await fetchNodeTelemetryHistory({ projectId, nodeId: "local-node" });
      assert.equal(histRes.ok, true);
      assert.equal(histRes.sample_count, 2);

      // Option B: GitOps & Docker-Compose Stack-Deployer
      const badUrl = await deployGitStackOnMuscle({
        projectId,
        name: "bad",
        repoUrl: "https://example.com/repo.git; rm -rf /",
        port: 4080,
      });
      assert.equal(badUrl.ok, false);

      const badPort = await deployGitStackOnMuscle({
        projectId,
        name: "bad-port",
        repoUrl: "https://github.com/example/stack.git",
        port: 80,
      });
      assert.equal(badPort.ok, false);

      const deployed = await deployGitStackOnMuscle({
        projectId,
        name: "Analytics Stack",
        repoUrl: "https://github.com/example/analytics.git",
        branch: "main",
        port: 4085,
        category: "backend",
      });
      assert.equal(deployed.ok, true);
      assert.ok(deployed.webhook_token?.startsWith("syn_git_"));
      assert.equal(deployed.stack?.last_commit, "a1b2c3d");
      assert.ok(deployed.stack?.injected_secret_keys.includes("API_TOKEN"));
      assert.equal(loadGitStacks(projectId).length, 1);

      const badHook = await triggerGitOpsWebhookRedeploy({
        projectId,
        stackId: deployed.stack!.stack_id,
        webhookToken: "wrong-token",
      });
      assert.equal(badHook.ok, false);

      const missingHook = await triggerGitOpsWebhookRedeploy({
        projectId,
        stackId: "missing-stack",
      });
      assert.equal(missingHook.ok, false);

      const goodHook = await triggerGitOpsWebhookRedeploy({
        projectId,
        stackId: deployed.stack!.stack_id,
        webhookToken: deployed.webhook_token,
      });
      assert.equal(goodHook.ok, true);
      assert.equal(goodHook.redeployed, true);

      // Option C: Cron Due-Scheduler & Forensic Alerts
      assert.equal(parseCronIntervalMinutes("*/10 * * * *"), 10);
      assert.equal(parseCronIntervalMinutes("0 */2 * * *"), 120);
      assert.equal(parseCronIntervalMinutes("30 * * * *"), 60);
      assert.equal(parseCronIntervalMinutes("0 4 * * *"), 1440);
      assert.equal(parseCronIntervalMinutes("invalid"), 15);

      saveCronJobs(projectId, [
        {
          id: "cron-ok-1",
          name: "Health Check",
          cron_expression: "*/5 * * * *",
          node_id: "local-node",
          command: "uptime",
          enabled: true,
        },
        {
          id: "cron-fail-1",
          name: "Disk Forensic Audit",
          cron_expression: "*/5 * * * *",
          node_id: "local-node",
          command: "fail-cron-cmd",
          enabled: true,
        },
      ]);

      const dueRes = await runDueCronJobsOnMuscle({ projectId, forceAll: true });
      assert.equal(dueRes.evaluated_count, 2);
      assert.equal(dueRes.executed_count, 2);
      assert.equal(dueRes.failed_count, 1);
      const alerts = loadAlertConfig(projectId).events;
      assert.ok(alerts.some((a) => a.severity === "CRITICAL" && a.title.includes("Disk Forensic Audit")));

      // Verify /api/service-ops route actions for v0.6.0 & v0.7.0 MCP/Orchestrator tools
      for (const payload of [
        { action: "tail_service_logs", service_id: "web-app", port: 4012 },
        { action: "node_telemetry_history", node_id: "local-node" },
        { action: "list_git_stacks" },
        { action: "deploy_git_stack", name: "Route Stack", repo_url: "https://github.com/example/route.git", port: 4086 },
        { action: "gitops_webhook", stack_id: deployed.stack!.stack_id, webhook_token: deployed.webhook_token },
        { action: "delete_git_stack", stack_id: deployed.stack!.stack_id },
        { action: "run_due_cron_jobs" },
      ]) {
        const res = await serviceOpsRoute.POST(makeReq("/api/service-ops", "POST", { project_id: projectId, ...payload }));
        assert.equal(res.status, 200);
      }
      assert.equal((await deleteGitStackOnMuscle({ projectId, stackId: "missing-stack" })).ok, false);

      for (const toolCall of [
        { name: "core_deploy_git_stack", arguments: { name: "MCP Stack", repo_url: "https://github.com/example/mcp.git", port: 4087 } },
        { name: "core_tail_service_logs", arguments: { service_id: "web-app", port: 4012 } },
        { name: "core_run_due_cron_jobs", arguments: { force_all: true } },
      ]) {
        const r = await mcpRoute.POST(
          makeReq("/api/mcp", "POST", {
            project_id: projectId,
            internal_ui_test: true,
            jsonrpc: "2.0",
            id: 99,
            method: "tools/call",
            params: toolCall,
          })
        );
        assert.equal(r.status, 200);
      }

      const promptParts = { staticPrefix: "System", dynamicSuffix: "Suffix", fullPrompt: "System\nSuffix" };
      for (const chatCmd of [
        "gitops: https://github.com/example/auto.git 4088",
        "logs: 4088",
        "cron-due",
      ]) {
        const wf = await runDeterministicAutonomousWorkflow(projectId, chatCmd, undefined, promptParts);
        assert.ok(wf.reply.length > 0);
      }
      resetBackgroundCronCooldown(projectId);
      resetBackgroundCronCooldown();
    } finally {
      process.env.CORE_GATEWAY_URL = prevGw;
    }
  });
});
