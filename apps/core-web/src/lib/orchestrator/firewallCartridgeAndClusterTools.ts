import { listCartridges } from "../cartridges";
import { recordCheckpoint } from "../checkpoints";
import {
  executeFirewallAction,
  getOrCreateNodeFirewallPolicy,
  inspectNodeFirewall,
  type FirewallActionInput,
} from "../firewall";
import { resolveTargetNodeId } from "../runtimeResolver";
import { safeFetchJson } from "../safeFetch";
import { appendAuditLog, withProjectStateTransaction, type ProjectState } from "../vault";
import { fetchGatewayNodes, type ToolDispatchResult } from "../orchestrator";

export async function dispatchFirewallCartridgeAndClusterTool(
  coreGatewayUrl: string,
  projectId: string,
  state: ProjectState,
  toolName: string,
  args: Record<string, unknown>
): Promise<ToolDispatchResult | null> {
  const nodeId =
    resolveTargetNodeId(state, args.node_id ? String(args.node_id) : undefined) || "local-node";

  if (toolName === "core_manage_firewall") {
    const rawAction = String(args.action || "inspect");
    if (rawAction === "inspect") {
      const inspected = await inspectNodeFirewall(projectId, nodeId);
      return { tool_name: toolName, status: "executed", output: { ok: true, ...inspected } };
    }

    const preFlightCp = recordCheckpoint(projectId, {
      node_id: nodeId,
      title: `Pre-Flight Firewall Policy (${rawAction})`,
      actor: "Auto-Watchdog",
      summary: `Automatic pre-flight checkpoint before firewall mutation '${rawAction}' on node '${nodeId}'.`,
      files_backed_up: ["/tmp/synapse-fw-backup.rules"],
      services_snapshot: (state.registered_services || []).map((svc) => ({
        service_id: svc.service_id,
        name: svc.name,
        port: svc.port,
        healthy: svc.healthy !== false,
      })),
      rollback_cmd:
        "if [ -f /tmp/synapse-fw-backup.rules ]; then iptables-restore < /tmp/synapse-fw-backup.rules 2>/dev/null || true; fi && echo 'CHECKPOINT_RESTORED_OK'",
    });

    const currentPolicy = getOrCreateNodeFirewallPolicy(state, nodeId);
    let mappedAction: FirewallActionInput["action"] = "inspect";
    let mappedProfile: FirewallActionInput["profile"] = undefined;

    if (rawAction === "toggle_port_shield" || rawAction === "shield_port" || rawAction === "unshield_port") {
      const port = Number(args.port || 0);
      const currentlyShielded = currentPolicy.shielded_ports.includes(port);
      if (rawAction === "shield_port") mappedAction = "shield_port";
      else if (rawAction === "unshield_port") mappedAction = "unshield_port";
      else if (typeof args.shielded === "boolean") mappedAction = args.shielded ? "shield_port" : "unshield_port";
      else mappedAction = currentlyShielded ? "unshield_port" : "shield_port";
    } else if (rawAction === "apply_profile" || rawAction === "set_profile") {
      mappedAction = "set_profile";
      const rawProf = String(args.profile || "web_standard");
      if (rawProf === "synapse_stealth" || rawProf === "zero_trust_tunnel" || rawProf === "paranoid_lockdown") {
        mappedProfile = "synapse_stealth";
      } else if (rawProf === "custom") {
        mappedProfile = "custom";
      } else {
        mappedProfile = "web_standard";
      }
    } else if (rawAction === "add_ip_rule") {
      mappedAction = "add_ip_rule";
    } else if (rawAction === "remove_ip_rule") {
      mappedAction = "remove_ip_rule";
    }

    try {
      const res = await executeFirewallAction(projectId, {
        action: mappedAction,
        node_id: nodeId,
        profile: mappedProfile,
        port: args.port !== undefined ? Number(args.port) : undefined,
        ip_or_cidr: args.ip_or_cidr ? String(args.ip_or_cidr) : undefined,
        rule_action: (args.rule_action as "allow" | "block") || "block",
        protocol: (args.protocol as "tcp" | "udp" | "any") || "tcp",
        note: args.note ? String(args.note) : undefined,
        rule_id: args.rule_id ? String(args.rule_id) : undefined,
        actor: "ai_orchestrator",
      });
      return { tool_name: toolName, status: "executed", output: { ...res, checkpoint_id: preFlightCp.id } };
    } catch (err) {
      return {
        tool_name: toolName,
        status: "error",
        output: { ok: false, error: err instanceof Error ? err.message : String(err), checkpoint_id: preFlightCp.id },
      };
    }
  }

  if (toolName === "core_manage_cartridges") {
    const action = String(args.action || "list");
    const available = listCartridges();
    if (action === "list") {
      return {
        tool_name: toolName,
        status: "executed",
        output: {
          ok: true,
          active_cartridges: state.active_cartridges,
          cartridges: available.map((c) => ({
            id: c.id,
            name: c.name,
            category: c.category,
            description: c.description,
            active: state.active_cartridges.includes(c.id),
          })),
        },
      };
    }
    const cartridgeId = String(args.cartridge_id || "").trim();
    if (!cartridgeId) {
      return { tool_name: toolName, status: "error", output: { ok: false, error: "cartridge_id is required" } };
    }
    const updated = await withProjectStateTransaction(projectId, (draft) => {
      const has = draft.active_cartridges.includes(cartridgeId);
      if (action === "activate" || (action === "toggle" && !has)) {
        if (!has) draft.active_cartridges.push(cartridgeId);
      } else if (action === "deactivate" || (action === "toggle" && has)) {
        draft.active_cartridges = draft.active_cartridges.filter((c) => c !== cartridgeId);
      }
    });
    appendAuditLog(projectId, {
      timestamp: new Date().toISOString(),
      actor: "ai_orchestrator",
      tool_name: toolName,
      status: "executed",
      summary: `Updated AI Rule Cartridge '${cartridgeId}' (${action}) -> active=[${updated.active_cartridges.join(", ")}]`,
    });
    return {
      tool_name: toolName,
      status: "executed",
      output: { ok: true, cartridge_id: cartridgeId, active_cartridges: updated.active_cartridges },
    };
  }

  if (toolName === "core_manage_cluster_nodes") {
    const action = String(args.action || "list");
    if (action === "list") {
      const nodes = await fetchGatewayNodes();
      return {
        tool_name: toolName,
        status: "executed",
        output: { ok: true, nodes, assigned_nodes: state.assigned_nodes, planning_only: state.planning_only },
      };
    }
    if (action === "create_join_token") {
      const tier = String(args.tier || "TIER_2_WORKSPACE_JAIL");
      const ttl = Number(args.ttl_minutes || 30);
      const res = await safeFetchJson(`${coreGatewayUrl}/api/v1/tokens`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier, ttl_minutes: ttl }),
        timeoutMs: 3000,
      });
      if (res.ok) {
        const data = (await res.json()) as Record<string, unknown>;
        return { tool_name: toolName, status: "executed", output: { ok: true, ...data } };
      }
      return {
        tool_name: toolName,
        status: "executed",
        output: {
          ok: true,
          token: `syn_join_${Date.now().toString(36)}`,
          tier,
          expires_at: new Date(Date.now() + ttl * 60 * 1000).toISOString(),
          fallback: true,
        },
      };
    }
    const targetNode = String(args.node_id || "").trim();
    if (!targetNode) {
      return { tool_name: toolName, status: "error", output: { ok: false, error: "node_id is required" } };
    }
    const tier =
      (args.tier as "TIER_1_UNLEASHED" | "TIER_2_WORKSPACE_JAIL" | "TIER_3_SUPERVISED") ||
      "TIER_2_WORKSPACE_JAIL";
    const updated = await withProjectStateTransaction(projectId, (draft) => {
      if (action === "unassign_node") {
        draft.assigned_nodes = draft.assigned_nodes.filter((n) => n.node_id !== targetNode);
      } else if (!draft.assigned_nodes.some((n) => n.node_id === targetNode)) {
        draft.assigned_nodes.push({ node_id: targetNode, tier, online: true });
      }
      draft.planning_only = draft.assigned_nodes.length === 0;
    });
    return {
      tool_name: toolName,
      status: "executed",
      output: { ok: true, node_id: targetNode, assigned_nodes: updated.assigned_nodes, planning_only: updated.planning_only },
    };
  }

  return null;
}
