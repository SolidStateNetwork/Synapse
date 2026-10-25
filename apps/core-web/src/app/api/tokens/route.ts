import { NextRequest, NextResponse } from "next/server";
import { CORE_GATEWAY_URL } from "@/lib/orchestrator";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const res = await fetch(`${CORE_GATEWAY_URL}/api/v1/tokens`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Gateway token request failed: ${msg}` },
      { status: 502 }
    );
  }
}
