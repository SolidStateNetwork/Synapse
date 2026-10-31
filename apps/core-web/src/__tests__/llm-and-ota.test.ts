import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { execSync } from "node:child_process";
import { NextRequest } from "next/server";

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "synapse-llm-ota-test-"));
const vaultRoot = path.join(tmpRoot, "vault");
const cartridgesRoot = path.join(tmpRoot, "cartridges");
const fakeRepoRoot = path.join(tmpRoot, "repo");
const bareRemoteRoot = path.join(tmpRoot, "remote.git");
const fakeBinDir = path.join(tmpRoot, "fake-bin");
const fakeGoBinDir = path.join(tmpRoot, ".local", "go", "bin");

for (const d of [vaultRoot, cartridgesRoot, path.join(fakeRepoRoot, "agents", "axon"), path.join(fakeRepoRoot, "apps", "core-gateway"), path.join(fakeRepoRoot, "bin"), bareRemoteRoot, fakeBinDir, fakeGoBinDir]) {
  fs.mkdirSync(d, { recursive: true });
}

process.env.SYNAPSE_VAULT_DIR = vaultRoot;
process.env.SYNAPSE_CARTRIDGES_DIR = cartridgesRoot;
process.env.SYNAPSE_REPO_ROOT = fakeRepoRoot;
process.env.SYNAPSE_MASTER_KEY = "synapse-llm-ota-test-master-key-32b!";

function makeReq(urlPath: string, method = "GET", body?: unknown, headers?: Record<string, string>): NextRequest {
  const init: { method: string; headers: Record<string, string>; body?: string } = {
    method,
    headers: { "content-type": "application/json", ...(headers || {}) },
  };
  if (body !== undefined) init.body = typeof body === "string" ? body : JSON.stringify(body);
  return new NextRequest(`http://127.0.0.1:3000${urlPath}`, init);
}

describe("Synapse LLM Streaming, Providers, Debug & OTA System-Update Deep Suite", () => {
  let mockServer: http.Server;
  let mockBaseUrl = "";
  let openAiTurn = 0;
  let anthropicTurn = 0;
  let ptyMode: "ota_ok" | "ota_fail" = "ota_ok";
  const origHome = process.env.HOME;
  const origPath = process.env.PATH;

  before(async () => {
    fs.writeFileSync(
      path.join(cartridgesRoot, "zero-trust.md"),
      "---\nname: Zero Trust\ndescription: Security rule\ncategory: security\n---\n# Zero Trust\nEnforce mTLS.\n",
      "utf8"
    );
    fs.writeFileSync(path.join(fakeRepoRoot, "agents", "axon", "main.go"), "package main\n", "utf8");
    fs.writeFileSync(path.join(fakeRepoRoot, "apps", "core-gateway", "main.go"), "package main\n", "utf8");

    execSync("git init --bare -b main", { cwd: bareRemoteRoot, stdio: "ignore" });
    execSync("git init -b main", { cwd: fakeRepoRoot, stdio: "ignore" });
    execSync('git config user.email "test@example.local"', { cwd: fakeRepoRoot, stdio: "ignore" });
    execSync('git config user.name "Synapse Test"', { cwd: fakeRepoRoot, stdio: "ignore" });
    execSync(`git remote add origin "${bareRemoteRoot}"`, { cwd: fakeRepoRoot, stdio: "ignore" });
    execSync("git add -A && git commit -m 'init fake repo'", { cwd: fakeRepoRoot, stdio: "ignore" });
    execSync("git push -u origin main", { cwd: fakeRepoRoot, stdio: "ignore" });

    fs.writeFileSync(
      path.join(fakeGoBinDir, "go"),
      `#!/usr/bin/env bash
if [ "$1" = "version" ]; then echo "go version go1.24.0 linux/amd64"; exit 0; fi
OUT=""
while [ "$#" -gt 0 ]; do
  if [ "$1" = "-o" ]; then OUT="$2"; shift 2; else shift 1; fi
done
if [ -n "$OUT" ]; then mkdir -p "$(dirname "$OUT")"; echo "fake-bin" > "$OUT"; chmod 0755 "$OUT"; fi
exit 0
`,
      { mode: 0o755 }
    );
    fs.writeFileSync(path.join(fakeBinDir, "systemctl"), "#!/usr/bin/env bash\nexit 0\n", { mode: 0o755 });

    mockServer = http.createServer(async (req, res) => {
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(Buffer.from(c));
      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}") as Record<string, unknown>;
      } catch {
        parsed = {};
      }

      if (req.url === "/v1/chat/completions") {
        openAiTurn += 1;
        res.writeHead(200, { "Content-Type": "application/json" });
        if (openAiTurn === 1) {
          res.end(JSON.stringify({
            usage: { prompt_tokens: 120, completion_tokens: 45, prompt_tokens_details: { cached_tokens: 80 } },
            choices: [{
              message: {
                reasoning_content: "Initial reasoning step from provider.",
                content: "<think>Analyzing vault state</think>Let me inspect the project state.",
                tool_calls: [{ id: "call_1", function: { name: "core_get_state", arguments: JSON.stringify({ include_audit_count: 5 }) } }],
              },
            }],
          }));
          return;
        }
        if (openAiTurn === 2) {
          res.end(JSON.stringify({
            usage: { prompt_tokens: 160, completion_tokens: 60 },
            choices: [{ message: { content: "<think>Done</think>### Completed Inspection\nAll services healthy." } }],
          }));
          return;
        }
        if (openAiTurn === 3) {
          res.end(JSON.stringify({
            choices: [{ message: { content: "", tool_calls: [{ id: "call_synth", function: { name: "core_get_state", arguments: "{}" } }] } }],
          }));
          return;
        }
        if (openAiTurn === 4) {
          res.end(JSON.stringify({ choices: [] }));
          return;
        }
        res.end(JSON.stringify({ choices: [{ message: { content: "<think>Synthesized</think>Synthesized final DevOps report." } }] }));
        return;
      }

      if (req.url === "/v1/messages") {
        anthropicTurn += 1;
        if (req.headers["x-api-key"] === "fail-key") {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "upstream error" }));
          return;
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        if (anthropicTurn === 1) {
          res.end(JSON.stringify({
            usage: { input_tokens: 100, cache_read_input_tokens: 64, cache_creation_input_tokens: 16 },
            content: [
              { type: "thinking", thinking: "Anthropic thinking block." },
              { type: "tool_use", id: "tu_1", name: "core_get_state", input: { include_audit_count: 3 } },
            ],
          }));
          return;
        }
        res.end(JSON.stringify({
          usage: { input_tokens: 140, cache_read_input_tokens: 64 },
          content: [{ type: "text", text: "Anthropic final response after tool execution." }],
        }));
        return;
      }

      if (req.url === "/v1/models") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ data: [{ id: "gpt-4o-mini" }, { id: "claude-3-5-sonnet-latest" }] }));
        return;
      }
      if (req.url === "/healthz" || req.url === "/api/v1/nodes/health-targets" || req.url === "/webhook") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok", ok: true }));
        return;
      }
      if (req.url === "/api/v1/nodes") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          nodes: [{
            node_id: "ota-node-1",
            online: true,
            tier: "TIER_1_UNLEASHED",
            remote_addr: "127.0.0.1:50001",
            connected_at: "2026-10-31T00:00:00Z",
            last_heartbeat: {
              hostname: "ota-host-1",
              os_arch: "linux/amd64",
              private_ipv4: "10.0.0.11",
              timestamp_unix: 1730000000,
              cpu_percent: 92.5,
              ram_percent: 91.0,
              disk_percent: 90.0,
              active_cores: 2,
              connected_cores: ["primary"],
              active_pty_sessions: ["default"],
              services: [
                { service_id: "svc-web-1", name: "Web Portal", port: 4050, healthy: true },
                { service_id: "svc-db-1", name: "SQLite DB", port: 5432, healthy: false, last_error: "ECONNREFUSED" },
              ],
            },
          }],
        }));
        return;
      }
      if (req.url === "/api/v1/debug") {
        res.writeHead(200, { "Content-Type": "application/json" });
        if (req.method === "POST" && parsed.action === "ping_nodes") {
          res.end(JSON.stringify({
            ping_results: [{ node_id: "ota-node-1", fs_ok: true, pty_ok: true, fs_entries: 12, current_cwd: "/workspace", pty_output: "synapse-ok", latency_ms: 4 }],
          }));
          return;
        }
        res.end(JSON.stringify({ debug_enabled: true, events: [] }));
        return;
      }
      if (req.url === "/api/v1/rpc/fs") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, content: "PORT=3000\n", entries: [] }));
        return;
      }
      if (req.url === "/api/v1/rpc/pty") {
        res.writeHead(200, { "Content-Type": "application/json" });
        if (String(parsed.command || "").includes(".synapse_fw_apply.py")) {
          res.end(JSON.stringify({ exit_code: 0, output: "SYNAPSE_FW_APPLIED_OK\n" }));
          return;
        }
        if (String(parsed.session_id || "") === "sys-update-check") {
          res.end(JSON.stringify({
            exit_code: 0,
            output: "SHA=0123456789abcdef\nMTIME=2026-10-31 01:00:00\nSVC=active\nSRC=release\nAXON_SRC=0123456789ab\n",
          }));
          return;
        }
        if (ptyMode === "ota_fail") {
          res.end(JSON.stringify({ exit_code: 1, output: "go build failed" }));
          return;
        }
        res.end(JSON.stringify({ exit_code: 0, output: "OTA_SUCCESS commit=abcdef1 sha256=0123456789abcdef\n" }));
        return;
      }

      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "not found" }));
    });

    await new Promise<void>((resolve) => {
      mockServer.listen(0, "127.0.0.1", () => {
        const addr = mockServer.address();
        if (addr && typeof addr === "object") mockBaseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });

    process.env.CORE_GATEWAY_URL = mockBaseUrl;
    process.env.CORE_GATEWAY_INTERNAL_URL = mockBaseUrl;
    process.env.HOME = tmpRoot;
    process.env.PATH = `${fakeBinDir}:${fakeGoBinDir}:${origPath || "/usr/bin:/bin"}`;
  });

  after(async () => {
    process.env.HOME = origHome;
    process.env.PATH = origPath;
    await new Promise<void>((resolve) => mockServer.close(() => resolve()));
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("29. llmStreamHelpers.ts: summarizeToolCallDetail, expandContextMentions, message formatters, language detector & halted reply formatting", async () => {
    const {
      summarizeToolCallDetail,
      expandContextMentions,
      formatOpenAIMessageContent,
      formatAnthropicMessageContent,
      splitReasoningFromReply,
      emitProgressiveTokens,
      detectPromptLanguage,
      formatHaltedWorkflowReply,
    } = await import("../lib/orchestrator/llmStreamHelpers");
    const { ensureProjectVault, withProjectStateTransaction } = await import("../lib/vault");

    const projectId = "proj-stream-helpers";
    ensureProjectVault(projectId, "Stream Helpers Project");
    await withProjectStateTransaction(projectId, (st) => {
      st.assigned_nodes.push({
        node_id: "node-alpha",
        tier: "TIER_1_UNLEASHED",
        online: true,
      });
      st.registered_services.push({
        service_id: "svc-web",
        name: "Web Frontend",
        node_id: "node-alpha",
        protocol: "http",
        port: 4050,
        healthy: true,
        registered_at: new Date().toISOString(),
      });
    });

    assert.match(summarizeToolCallDetail("node_deep_search", { node_id: "node-alpha", search_mode: "grep", query: "listen" }), /node-alpha: \[grep\] listen/);
    assert.match(summarizeToolCallDetail("core_vault_search", { scope: "memory", query: "port" }), /Vault Search \[memory\]: port/);
    assert.match(summarizeToolCallDetail("node_pty_exec", { node_id: "node-alpha", command: "systemctl status nginx --no-pager" }), /node-alpha: systemctl status nginx/);
    assert.equal(summarizeToolCallDetail("node_fs_operation", { operation: "write_file", path: "/etc/app.conf" }), "write_file /etc/app.conf");
    assert.equal(summarizeToolCallDetail("core_register_service", { name: "api", port: 8080 }), "api :8080");
    assert.equal(summarizeToolCallDetail("core_update_brain_doc", { document: "Architecture.md", mode: "append" }), "Architecture.md (append)");
    assert.equal(summarizeToolCallDetail("unknown_tool", {}), "");

    const expanded = expandContextMentions(projectId, "Check @Architecture.md and @Memory.md on @node-alpha for @svc-web :4050");
    assert.match(expanded, /<mentioned_context target="@Architecture\.md">/);
    assert.match(expanded, /<mentioned_context target="@Memory\.md">/);
    assert.match(expanded, /<mentioned_peer node_id="node-alpha"/);
    assert.match(expanded, /<mentioned_service service_id="svc-web"/);

    const imgAtt = {
      id: "att-1",
      name: "screen.png",
      mime_type: "image/png",
      data_url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    };
    const txtAtt = {
      id: "att-2",
      name: "notes.txt",
      mime_type: "text/plain",
      data_url: `data:text/plain;base64,${Buffer.from("hello world", "utf8").toString("base64")}`,
    };
    assert.equal((formatOpenAIMessageContent("", [imgAtt, txtAtt]) as unknown[]).length, 3);
    assert.equal((formatAnthropicMessageContent("", [imgAtt, txtAtt]) as unknown[]).length, 3);

    const split = splitReasoningFromReply("<think>deep thought</think>Clean answer.");
    assert.equal(split.thinking, "deep thought");
    assert.equal(split.cleanReply, "Clean answer.");

    const events: string[] = [];
    await emitProgressiveTokens("Hello token", "Thinking delta", (ev) => events.push(ev.type));
    assert.ok(events.includes("thinking_delta") && events.includes("token_delta"));

    assert.equal(detectPromptLanguage("Please check all my servers and services in English"), "en");
    assert.equal(detectPromptLanguage("Bitte prüfe alle meine Dienste und Dateien auf Deutsch"), "de");

    assert.match(formatHaltedWorkflowReply({ status: "blocked_planning_mode", tool_name: "node_pty_exec", output: {} }, 1), /Planning-Only Mode Enforced/);
    assert.match(formatHaltedWorkflowReply({ status: "paused_tier3", tool_name: "node_pty_exec", approval_id: "appr-1", output: {} }, 2), /Policy Interceptor Pause/);
    assert.match(formatHaltedWorkflowReply({ status: "executed", tool_name: "core_get_state", cached: true, output: {} }, 3), /Served from Tool Cache/);
  });

  it("30. llmProviders.ts: runOpenAICompatibleAgentLoop & runAnthropicAgentLoop execute multi-turn tool calls, synthesis fallback & error handling", async () => {
    const { runOpenAICompatibleAgentLoop, runAnthropicAgentLoop } = await import("../lib/orchestrator/llmProviders");
    const { buildCacheOptimizedSystemPromptParts } = await import("../lib/orchestrator");
    const { ensureProjectVault, withProjectStateTransaction } = await import("../lib/vault");

    const projectId = "proj-llm-loop";
    ensureProjectVault(projectId, "LLM Loop Project");
    await withProjectStateTransaction(projectId, (st) => {
      st.assigned_nodes.push({
        node_id: "ota-node-1",
        tier: "TIER_1_UNLEASHED",
        online: true,
      });
    });
    const promptParts = buildCacheOptimizedSystemPromptParts(projectId);

    const progressEvents: string[] = [];
    const oaiRes = await runOpenAICompatibleAgentLoop(
      projectId,
      `${mockBaseUrl}/v1/chat/completions`,
      "gpt-4o-mini",
      "test-api-key",
      promptParts,
      [{ role: "user", content: "Please check the current project state in English." }],
      (ev) => progressEvents.push(ev.type)
    );
    assert.ok(oaiRes);
    assert.match(oaiRes.reply, /Completed Inspection/);
    assert.equal(oaiRes.toolResults.length, 1);
    assert.ok(progressEvents.includes("step_start") && progressEvents.includes("cache_metrics"));

    const oaiSynthRes = await runOpenAICompatibleAgentLoop(
      projectId,
      `${mockBaseUrl}/v1/chat/completions`,
      "gpt-4o-mini",
      "test-api-key",
      promptParts,
      [{ role: "user", content: "Bitte prüfe den Status auf Deutsch." }]
    );
    assert.ok(oaiSynthRes);
    assert.match(oaiSynthRes.reply, /Synthesized final DevOps report/);

    const anthRes = await runAnthropicAgentLoop(
      projectId,
      mockBaseUrl,
      "claude-3-5-sonnet-latest",
      "test-anth-key",
      promptParts,
      [{ role: "user", content: "Check state via Anthropic." }]
    );
    assert.ok(anthRes);
    assert.match(anthRes.reply, /Anthropic final response/);
    assert.equal(anthRes.toolResults.length, 1);

    const anthFail = await runAnthropicAgentLoop(
      projectId,
      mockBaseUrl,
      "claude-3-5-sonnet-latest",
      "fail-key",
      promptParts,
      [{ role: "user", content: "Should return null on HTTP 500." }]
    );
    assert.equal(anthFail, null);
  });

  it("31. /api/debug & /api/orchestrator: self-test with live gateway node ping, debug toggle, model list, SSE stream & snapshot rollback", async () => {
    const debugRoute = await import("../app/api/debug/route");
    const orchRoute = await import("../app/api/orchestrator/route");
    const {
      ensureProjectVault,
      generateRandomSecret,
      readChatHistory,
      recordRollbackSnapshot,
      writeBrainDoc,
    } = await import("../lib/vault");

    const projectId = "proj-debug-ota";
    ensureProjectVault(projectId, "Debug & OTA Project");
    writeBrainDoc(projectId, "Architecture.md", "## Overview\nOld overview\n## Services\nSvc list\n", "overwrite");
    writeBrainDoc(projectId, "Architecture.md", "Updated overview text", "replace_section", "Overview");
    writeBrainDoc(projectId, "Architecture.md", "New section text", "replace_section", "NonExistentSection");
    const secKeys = generateRandomSecret(projectId, "AUTO_GENERATED_TOKEN", 24);
    assert.ok(secKeys.includes("AUTO_GENERATED_TOKEN"));

    const getRes = await debugRoute.GET(makeReq(`/api/debug?project_id=${projectId}`));
    assert.equal(getRes.status, 200);
    const getData = (await getRes.json()) as { gateway: { reachable: boolean } };
    assert.equal(getData.gateway.reachable, true);

    assert.equal((await debugRoute.POST(makeReq("/api/debug", "POST", { project_id: projectId, action: "toggle_debug", enabled: true }))).status, 200);
    assert.equal((await debugRoute.POST(makeReq("/api/debug", "POST", { project_id: projectId, action: "clear_gateway_events" }))).status, 200);

    const selfTestRes = await debugRoute.POST(makeReq("/api/debug", "POST", { project_id: projectId, action: "run_self_test" }));
    assert.equal(selfTestRes.status, 200);
    const selfTestData = (await selfTestRes.json()) as { ok: boolean; checks: Array<{ id: string; status: string }> };
    assert.equal(selfTestData.ok, true);
    assert.ok(selfTestData.checks.some((c) => c.id === "muscle_ota-node-1" && c.status === "PASS"));

    assert.equal((await debugRoute.POST(makeReq("/api/debug", "POST", { project_id: projectId, action: "invalid_action" }))).status, 400);

    const modelsRes = await orchRoute.POST(
      makeReq("/api/orchestrator", "POST", { project_id: projectId, action: "list_models", base_url: mockBaseUrl, api_key: "test-key" })
    );
    assert.equal(modelsRes.status, 200);
    const modelsData = (await modelsRes.json()) as { models: string[] };
    assert.ok(modelsData.models.includes("gpt-4o-mini"));

    const sseRes = await orchRoute.POST(
      makeReq("/api/orchestrator", "POST", {
        project_id: projectId,
        stream: true,
        provider: "anthropic",
        base_url: mockBaseUrl,
        api_key: "test-anth-key",
        model: "claude-3-5-sonnet-latest",
        messages: [{ role: "user", content: "Stream test via Anthropic" }],
      })
    );
    assert.equal(sseRes.status, 200);
    const sseText = await sseRes.text();
    assert.match(sseText, /"type":"complete"/);
    assert.ok(readChatHistory(projectId).length >= 1);

    const directRes = await orchRoute.POST(
      makeReq("/api/orchestrator", "POST", { project_id: projectId, direct_tool: { name: "core_get_state", arguments: {} } })
    );
    assert.equal(directRes.status, 200);

    recordRollbackSnapshot(projectId, {
      snapshot_id: "snap-ota-1",
      node_id: "ota-node-1",
      path: "/workspace/app.env",
      previous_content: "PORT=3000\n",
      existed: true,
      created_at: new Date().toISOString(),
    });
    const rbRes = await orchRoute.POST(
      makeReq("/api/orchestrator", "POST", { project_id: projectId, action: "rollback_snapshot", snapshot_id: "snap-ota-1" })
    );
    assert.equal(rbRes.status, 200);
  });

  it("32. /api/system-update: GET status inspection, POST check, POST update_core & POST update_muscle OTA rollout", async () => {
    const sysUpdateRoute = await import("../app/api/system-update/route");

    const getRes = await sysUpdateRoute.GET(makeReq("/api/system-update?inspect_nodes=1"));
    assert.equal(getRes.status, 200);
    const statusData = (await getRes.json()) as { nodes: Array<{ node_id: string; installed_sha256: string }> };
    assert.equal(statusData.nodes.length, 1);
    assert.equal(statusData.nodes[0].installed_sha256, "0123456789abcdef");

    const checkRes = await sysUpdateRoute.POST(makeReq("/api/system-update", "POST", { action: "check", project_id: "proj-debug-ota" }));
    assert.equal(checkRes.status, 200);

    const offlineRes = await sysUpdateRoute.POST(
      makeReq("/api/system-update", "POST", { action: "update_muscle", project_id: "proj-debug-ota", node_id: "missing-node" })
    );
    assert.equal(offlineRes.status, 200);

    ptyMode = "ota_ok";
    const otaOkRes = await sysUpdateRoute.POST(
      makeReq("/api/system-update", "POST", { action: "update_muscle", project_id: "proj-debug-ota", node_id: "ota-node-1" })
    );
    assert.equal(otaOkRes.status, 200);
    const otaOkData = (await otaOkRes.json()) as { success: boolean; steps: Array<{ status: string }> };
    assert.equal(otaOkData.success, true);
    assert.equal(otaOkData.steps[0].status, "ok");

    ptyMode = "ota_fail";
    const otaFailRes = await sysUpdateRoute.POST(
      makeReq("/api/system-update", "POST", { action: "update_muscle", project_id: "proj-debug-ota", node_id: "ota-node-1" })
    );
    assert.equal(otaFailRes.status, 200);
    const otaFailData = (await otaFailRes.json()) as { success: boolean };
    assert.equal(otaFailData.success, false);
    ptyMode = "ota_ok";

    const coreUpdateRes = await sysUpdateRoute.POST(
      makeReq("/api/system-update", "POST", { action: "update_core", project_id: "proj-debug-ota" })
    );
    assert.equal(coreUpdateRes.status, 200);
    const coreUpdateData = (await coreUpdateRes.json()) as { success: boolean; steps: Array<{ step: string; status: string }> };
    assert.equal(coreUpdateData.success, true);
    assert.ok(coreUpdateData.steps.length >= 3);
  });

  it("33. Alerts, GatewayClient, ServicePresets, ProjectTelemetrySync, Firewall & Orchestrator FS/PTY RPCs", async () => {
    const alertsRoute = await import("../app/api/alerts/route");
    const { gatewayFetchLiveNodes, gatewayFsOperation, gatewayPushHealthTargets } = await import("../lib/gatewayClient");
    const { buildDefaultServiceEndpoints } = await import("../lib/orchestrator/servicePresets");
    const { syncProjectTelemetryAndWatchdog } = await import("../lib/projects/projectTelemetrySync");
    const { executeFirewallAction } = await import("../lib/firewall");
    const { interceptAndExecuteTool } = await import("../lib/orchestrator");

    const projectId = "proj-debug-ota";
    assert.equal(buildDefaultServiceEndpoints(projectId, "mesh-db", "Mesh DB", "database").length, 2);
    assert.equal(buildDefaultServiceEndpoints(projectId, "sqlite-db", "SQLite DB", "database").length, 4);

    const liveNodes = await gatewayFetchLiveNodes(2000);
    assert.equal(liveNodes.length, 1);
    const fsRes = await gatewayFsOperation({ node_id: "ota-node-1", project_id: projectId, operation: "read_file", path: "app.env" });
    assert.equal(fsRes.success, true);
    assert.equal(await gatewayPushHealthTargets("ota-node-1", []), true);

    const cfgRes = await alertsRoute.POST(makeReq("/api/alerts", "POST", {
      project_id: projectId, action: "configure", enabled: true, telegram_enabled: true, telegram_bot_token: "bot123", telegram_chat_id: "chat456",
      discord_enabled: true, discord_webhook_url: `${mockBaseUrl}/webhook`, webhook_enabled: true, webhook_url: `${mockBaseUrl}/webhook`,
      cpu_threshold: 50, ram_threshold: 50, disk_threshold: 50, alert_on_service_down: true, alert_on_peer_offline: true, auto_heal_services: true,
    }));
    assert.equal(cfgRes.status, 200);
    assert.equal((await alertsRoute.POST(makeReq("/api/alerts", "POST", { project_id: projectId, action: "test_alert", message: "Verify channels" }))).status, 200);
    const evalRes = await alertsRoute.POST(makeReq("/api/alerts", "POST", { project_id: projectId, action: "evaluate" }));
    assert.equal(evalRes.status, 200);
    const evalData = (await evalRes.json()) as { triggered_count: number };
    assert.ok(evalData.triggered_count >= 3);

    const { withProjectStateTransaction } = await import("../lib/vault");
    await withProjectStateTransaction(projectId, (st) => {
      st.registered_services.push({ service_id: "svc-db-1", name: "SQLite DB", node_id: "ota-node-1", protocol: "http", port: 5432, healthy: true, registered_at: new Date().toISOString() });
    });
    const synced = await syncProjectTelemetryAndWatchdog(projectId);
    assert.ok(synced.state.assigned_nodes.some((n) => n.node_id === "ota-node-1" && n.online));

    await executeFirewallAction(projectId, { action: "set_profile", node_id: "ota-node-1", profile: "web_standard" });
    await executeFirewallAction(projectId, { action: "set_profile", node_id: "ota-node-1", profile: "custom" });
    await executeFirewallAction(projectId, { action: "shield_port", node_id: "ota-node-1", port: 4050 });
    await executeFirewallAction(projectId, { action: "unshield_port", node_id: "ota-node-1", port: 4050 });
    const ipAdded = await executeFirewallAction(projectId, { action: "add_ip_rule", node_id: "ota-node-1", ip_or_cidr: "10.20.0.0/16", rule_action: "allow", port: 4050, note: "Internal subnet" });
    await executeFirewallAction(projectId, { action: "remove_ip_rule", node_id: "ota-node-1", rule_id: ipAdded.policy.ip_rules[0]?.rule_id || "" });

    const r1 = await interceptAndExecuteTool("proj-llm-loop", "node_fs_operation", { node_id: "ota-node-1", operation: "read_file", path: "/workspace/app.env" });
    const r2 = await interceptAndExecuteTool("proj-llm-loop", "node_fs_operation", { node_id: "ota-node-1", operation: "read_file", path: "/workspace/app.env" });
    assert.equal(r1.status, "executed");
    assert.equal(r2.cached, true);
    const w1 = await interceptAndExecuteTool("proj-llm-loop", "node_fs_operation", { node_id: "ota-node-1", operation: "write_file", path: "/workspace/app.env", content: "PORT=4000\n" });
    assert.equal(w1.status, "executed");
    const p1 = await interceptAndExecuteTool("proj-llm-loop", "node_pty_exec", { node_id: "ota-node-1", command: "echo ok" });
    assert.equal(p1.status, "executed");
  });
});
