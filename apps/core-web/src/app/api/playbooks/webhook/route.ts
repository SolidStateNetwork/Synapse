import { NextResponse } from "next/server";
import { interceptAndExecuteTool } from "@/lib/orchestrator";
import {
  verifyPlaybookWebhookSignature,
  type DagStepSpec,
} from "@/lib/vault/v250Enterprise";

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "/api/playbooks/webhook",
    auth: "HMAC-SHA256 via X-Synapse-Signature (+ optional X-Synapse-Timestamp)",
    supported_events: ["push", "workflow_run", "playbook_dag"],
  });
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(rawBody || "{}") as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON webhook payload" }, { status: 400 });
  }

  const projectId = String(parsed.project_id || "default-project");
  const sigHeader = req.headers.get("x-synapse-signature") || req.headers.get("x-hub-signature-256") || "";
  const tsHeader = req.headers.get("x-synapse-timestamp") || undefined;
  const customSecret = typeof parsed.webhook_secret === "string" ? parsed.webhook_secret : undefined;

  const check = verifyPlaybookWebhookSignature(projectId, rawBody, sigHeader, tsHeader, customSecret);
  if (!check.valid) {
    return NextResponse.json(
      { ok: false, error: check.reason || "Webhook signature verification failed" },
      { status: 401 }
    );
  }

  const steps: DagStepSpec[] = Array.isArray(parsed.steps)
    ? (parsed.steps as DagStepSpec[])
    : [
        {
          id: "webhook-step-1",
          command: String(parsed.command || "mock_ok git pull && docker compose up -d"),
        },
      ];

  const dispatchRes = await interceptAndExecuteTool(
    projectId,
    "core_manage_playbooks",
    {
      action: "run_dag",
      name: String(parsed.playbook_name || parsed.repository || "GitOps Webhook Playbook"),
      target_node_id: typeof parsed.node_id === "string" ? parsed.node_id : undefined,
      steps,
    },
    true
  );

  return NextResponse.json({
    ok: dispatchRes.status === "executed",
    project_id: projectId,
    result: dispatchRes.output,
  });
}
