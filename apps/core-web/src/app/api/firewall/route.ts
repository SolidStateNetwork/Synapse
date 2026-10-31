import { NextRequest, NextResponse } from "next/server";
import { recordCheckpoint } from "@/lib/checkpoints";
import {
  executeFirewallAction,
  getOrCreateNodeFirewallPolicy,
  inspectNodeFirewall,
  type FirewallActionInput,
} from "@/lib/firewall";
import {
  resolveActiveProjectId,
  resolveTargetNodeId,
  safeParseRequestJson,
} from "@/lib/runtimeResolver";
import { ensureProjectVault } from "@/lib/vault";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const projectId = resolveActiveProjectId(
      req.nextUrl.searchParams.get("project_id")
    );
    const nodeId = req.nextUrl.searchParams.get("node_id") || undefined;
    const data = await inspectNodeFirewall(projectId, nodeId);
    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await safeParseRequestJson(req);
    const projectId = resolveActiveProjectId(
      String(
        body.project_id ||
          body.projectId ||
          req.nextUrl.searchParams.get("project_id") ||
          ""
      )
    );
    const rawAction = String(body.action || "inspect");
    const state = ensureProjectVault(projectId);
    const nodeId =
      resolveTargetNodeId(state, body.node_id ? String(body.node_id) : undefined) ||
      "local-node";

    let mappedAction: FirewallActionInput["action"] = "inspect";
    let mappedProfile: FirewallActionInput["profile"] =
      body.profile as FirewallActionInput["profile"];

    if (
      rawAction === "toggle_port_shield" ||
      rawAction === "shield_port" ||
      rawAction === "unshield_port"
    ) {
      const port = Number(body.port || 0);
      const policy = getOrCreateNodeFirewallPolicy(state, nodeId);
      if (rawAction === "shield_port") mappedAction = "shield_port";
      else if (rawAction === "unshield_port") mappedAction = "unshield_port";
      else if (typeof body.shielded === "boolean") {
        mappedAction = body.shielded ? "shield_port" : "unshield_port";
      } else {
        mappedAction = policy.shielded_ports.includes(port)
          ? "unshield_port"
          : "shield_port";
      }
    } else if (rawAction === "apply_profile" || rawAction === "set_profile") {
      mappedAction = "set_profile";
      const rawProf = String(body.profile || "web_standard");
      if (
        rawProf === "synapse_stealth" ||
        rawProf === "zero_trust_tunnel" ||
        rawProf === "paranoid_lockdown"
      ) {
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

    let checkpointId: string | undefined;
    if (mappedAction !== "inspect") {
      const cp = recordCheckpoint(projectId, {
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
      checkpointId = cp.id;
    }

    const input: FirewallActionInput = {
      action: mappedAction,
      node_id: body.node_id ? String(body.node_id) : undefined,
      profile: mappedProfile,
      port: body.port !== undefined ? Number(body.port) : undefined,
      ip_or_cidr: body.ip_or_cidr ? String(body.ip_or_cidr) : undefined,
      rule_action: body.rule_action as FirewallActionInput["rule_action"],
      protocol: body.protocol as FirewallActionInput["protocol"],
      note: body.note ? String(body.note) : undefined,
      rule_id: body.rule_id ? String(body.rule_id) : undefined,
      actor: "user",
    };
    const result = await executeFirewallAction(projectId, input);
    return NextResponse.json(
      checkpointId ? { ...result, checkpoint_id: checkpointId } : result
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
