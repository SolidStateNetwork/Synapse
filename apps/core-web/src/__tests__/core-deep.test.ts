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
import { runDeterministicAutonomousWorkflow } from "../lib/orchestrator/autonomousFallback";
import * as projectsRoute from "../app/api/projects/route";
import * as mcpRoute from "../app/api/mcp/route";

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
      if (req.url === "/api/v1/rpc/fs") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
        return;
      }
      if (req.url === "/api/v1/rpc/pty") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            cmd_id: "mock-cmd",
            exit_code: 0,
            output: '{"db_path":"/tmp/test.db","rows_count":1,"rows":[{"id":1}]}',
            cwd: "/workspace",
          })
        );
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
});
