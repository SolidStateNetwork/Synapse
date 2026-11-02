import { NextResponse } from "next/server";
import {
  buildCoreMetricsSummary,
  buildCorePrometheusMetrics,
} from "@/lib/vault/v250Enterprise";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const expectedToken = (process.env.SYNAPSE_METRICS_TOKEN || "").trim();
  if (expectedToken) {
    const authHdr = (req.headers.get("authorization") || "").trim();
    const queryTok = (url.searchParams.get("token") || "").trim();
    if (authHdr !== `Bearer ${expectedToken}` && queryTok !== expectedToken) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized metrics scrape: missing or invalid Bearer token" },
        { status: 401 }
      );
    }
  }

  const projectId = url.searchParams.get("project_id") || "default-project";
  const format = url.searchParams.get("format") || "";
  const accept = req.headers.get("accept") || "";

  if (format === "json" || accept.includes("application/json")) {
    return NextResponse.json({
      ok: true,
      ...buildCoreMetricsSummary(projectId),
    });
  }

  const text = buildCorePrometheusMetrics(projectId);
  return new Response(text, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
