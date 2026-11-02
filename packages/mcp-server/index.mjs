#!/usr/bin/env node
import crypto from "node:crypto";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

export const MCP_SERVER_VERSION = "2.4.0";

const TOOL_SPECS = [
  ["core_update_brain_doc", "Update Brain Lexicon Document", false, false, true, false, ["mode"], { document: { type: "string", enum: ["Architecture.md", "Memory.md", "Milestones.md", "AGENTS.md"] }, mode: { type: "string", enum: ["replace_section", "append", "overwrite_full", "overwrite", "sync_lexicon_to_node"] }, content: { type: "string" } }],
  ["core_register_service", "Register Live-Preview Service Endpoint", false, false, true, false, ["service_id", "node_id"], { service_id: { type: "string" }, node_id: { type: "string" }, name: { type: "string" }, port: { type: "integer" } }],
  ["core_manage_secret", "Manage AES-256-GCM Encrypted Secrets", false, true, true, false, ["action", "key"], { action: { type: "string", enum: ["generate_random", "set_value", "set", "delete", "list"] }, key: { type: "string" }, value: { type: "string" } }],
  ["node_pty_exec", "Execute Command in Persistent Stateful PTY", false, true, false, true, ["node_id", "session_id", "command"], { node_id: { type: "string" }, session_id: { type: "string" }, command: { type: "string" }, wait_timeout_ms: { type: "integer" } }],
  ["node_fs_operation", "Execute Remote Atomic Filesystem Operation", false, true, true, false, ["node_id", "operation", "path"], { node_id: { type: "string" }, operation: { type: "string", enum: ["read_file", "write_file", "apply_unified_diff", "list_dir", "stat", "delete"] }, path: { type: "string" }, content_or_patch: { type: "string" }, file_mode: { type: "string" } }],
  ["core_link_peers", "Manage Inter-Node Peer Mesh Links", false, false, true, false, ["source_node_id", "target_node_id", "remote_port"], { action: { type: "string", enum: ["upsert", "remove"] }, source_node_id: { type: "string" }, target_node_id: { type: "string" }, remote_port: { type: "integer" } }],
  ["node_deep_search", "Run Senior DevOps Deep Forensic Search on Muscle", true, false, true, false, ["node_id", "search_mode"], { node_id: { type: "string" }, search_mode: { type: "string", enum: ["content_grep", "file_find", "log_scan", "process_and_port_map", "sqlite_inspect", "security_forensics"] }, query: { type: "string" } }],
  ["core_vault_search", "Search Brain Vault Documents, Audit & History", true, false, true, false, [], { query: { type: "string" }, scope: { type: "string", enum: ["all", "architecture", "memory", "milestones", "agents", "services", "audit", "cartridges"] } }],
  ["node_firewall_control", "Control Synapse Firewall & Port-Shield on Muscle", false, true, true, false, ["action"], { node_id: { type: "string" }, action: { type: "string", enum: ["inspect", "set_profile", "shield_port", "unshield_port", "add_ip_rule", "remove_ip_rule"] }, port: { type: "integer" } }],
  ["core_deploy_git_stack", "Deploy GitOps Repository Stack on Muscle", false, true, false, true, ["name", "repo_url", "port"], { name: { type: "string" }, repo_url: { type: "string" }, port: { type: "integer" }, node_id: { type: "string" } }],
  ["core_delete_git_stack", "Tear Down Deployed GitOps Stack on Muscle", false, true, true, false, ["stack_id"], { stack_id: { type: "string" } }],
  ["core_tail_service_logs", "Tail Live Service & Container Logs on Muscle", true, false, true, false, [], { service_id: { type: "string" }, port: { type: "integer" }, node_id: { type: "string" }, lines: { type: "integer" } }],
  ["core_get_node_telemetry_history", "Get 60-Sample Node Telemetry History", true, false, true, false, [], { node_id: { type: "string" } }],
  ["core_run_due_cron_jobs", "Evaluate and Execute Due Cron-Runbooks", false, true, false, true, [], { node_id: { type: "string" }, force_all: { type: "boolean" } }],
  ["core_manage_backup", "Manage AES-256-GCM Encrypted Offsite Backups", false, true, false, false, ["action"], { action: { type: "string", enum: ["list", "create", "restore", "delete"] }, node_id: { type: "string" }, backup_id: { type: "string" } }],
  ["core_manage_checkpoint", "Manage Time-Machine Server Checkpoints", false, true, false, false, ["action"], { action: { type: "string", enum: ["list", "create", "rollback"] }, node_id: { type: "string" }, checkpoint_id: { type: "string" } }],
  ["core_manage_alerts", "Manage Watchdog Alert Rules & Webhooks", false, false, true, true, ["action"], { action: { type: "string", enum: ["inspect", "configure", "test_alert", "evaluate"] }, enabled: { type: "boolean" } }],
  ["core_intrusion_scan", "Scan Muscle SSH/Auth Logs for Brute-Force Intrusions", false, true, true, false, ["action"], { action: { type: "string", enum: ["scan", "block_ip"] }, node_id: { type: "string" }, ip: { type: "string" } }],
  ["core_hot_reload_service_code", "Inspect or Hot-Reload Microservice Code on Muscle", false, true, true, false, ["action", "port"], { action: { type: "string", enum: ["inspect", "hot_reload"] }, port: { type: "integer" }, code: { type: "string" } }],
  ["core_sqlite_studio", "Inspect & Query SQLite Databases on Muscle", false, true, false, false, [], { node_id: { type: "string" }, db_path: { type: "string" }, custom_sql: { type: "string" } }],
  ["core_manage_cron_jobs", "Manage Scheduled Cron-Runbooks", false, true, true, true, ["action"], { action: { type: "string", enum: ["list", "save", "delete", "run_now"] }, id: { type: "string" }, name: { type: "string" }, command: { type: "string" } }],
  ["core_manage_self_healing", "Manage Autonomous Self-Healing & Chaos Policies", false, false, true, false, ["action"], { action: { type: "string", enum: ["inspect", "configure", "heal_now", "simulate_crash"] }, service_id: { type: "string" } }],
  ["core_probe_service_mesh", "Probe Service Mesh Health & Deploy Custom Microservice", false, false, true, false, ["action"], { action: { type: "string", enum: ["probe_service", "probe_link", "deploy_custom_service"] }, port: { type: "integer" } }],
  ["core_manage_blueprint", "Deploy or Undeploy Official 1-Click Stack Blueprints", false, true, false, true, ["action"], { action: { type: "string", enum: ["list", "deploy", "undeploy"] }, blueprint_id: { type: "string" } }],
  ["core_manage_domain_tls", "Manage Custom Domain & Auto-TLS Reverse Proxy Bindings", false, false, true, false, ["action"], { action: { type: "string", enum: ["list", "bind", "unbind"] }, domain: { type: "string" }, port: { type: "integer" } }],
  ["core_system_ota_status", "Inspect OTA System Update & Binary SHA-256 Status", true, false, true, false, [], { inspect_nodes: { type: "boolean" } }],
  ["core_manage_firewall", "Manage Synapse Shield Firewall Policy", false, true, true, false, ["action"], { action: { type: "string", enum: ["inspect", "toggle_port_shield", "apply_profile", "add_ip_rule", "remove_ip_rule"] }, port: { type: "integer" } }],
  ["core_manage_cartridges", "Manage Modular AI Rule Cartridges", false, false, true, false, ["action"], { action: { type: "string", enum: ["list", "toggle", "activate", "deactivate"] }, cartridge_id: { type: "string" } }],
  ["core_manage_cluster_nodes", "Manage Muscle Cluster Nodes & Join Tokens", false, false, true, false, ["action"], { action: { type: "string", enum: ["list", "create_join_token", "assign_node", "unassign_node"] }, node_id: { type: "string" }, tier: { type: "string" } }],
  ["core_manage_projects", "Manage Multi-Project Workspaces & Audit Trail", false, false, true, false, ["action"], { action: { type: "string", enum: ["list", "create", "set_planning_only", "audit_trail"] }, name: { type: "string" } }],
  ["core_run_platform_self_test", "Run 6-Stage Synapse Platform Diagnostic Self-Test", true, false, true, false, ["action"], { action: { type: "string", enum: ["self_test", "toggle_debug"] } }],
  ["core_manage_playbooks", "Manage Scheduled AI Playbooks & Custom Cartridges", false, true, true, false, ["action"], { action: { type: "string", enum: ["list", "upsert", "delete", "create_custom_cartridge", "delete_custom_cartridge"] }, name: { type: "string" } }],
  ["core_manage_approvals", "Manage Tier-3 Supervised Execution Approvals", false, false, true, false, ["action"], { action: { type: "string", enum: ["list", "approve", "reject"] }, approval_id: { type: "string" } }],
  ["core_invoke_service_action", "Invoke Service REST Endpoint or SQLite Query", false, true, false, true, ["port", "method"], { port: { type: "integer" }, method: { type: "string", enum: ["GET", "POST", "PUT", "DELETE", "SQL"] }, path: { type: "string" } }],
  ["core_manage_auth_and_ai", "Manage WebUI RBAC/2FA & AI Provider Endpoint", false, false, true, false, ["action"], { action: { type: "string", enum: ["inspect_auth", "revoke_sessions", "configure_ai_endpoint"] }, provider: { type: "string" } }],
  ["core_manage_topology_bundle", "Export or Import Declarative Topology Bundle", false, false, true, false, ["action"], { action: { type: "string", enum: ["export", "import"] }, node_id: { type: "string" } }],
  ["core_cluster_canary_exec", "Execute Staged Multi-Node Canary Rollout", false, true, false, true, ["action"], { action: { type: "string", enum: ["canary_rollout", "verify_fleet_health"] }, command: { type: "string" } }],
  ["core_manage_mcp_keys", "Manage External AI / MCP API Keys", false, true, false, false, ["action"], { action: { type: "string", enum: ["list", "create", "revoke"] }, name: { type: "string" }, key_id: { type: "string" } }],
  ["synapse_list_peers", "List Connected Axon Muscle Peers", true, false, true, false, [], { project_id: { type: "string" } }],
  ["synapse_get_project_state", "Read Project Brain Vault State", true, false, true, false, [], { project_id: { type: "string" } }],
  ["synapse_create_join_token", "Generate Muscle Enrollment Join Token", false, false, false, false, [], { tier: { type: "string", enum: ["TIER_1_UNLEASHED", "TIER_2_WORKSPACE_JAIL", "TIER_3_SUPERVISED"] }, ttl_minutes: { type: "number" } }],
  ["synapse_rollback_snapshot", "Rollback File to Pre-Write Snapshot", false, true, true, false, ["snapshot_id"], { snapshot_id: { type: "string" } }],
];

export function getStandaloneMcpToolDefinitions() {
  return TOOL_SPECS.map(([name, title, readOnlyHint, destructiveHint, idempotentHint, openWorldHint, required, properties]) => ({
    name,
    description: `${title} (${name}) via Synapse v${MCP_SERVER_VERSION} Brain & Muscle Control Plane.`,
    inputSchema: {
      type: "object",
      ...(required.length > 0 ? { required } : {}),
      properties,
    },
    annotations: {
      title,
      readOnlyHint: Boolean(readOnlyHint),
      destructiveHint: Boolean(destructiveHint),
      idempotentHint: Boolean(idempotentHint),
      openWorldHint: Boolean(openWorldHint),
    },
  }));
}

export const STANDALONE_MCP_TOOLS = getStandaloneMcpToolDefinitions();

export function getStandaloneMcpResources(projectId = "default-project") {
  return [
    { uri: `synapse://${projectId}/Architecture.md`, name: "Architecture.md (System Blueprint & Mermaid Topology)", mimeType: "text/markdown" },
    { uri: `synapse://${projectId}/Memory.md`, name: "Memory.md (Blackbox [BB-XXX] Engineering Journal)", mimeType: "text/markdown" },
    { uri: `synapse://${projectId}/Milestones.md`, name: "Milestones.md (Project Roadmap & Phases)", mimeType: "text/markdown" },
    { uri: `synapse://${projectId}/AGENTS.md`, name: "AGENTS.md (5-Step SolidState AI Governance)", mimeType: "text/markdown" },
    { uri: `synapse://${projectId}/State.json`, name: "State.json (Live Peers, Services & Telemetry)", mimeType: "application/json" },
    { uri: `synapse://${projectId}/Audit.jsonl`, name: "Audit.jsonl (Immutable Security & Tool Trail)", mimeType: "application/json" },
  ];
}

export function signMcpPayload(apiKey, rawBody, timestampSec = Math.floor(Date.now() / 1000)) {
  const ts = String(timestampSec);
  const sig = crypto
    .createHmac("sha256", String(apiKey || ""))
    .update(`${ts}.${rawBody}`)
    .digest("hex");
  return { timestamp: ts, signature: `sha256=${sig}` };
}

export async function forwardToSynapseHttp(rpcReq, opts = {}) {
  const baseUrl = String(opts.synapseUrl || process.env.SYNAPSE_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");
  const apiKey = String(opts.apiKey ?? process.env.SYNAPSE_MCP_API_KEY ?? "");
  const timeoutMs = Number(opts.timeoutMs || process.env.SYNAPSE_MCP_TIMEOUT_MS || 15000);
  const maxRetries = Number(opts.maxRetries ?? 2);
  const rawBody = JSON.stringify(rpcReq);

  let lastErr = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const headers = { "Content-Type": "application/json" };
      if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
        const signed = signMcpPayload(apiKey, rawBody);
        headers["X-Synapse-Timestamp"] = signed.timestamp;
        headers["X-Synapse-Signature"] = signed.signature;
      }
      const res = await fetch(`${baseUrl}/api/mcp`, {
        method: "POST",
        headers,
        body: rawBody,
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok || res.status === 401 || res.status === 429) {
        return await res.json();
      }
      lastErr = new Error(`HTTP ${res.status}`);
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
    }
    if (attempt < maxRetries) {
      await new Promise((r) => setTimeout(r, 150 * Math.pow(2, attempt)));
    }
  }
  throw lastErr || new Error("Synapse MCP upstream unreachable");
}

export async function handleMcpRpcRequest(rpcReq, opts = {}) {
  const rpcId = rpcReq?.id ?? 1;
  const method = String(rpcReq?.method || "");
  const projectId = String(opts.projectId || process.env.SYNAPSE_PROJECT_ID || "default-project");

  if (method === "initialize") {
    return {
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
          name: "synapse-mcp-server",
          version: MCP_SERVER_VERSION,
        },
      },
    };
  }

  if (method === "notifications/initialized" || method === "ping") {
    return { jsonrpc: "2.0", id: rpcId, result: {} };
  }

  if (method === "tools/list") {
    return {
      jsonrpc: "2.0",
      id: rpcId,
      result: { tools: getStandaloneMcpToolDefinitions() },
    };
  }

  if (method === "resources/list") {
    return {
      jsonrpc: "2.0",
      id: rpcId,
      result: { resources: getStandaloneMcpResources(projectId) },
    };
  }

  try {
    return await forwardToSynapseHttp(rpcReq, opts);
  } catch (err) {
    return {
      jsonrpc: "2.0",
      id: rpcId,
      result: {
        isError: true,
        content: [
          {
            type: "text",
            text: JSON.stringify({
              offline_fallback: true,
              error: `Synapse Core HTTP endpoint unreachable: ${err instanceof Error ? err.message : String(err)}`,
            }),
          },
        ],
      },
    };
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const rl = readline.createInterface({ input: process.stdin, terminal: false });
  rl.on("line", async (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      const parsed = JSON.parse(trimmed);
      const response = await handleMcpRpcRequest(parsed);
      process.stdout.write(JSON.stringify(response) + "\n");
    } catch {
      process.stdout.write(
        JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }) + "\n"
      );
    }
  });
}
