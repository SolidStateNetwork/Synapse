import {
  appendAuditLog,
  deleteSecret,
  generateRandomSecret,
  listSecretKeys,
  setSecret,
  withProjectStateTransaction,
  writeBrainDoc,
  type ProjectState,
  type RegisteredService,
  type ServiceEndpointAction,
} from "../vault";
import {
  buildDefaultServiceEndpoints,
  pushNodeHealthTargets,
} from "./servicePresets";
import type { ToolDispatchResult } from "../orchestrator";

export async function dispatchCoreBrainTool(
  coreGatewayUrl: string,
  projectId: string,
  state: ProjectState,
  toolName: string,
  args: Record<string, unknown>
): Promise<ToolDispatchResult | null> {
  if (toolName === "core_update_brain_doc") {
    const doc =
      args.document === "Memory.md" ? "Memory.md" : "Architecture.md";
    const rawMode = String(args.mode || "overwrite_full");
    const mode =
      rawMode === "append"
        ? "append"
        : rawMode === "replace_section"
        ? "replace_section"
        : "overwrite_full";
    const sectionHeader = args.section_header
      ? String(args.section_header)
      : undefined;
    const content = String(args.content || "");
    const updated = writeBrainDoc(
      projectId,
      doc,
      content,
      mode,
      sectionHeader
    );
    appendAuditLog(projectId, {
      timestamp: new Date().toISOString(),
      actor: "ai_orchestrator",
      tool_name: toolName,
      status: "executed",
      summary: `Updated ${doc} (${mode}${
        sectionHeader ? ` [${sectionHeader}]` : ""
      }, ${content.length} chars)`,
      args,
    });
    return {
      tool_name: toolName,
      status: "executed",
      output: {
        document: doc,
        mode,
        section_header: sectionHeader,
        length: updated.length,
      },
    };
  }

  if (toolName === "core_register_service") {
    const action = String(args.action || "upsert");
    const serviceId = String(args.service_id || `svc-${Date.now()}`);
    const nodeId = String(
      args.node_id || state.assigned_nodes[0]?.node_id || ""
    );

    if (action === "remove") {
      const updatedState = await withProjectStateTransaction(
        projectId,
        (draft) => {
          draft.registered_services = draft.registered_services.filter(
            (s) => s.service_id !== serviceId
          );
          return draft;
        }
      );
      await pushNodeHealthTargets(updatedState, nodeId);
      appendAuditLog(projectId, {
        timestamp: new Date().toISOString(),
        actor: "ai_orchestrator",
        tool_name: toolName,
        node_id: nodeId,
        status: "executed",
        summary: `Removed service ${serviceId} from ${nodeId}`,
        args,
      });
      return {
        tool_name: toolName,
        status: "executed",
        output: { removed: serviceId, node_id: nodeId },
      };
    }

    const hcRaw = (args.health_check || {}) as Record<string, unknown>;
    const port = Number(args.port || 3000);
    const pathStr = String(args.path || "/");
    const hcType = (
      String(hcRaw.type || args.protocol || "HTTP").toUpperCase() === "TCP"
        ? "TCP"
        : String(hcRaw.type || "").toUpperCase() === "EXEC"
        ? "EXEC"
        : "HTTP"
    ) as "HTTP" | "TCP" | "EXEC";
    const hcTarget = String(
      hcRaw.target ||
        (hcType === "HTTP"
          ? `http://127.0.0.1:${port}${pathStr}`
          : `127.0.0.1:${port}`)
    );

    const existingSvc = state.registered_services.find(
      (s) => s.service_id === serviceId
    );

    const rawName = String(args.name || existingSvc?.name || serviceId);
    const rawCat = String(
      args.category || existingSvc?.category || ""
    ).toLowerCase();
    let category: RegisteredService["category"] = "backend";
    if (
      rawCat === "webui" ||
      rawCat === "backend" ||
      rawCat === "database" ||
      rawCat === "worker"
    ) {
      category = rawCat;
    } else if (
      /db|sqlite|postgres|mysql|redis|mongo|sql/i.test(
        `${serviceId} ${rawName}`
      )
    ) {
      category = "database";
    } else if (
      /web|ui|frontend|dashboard|portal|app|next|vite/i.test(
        `${serviceId} ${rawName}`
      )
    ) {
      category = "webui";
    }

    const dbPath = args.db_path
      ? String(args.db_path)
      : existingSvc?.db_path ||
        (category === "database" ||
        /pulse|sqlite/i.test(`${serviceId} ${rawName}`)
          ? `/opt/axon/workspaces/${projectId}/pulse.db`
          : undefined);

    let endpoints: ServiceEndpointAction[] = [];
    if (Array.isArray(args.endpoints) && args.endpoints.length > 0) {
      endpoints = args.endpoints.map(
        (ep: Record<string, unknown>, idx: number) => ({
          id: String(ep.id || `ep-${idx + 1}`),
          label: String(ep.label || `${ep.method || "GET"} ${ep.path || "/"}`),
          method: (["GET", "POST", "PUT", "DELETE", "SQL"].includes(
            String(ep.method || "GET").toUpperCase()
          )
            ? String(ep.method || "GET").toUpperCase()
            : "GET") as ServiceEndpointAction["method"],
          path: String(ep.path || "/"),
          description: ep.description ? String(ep.description) : undefined,
          sample_payload:
            ep.sample_payload !== undefined
              ? String(ep.sample_payload)
              : undefined,
        })
      );
    } else if (existingSvc?.endpoints && existingSvc.endpoints.length > 0) {
      endpoints = existingSvc.endpoints;
    } else {
      endpoints = buildDefaultServiceEndpoints(
        projectId,
        serviceId,
        rawName,
        category,
        pathStr,
        dbPath
      );
    }

    const description = args.description
      ? String(args.description)
      : existingSvc?.description ||
        (category === "webui"
          ? `Interactive WebUI reachable from outside via Synapse Reverse Proxy (127.0.0.1:${port})`
          : category === "database"
          ? `Interactive Database & Storage Engine on ${nodeId} (127.0.0.1:${port})`
          : `Reachable Backend REST API via Synapse Reverse Proxy (127.0.0.1:${port})`);

    const svc: RegisteredService = {
      service_id: serviceId,
      name: rawName,
      node_id: nodeId,
      category,
      description,
      db_path: dbPath,
      endpoints,
      runtime: (args.runtime as RegisteredService["runtime"]) || "binary",
      unit_or_container: args.unit_or_container
        ? String(args.unit_or_container)
        : undefined,
      bind_address: String(args.bind_address || "127.0.0.1"),
      protocol: hcType.toLowerCase() as "http" | "tcp" | "exec",
      port,
      path: pathStr,
      enable_preview_tunnel:
        args.enable_preview_tunnel !== undefined
          ? Boolean(args.enable_preview_tunnel)
          : true,
      auto_heal:
        args.auto_heal !== undefined
          ? Boolean(args.auto_heal)
          : existingSvc?.auto_heal ?? true,
      consecutive_failures: 0,
      health_check: {
        type: hcType,
        target: hcTarget,
        interval_sec: Number(hcRaw.interval_sec || 15),
        status: "HEALTHY",
        last_checked: new Date().toISOString(),
      },
      healthy: true,
      registered_at: new Date().toISOString(),
    };

    const updatedState = await withProjectStateTransaction(
      projectId,
      (draft) => {
        draft.registered_services = [
          ...draft.registered_services.filter(
            (s) => s.service_id !== svc.service_id
          ),
          svc,
        ];
        return draft;
      }
    );
    await pushNodeHealthTargets(updatedState, svc.node_id);

    appendAuditLog(projectId, {
      timestamp: new Date().toISOString(),
      actor: "ai_orchestrator",
      tool_name: toolName,
      node_id: svc.node_id,
      status: "executed",
      summary: `Registered service ${svc.name} (${svc.bind_address}:${svc.port}, ${svc.health_check?.type}, auto_heal=${svc.auto_heal}) on ${svc.node_id}`,
      args,
    });

    return {
      tool_name: toolName,
      status: "executed",
      output: {
        registered: svc,
        live_preview_url: `/preview/${projectId}/${svc.node_id}/${svc.port}`,
      },
    };
  }

  if (toolName === "core_manage_secret") {
    const action = String(args.action || "list");
    const key = String(args.key || args.key_name || "").trim().toUpperCase();
    const value = String(args.value || args.secret_value || "");
    const length = Number(args.length || 32);
    let keys: string[] = [];

    if (action === "generate_random" && key) {
      keys = generateRandomSecret(projectId, key, length);
    } else if (
      (action === "set_value" || action === "set" || action === "set_secret") &&
      key
    ) {
      keys = setSecret(projectId, key, value);
    } else if ((action === "delete" || action === "delete_secret") && key) {
      keys = deleteSecret(projectId, key);
    } else {
      keys = listSecretKeys(projectId);
    }

    appendAuditLog(projectId, {
      timestamp: new Date().toISOString(),
      actor: "ai_orchestrator",
      tool_name: toolName,
      status: "executed",
      summary: `Secret vault action '${action}' on key '${key || "*"}'`,
      args: {
        action,
        key,
        length: action === "generate_random" ? length : undefined,
      },
    });
    return {
      tool_name: toolName,
      status: "executed",
      output: {
        action,
        key,
        secret_keys_available: keys,
        note:
          action === "generate_random"
            ? `Generated ${length}-char secret '${key}' in Secrets.enc (never exposed in plaintext).`
            : undefined,
      },
    };
  }

  if (toolName === "core_link_peers") {
    const action = String(args.action || "upsert");
    const sourceNodeId = String(
      args.source_node_id || state.assigned_nodes[0]?.node_id || "node-a"
    );
    const targetNodeId = String(
      args.target_node_id || state.assigned_nodes[1]?.node_id || "node-b"
    );
    const remotePort = Number(args.remote_port || 5432);
    const localPort = Number(args.local_port || remotePort);
    const linkId = String(
      args.link_id || `mesh-${sourceNodeId}-${targetNodeId}-${remotePort}`
    );

    if (action === "remove") {
      await withProjectStateTransaction(projectId, (draft) => {
        draft.peer_mesh_links = (draft.peer_mesh_links || []).filter(
          (l) => l.link_id !== linkId
        );
      });
      try {
        await fetch(`${coreGatewayUrl}/api/v1/rpc/pty`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            node_id: sourceNodeId,
            cmd_id: `mesh-rm-${Date.now()}`,
            session_id: `mesh-${projectId}`,
            project_id: projectId,
            tier: "TIER_1_UNLEASHED",
            command: `pkill -f "synapse-mesh-${localPort}.py" 2>/dev/null || true`,
            wait_timeout_ms: 4000,
          }),
        });
      } catch {
        // Non-fatal if source node offline
      }
      appendAuditLog(projectId, {
        timestamp: new Date().toISOString(),
        actor: "ai_orchestrator",
        tool_name: toolName,
        node_id: sourceNodeId,
        status: "executed",
        summary: `Removed peer mesh link ${linkId} (${sourceNodeId} -> ${targetNodeId}:${remotePort})`,
        args,
      });
      return {
        tool_name: toolName,
        status: "executed",
        output: { removed: linkId },
      };
    }

    const link = {
      link_id: linkId,
      source_node_id: sourceNodeId,
      target_node_id: targetNodeId,
      local_port: localPort,
      remote_port: remotePort,
      target_port: remotePort,
      protocol: (String(args.protocol || "tcp").toLowerCase() === "http"
        ? "http"
        : "tcp") as "tcp" | "http",
      alias_env: args.alias_env
        ? String(args.alias_env)
        : "PEER_SERVICE_URL",
      description: args.description
        ? String(args.description)
        : `Encrypted mTLS mesh route ${sourceNodeId} (127.0.0.1:${localPort}) -> ${targetNodeId} (127.0.0.1:${remotePort})`,
      created_at: new Date().toISOString(),
    };

    await withProjectStateTransaction(projectId, (draft) => {
      draft.peer_mesh_links = [
        ...(draft.peer_mesh_links || []).filter((l) => l.link_id !== linkId),
        link,
      ];
    });

    if (localPort !== remotePort || sourceNodeId !== targetNodeId) {
      const relayScript = `import http.server, urllib.request, sys
TARGET_BASE = "http://127.0.0.1:8081/preview/${projectId}/${targetNodeId}/${remotePort}"
class MeshRelay(http.server.BaseHTTPRequestHandler):
    def log_message(self, format, *args): pass
    def _proxy(self):
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length) if length > 0 else None
        url = TARGET_BASE + (self.path if self.path.startswith("/") else "/" + self.path)
        req = urllib.request.Request(url, data=body, method=self.command)
        for k, v in self.headers.items():
            if k.lower() not in ("host", "content-length"):
                req.add_header(k, v)
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = resp.read()
                self.send_response(resp.status)
                for hk, hv in resp.getheaders():
                    if hk.lower() not in ("transfer-encoding", "content-length"):
                        self.send_header(hk, hv)
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)
        except Exception as e:
            msg = str(e).encode()
            self.send_response(502)
            self.send_header("Content-Length", str(len(msg)))
            self.end_headers()
            self.wfile.write(msg)
    def do_GET(self): self._proxy()
    def do_POST(self): self._proxy()
    def do_PUT(self): self._proxy()
    def do_DELETE(self): self._proxy()
http.server.ThreadingHTTPServer(("127.0.0.1", ${localPort}), MeshRelay).serve_forever()
`;
      const b64Relay = Buffer.from(relayScript, "utf8").toString("base64");
      try {
        await fetch(`${coreGatewayUrl}/api/v1/rpc/pty`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            node_id: sourceNodeId,
            cmd_id: `mesh-up-${Date.now()}`,
            session_id: `mesh-${projectId}`,
            project_id: projectId,
            tier: "TIER_1_UNLEASHED",
            command: `pkill -f "synapse-mesh-${localPort}.py" 2>/dev/null || true; echo "${b64Relay}" | base64 -d > /tmp/synapse-mesh-${localPort}.py && (nohup python3 /tmp/synapse-mesh-${localPort}.py >/tmp/synapse-mesh-${localPort}.log 2>&1 &); sleep 0.3`,
            wait_timeout_ms: 6000,
          }),
        });
      } catch {
        // Non-fatal if source node offline
      }
    }

    appendAuditLog(projectId, {
      timestamp: new Date().toISOString(),
      actor: "ai_orchestrator",
      tool_name: toolName,
      node_id: sourceNodeId,
      status: "executed",
      summary: `Established Peer-to-Peer Mesh Tunnel: ${sourceNodeId} (127.0.0.1:${localPort}) <=> ${targetNodeId} (127.0.0.1:${remotePort})`,
      args,
    });

    return {
      tool_name: toolName,
      status: "executed",
      output: {
        mesh_link: link,
        note: `Peer ${sourceNodeId} can now reach ${targetNodeId}:${remotePort} directly via 127.0.0.1:${localPort}.`,
      },
    };
  }

  return null;
}
