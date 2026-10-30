import { gatewayPushHealthTargets } from "@/lib/gatewayClient";
import type {
  ProjectState,
  RegisteredService,
  ServiceEndpointAction,
} from "@/lib/vault";

export function buildDefaultServiceEndpoints(
  projectId: string,
  serviceId: string,
  name: string,
  category: RegisteredService["category"],
  basePath = "/",
  dbPath?: string
): ServiceEndpointAction[] {
  const combined = `${serviceId} ${name} ${projectId}`.toLowerCase();

  if (category === "database") {
    if (combined.includes("mesh") && !combined.includes("sqlite")) {
      return [
        {
          id: "mesh-db-root",
          label: "GET / (Mesh DB Status & Records)",
          method: "GET",
          path: "/",
          description:
            "Fetch encrypted mesh database node status and record count via Reverse Proxy.",
        },
        {
          id: "db-http-probe",
          label: "GET /query (Mesh Probe)",
          method: "GET",
          path: "/query",
          description: "Probe HTTP/JSON database endpoint via Reverse Proxy.",
        },
      ];
    }
    const defaultDbPath = dbPath || `/opt/axon/workspaces/${projectId}/app.db`;
    return [
      {
        id: "sql-tables",
        label: "Show Tables (SQLite)",
        method: "SQL",
        path: defaultDbPath,
        description: "List all database tables and schemas.",
        sample_payload:
          "SELECT name, type, sql FROM sqlite_master WHERE type='table';",
      },
      {
        id: "sql-select",
        label: "Query Latest Rows",
        method: "SQL",
        path: defaultDbPath,
        description: "Inspect recent records stored in the database.",
        sample_payload: "SELECT * FROM events ORDER BY id DESC LIMIT 15;",
      },
      {
        id: "sql-insert",
        label: "Insert Test Row (SQL)",
        method: "SQL",
        path: defaultDbPath,
        description: "Insert a new record directly into the database.",
        sample_payload:
          "INSERT INTO events (event, source) VALUES ('manual_db_test', 'core_ui_box'); SELECT * FROM events ORDER BY id DESC LIMIT 5;",
      },
      {
        id: "db-http-probe",
        label: "GET / (API Status)",
        method: "GET",
        path: "/",
        description: "Probe HTTP/JSON database endpoint via Reverse Proxy.",
      },
    ];
  }

  if (category === "webui") {
    return [
      {
        id: "webui-home",
        label: "GET / (Open WebUI)",
        method: "GET",
        path: basePath || "/",
        description: "Load the main interactive WebUI in the Reverse Proxy.",
      },
      {
        id: "webui-api",
        label: "GET /api/status",
        method: "GET",
        path: "/api/status",
        description: "Inspect WebUI backend status JSON.",
      },
      {
        id: "webui-post",
        label: "POST /api/action (Send Input)",
        method: "POST",
        path: "/api/action",
        description: "Send interactive form/JSON input to the WebUI backend.",
        sample_payload: JSON.stringify(
          { action: "refresh_dashboard", actor: "operator" },
          null,
          2
        ),
      },
    ];
  }

  if (combined.includes("event") || combined.includes("analytics")) {
    const resolvedDbPath = dbPath || `/opt/axon/workspaces/${projectId}/app.db`;
    return [
      {
        id: "get-root",
        label: "GET / (Service Status)",
        method: "GET",
        path: "/",
        description: "Check microservice status via Reverse Proxy.",
      },
      {
        id: "get-events",
        label: "GET /api/events",
        method: "GET",
        path: "/api/events",
        description: "Fetch all stored analytics events from SQLite.",
      },
      {
        id: "post-events",
        label: "POST /api/events (Add Event)",
        method: "POST",
        path: "/api/events",
        description: "Submit a new JSON analytics event from the UI box.",
        sample_payload: JSON.stringify(
          { event: "user_clicked_box", source: "synapse-core-ui" },
          null,
          2
        ),
      },
      {
        id: "sql-events",
        label: "SQL: Inspect Database",
        method: "SQL",
        path: resolvedDbPath,
        description:
          "Run an interactive SQL query against the SQLite database on the Muscle node.",
        sample_payload: "SELECT * FROM events ORDER BY id DESC LIMIT 10;",
      },
    ];
  }

  return [
    {
      id: "api-root",
      label: `GET ${basePath || "/"} (Overview)`,
      method: "GET",
      path: basePath || "/",
      description: "Call the root endpoint through the Yamux Reverse Proxy.",
    },
    {
      id: "api-health",
      label: "GET /health",
      method: "GET",
      path: "/health",
      description: "Probe service health and telemetry.",
    },
    {
      id: "api-post",
      label: "POST / (Send JSON Input)",
      method: "POST",
      path: basePath || "/",
      description: "Send a custom JSON payload to the service via Reverse Proxy.",
      sample_payload: JSON.stringify(
        { action: "ping", message: "Hello from Synapse Core UI" },
        null,
        2
      ),
    },
  ];
}

export async function pushNodeHealthTargets(
  state: ProjectState,
  nodeId: string
): Promise<void> {
  if (!nodeId) return;
  const nodeTargets = state.registered_services
    .filter((s) => s.node_id === nodeId)
    .map((s) => ({
      service_id: s.service_id,
      name: s.name,
      protocol: (
        s.health_check?.type ||
        s.protocol ||
        "http"
      ).toLowerCase(),
      port: s.port,
      path: s.path || "/",
      target:
        s.health_check?.target ||
        (s.protocol === "http"
          ? `http://127.0.0.1:${s.port}${s.path || "/"}`
          : `127.0.0.1:${s.port}`),
      interval_sec: s.health_check?.interval_sec || 15,
    }));
  await gatewayPushHealthTargets(nodeId, nodeTargets);
}
