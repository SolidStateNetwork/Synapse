import { NextRequest, NextResponse } from "next/server";
import {
  appendAuditLog,
  deleteSecret,
  ensureProjectVault,
  listProjects,
  listSecretKeys,
  readAuditLogs,
  readBrainDoc,
  saveProjectState,
  setSecret,
  writeBrainDoc,
} from "@/lib/vault";
import { listCartridges } from "@/lib/cartridges";
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

  // Merge live gateway node status & telemetry into project state view
  for (const assigned of state.assigned_nodes) {
    const match = liveNodes.find((n) => n.node_id === assigned.node_id);
    assigned.online = Boolean(match?.online);
    if (match?.last_heartbeat) {
      state.telemetry[assigned.node_id] = match.last_heartbeat;
      assigned.hostname = match.last_heartbeat.hostname;
      assigned.os_arch = match.last_heartbeat.os_arch;
      assigned.last_seen_unix = match.last_heartbeat.timestamp_unix;
    }
  }

  return NextResponse.json({
    projects,
    active_project: state,
    architecture_md: readBrainDoc(projectId, "Architecture.md"),
    memory_md: readBrainDoc(projectId, "Memory.md"),
    secret_keys: listSecretKeys(projectId),
    audit_logs: readAuditLogs(projectId, 60),
    cartridges: listCartridges(),
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
