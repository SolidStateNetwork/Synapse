import { NextRequest, NextResponse } from "next/server";
import {
  appendAuditLog,
  createMcpApiKey,
  ensureProjectVault,
  getRollbackSnapshot,
  listSecretKeys,
  readAuditLogs,
  readBrainDoc,
  revokeMcpApiKey,
  verifyMcpApiKey,
} from "@/lib/vault";
import { listCartridges, OFFICIAL_STACK_BLUEPRINTS } from "@/lib/cartridges";
import {
  CORE_GATEWAY_URL,
  fetchGatewayNodes,
  interceptAndExecuteTool,
  SYNAPSE_TOOL_SCHEMAS,
} from "@/lib/orchestrator";
import {
  resolveActiveProjectId,
  safeParseRequestJson,
} from "@/lib/runtimeResolver";
import { safeFetchJson } from "@/lib/safeFetch";

export const dynamic = "force-dynamic";

function extractApiKey(req: NextRequest): string {
  const authHeader = req.headers.get("authorization") || "";
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }
  const customHeader =
    req.headers.get("x-synapse-api-key") || req.headers.get("x-api-key") || "";
  if (customHeader) {
    return customHeader.trim();
  }
  return req.nextUrl.searchParams.get("api_key") || "";
}

function getMcpToolDefinitions() {
  const baseTools = SYNAPSE_TOOL_SCHEMAS.map((s) => ({
    name: s.function.name,
    description: s.function.description,
    inputSchema: s.function.parameters,
  }));

  const extraTools = [
    {
      name: "synapse_list_peers",
      description:
        "List all connected Axon Muscle peers, their live CPU/RAM/Disk telemetry, Autonomy Tiers, IP addresses, and active PTY sessions.",
      inputSchema: {
        type: "object",
        properties: {
          project_id: {
            type: "string",
            description: "Optional project ID (defaults to active workspace)",
          },
        },
      },
    },
    {
      name: "synapse_get_project_state",
      description:
        "Read the complete Synapse Project Brain Vault state (State.json, Architecture.md, Memory.md, active Rule Cartridges, and Secret Key names).",
      inputSchema: {
        type: "object",
        properties: {
          project_id: {
            type: "string",
            description: "Optional project ID (defaults to active workspace)",
          },
        },
      },
    },
    {
      name: "synapse_create_join_token",
      description:
        "Generate a one-time mTLS CSR join token and ready-to-run 'install.sh' + 'axon switch' CLI commands to enroll or rebind a Linux Muscle server.",
      inputSchema: {
        type: "object",
        properties: {
          tier: {
            type: "string",
            enum: [
              "TIER_1_UNLEASHED",
              "TIER_2_WORKSPACE_JAIL",
              "TIER_3_SUPERVISED",
            ],
            description: "Autonomy Tier for the Muscle peer",
          },
          ttl_minutes: {
            type: "number",
            description: "Token validity in minutes (default 30)",
          },
        },
      },
    },
    {
      name: "synapse_rollback_snapshot",
      description:
        "Restore a remote file on a Muscle peer to a previous pre-write snapshot ID.",
      inputSchema: {
        type: "object",
        required: ["snapshot_id"],
        properties: {
          snapshot_id: {
            type: "string",
            description: "Snapshot ID to restore",
          },
        },
      },
    },
  ];

  return [...baseTools, ...extraTools];
}

async function executeMcpTool(
  projectId: string,
  toolName: string,
  args: Record<string, unknown>,
  scopes: Array<"read" | "execute" | "admin">
): Promise<{ isError: boolean; result: unknown }> {
  const canExecute = scopes.includes("execute") || scopes.includes("admin");

  const isReadOnlyTool =
    toolName === "synapse_list_peers" ||
    toolName === "synapse_get_project_state" ||
    toolName === "core_vault_search" ||
    toolName === "core_tail_service_logs" ||
    toolName === "node_deep_search" ||
    (toolName === "node_fs_operation" &&
      ["read_file", "list_dir", "stat"].includes(
        String(args.operation || "")
      )) ||
    (toolName === "core_manage_secret" &&
      (args.action === "list_keys" || args.action === "list")) ||
    ((toolName === "node_firewall_control" ||
      toolName === "core_manage_firewall") &&
      (!args.action || args.action === "inspect"));

  if (!isReadOnlyTool && !canExecute) {
    return {
      isError: true,
      result: {
        error: `MCP API Key lacks 'execute' scope required for tool '${toolName}'.`,
      },
    };
  }

  if (toolName === "synapse_list_peers") {
    const state = ensureProjectVault(projectId);
    const liveNodes = await fetchGatewayNodes();
    return {
      isError: false,
      result: {
        project_id: projectId,
        gateway_nodes: liveNodes,
        live_gateway_nodes: liveNodes,
        assigned_nodes: state.assigned_nodes,
        telemetry: state.telemetry,
      },
    };
  }

  if (toolName === "synapse_get_project_state") {
    const state = ensureProjectVault(projectId);
    return {
      isError: false,
      result: {
        state,
        architecture_md: readBrainDoc(projectId, "Architecture.md"),
        memory_md: readBrainDoc(projectId, "Memory.md"),
        secret_keys: listSecretKeys(projectId),
        available_cartridges: listCartridges().map((c) => ({
          id: c.id,
          name: c.name,
          category: c.category,
        })),
      },
    };
  }

  if (toolName === "synapse_create_join_token") {
    const tier = String(args.tier || "TIER_2_WORKSPACE_JAIL");
    const ttl = Number(args.ttl_minutes || 30);
    let token = `syn_join_${Date.now().toString(36)}`;
    try {
      const gwRes = await safeFetchJson(`${CORE_GATEWAY_URL}/api/v1/tokens`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: projectId,
          tier,
          ttl_minutes: ttl,
        }),
        timeoutMs: 3000,
      });
      if (gwRes.ok) {
        const gwTok = await gwRes.json();
        if (gwTok.token) token = gwTok.token;
      }
    } catch {
      // fallback local token preview if gateway offline
    }
    return {
      isError: false,
      result: {
        token,
        tier,
        install_command: `curl -fsSL ${CORE_GATEWAY_URL}/install.sh | sudo sh -s -- ${token} ${tier}`,
        switch_cli_command: `sudo axon switch --core ${CORE_GATEWAY_URL} --token ${token} --tier ${tier} --restart`,
      },
    };
  }

  if (toolName === "synapse_rollback_snapshot") {
    const snapId = String(args.snapshot_id || "");
    const snap = getRollbackSnapshot(projectId, snapId);
    if (!snap) {
      return {
        isError: true,
        result: { error: `Snapshot '${snapId}' not found` },
      };
    }
    const execRes = await interceptAndExecuteTool(
      projectId,
      "node_fs_operation",
      {
        node_id: snap.node_id,
        operation: snap.existed ? "write_file" : "delete",
        path: snap.path,
        content_or_patch: snap.previous_content,
        file_mode: snap.file_mode || "0644",
      },
      true
    );
    return {
      isError: execRes.status === "error",
      result: {
        ...execRes,
        success: execRes.status === "executed",
        snapshot: snap,
      },
    };
  }

  const toolRes = await interceptAndExecuteTool(projectId, toolName, args);

  appendAuditLog(projectId, {
    timestamp: new Date().toISOString(),
    actor: "ai_orchestrator",
    tool_name: `mcp:${toolName}`,
    node_id: typeof args.node_id === "string" ? args.node_id : undefined,
    status: toolRes.status === "executed" ? "executed" : "error",
    summary: `External MCP AI invoked ${toolName} -> ${toolRes.status}`,
  });

  return {
    isError:
      toolRes.status === "error" ||
      toolRes.status === "blocked_planning_mode",
    result: toolRes,
  };
}

export async function GET(req: NextRequest) {
  const projectId = resolveActiveProjectId(
    req.nextUrl.searchParams.get("project_id")
  );
  const state = ensureProjectVault(projectId);
  const tools = getMcpToolDefinitions();

  return NextResponse.json({
    protocol: "Model Context Protocol (MCP) Streamable HTTP + REST Tool API",
    protocolVersion: "2024-11-05",
    serverInfo: {
      name: "synapse-core-mcp",
      version: "0.7.0",
    },
    endpoint: "/api/mcp",
    project_id: projectId,
    active_keys_count: (state.mcp_api_keys || []).length,
    keys: (state.mcp_api_keys || []).map((k) => ({
      key_id: k.key_id,
      name: k.name,
      token_prefix: k.token_prefix,
      scopes: k.scopes,
      created_at: k.created_at,
      last_used_at: k.last_used_at,
    })),
    tools,
  });
}

export async function POST(req: NextRequest) {
  const body = await safeParseRequestJson(req);
  const projectId = resolveActiveProjectId(
    String(
      body.project_id ||
        body.projectId ||
        req.nextUrl.searchParams.get("project_id") ||
        ""
    )
  );
  ensureProjectVault(projectId);

  if (body.action === "create_key") {
    const scopes = Array.isArray(body.scopes)
      ? (body.scopes as Array<"read" | "execute" | "admin">)
      : (["read", "execute"] as Array<"read" | "execute" | "admin">);
    const created = createMcpApiKey(
      projectId,
      String(body.name || "External AI / MCP Client"),
      scopes
    );
    return NextResponse.json(created, { status: 201 });
  }

  if (body.action === "revoke_key") {
    const remaining = revokeMcpApiKey(projectId, String(body.key_id || ""));
    return NextResponse.json({ keys: remaining });
  }

  const rawToken = extractApiKey(req);
  let activeScopes: Array<"read" | "execute" | "admin"> = ["read", "execute"];

  if (!body.internal_ui_test) {
    const verified = verifyMcpApiKey(projectId, rawToken);
    if (!verified) {
      return NextResponse.json(
        {
          jsonrpc: "2.0",
          id: body.id ?? null,
          error: {
            code: -32001,
            message:
              "Unauthorized: Missing or invalid Synapse MCP API Key. Pass 'Authorization: Bearer syn_mcp_...' or 'X-Synapse-Api-Key'.",
          },
        },
        { status: 401 }
      );
    }
    activeScopes = verified.scopes;
  }

  if (body.jsonrpc === "2.0" || typeof body.method === "string") {
    const rpcId = body.id ?? 1;
    const method = String(body.method || "");
    const params = (body.params || {}) as Record<string, unknown>;

    if (method === "initialize") {
      return NextResponse.json({
        jsonrpc: "2.0",
        id: rpcId,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: { listChanged: true },
            resources: { listChanged: true },
            prompts: { listChanged: true },
          },
          serverInfo: {
            name: "synapse-core-mcp",
            version: "0.7.0",
          },
        },
      });
    }

    if (method === "notifications/initialized" || method === "ping") {
      return NextResponse.json({
        jsonrpc: "2.0",
        id: rpcId,
        result: {},
      });
    }

    if (method === "tools/list") {
      return NextResponse.json({
        jsonrpc: "2.0",
        id: rpcId,
        result: {
          tools: getMcpToolDefinitions(),
        },
      });
    }

    if (method === "tools/call") {
      const toolName = String(params.name || "");
      const toolArgs = (params.arguments || {}) as Record<string, unknown>;
      const execOut = await executeMcpTool(
        projectId,
        toolName,
        toolArgs,
        activeScopes
      );
      return NextResponse.json({
        jsonrpc: "2.0",
        id: rpcId,
        result: {
          isError: execOut.isError,
          content: [
            {
              type: "text",
              text: JSON.stringify(execOut.result, null, 2),
            },
          ],
        },
      });
    }

    if (method === "resources/list") {
      return NextResponse.json({
        jsonrpc: "2.0",
        id: rpcId,
        result: {
          resources: [
            {
              uri: `synapse://${projectId}/Architecture.md`,
              name: "Architecture.md (System Blueprint & Mermaid Topology)",
              mimeType: "text/markdown",
            },
            {
              uri: `synapse://${projectId}/Memory.md`,
              name: "Memory.md (Engineering Journal & Lessons Learned)",
              mimeType: "text/markdown",
            },
            {
              uri: `synapse://${projectId}/State.json`,
              name: "State.json (Live Peers, Services & Telemetry)",
              mimeType: "application/json",
            },
            {
              uri: `synapse://${projectId}/Audit.jsonl`,
              name: "Audit.jsonl (Immutable Security & Tool Trail)",
              mimeType: "application/json",
            },
          ],
        },
      });
    }

    if (method === "resources/read") {
      const uri = String(params.uri || "");
      let textContent = "";
      let mimeType = "text/plain";
      if (uri.endsWith("Architecture.md")) {
        textContent = readBrainDoc(projectId, "Architecture.md");
        mimeType = "text/markdown";
      } else if (uri.endsWith("Memory.md")) {
        textContent = readBrainDoc(projectId, "Memory.md");
        mimeType = "text/markdown";
      } else if (uri.endsWith("Audit.jsonl")) {
        textContent = JSON.stringify(readAuditLogs(projectId, 50), null, 2);
        mimeType = "application/json";
      } else {
        textContent = JSON.stringify(ensureProjectVault(projectId), null, 2);
        mimeType = "application/json";
      }
      return NextResponse.json({
        jsonrpc: "2.0",
        id: rpcId,
        result: {
          contents: [
            {
              uri,
              mimeType,
              text: textContent,
            },
          ],
        },
      });
    }

    if (method === "prompts/list") {
      return NextResponse.json({
        jsonrpc: "2.0",
        id: rpcId,
        result: {
          prompts: OFFICIAL_STACK_BLUEPRINTS.map((bp) => ({
            name: bp.id,
            description: `${bp.name} — ${bp.description}`,
          })),
        },
      });
    }

    return NextResponse.json({
      jsonrpc: "2.0",
      id: rpcId,
      error: {
        code: -32601,
        message: `Unsupported MCP method: ${method}`,
      },
    });
  }

  if (typeof body.tool === "string") {
    const execOut = await executeMcpTool(
      projectId,
      body.tool,
      (body.arguments || {}) as Record<string, unknown>,
      activeScopes
    );
    return NextResponse.json(
      {
        ok: !execOut.isError,
        isError: execOut.isError,
        tool: body.tool,
        result: execOut.result,
      },
      { status: 200 }
    );
  }

  return NextResponse.json(
    {
      error:
        "Invalid request. Send a JSON-RPC 2.0 MCP payload ({ jsonrpc: '2.0', method: 'tools/list' | 'tools/call', ... }) or REST tool payload ({ tool: '<name>', arguments: {...} }).",
    },
    { status: 400 }
  );
}
