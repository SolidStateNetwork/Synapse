export interface ServiceBlueprint {
  id: string;
  name: string;
  category: "backend" | "webui" | "database";
  port: number;
  description: string;
  secret_key?: string;
  deploy_cmd: string;
}

/**
 * Generates a complete, standard-library Python HTTP microservice source file
 * with full GET, POST, PUT, and DELETE handlers (preventing HTTP 501 errors).
 */
export function buildAutonomousMicroservicePy(params: {
  projectId: string;
  nodeId: string;
  port: number;
  healed?: boolean;
}): string {
  const { projectId, nodeId, port, healed = false } = params;
  const healedLine = healed ? `\n            "healed": True,` : "";
  return `#!/usr/bin/env python3
import http.server, json, datetime, os

PORT = ${port}

class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass
    def _send(self, code, payload):
        body = json.dumps(payload, indent=2).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)
    def _read_json(self):
        length = int(self.headers.get("Content-Length", "0") or "0")
        raw = self.rfile.read(length).decode("utf-8", errors="replace") if length > 0 else "{}"
        try:
            return json.loads(raw) if raw.strip() else {}
        except Exception:
            return {"raw": raw}
    def do_GET(self):
        self._send(200, {
            "service": "${projectId}-autonomous-service",
            "status": "healthy",${healedLine}
            "method": "GET",
            "port": PORT,
            "path": self.path,
            "node": "${nodeId}",
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
        })
    def do_POST(self):
        data = self._read_json()
        self._send(200, {
            "service": "${projectId}-autonomous-service",
            "status": "healthy",${healedLine}
            "method": "POST",
            "port": PORT,
            "path": self.path,
            "node": "${nodeId}",
            "received": data,
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
        })
    def do_PUT(self):
        data = self._read_json()
        self._send(200, {
            "service": "${projectId}-autonomous-service",
            "status": "healthy",${healedLine}
            "method": "PUT",
            "port": PORT,
            "path": self.path,
            "node": "${nodeId}",
            "received": data,
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
        })
    def do_DELETE(self):
        self._send(200, {
            "service": "${projectId}-autonomous-service",
            "status": "healthy",${healedLine}
            "method": "DELETE",
            "port": PORT,
            "path": self.path,
            "node": "${nodeId}",
            "deleted": True,
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
        })

if __name__ == "__main__":
    http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
`;
}

/**
 * Generates a deterministic daemon launch command that frees any existing process
 * occupying the target port, records a PID file, starts the service detached, and verifies readiness.
 */
export function buildMicroserviceLaunchCommand(port: number): string {
  return `(fuser -k ${port}/tcp 2>/dev/null || pkill -f "service/server_${port}.py" 2>/dev/null || pkill -f "service/server.py" 2>/dev/null || true); cp -f service/server_${port}.py service/server.py 2>/dev/null || true; (nohup python3 service/server_${port}.py >/tmp/synapse-svc-${port}.log 2>&1 </dev/null & echo $! >/tmp/synapse-svc-${port}.pid); sleep 0.6 && curl -sf http://127.0.0.1:${port}/`;
}

export const SERVICE_BLUEPRINTS: ServiceBlueprint[] = [
  {
    id: "health-beacon-4060",
    name: "Health & Latency Beacon :4060",
    category: "backend",
    port: 4060,
    description:
      "Lightweight JSON health and latency telemetry beacon running on port 4060.",
    secret_key: "HEALTH_BEACON_TOKEN",
    deploy_cmd: `mkdir -p /var/lib/synapse/blueprints/beacon && cat << 'EOF' > /var/lib/synapse/blueprints/beacon/server.py
import http.server, json, time, socket
class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, format, *args): pass
    def _send(self, payload):
        body = json.dumps(payload, indent=2).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
    def do_GET(self):
        self._send({"status": "healthy", "service": "health-beacon-4060", "method": "GET", "path": self.path, "host": socket.gethostname(), "ts": int(time.time())})
    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0) or 0)
        raw = self.rfile.read(length).decode("utf-8", errors="ignore") if length > 0 else "{}"
        try: data = json.loads(raw)
        except Exception: data = {"raw": raw}
        self._send({"status": "healthy", "service": "health-beacon-4060", "method": "POST", "path": self.path, "received": data, "host": socket.gethostname(), "ts": int(time.time())})
    def do_PUT(self): self.do_POST()
    def do_DELETE(self): self._send({"status": "healthy", "service": "health-beacon-4060", "deleted": True})
if __name__ == "__main__":
    http.server.ThreadingHTTPServer(("127.0.0.1", 4060), Handler).serve_forever()
EOF
fuser -k 4060/tcp 2>/dev/null || true
nohup python3 /var/lib/synapse/blueprints/beacon/server.py >/var/lib/synapse/blueprints/beacon/beacon.log 2>&1 </dev/null & sleep 1
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
    def _send(self, payload):
        body = json.dumps(payload, indent=2).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
    def do_GET(self):
        self._send({"status": "ok", "service": "webhook-sink-4065", "events": EVENTS[-20:]})
    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0) or 0)
        raw = self.rfile.read(length).decode("utf-8", errors="ignore") if length > 0 else "{}"
        try: parsed = json.loads(raw)
        except Exception: parsed = raw
        EVENTS.append({"id": len(EVENTS)+1, "payload": parsed, "ts": int(time.time())})
        self._send({"status": "ok", "service": "webhook-sink-4065", "received": parsed, "total": len(EVENTS)})
    def do_PUT(self): self.do_POST()
    def do_DELETE(self):
        EVENTS.clear()
        self._send({"status": "ok", "service": "webhook-sink-4065", "cleared": True})
if __name__ == "__main__":
    http.server.ThreadingHTTPServer(("127.0.0.1", 4065), Handler).serve_forever()
EOF
fuser -k 4065/tcp 2>/dev/null || true
nohup python3 /var/lib/synapse/blueprints/webhook/server.py >/var/lib/synapse/blueprints/webhook/webhook.log 2>&1 </dev/null & sleep 1
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
    def _send(self, payload):
        body = json.dumps(payload, indent=2).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
    def do_GET(self):
        self._send({"status": "healthy", "service": "kv-memory-store-6380", "keys": len(STORE), "data": STORE})
    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0) or 0)
        raw = self.rfile.read(length).decode("utf-8", errors="ignore") if length > 0 else "{}"
        try:
            data = json.loads(raw)
            if isinstance(data, dict):
                for k, v in data.items(): STORE[str(k)] = v
        except Exception:
            data = {"raw": raw}
        self._send({"status": "healthy", "service": "kv-memory-store-6380", "updated": data, "keys": len(STORE), "data": STORE})
    def do_PUT(self): self.do_POST()
    def do_DELETE(self):
        self._send({"status": "healthy", "service": "kv-memory-store-6380", "keys": len(STORE)})
if __name__ == "__main__":
    http.server.ThreadingHTTPServer(("127.0.0.1", 6380), Handler).serve_forever()
EOF
fuser -k 6380/tcp 2>/dev/null || true
nohup python3 /var/lib/synapse/blueprints/kvstore/server.py >/var/lib/synapse/blueprints/kvstore/kv.log 2>&1 </dev/null & sleep 1
echo "BLUEPRINT_DEPLOYED_6380"`,
  },
];
