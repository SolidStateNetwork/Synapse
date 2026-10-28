import { NextRequest, NextResponse } from "next/server";
import {
  executeFirewallAction,
  inspectNodeFirewall,
  type FirewallActionInput,
} from "@/lib/firewall";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const projectId =
      req.nextUrl.searchParams.get("project_id") || "synapse-cloud-demo";
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
    const body = await req.json();
    const projectId = String(
      body.project_id ||
        req.nextUrl.searchParams.get("project_id") ||
        "synapse-cloud-demo"
    );
    const input: FirewallActionInput = {
      action: body.action || "inspect",
      node_id: body.node_id,
      profile: body.profile,
      port: body.port !== undefined ? Number(body.port) : undefined,
      ip_or_cidr: body.ip_or_cidr,
      rule_action: body.rule_action,
      protocol: body.protocol,
      note: body.note,
      rule_id: body.rule_id,
      actor: "user",
    };
    const result = await executeFirewallAction(projectId, input);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
