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
  setSecret,
  withProjectStateTransaction,
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
} from "@/lib/orchestrator";
import { executeServiceAction } from "@/lib/projects/serviceActionRunner";

export async function GET(req: NextRequest) {
  const projectId =
    req.nextUrl.searchParams.get("project_id") ||
    req.nextUrl.searchParams.get("projectId") ||
    "synapse-cloud-demo";
  const isLightPoll = req.nextUrl.searchParams.get("light") === "1";
  const projects = listProjects();
  const liveNodes = await fetchGatewayNodes();

  const watchdogTargets: Array<{
    service_id: string;
    name: string;
    node_id: string;
    port: number;
  }> = [];

  const state = await withProjectStateTransaction(projectId, (draft) => {
    // Auto-enroll any live connected Muscle node into assigned_nodes so it always displays automatically
    for (const live of liveNodes) {
      if (!live.node_id) continue;
      const existsInProject = draft.assigned_nodes.some(
        (a) => a.node_id === live.node_id
      );
      if (!existsInProject) {
        draft.assigned_nodes.push({
          node_id: live.node_id,
          tier: live.tier || "TIER_2_WORKSPACE_JAIL",
          online: Boolean(live.online),
          status: live.online ? "ONLINE" : "OFFLINE",
        });
        draft.planning_only = false;
      }
    }

    for (const assigned of draft.assigned_nodes) {
      const match = liveNodes.find((n) => n.node_id === assigned.node_id);
      assigned.online = Boolean(match?.online);
      assigned.status = assigned.online ? "ONLINE" : "OFFLINE";
      if (match?.last_heartbeat) {
        const hb = match.last_heartbeat;
        draft.telemetry[assigned.node_id] = hb;
        assigned.hostname = hb.hostname;
        assigned.os_arch = hb.os_arch;
        assigned.os_info = hb.os_info || hb.os_arch;
        assigned.last_seen_unix = hb.timestamp_unix;
        if (typeof hb.active_cores === "number" && hb.active_cores > 0) {
          assigned.active_cores = hb.active_cores;
        }
        if (Array.isArray(hb.connected_cores)) {
          assigned.connected_cores = hb.connected_cores;
        }
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

        if (Array.isArray(hb.services)) {
          draft.registered_services = draft.registered_services.filter((s, i, arr) => {
            if (!s.service_id.startsWith("auto-svc-")) return true;
            return !arr.some(
              (other, oi) =>
                oi !== i &&
                other.node_id === s.node_id &&
                other.port === s.port &&
                !other.service_id.startsWith("auto-svc-")
            );
          });
          for (const liveSvc of hb.services) {
            if (!liveSvc.service_id || !liveSvc.port) continue;
            const exists = draft.registered_services.some(
              (s) =>
                s.node_id === assigned.node_id &&
                (s.service_id === liveSvc.service_id || s.port === liveSvc.port)
            );
            if (!exists) {
              draft.registered_services.push({
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
            }
          }

          for (const svc of draft.registered_services) {
            if (svc.node_id !== assigned.node_id) continue;
            const liveSvc = hb.services.find(
              (ls) =>
                ls.service_id === svc.service_id || ls.port === svc.port
            );
            if (liveSvc) {
              svc.healthy = liveSvc.healthy;
              if (liveSvc.healthy) {
                svc.consecutive_failures = 0;
              } else {
                svc.consecutive_failures = (svc.consecutive_failures || 0) + 1;
                const lastHealMs = svc.last_auto_heal_at
                  ? new Date(svc.last_auto_heal_at).getTime()
                  : 0;
                const cooldownPassed = Date.now() - lastHealMs > 10_000;
                if (
                  svc.auto_heal !== false &&
                  draft.ai_settings?.enable_auto_watchdog !== false &&
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

    for (const svc of draft.registered_services) {
      if (!svc.category) {
        if (
          /db|sqlite|postgres|mysql|redis|mongo|sql/i.test(
            `${svc.service_id} ${svc.name}`
          )
        ) {
          svc.category = "database";
        } else if (
          /web|ui|frontend|dashboard|portal|app/i.test(
            `${svc.service_id} ${svc.name}`
          )
        ) {
          svc.category = "webui";
        } else {
          svc.category = "backend";
        }
      }
      if (!svc.description) {
        svc.description =
          svc.category === "webui"
            ? `Interactive WebUI reachable from outside via Synapse Reverse Proxy (127.0.0.1:${svc.port})`
            : svc.category === "database"
            ? `Interactive Database & Storage Engine on ${svc.node_id} (127.0.0.1:${svc.port})`
            : `Reachable Backend REST API via Synapse Reverse Proxy (127.0.0.1:${svc.port})`;
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
      }
    }
  });

  if (watchdogTargets.length > 0) {
    void (async () => {
      for (const target of watchdogTargets) {
        try {
          const healRes = await interceptAndExecuteTool(
            projectId,
            "node_pty_exec",
            {
              node_id: target.node_id,
              session_id: `watchdog-${projectId}`,
              command: `cd /opt/axon/workspaces/${projectId} 2>/dev/null || true; if [ -f docker-compose.yml ] || [ -f compose.yml ]; then docker compose up -d 2>/dev/null || true; fi; for c in $(docker ps -aq --filter status=exited 2>/dev/null); do docker start "$c" >/dev/null 2>&1 || true; done; if [ -f "service/server_${target.port}.py" ] && ! ss -tln 2>/dev/null | grep -q ":${target.port} "; then (nohup python3 "service/server_${target.port}.py" >/tmp/synapse-svc-${target.port}.log 2>&1 </dev/null &); elif [ -f service/server.py ] && ! ss -tln 2>/dev/null | grep -q ":${target.port} "; then (nohup python3 service/server.py >/tmp/synapse-svc-${target.port}.log 2>&1 </dev/null &); elif [ -f service/server.js ] && ! ss -tln 2>/dev/null | grep -q ":${target.port} "; then (nohup node service/server.js >/tmp/synapse-svc-${target.port}.log 2>&1 </dev/null &); fi; sleep 0.8; curl -fsS http://127.0.0.1:${target.port}/`,
              wait_timeout_ms: 15000,
            },
            true
          );

          if (healRes.status === "executed") {
            await withProjectStateTransaction(projectId, (freshState) => {
              const healedSvc = freshState.registered_services.find(
                (s) =>
                  s.service_id === target.service_id || s.port === target.port
              );
              if (healedSvc) {
                healedSvc.healthy = true;
                healedSvc.consecutive_failures = 0;
                if (healedSvc.health_check) {
                  healedSvc.health_check.status = "HEALTHY";
                  healedSvc.health_check.last_error = undefined;
                }
              }
            });
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
    })();
  }

  return NextResponse.json({
    projects,
    active_project: state,
    architecture_md: readBrainDoc(projectId, "Architecture.md"),
    memory_md: readBrainDoc(projectId, "Memory.md"),
    secret_keys: listSecretKeys(projectId),
    audit_logs: readAuditLogs(projectId, 200),
    chat_history: isLightPoll ? undefined : readChatHistory(projectId, 100),
    cartridges: listCartridges(),
    blueprints: OFFICIAL_STACK_BLUEPRINTS,
    gateway_nodes: liveNodes,
    gateway_url: CORE_GATEWAY_URL,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const action = String(body.action || "");
  const projectId = String(
    body.project_id || body.projectId || "synapse-cloud-demo"
  );

  if (action === "create_project") {
    const newId = String(body.new_project_id || `project-${Date.now()}`);
    ensureProjectVault(
      newId,
      String(body.name || ""),
      String(body.description || "")
    );

    const templateState = ensureProjectVault(projectId);
    const created = await withProjectStateTransaction(newId, (draft) => {
      if (templateState.ai_settings) {
        draft.ai_settings = { ...templateState.ai_settings };
      }
    });

    if (templateState.ai_settings) {
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

  ensureProjectVault(projectId);

  if (action === "assign_node") {
    const nodeId = String(body.node_id || "").trim();
    const tier = body.tier || "TIER_2_WORKSPACE_JAIL";
    if (!nodeId) {
      return NextResponse.json(
        { error: "node_id is required" },
        { status: 400 }
      );
    }
    const saved = await withProjectStateTransaction(projectId, (draft) => {
      const existingIdx = draft.assigned_nodes.findIndex(
        (n) => n.node_id === nodeId
      );
      if (existingIdx >= 0) {
        draft.assigned_nodes[existingIdx].tier = tier;
      } else {
        draft.assigned_nodes.push({
          node_id: nodeId,
          tier,
          online: true,
        });
      }
    });
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
    const saved = await withProjectStateTransaction(projectId, (draft) => {
      draft.assigned_nodes = draft.assigned_nodes.filter(
        (n) => n.node_id !== nodeId
      );
    });
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
    const saved = await withProjectStateTransaction(projectId, (draft) => {
      if (draft.active_cartridges.includes(cartridgeId)) {
        draft.active_cartridges = draft.active_cartridges.filter(
          (id) => id !== cartridgeId
        );
      } else {
        draft.active_cartridges.push(cartridgeId);
      }
    });
    return NextResponse.json({ project: saved });
  }

  if (action === "create_custom_cartridge") {
    const created = saveCustomCartridge({
      name: String(body.name || "Custom DevOps Rule"),
      description: String(
        body.description || "User-defined Synapse Rule Cartridge"
      ),
      category: String(body.category || "custom"),
      content: String(body.content || ""),
    });
    const saved = await withProjectStateTransaction(projectId, (draft) => {
      if (!draft.active_cartridges.includes(created.id)) {
        draft.active_cartridges.push(created.id);
      }
    });
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
    const saved = await withProjectStateTransaction(projectId, (draft) => {
      draft.active_cartridges = draft.active_cartridges.filter(
        (id) => id !== cartridgeId
      );
    });
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
      prompt: String(
        body.prompt || "Inspect server health and update Memory.md"
      ),
      target_node_id: body.target_node_id
        ? String(body.target_node_id)
        : undefined,
      enabled: body.enabled !== undefined ? Boolean(body.enabled) : true,
      last_status: "Scheduled",
    };
    const saved = await withProjectStateTransaction(projectId, (draft) => {
      draft.scheduled_playbooks = [
        ...(draft.scheduled_playbooks || []).filter(
          (x) => x.playbook_id !== pbId
        ),
        pb,
      ];
    });
    return NextResponse.json({ project: saved });
  }

  if (action === "delete_playbook") {
    const pbId = String(body.playbook_id || "");
    const saved = await withProjectStateTransaction(projectId, (draft) => {
      draft.scheduled_playbooks = (draft.scheduled_playbooks || []).filter(
        (x) => x.playbook_id !== pbId
      );
    });
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
    const saved = await withProjectStateTransaction(projectId, (draft) => {
      draft.peer_mesh_links = (draft.peer_mesh_links || []).filter(
        (l) => l.link_id !== linkId
      );
    });
    return NextResponse.json({ project: saved });
  }

  if (action === "toggle_service_auto_heal") {
    const serviceId = String(body.service_id || "");
    const saved = await withProjectStateTransaction(projectId, (draft) => {
      for (const svc of draft.registered_services) {
        if (svc.service_id === serviceId) {
          svc.auto_heal = svc.auto_heal === false ? true : false;
        }
      }
    });
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

    if (body.api_key && String(body.api_key).trim() !== "") {
      setSecret(projectId, secretName, String(body.api_key).trim());
    }

    const saved = await withProjectStateTransaction(projectId, (draft) => {
      draft.ai_settings = {
        provider,
        base_url: baseUrl,
        model,
        api_key_secret_name: secretName,
        enable_prompt_caching:
          body.enable_prompt_caching !== undefined
            ? Boolean(body.enable_prompt_caching)
            : draft.ai_settings?.enable_prompt_caching ?? true,
        enable_auto_watchdog:
          body.enable_auto_watchdog !== undefined
            ? Boolean(body.enable_auto_watchdog)
            : draft.ai_settings?.enable_auto_watchdog ?? true,
      };
    });

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
    let matchedApproval:
      | {
          approval_id: string;
          tool_name: string;
          node_id: string;
          arguments: Record<string, unknown>;
          status: string;
        }
      | undefined;

    await withProjectStateTransaction(projectId, (draft) => {
      const target = draft.pending_approvals.find(
        (a) => a.approval_id === approvalId
      );
      if (target) {
        target.status = decision;
        matchedApproval = { ...target };
      }
    });

    if (!matchedApproval) {
      return NextResponse.json(
        { error: "Approval request not found" },
        { status: 404 }
      );
    }

    if (decision === "rejected") {
      appendAuditLog(projectId, {
        timestamp: new Date().toISOString(),
        actor: "user",
        tool_name: matchedApproval.tool_name,
        node_id: matchedApproval.node_id,
        status: "rejected",
        summary: `User rejected TIER_3_SUPERVISED tool call ${approvalId} (${matchedApproval.tool_name})`,
        args: matchedApproval.arguments,
      });
      return NextResponse.json({
        status: "rejected",
        approval: matchedApproval,
      });
    }

    appendAuditLog(projectId, {
      timestamp: new Date().toISOString(),
      actor: "user",
      tool_name: matchedApproval.tool_name,
      node_id: matchedApproval.node_id,
      status: "approved",
      summary: `User approved TIER_3_SUPERVISED tool call ${approvalId} (${matchedApproval.tool_name})`,
      args: matchedApproval.arguments,
    });

    const execResult = await interceptAndExecuteTool(
      projectId,
      matchedApproval.tool_name,
      matchedApproval.arguments,
      true
    );
    return NextResponse.json({
      status: "approved",
      approval: matchedApproval,
      execution: execResult,
    });
  }

  if (action === "invoke_service_action") {
    const current = ensureProjectVault(projectId);
    const nodeId = String(
      body.node_id || current.assigned_nodes[0]?.node_id || ""
    );
    const port = Number(body.port || 3000);
    const method = String(body.method || "GET");
    const rawPath = String(body.path || "/");
    const payload =
      body.payload !== undefined && body.payload !== null
        ? String(body.payload)
        : "";
    const out = await executeServiceAction({
      projectId,
      nodeId,
      port,
      method,
      rawPath,
      payload,
    });
    return NextResponse.json(out);
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
