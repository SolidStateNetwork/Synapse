import {
  CORE_GATEWAY_URL,
  interceptAndExecuteTool,
} from "@/lib/orchestrator";

export interface InvokeServiceActionInput {
  projectId: string;
  nodeId: string;
  port: number;
  method: string;
  rawPath: string;
  payload: string;
}

export async function executeServiceAction({
  projectId,
  nodeId,
  port,
  method,
  rawPath,
  payload,
}: InvokeServiceActionInput) {
  const startMs = Date.now();
  const normalizedMethod = String(method || "GET").toUpperCase();

  if (normalizedMethod === "SQL") {
    const dbPath =
      rawPath.endsWith(".db") || rawPath.startsWith("/")
        ? rawPath
        : `/opt/axon/workspaces/${projectId}/pulse.db`;
    const sqlQuery =
      payload.trim() ||
      "SELECT name, type FROM sqlite_master WHERE type='table';";
    const pyScript = `import sqlite3, json, sys, os, glob
db_path = ${JSON.stringify(dbPath)}
if not os.path.exists(db_path) or os.path.getsize(db_path) == 0:
    base_name = os.path.basename(db_path) or "pulse.db"
    candidates = [
        p for p in glob.glob(f"/opt/axon/workspaces*/*/{base_name}") + glob.glob("/opt/axon/workspaces*/*/*.db")
        if os.path.isfile(p) and os.path.getsize(p) > 0
    ]
    if candidates:
        if os.path.exists(db_path) and os.path.getsize(db_path) == 0:
            try:
                os.remove(db_path)
            except OSError:
                pass
        db_path = candidates[0]
query = ${JSON.stringify(sqlQuery)}
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()
statements = [s.strip() for s in query.split(";") if s.strip()]
rows = []
for stmt in statements:
    cur.execute(stmt)
    if cur.description:
        rows = [dict(r) for r in cur.fetchall()]
conn.commit()
print(json.dumps({"db_path": db_path, "rows_count": len(rows), "rows": rows}, default=str))
`;
    const b64Py = Buffer.from(pyScript, "utf8").toString("base64");
    const ptyRes = await interceptAndExecuteTool(
      projectId,
      "node_pty_exec",
      {
        node_id: nodeId,
        session_id: `db-explorer-${projectId}`,
        command: `python3 -c "$(echo '${b64Py}' | base64 -d)"`,
        wait_timeout_ms: 8000,
      },
      true
    );
    const outObj = (ptyRes.output || {}) as Record<string, unknown>;
    const rawOut = String(outObj.output || "").trim();
    let parsedJson: unknown = null;
    try {
      parsedJson = JSON.parse(rawOut);
    } catch {
      parsedJson = null;
    }
    return {
      ok: ptyRes.status === "executed" && Number(outObj.exit_code ?? 0) === 0,
      status_code: Number(outObj.exit_code ?? 0) === 0 ? 200 : 500,
      latency_ms: Date.now() - startMs,
      method: "SQL",
      proxy_url: `sqlite://${nodeId}:${dbPath}`,
      response_text: parsedJson
        ? JSON.stringify(parsedJson, null, 2)
        : rawOut,
      response_json: parsedJson,
    };
  }

  const cleanSubPath = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
  const proxyUrl = `${CORE_GATEWAY_URL}/preview/${projectId}/${nodeId}/${port}${cleanSubPath}`;
  try {
    const fetchInit: RequestInit = {
      method: normalizedMethod,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/html, */*",
      },
    };
    if (
      normalizedMethod !== "GET" &&
      normalizedMethod !== "HEAD" &&
      payload.trim() !== ""
    ) {
      fetchInit.body = payload;
    }
    const proxyRes = await fetch(proxyUrl, fetchInit);
    const text = await proxyRes.text();
    let parsedJson: unknown = null;
    try {
      parsedJson = JSON.parse(text);
    } catch {
      parsedJson = null;
    }
    return {
      ok: proxyRes.ok,
      status_code: proxyRes.status,
      latency_ms: Date.now() - startMs,
      method: normalizedMethod,
      proxy_url: proxyUrl,
      response_text: parsedJson
        ? JSON.stringify(parsedJson, null, 2)
        : text.slice(0, 8192),
      response_json: parsedJson,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      status_code: 502,
      latency_ms: Date.now() - startMs,
      method: normalizedMethod,
      proxy_url: proxyUrl,
      response_text: `Reverse Proxy Error: ${msg}`,
    };
  }
}
