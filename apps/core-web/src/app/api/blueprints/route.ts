import { NextRequest, NextResponse } from "next/server";
import { gatewayExecPty, normalizeApiParams } from "@/lib/gatewayClient";
import {
  SERVICE_BLUEPRINTS,
  type ServiceBlueprint,
} from "@/lib/templates/serviceTemplates";
import {
  appendAuditLog,
  setSecret,
  withProjectStateTransaction,
} from "@/lib/vault";

export type { ServiceBlueprint };

export async function GET() {
  return NextResponse.json({ blueprints: SERVICE_BLUEPRINTS, templates: SERVICE_BLUEPRINTS });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const { projectId, nodeId: rawNodeId, action: rawAction } =
      normalizeApiParams(body);
    const nodeId = rawNodeId || "vps2-muscle";
    const action = rawAction || "deploy";
    const blueprintId = String(
      body.blueprint_id || body.blueprintId || ""
    ).trim();

    const bp = SERVICE_BLUEPRINTS.find((b) => b.id === blueprintId || (blueprintId && b.id.startsWith(blueprintId)));
    if (!bp) {
      return NextResponse.json(
        { ok: false, error: `Blueprint ${blueprintId} not found` },
        { status: 404 }
      );
    }

    if (action === "undeploy") {
      await gatewayExecPty({
        node_id: nodeId,
        cmd_id: `bp-stop-${Date.now()}`,
        project_id: projectId,
        session_id: "blueprint-ops",
        command: `fuser -k ${bp.port}/tcp 2>/dev/null || true && echo STOPPED_${bp.port}`,
        wait_timeout_ms: 4000,
      });

      await withProjectStateTransaction(projectId, (state) => {
        state.registered_services = (state.registered_services || []).filter(
          (s) => s.service_id !== bp.id && s.port !== bp.port
        );
      });
      return NextResponse.json({ ok: true, undeployed: bp.id });
    }

    // 1. Generate and store secret in Secrets.enc if specified
    if (bp.secret_key) {
      setSecret(
        projectId,
        bp.secret_key,
        `syn_bp_${Math.random().toString(36).slice(2, 14)}`
      );
    }

    // 2. Deploy on Muscle via mTLS+Yamux PTY
    const ptyJson = await gatewayExecPty({
      node_id: nodeId,
      cmd_id: `bp-deploy-${Date.now()}`,
      project_id: projectId,
      session_id: "blueprint-ops",
      command: bp.deploy_cmd,
      wait_timeout_ms: 8000,
    });

    // 3. Register in Project State atomically
    const svcEntry = {
      service_id: bp.id,
      name: bp.name,
      node_id: nodeId,
      category: bp.category,
      description: bp.description,
      port: bp.port,
      protocol: "http" as const,
      path: "/",
      healthy: true,
      registered_at: new Date().toISOString(),
      endpoints: [
        {
          id: "get-root",
          label: "GET / (Status & JSON)",
          method: "GET" as const,
          path: "/",
        },
        {
          id: "post-root",
          label: "POST / (Send JSON Input)",
          method: "POST" as const,
          path: "/",
          sample_payload: JSON.stringify(
            { action: "ping", message: "Hello from Synapse Core UI" },
            null,
            2
          ),
        },
      ],
      health_check: {
        type: "HTTP" as const,
        target: `http://127.0.0.1:${bp.port}/`,
        interval_sec: 15,
        status: "HEALTHY" as const,
        last_checked: new Date().toISOString(),
      },
    };

    await withProjectStateTransaction(projectId, (state) => {
      const existingIdx = (state.registered_services || []).findIndex(
        (s) => s.service_id === bp.id || s.port === bp.port
      );
      if (existingIdx >= 0) {
        state.registered_services[existingIdx] = svcEntry;
      } else {
        state.registered_services = [
          ...(state.registered_services || []),
          svcEntry,
        ];
      }
    });

    appendAuditLog(projectId, {
      timestamp: new Date().toISOString(),
      actor: "user",
      tool_name: "blueprint_deploy",
      node_id: nodeId,
      status: "executed",
      summary: `Deployed blueprint "${bp.name}" (:${bp.port}) on ${nodeId}`,
    });

    return NextResponse.json({
      ok: true,
      blueprint: bp,
      output: String(ptyJson.output || "").trim(),
      service: svcEntry,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Blueprint API error",
      },
      { status: 500 }
    );
  }
}
