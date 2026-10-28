import { NextRequest, NextResponse } from "next/server";
import {
  appendAuditLog,
  ensureProjectVault,
  saveProjectState,
  setSecret,
} from "@/lib/vault";

const GATEWAY_URL = process.env.CORE_GATEWAY_URL || "http://127.0.0.1:8081";

export interface ServiceBlueprint {
  id: string;
  name: string;
  category: "backend" | "webui" | "database";
  port: number;
  description: string;
  secret_key?: string;
  deploy_cmd: string;
}

const SERVICE_BLUEPRINTS: ServiceBlueprint[] = [
  {
    id: "uptime-beacon-4060",
    name: "Uptime & Latency Beacon :4060",
    category: "backend",
    port: 4060,
    description:
      "Lightweight JSON health and latency telemetry beacon running on port 4060.",
    secret_key: "UPTIME_BEACON_TOKEN",
    deploy_cmd: `mkdir -p /var/lib/synapse/blueprints/beacon && cat << 'EOF' > /var/lib/synapse/blueprints/beacon/server.py
import http.server, json, time, socket
class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, format, *args): pass
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"status": "healthy", "service": "uptime-beacon-4060", "host": socket.gethostname(), "ts": int(time.time())}).encode())
if __name__ == "__main__":
    http.server.HTTPServer(("127.0.0.1", 4060), Handler).serve_forever()
EOF
if ! ss -tln | grep -q ':4060 '; then nohup python3 /var/lib/synapse/blueprints/beacon/server.py >/var/lib/synapse/blueprints/beacon/beacon.log 2>&1 & sleep 1; fi
echo "BLUEPRINT_DEPLOYED_4060"`,
  },
  {
    id: "webhook-sink-4065",
    name: "Webhook Event Sink :4065",
    category: "backend",
    port: 4065,
    description:
      "Captures and inspects incoming JSON webhooks in real time on port 4065.",
    secret_key: "WEBHOOK_SIGNING_SECRET",
    deploy_cmd: `mkdir -p /var/lib/synapse/blueprints/webhook && cat << 'EOF' > /var/lib/synapse/blueprints/webhook/server.py
import http.server, json, time
EVENTS = [{"id": 1, "event": "sink.ready", "ts": int(time.time())}]
class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, format, *args): pass
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"status": "ok", "service": "webhook-sink-4065", "events": EVENTS[-20:]}).encode())
    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length).decode("utf-8", errors="ignore") if length > 0 else "{}"
        EVENTS.append({"id": len(EVENTS)+1, "payload": raw, "ts": int(time.time())})
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"received": True, "total": len(EVENTS)}).encode())
if __name__ == "__main__":
    http.server.HTTPServer(("127.0.0.1", 4065), Handler).serve_forever()
EOF
if ! ss -tln | grep -q ':4065 '; then nohup python3 /var/lib/synapse/blueprints/webhook/server.py >/var/lib/synapse/blueprints/webhook/webhook.log 2>&1 & sleep 1; fi
echo "BLUEPRINT_DEPLOYED_4065"`,
  },
  {
    id: "kv-memory-store-6380",
    name: "In-Memory KV Cache :6380",
    category: "database",
    port: 6380,
    description:
      "Fast HTTP/JSON Key-Value in-memory cache store running on port 6380.",
    secret_key: "KV_CACHE_AUTH_KEY",
    deploy_cmd: `mkdir -p /var/lib/synapse/blueprints/kvstore && cat << 'EOF' > /var/lib/synapse/blueprints/kvstore/server.py
import http.server, json, time
STORE = {"synapse:boot": "ok", "cache:mode": "in-memory"}
class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, format, *args): pass
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"status": "healthy", "service": "kv-memory-store-6380", "keys": len(STORE), "data": STORE}).encode())
if __name__ == "__main__":
    http.server.HTTPServer(("127.0.0.1", 6380), Handler).serve_forever()
EOF
if ! ss -tln | grep -q ':6380 '; then nohup python3 /var/lib/synapse/blueprints/kvstore/server.py >/var/lib/synapse/blueprints/kvstore/kv.log 2>&1 & sleep 1; fi
echo "BLUEPRINT_DEPLOYED_6380"`,
  },
];

export async function GET() {
  return NextResponse.json({ blueprints: SERVICE_BLUEPRINTS });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const projectId = String(body.project_id || "synapse-cloud-demo");
    const nodeId = String(body.node_id || "vps2-muscle");
    const action = String(body.action || "deploy");
    const blueprintId = String(body.blueprint_id || "");

    const bp = SERVICE_BLUEPRINTS.find((b) => b.id === blueprintId);
    if (!bp) {
      return NextResponse.json(
        { ok: false, error: `Blueprint ${blueprintId} not found` },
        { status: 404 }
      );
    }

    if (action === "undeploy") {
      await fetch(`${GATEWAY_URL}/api/v1/rpc/pty`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          node_id: nodeId,
          cmd_id: `bp-stop-${Date.now()}`,
          project_id: projectId,
          session_id: "blueprint-ops",
          command: `fuser -k ${bp.port}/tcp 2>/dev/null || true && echo STOPPED_${bp.port}`,
          wait_timeout_ms: 4000,
        }),
      }).catch(() => {});

      const state = ensureProjectVault(projectId);
      state.registered_services = (state.registered_services || []).filter(
        (s) => s.service_id !== bp.id && s.port !== bp.port
      );
      saveProjectState(state);
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
    const ptyRes = await fetch(`${GATEWAY_URL}/api/v1/rpc/pty`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        node_id: nodeId,
        cmd_id: `bp-deploy-${Date.now()}`,
        project_id: projectId,
        session_id: "blueprint-ops",
        command: bp.deploy_cmd,
        wait_timeout_ms: 8000,
      }),
    });
    const ptyJson = await ptyRes.json();

    // 3. Register in Project State
    const state = ensureProjectVault(projectId);
    const existingIdx = (state.registered_services || []).findIndex(
      (s) => s.service_id === bp.id || s.port === bp.port
    );
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
      ],
      health_check: {
        type: "HTTP" as const,
        target: `http://127.0.0.1:${bp.port}/`,
        interval_sec: 15,
        status: "HEALTHY" as const,
        last_checked: new Date().toISOString(),
      },
    };
    if (existingIdx >= 0) {
      state.registered_services[existingIdx] = svcEntry;
    } else {
      state.registered_services = [
        ...(state.registered_services || []),
        svcEntry,
      ];
    }
    saveProjectState(state);

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
