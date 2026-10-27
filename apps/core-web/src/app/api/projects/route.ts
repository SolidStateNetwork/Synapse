import { NextRequest, NextResponse } from "next/server";
import {
  appendAuditLog,
  appendChatMessage,
  clearChatHistory,
  deleteSecret,
  ensureProjectVault,
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
  CORE_GATEWAY_URL,
  fetchGatewayNodes,
  interceptAndExecuteTool,
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
      if (Array.isArray(hb.services)) {
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
              const cooldownPassed = Date.now() - lastHealMs > 30_000;
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
  if (stateChanged) {
    saveProjectState(state);
  }

  // Trigger Proactive Auto-Watchdog self-healing for degraded services
  for (const target of watchdogTargets) {
    try {
      const healRes = await interceptAndExecuteTool(projectId, "node_pty_exec", {
        node_id: target.node_id,
        session_id: `default-${projectId}`,
        command: `tail -n 20 /tmp/synapse-svc-${target.port}.log 2>/dev/null || true; (nohup node service/server.js >/tmp/synapse-svc-${target.port}.log 2>&1 &); sleep 0.3; curl -s http://127.0.0.1:${target.port}/`,
        wait_timeout_ms: 8000,
      });

      writeBrainDoc(
        projectId,
        "Memory.md",
        `- **[${new Date().toISOString()}]** 🤖 **Proactive Auto-Watchdog:** Automatically restarted unhealthy service \`${target.name}\` (\`127.0.0.1:${target.port}\` on \`${target.node_id}\`).`,
        "append"
      );

      appendChatMessage(projectId, {
        role: "assistant",
        content: `🤖 **Proactive Auto-Watchdog Triggered:** Detected consecutive health probe failures on **${target.name}** (\`127.0.0.1:${target.port}\` on \`${target.node_id}\`). Automatically inspected logs, restarted the daemon, and logged the recovery in \`Memory.md\`.`,
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
    audit_logs: readAuditLogs(projectId, 60),
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
    const created = ensureProjectVault(
      String(body.new_project_id || `project-${Date.now()}`),
      String(body.name || ""),
      String(body.description || "")
    );
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
    const pb = {
      playbook_id: pbId,
      name: String(body.name || "Scheduled AI Playbook"),
      cron_expression: String(body.cron_expression || "0 3 * * *"),
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
    const res = await interceptAndExecuteTool(
      projectId,
      "core_link_peers",
      {
        action: "upsert",
        source_node_id: body.source_node_id,
        target_node_id: body.target_node_id,
        local_port: Number(body.local_port || body.remote_port || 5432),
        remote_port: Number(body.remote_port || 5432),
        protocol: body.protocol || "tcp",
        description: body.description,
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

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
