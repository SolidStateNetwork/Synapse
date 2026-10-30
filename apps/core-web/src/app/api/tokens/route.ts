import { NextRequest, NextResponse } from "next/server";
import { CORE_GATEWAY_URL } from "@/lib/orchestrator";
import { safeParseRequestJson } from "@/lib/runtimeResolver";
import { safeFetchJson } from "@/lib/safeFetch";

export async function POST(req: NextRequest) {
  const body = await safeParseRequestJson(req);
  const res = await safeFetchJson(`${CORE_GATEWAY_URL}/api/v1/tokens`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    timeoutMs: 4000,
  });
  if (res.ok) {
    const data = await res.json();
    return NextResponse.json(data, { status: res.status || 200 });
  }
  const fallbackToken = `syn_join_${Date.now().toString(36)}`;
  return NextResponse.json(
    {
      token: fallbackToken,
      tier: String(body.tier || "TIER_2_WORKSPACE_JAIL"),
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      fallback: true,
      error: res.error || "Core Gateway offline (generated preview token)",
    },
    { status: res.status >= 400 ? res.status : 200 }
  );
}
