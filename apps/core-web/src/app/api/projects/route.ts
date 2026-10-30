import { NextRequest, NextResponse } from "next/server";
import {
  appendAuditLog,
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
import { CORE_GATEWAY_URL, interceptAndExecuteTool } from "@/lib/orchestrator";
import { executeServiceAction } from "@/lib/projects/serviceActionRunner";
import { syncProjectTelemetryAndWatchdog } from "@/lib/projects/projectTelemetrySync";
import {
  resolveActiveProjectId,
  resolveTargetNodeId,
  safeParseRequestJson,
} from "@/lib/runtimeResolver";

export async function GET(req: NextRequest) {
  const projectId = resolveActiveProjectId(
    req.nextUrl.searchParams.get("project_id") ||
      req.nextUrl.searchParams.get("projectId")
  );
  const isLightPoll = req.nextUrl.searchParams.get("light") === "1";

  const { state, liveNodes } = await syncProjectTelemetryAndWatchdog(projectId);
  const projects = listProjects();

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
  const body = await safeParseRequestJson(req);
  const action = String(body.action || "");
  const projectId = resolveActiveProjectId(
    String(body.project_id || body.projectId || "")
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
    const tier = (body.tier as "TIER_1_UNLEASHED" | "TIER_2_WORKSPACE_JAIL" | "TIER_3_SUPERVISED") || "TIER_2_WORKSPACE_JAIL";
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
    const nodeId = resolveTargetNodeId(
      current,
      String(body.node_id || body.nodeId || "")
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
