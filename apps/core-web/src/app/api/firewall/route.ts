import { NextRequest, NextResponse } from "next/server";
import {
  executeFirewallAction,
  inspectNodeFirewall,
  type FirewallActionInput,
} from "@/lib/firewall";
import {
  resolveActiveProjectId,
  safeParseRequestJson,
} from "@/lib/runtimeResolver";

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
    const input: FirewallActionInput = {
      action: (body.action as FirewallActionInput["action"]) || "inspect",
      node_id: body.node_id ? String(body.node_id) : undefined,
      profile: body.profile as FirewallActionInput["profile"],
      port: body.port !== undefined ? Number(body.port) : undefined,
      ip_or_cidr: body.ip_or_cidr ? String(body.ip_or_cidr) : undefined,
      rule_action: body.rule_action as FirewallActionInput["rule_action"],
      protocol: body.protocol as FirewallActionInput["protocol"],
      note: body.note ? String(body.note) : undefined,
      rule_id: body.rule_id ? String(body.rule_id) : undefined,
      actor: "user",
    };
    const result = await executeFirewallAction(projectId, input);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
