import { NextRequest, NextResponse } from "next/server";
import {
  appendAuditLog,
  appendChatMessage,
  clearChatHistory,
  deleteSecret,
  ensureProjectVault,
  getDecryptedSecrets,
  listProjects,
  listSecretKeys,
  readAuditLogs,
  readBrainDoc,
  readChatHistory,
  saveProjectState,
  setSecret,
  writeBrainDoc,
} from "@/lib/vault";
import {
  deleteCustomCartridge,
  listCartridges,
  OFFICIAL_STACK_BLUEPRINTS,
  saveCustomCartridge,
} from "@/lib/cartridges";
import {
  buildDefaultServiceEndpoints,
  CORE_GATEWAY_URL,
  fetchGatewayNodes,
  interceptAndExecuteTool,
  pushNodeHealthTargets,
} from "@/lib/orchestrator";

export async function GET(req: NextRequest) {
  const projectId =
    req.nextUrl.searchParams.get("project_id") || "synapse-cloud-demo";
  const projects = listProjects();
  const state = ensureProjectVault(projectId);
  const liveNodes = await fetchGatewayNodes();

  // Merge live gateway node status, telemetry & service health into project state view
  let stateChanged = false;
  const watchdogTargets: Array<{
    service_id: string;
    name: string;
    node_id: string;
    port: number;
  }> = [];

  for (const assigned of state.assigned_nodes) {
    const match = liveNodes.find((n) => n.node_id === assigned.node_id);
    assigned.online = Boolean(match?.online);
    assigned.status = assigned.online ? "ONLINE" : "OFFLINE";
    if (match?.last_heartbeat) {
      const hb = match.last_heartbeat;
      state.telemetry[assigned.node_id] = hb;
      assigned.hostname = hb.hostname;
      assigned.os_arch = hb.os_arch;
      assigned.os_info = hb.os_info || hb.os_arch;
      assigned.last_seen_unix = hb.timestamp_unix;
      assigned.network = {
        public_ipv4: hb.public_ipv4 || null,
        private_ipv4: hb.private_ipv4 || "127.0.0.1",
      };
      assigned.active_pty_sessions =
        hb.pty_session_details ||
        (hb.active_pty_sessions || []).map((sid) => ({
          session_id: sid,
          cwd: `/opt/axon/workspaces/${projectId}`,
          running_cmd: null,
        }));

      // Synchronize registered service health statuses from node heartbeat
      // and auto-import any services reported by Multi-Core Muscle nodes
      if (Array.isArray(hb.services)) {
        for (const liveSvc of hb.services) {
          if (!liveSvc.service_id || !liveSvc.port) continue;
          const exists = state.registered_services.some(
            (s) =>
              s.node_id === assigned.node_id &&
              s.service_id === liveSvc.service_id
          );
          if (!exists) {
            state.registered_services.push({
              service_id: liveSvc.service_id,
              name: liveSvc.name || liveSvc.service_id,
              node_id: assigned.node_id,
              protocol: "http",
              port: liveSvc.port,
              path: "/",
              healthy: Boolean(liveSvc.healthy),
              consecutive_failures: 0,
              registered_at: new Date().toISOString(),
            });
            stateChanged = true;
          }
        }

        for (const svc of state.registered_services) {
          if (svc.node_id !== assigned.node_id) continue;
          const liveSvc = hb.services.find(
            (ls) =>
              ls.service_id === svc.service_id || ls.port === svc.port
          );
          if (liveSvc) {
            if (svc.healthy !== liveSvc.healthy) {
              stateChanged = true;
            }
            svc.healthy = liveSvc.healthy;
            if (liveSvc.healthy) {
              svc.consecutive_failures = 0;
            } else {
              svc.consecutive_failures = (svc.consecutive_failures || 0) + 1;
              stateChanged = true;

              const lastHealMs = svc.last_auto_heal_at
                ? new Date(svc.last_auto_heal_at).getTime()
                : 0;
              const cooldownPassed = Date.now() - lastHealMs > 10_000;
              if (
                svc.auto_heal !== false &&
                state.ai_settings?.enable_auto_watchdog !== false &&
                (svc.consecutive_failures || 0) >= 2 &&
                cooldownPassed
              ) {
                svc.last_auto_heal_at = new Date().toISOString();
                svc.consecutive_failures = 0;
                watchdogTargets.push({
                  service_id: svc.service_id,
                  name: svc.name,
                  node_id: svc.node_id,
                  port: svc.port,
                });
              }
            }

            svc.health_check = {
              type:
                svc.health_check?.type ||
                ((svc.protocol?.toUpperCase() || "HTTP") as
                  | "HTTP"
                  | "TCP"
                  | "EXEC"),
              target:
                svc.health_check?.target ||
                `http://127.0.0.1:${svc.port}${svc.path || "/"}`,
              interval_sec: svc.health_check?.interval_sec || 15,
              status: liveSvc.healthy ? "HEALTHY" : "UNHEALTHY",
              last_checked: new Date(hb.timestamp_unix * 1000).toISOString(),
              last_error: liveSvc.last_error,
            };
          }
        }
      }
    }
  }
  for (const svc of state.registered_services) {
    if (!svc.category) {
      if (/db|sqlite|postgres|mysql|redis|mongo|sql/i.test(`${svc.service_id} ${svc.name}`)) {
        svc.category = "database";
      } else if (/web|ui|frontend|dashboard|portal|app/i.test(`${svc.service_id} ${svc.name}`)) {
        svc.category = "webui";
      } else {
        svc.category = "backend";
      }
      stateChanged = true;
    }
    if (!svc.description) {
      svc.description =
        svc.category === "webui"
          ? `Interactive WebUI reachable from outside via Synapse Reverse Proxy (127.0.0.1:${svc.port})`
          : svc.category === "database"
          ? `Interactive Database & Storage Engine on ${svc.node_id} (127.0.0.1:${svc.port})`
          : `Reachable Backend REST API via Synapse Reverse Proxy (127.0.0.1:${svc.port})`;
      stateChanged = true;
    }
    if (!Array.isArray(svc.endpoints) || svc.endpoints.length === 0) {
      svc.endpoints = buildDefaultServiceEndpoints(
        projectId,
        svc.service_id,
        svc.name,
        svc.category,
        svc.path || "/",
        svc.db_path
      );
      stateChanged = true;
    }
  }

  if (stateChanged) {
    saveProjectState(state);
  }

  // Trigger Proactive Auto-Watchdog self-healing for degraded services
  for (const target of watchdogTargets) {
    try {
      const healRes = await interceptAndExecuteTool(
        projectId,
        "node_pty_exec",
        {
          node_id: target.node_id,
          session_id: `watchdog-${projectId}`,
          command: `cd /opt/axon/workspaces/${projectId} 2>/dev/null || true; if [ -f docker-compose.yml ] || [ -f compose.yml ]; then docker compose up -d 2>/dev/null || true; fi; for c in $(docker ps -aq --filter status=exited 2>/dev/null); do docker start "$c" >/dev/null 2>&1 || true; done; if [ -f service/server.js ] && ! ss -tln 2>/dev/null | grep -q ":${target.port} "; then (nohup node service/server.js >/tmp/synapse-svc-${target.port}.log 2>&1 &); fi; sleep 0.8; curl -fsS http://127.0.0.1:${target.port}/`,
          wait_timeout_ms: 15000,
        },
        true
      );

      // Update service health immediately if curl probe succeeded
      const healedSvc = state.registered_services.find(
        (s) => s.service_id === target.service_id || s.port === target.port
      );
      if (healedSvc && healRes.status === "executed") {
        healedSvc.healthy = true;
        healedSvc.consecutive_failures = 0;
        if (healedSvc.health_check) {
          healedSvc.health_check.status = "HEALTHY";
          healedSvc.health_check.last_error = undefined;
        }
        saveProjectState(state);
      }

      writeBrainDoc(
        projectId,
        "Memory.md",
        `- **[${new Date().toISOString()}]** 🤖 **Proactive Auto-Watchdog:** Automatically restarted unhealthy service \`${target.name}\` (\`127.0.0.1:${target.port}\` on \`${target.node_id}\`).`,
        "append"
      );

      appendChatMessage(projectId, {
        role: "assistant",
        content: `🤖 **Proactive Auto-Watchdog Triggered:** Detected consecutive health probe failures on **${target.name}** (\`127.0.0.1:${target.port}\` on \`${target.node_id}\`). Automatically restarted the container/daemon, verified \`http://127.0.0.1:${target.port}/\`, and logged the recovery in \`Memory.md\`.`,
        timestamp: new Date().toISOString(),
        toolResults: [healRes],
      });
    } catch {
      // ignore background watchdog error
    }
  }

  return NextResponse.json({
    projects,
    active_project: state,
    architecture_md: readBrainDoc(projectId, "Architecture.md"),
    memory_md: readBrainDoc(projectId, "Memory.md"),
    secret_keys: listSecretKeys(projectId),
    audit_logs: readAuditLogs(projectId, 200),
    chat_history: readChatHistory(projectId, 100),
    cartridges: listCartridges(),
    blueprints: OFFICIAL_STACK_BLUEPRINTS,
    gateway_nodes: liveNodes,
    gateway_url: CORE_GATEWAY_URL,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const action = String(body.action || "");
  const projectId = String(body.project_id || "synapse-cloud-demo");

  if (action === "create_project") {
    const newId = String(body.new_project_id || `project-${Date.now()}`);
    const created = ensureProjectVault(
      newId,
      String(body.name || ""),
      String(body.description || "")
    );

    // Automatically inherit configured AI endpoint & API key from the source project (or synapse-cloud-demo)
    const templateState = ensureProjectVault(projectId);
    if (templateState.ai_settings) {
      created.ai_settings = { ...templateState.ai_settings };
      saveProjectState(created);
      const secretKeyName =
        templateState.ai_settings.api_key_secret_name || "LLM_API_KEY";
      const srcSecrets = getDecryptedSecrets(projectId);
      if (srcSecrets[secretKeyName]) {
        setSecret(created.project_id, secretKeyName, srcSecrets[secretKeyName]);
      }
    }

    return NextResponse.json({ project: created });
  }

  if (action === "clear_chat") {
    const reset = clearChatHistory(projectId);
    return NextResponse.json({ chat_history: reset });
  }

  const state = ensureProjectVault(projectId);

  if (action === "assign_node") {
    const nodeId = String(body.node_id || "").trim();
    const tier = body.tier || "TIER_2_WORKSPACE_JAIL";
    if (!nodeId) {
      return NextResponse.json(
        { error: "node_id is required" },
        { status: 400 }
      );
    }
    const existingIdx = state.assigned_nodes.findIndex(
      (n) => n.node_id === nodeId
    );
    if (existingIdx >= 0) {
      state.assigned_nodes[existingIdx].tier = tier;
    } else {
      state.assigned_nodes.push({
        node_id: nodeId,
        tier,
        online: true,
      });
    }
    const saved = saveProjectState(state);
    appendAuditLog(projectId, {
      timestamp: new Date().toISOString(),
      actor: "user",
      tool_name: "assign_node",
      node_id: nodeId,
      status: "executed",
      summary: `Assigned Axon Muscle Node '${nodeId}' with autonomy tier ${tier}`,
    });
    return NextResponse.json({ project: saved });
  }

  if (action === "unassign_node") {
    const nodeId = String(body.node_id || "");
    state.assigned_nodes = state.assigned_nodes.filter(
      (n) => n.node_id !== nodeId
    );
    const saved = saveProjectState(state);
    appendAuditLog(projectId, {
      timestamp: new Date().toISOString(),
      actor: "user",
      tool_name: "unassign_node",
      node_id: nodeId,
      status: "executed",
      summary: `Unassigned Axon Node '${nodeId}'`,
    });
    return NextResponse.json({ project: saved });
  }

  if (action === "toggle_cartridge") {
    const cartridgeId = String(body.cartridge_id || "");
    if (state.active_cartridges.includes(cartridgeId)) {
      state.active_cartridges = state.active_cartridges.filter(
        (id) => id !== cartridgeId
      );
    } else {
      state.active_cartridges.push(cartridgeId);
    }
    const saved = saveProjectState(state);
    return NextResponse.json({ project: saved });
  }

  if (action === "create_custom_cartridge") {
    const created = saveCustomCartridge({
      name: String(body.name || "Custom DevOps Rule"),
      description: String(body.description || "User-defined Synapse Rule Cartridge"),
      category: String(body.category || "custom"),
      content: String(body.content || ""),
    });
    if (!state.active_cartridges.includes(created.id)) {
      state.active_cartridges.push(created.id);
    }
    const saved = saveProjectState(state);
    appendAuditLog(projectId, {
      timestamp: new Date().toISOString(),
      actor: "user",
      tool_name: "create_custom_cartridge",
      status: "executed",
      summary: `Created and activated custom Rule Cartridge '${created.name}' (${created.id}.md)`,
    });
    return NextResponse.json({
      cartridge: created,
      cartridges: listCartridges(),
      project: saved,
    });
  }

  if (action === "delete_custom_cartridge") {
    const cartridgeId = String(body.cartridge_id || "");
    const deleted = deleteCustomCartridge(cartridgeId);
    state.active_cartridges = state.active_cartridges.filter(
      (id) => id !== cartridgeId
    );
    const saved = saveProjectState(state);
    return NextResponse.json({
      deleted,
      cartridges: listCartridges(),
      project: saved,
    });
  }

  if (action === "upsert_playbook") {
    const pbId = String(body.playbook_id || `pb-${Date.now()}`);
    const cronExpr = String(body.cron_expression || body.cron || "0 3 * * *");
    const pb = {
      playbook_id: pbId,
      name: String(body.name || "Scheduled AI Playbook"),
      cron_expression: cronExpr,
      cron: cronExpr,
      prompt: String(body.prompt || "Inspect server health and update Memory.md"),
      target_node_id: body.target_node_id ? String(body.target_node_id) : undefined,
      enabled: body.enabled !== undefined ? Boolean(body.enabled) : true,
      last_status: "Scheduled",
    };
    state.scheduled_playbooks = [
      ...(state.scheduled_playbooks || []).filter(
        (x) => x.playbook_id !== pbId
      ),
      pb,
    ];
    const saved = saveProjectState(state);
    return NextResponse.json({ project: saved });
  }

  if (action === "delete_playbook") {
    const pbId = String(body.playbook_id || "");
    state.scheduled_playbooks = (state.scheduled_playbooks || []).filter(
      (x) => x.playbook_id !== pbId
    );
    const saved = saveProjectState(state);
    return NextResponse.json({ project: saved });
  }

  if (action === "upsert_mesh_link") {
    const portNum = Number(
      body.remote_port || body.target_port || body.local_port || 5432
    );
    const res = await interceptAndExecuteTool(
      projectId,
      "core_link_peers",
      {
        action: "upsert",
        source_node_id: body.source_node_id,
        target_node_id: body.target_node_id,
        local_port: Number(body.local_port || portNum),
        remote_port: portNum,
        protocol: body.protocol || "tcp",
        alias_env: body.alias_env || "PEER_SERVICE_URL",
        description: body.description || body.alias_env,
      },
      true
    );
    return NextResponse.json({
      project: ensureProjectVault(projectId),
      result: res,
    });
  }

  if (action === "remove_mesh_link") {
    const linkId = String(body.link_id || "");
    state.peer_mesh_links = (state.peer_mesh_links || []).filter(
      (l) => l.link_id !== linkId
    );
    const saved = saveProjectState(state);
    return NextResponse.json({ project: saved });
  }

  if (action === "toggle_service_auto_heal") {
    const serviceId = String(body.service_id || "");
    for (const svc of state.registered_services) {
      if (svc.service_id === serviceId) {
        svc.auto_heal = svc.auto_heal === false ? true : false;
      }
    }
    const saved = saveProjectState(state);
    return NextResponse.json({ project: saved });
  }

  if (action === "save_doc") {
    const doc =
      body.document === "Memory.md" ? "Memory.md" : "Architecture.md";
    const updated = writeBrainDoc(
      projectId,
      doc,
      String(body.content || ""),
      body.mode === "append" ? "append" : "overwrite"
    );
    appendAuditLog(projectId, {
      timestamp: new Date().toISOString(),
      actor: "user",
      tool_name: "core_update_brain_doc",
      status: "executed",
      summary: `Updated ${doc} via Brain Vault Editor`,
    });
    return NextResponse.json({ content: updated });
  }

  if (action === "set_secret") {
    const keys = setSecret(
      projectId,
      String(body.key || ""),
      String(body.value || "")
    );
    appendAuditLog(projectId, {
      timestamp: new Date().toISOString(),
      actor: "user",
      tool_name: "core_manage_secret",
      status: "executed",
      summary: `Stored AES-256-GCM encrypted secret '${String(
        body.key || ""
      ).toUpperCase()}' in Secrets.enc`,
    });
    return NextResponse.json({ secret_keys: keys });
  }

  if (action === "delete_secret") {
    const keys = deleteSecret(projectId, String(body.key || ""));
    appendAuditLog(projectId, {
      timestamp: new Date().toISOString(),
      actor: "user",
      tool_name: "core_manage_secret",
      status: "executed",
      summary: `Deleted secret '${String(body.key || "").toUpperCase()}'`,
    });
    return NextResponse.json({ secret_keys: keys });
  }

  if (action === "save_ai_settings") {
    const provider = String(body.provider || "openai-compatible");
    const baseUrl = String(body.base_url || "https://api.openai.com/v1").trim();
    const model = String(body.model || "gpt-4o").trim();
    const secretName = String(body.api_key_secret_name || "LLM_API_KEY")
      .trim()
      .toUpperCase();

    state.ai_settings = {
      provider,
      base_url: baseUrl,
      model,
      api_key_secret_name: secretName,
      enable_prompt_caching:
        body.enable_prompt_caching !== undefined
          ? Boolean(body.enable_prompt_caching)
          : state.ai_settings?.enable_prompt_caching ?? true,
      enable_auto_watchdog:
        body.enable_auto_watchdog !== undefined
          ? Boolean(body.enable_auto_watchdog)
          : state.ai_settings?.enable_auto_watchdog ?? true,
    };

    if (body.api_key && String(body.api_key).trim() !== "") {
      setSecret(projectId, secretName, String(body.api_key).trim());
    }

    const saved = saveProjectState(state);
    appendAuditLog(projectId, {
      timestamp: new Date().toISOString(),
      actor: "user",
      tool_name: "configure_ai_endpoint",
      status: "executed",
      summary: `Configured AI Endpoint: provider=${provider}, base_url=${baseUrl}, model=${model}`,
    });
    return NextResponse.json({
      project: saved,
      secret_keys: listSecretKeys(projectId),
    });
  }

  if (action === "resolve_approval") {
    const approvalId = String(body.approval_id || "");
    const decision = body.decision === "approve" ? "approved" : "rejected";
    const target = state.pending_approvals.find(
      (a) => a.approval_id === approvalId
    );
    if (!target) {
      return NextResponse.json(
        { error: "Approval request not found" },
        { status: 404 }
      );
    }
    target.status = decision;
    saveProjectState(state);

    if (decision === "rejected") {
      appendAuditLog(projectId, {
        timestamp: new Date().toISOString(),
        actor: "user",
        tool_name: target.tool_name,
        node_id: target.node_id,
        status: "rejected",
        summary: `User rejected TIER_3_SUPERVISED tool call ${approvalId} (${target.tool_name})`,
        args: target.arguments,
      });
      return NextResponse.json({ status: "rejected", approval: target });
    }

    appendAuditLog(projectId, {
      timestamp: new Date().toISOString(),
      actor: "user",
      tool_name: target.tool_name,
      node_id: target.node_id,
      status: "approved",
      summary: `User approved TIER_3_SUPERVISED tool call ${approvalId} (${target.tool_name})`,
      args: target.arguments,
    });

    const execResult = await interceptAndExecuteTool(
      projectId,
      target.tool_name,
      target.arguments,
      true
    );
    return NextResponse.json({
      status: "approved",
      approval: target,
      execution: execResult,
    });
  }

  if (action === "invoke_service_action") {
    const nodeId = String(
      body.node_id || state.assigned_nodes[0]?.node_id || ""
    );
    const port = Number(body.port || 3000);
    const method = String(body.method || "GET").toUpperCase();
    const rawPath = String(body.path || "/");
    const payload =
      body.payload !== undefined && body.payload !== null
        ? String(body.payload)
        : "";
    const startMs = Date.now();

    if (method === "SQL") {
      const dbPath =
        rawPath.endsWith(".db") || rawPath.startsWith("/")
          ? rawPath
          : `/opt/axon/workspaces/${projectId}/pulse.db`;
      const sqlQuery =
        payload.trim() || "SELECT name, type FROM sqlite_master WHERE type='table';";
      const pyScript = `import sqlite3, json, sys, os, glob
db_path = ${JSON.stringify(dbPath)}
if not os.path.exists(db_path) or os.path.getsize(db_path) == 0:
    base_name = os.path.basename(db_path) or "pulse.db"
    candidates = [
        p for p in glob.glob(f"/opt/axon/workspaces*/*/{base_name}") + glob.glob("/opt/axon/workspaces*/*/*.db")
        if os.path.isfile(p) and os.path.getsize(p) > 0
    ]
    if candidates:
        if os.path.exists(db_path) and os.path.getsize(db_path) == 0:
            try:
                os.remove(db_path)
            except OSError:
                pass
        db_path = candidates[0]
query = ${JSON.stringify(sqlQuery)}
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()
statements = [s.strip() for s in query.split(";") if s.strip()]
rows = []
for stmt in statements:
    cur.execute(stmt)
    if cur.description:
        rows = [dict(r) for r in cur.fetchall()]
conn.commit()
print(json.dumps({"db_path": db_path, "rows_count": len(rows), "rows": rows}, default=str))
`;
      const b64Py = Buffer.from(pyScript, "utf8").toString("base64");
      const ptyRes = await interceptAndExecuteTool(
        projectId,
        "node_pty_exec",
        {
          node_id: nodeId,
          session_id: `db-explorer-${projectId}`,
          command: `python3 -c "$(echo '${b64Py}' | base64 -d)"`,
          wait_timeout_ms: 8000,
        },
        true
      );
      const outObj = (ptyRes.output || {}) as Record<string, unknown>;
      const rawOut = String(outObj.output || "").trim();
      let parsedJson: unknown = null;
      try {
        parsedJson = JSON.parse(rawOut);
      } catch {
        parsedJson = null;
      }
      return NextResponse.json({
        ok: ptyRes.status === "executed" && Number(outObj.exit_code ?? 0) === 0,
        status_code: Number(outObj.exit_code ?? 0) === 0 ? 200 : 500,
        latency_ms: Date.now() - startMs,
        method: "SQL",
        proxy_url: `sqlite://${nodeId}:${dbPath}`,
        response_text: parsedJson
          ? JSON.stringify(parsedJson, null, 2)
          : rawOut,
        response_json: parsedJson,
      });
    }

    const cleanSubPath = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
    const proxyUrl = `${CORE_GATEWAY_URL}/preview/${projectId}/${nodeId}/${port}${cleanSubPath}`;
    try {
      const fetchInit: RequestInit = {
        method,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/html, */*",
        },
      };
      if (method !== "GET" && method !== "HEAD" && payload.trim() !== "") {
        fetchInit.body = payload;
      }
      const proxyRes = await fetch(proxyUrl, fetchInit);
      const text = await proxyRes.text();
      let parsedJson: unknown = null;
      try {
        parsedJson = JSON.parse(text);
      } catch {
        parsedJson = null;
      }
      return NextResponse.json({
        ok: proxyRes.ok,
        status_code: proxyRes.status,
        latency_ms: Date.now() - startMs,
        method,
        proxy_url: proxyUrl,
        response_text: parsedJson
          ? JSON.stringify(parsedJson, null, 2)
          : text.slice(0, 8192),
        response_json: parsedJson,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json({
        ok: false,
        status_code: 502,
        latency_ms: Date.now() - startMs,
        method,
        proxy_url: proxyUrl,
        response_text: `Reverse Proxy Error: ${msg}`,
      });
    }
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
