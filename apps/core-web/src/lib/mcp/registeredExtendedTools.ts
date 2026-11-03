import type {
  McpToolServerRegistrar,
  ReadMcpToolFn,
  RunMcpToolFn,
} from "./registeredTools";

export function registerExtendedMcpTools(
  server: McpToolServerRegistrar,
  readMcpToolResult: ReadMcpToolFn,
  runMcpToolAction: RunMcpToolFn
): void {
  server.registerTool(
    "core_manage_self_healing",
    {
      description: "Manages Autonomous Self-Healing & Chaos-Resilience policies and triggers immediate service recovery or MTTR crash simulation on a Muscle node.",
      inputSchema: {
        type: "object",
        required: ["action"],
        properties: {
          action: { type: "string", enum: ["inspect", "configure", "heal_now", "simulate_crash"], description: "Self-healing action." },
          node_id: { type: "string", description: "Optional target Muscle Peer ID." },
          service_id: { type: "string", description: "Service ID to heal or simulate crash." },
          service_name: { type: "string", description: "Optional display name." },
          port: { type: "integer", description: "Service port number." },
          container_name: { type: "string", description: "Optional Docker container name." },
          enabled: { type: "boolean", description: "Enable or disable autonomous self-healing." },
          max_latency_ms: { type: "integer", description: "Max allowed latency before self-heal." },
          failure_threshold: { type: "integer", description: "Consecutive failures before self-heal." },
          cooldown_seconds: { type: "integer", description: "Cooldown seconds between self-heals." },
        },
      },
      annotations: { title: "Manage Autonomous Self-Healing & Chaos Policies", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args: Record<string, unknown>) => {
      try {
        return await runMcpToolAction("core_manage_self_healing", { action: args.action, node_id: args.node_id, service_id: args.service_id, port: args.port, enabled: args.enabled });
      } catch (err) {
        return { isError: true, error: String(err) };
      }
    }
  );

  server.registerTool(
    "core_probe_service_mesh",
    {
      description: "Probes live service HTTP/TCP health, measures Service-Mesh link latency between two ports, or deploys a custom microservice (python_http, static_webui, sqlite_rest) on a Muscle node.",
      inputSchema: {
        type: "object",
        required: ["action"],
        properties: {
          action: { type: "string", enum: ["probe_service", "probe_link", "deploy_custom_service"], description: "Service mesh action." },
          node_id: { type: "string", description: "Optional target Muscle Peer ID." },
          service_id: { type: "string", description: "Service ID for probe_service." },
          port: { type: "integer", description: "Port for probe_service or deploy_custom_service." },
          from_service_id: { type: "string", description: "Source service ID for probe_link." },
          to_service_id: { type: "string", description: "Target service ID for probe_link." },
          from_port: { type: "integer", description: "Source port for probe_link." },
          to_port: { type: "integer", description: "Target port for probe_link." },
          protocol: { type: "string", description: "Protocol label for probe_link." },
          name: { type: "string", description: "Microservice display name for deploy_custom_service." },
          category: { type: "string", enum: ["webui", "backend", "database"], description: "Microservice category." },
          runtime: { type: "string", enum: ["python_http", "static_webui", "sqlite_rest"], description: "Microservice runtime template." },
          description: { type: "string", description: "Optional service description." },
        },
      },
      annotations: { title: "Probe Service Mesh Health & Deploy Custom Microservice", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args: Record<string, unknown>) => {
      try {
        return await runMcpToolAction("core_probe_service_mesh", { action: args.action, node_id: args.node_id, service_id: args.service_id, port: args.port, runtime: args.runtime });
      } catch (err) {
        return { isError: true, error: String(err) };
      }
    }
  );

  server.registerTool(
    "core_manage_blueprint",
    {
      description: "Lists, deploys, or undeploys official 1-Click Stack Blueprints on a Muscle node with automatic secret generation and Pre-Flight Time-Machine Checkpoint.",
      inputSchema: {
        type: "object",
        required: ["action"],
        properties: {
          action: { type: "string", enum: ["list", "deploy", "undeploy"], description: "Blueprint action." },
          node_id: { type: "string", description: "Optional target Muscle Peer ID." },
          blueprint_id: { type: "string", description: "Blueprint ID for deploy or undeploy." },
        },
      },
      annotations: { title: "Deploy or Undeploy Official 1-Click Stack Blueprints", readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    async (args: Record<string, unknown>) => {
      try {
        return await runMcpToolAction("core_manage_blueprint", { action: args.action, node_id: args.node_id, blueprint_id: args.blueprint_id });
      } catch (err) {
        return { isError: true, error: String(err) };
      }
    }
  );

  server.registerTool(
    "core_manage_domain_tls",
    {
      description: "Manages Custom Domain & Auto-TLS Reverse-Proxy bindings (list, bind, unbind) in Domains.json.",
      inputSchema: {
        type: "object",
        required: ["action"],
        properties: {
          action: { type: "string", enum: ["list", "bind", "unbind"], description: "Domain TLS action." },
          node_id: { type: "string", description: "Optional target Muscle Peer ID." },
          service_id: { type: "string", description: "Service ID to bind/unbind." },
          port: { type: "integer", description: "Target service port." },
          domain: { type: "string", description: "Custom domain name (e.g. api.example.com)." },
          auto_tls: { type: "boolean", description: "Whether to issue automatic TLS." },
        },
      },
      annotations: { title: "Manage Custom Domain & Auto-TLS Reverse Proxy Bindings", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args: Record<string, unknown>) => {
      try {
        return await runMcpToolAction("core_manage_domain_tls", { action: args.action, node_id: args.node_id, service_id: args.service_id, port: args.port, domain: args.domain, auto_tls: args.auto_tls });
      } catch (err) {
        return { isError: true, error: String(err) };
      }
    }
  );

  server.registerTool(
    "core_system_ota_status",
    {
      description: "Returns the OTA System Update status including SYNAPSE_VERSION, Git commit sync, and Core/Muscle binary SHA-256 verification.",
      inputSchema: {
        type: "object",
        properties: {
          inspect_nodes: { type: "boolean", description: "If true, probes connected Muscle nodes for installed binary SHA-256." },
        },
      },
      annotations: { title: "Inspect OTA System Update & Binary SHA-256 Status", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args: Record<string, unknown>) => {
      try {
        return await readMcpToolResult("core_system_ota_status", { inspect_nodes: args.inspect_nodes });
      } catch (err) {
        return { isError: true, error: String(err) };
      }
    }
  );

  server.registerTool(
    "core_manage_firewall",
    {
      description: "Manages Synapse Shield firewall policy on a Muscle node (inspect, toggle_port_shield, apply_profile, add_ip_rule, remove_ip_rule) with automatic Pre-Flight Time-Machine Checkpoint.",
      inputSchema: {
        type: "object",
        required: ["action"],
        properties: {
          action: { type: "string", enum: ["inspect", "toggle_port_shield", "apply_profile", "add_ip_rule", "remove_ip_rule"], description: "Firewall management action." },
          node_id: { type: "string", description: "Optional target Muscle Peer ID." },
          port: { type: "integer", description: "Port number for toggle_port_shield or add_ip_rule." },
          shielded: { type: "boolean", description: "Optional explicit shield state for toggle_port_shield." },
          profile: { type: "string", enum: ["web_standard", "synapse_stealth", "zero_trust_tunnel", "paranoid_lockdown", "custom"], description: "Security profile for apply_profile." },
          ip_or_cidr: { type: "string", description: "IPv4/IPv6 or CIDR for add_ip_rule." },
          rule_action: { type: "string", enum: ["allow", "block"], description: "IP rule action." },
          rule_id: { type: "string", description: "IP rule ID for remove_ip_rule." },
          note: { type: "string", description: "Optional IP rule note." },
        },
      },
      annotations: { title: "Manage Synapse Shield Firewall Policy", readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (args: Record<string, unknown>) => {
      try {
        return await runMcpToolAction("core_manage_firewall", { action: args.action, node_id: args.node_id, port: args.port, profile: args.profile, ip_or_cidr: args.ip_or_cidr });
      } catch (err) {
        return { isError: true, error: String(err) };
      }
    }
  );

  server.registerTool(
    "core_manage_cartridges",
    {
      description: "Lists, toggles, activates, or deactivates modular AI Rule Cartridges (e.g. docker-first, zero-trust-networking, native-systemd) on the active project.",
      inputSchema: {
        type: "object",
        required: ["action"],
        properties: {
          action: { type: "string", enum: ["list", "toggle", "activate", "deactivate"], description: "Cartridge action." },
          cartridge_id: { type: "string", description: "Cartridge ID for toggle, activate, or deactivate." },
        },
      },
      annotations: { title: "Manage Modular AI Rule Cartridges", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args: Record<string, unknown>) => {
      try {
        return await runMcpToolAction("core_manage_cartridges", { action: args.action, cartridge_id: args.cartridge_id });
      } catch (err) {
        return { isError: true, error: String(err) };
      }
    }
  );

  server.registerTool(
    "core_manage_cluster_nodes",
    {
      description: "Lists live Muscle nodes, generates one-time CSR join tokens, or assigns/unassigns Muscle nodes to the active project.",
      inputSchema: {
        type: "object",
        required: ["action"],
        properties: {
          action: { type: "string", enum: ["list", "create_join_token", "assign_node", "unassign_node"], description: "Cluster node action." },
          node_id: { type: "string", description: "Muscle Node ID for assign_node or unassign_node." },
          tier: { type: "string", enum: ["TIER_1_UNLEASHED", "TIER_2_WORKSPACE_JAIL", "TIER_3_SUPERVISED"], description: "Autonomy Tier for create_join_token." },
          ttl_minutes: { type: "integer", description: "Token validity in minutes (default 30)." },
        },
      },
      annotations: { title: "Manage Muscle Cluster Nodes & Join Tokens", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args: Record<string, unknown>) => {
      try {
        return await runMcpToolAction("core_manage_cluster_nodes", { action: args.action, node_id: args.node_id, tier: args.tier, ttl_minutes: args.ttl_minutes });
      } catch (err) {
        return { isError: true, error: String(err) };
      }
    }
  );

  server.registerTool(
    "core_manage_projects",
    {
      description: "Lists all Synapse project workspaces, creates a new project workspace, toggles planning_only mode, or retrieves recent Audit.jsonl entries.",
      inputSchema: {
        type: "object",
        required: ["action"],
        properties: {
          action: { type: "string", enum: ["list", "create", "set_planning_only", "audit_trail"], description: "Project workspace management action." },
          name: { type: "string", description: "New project name when action is create." },
          planning_only: { type: "boolean", description: "Planning-Only guardrail state when action is set_planning_only." },
          limit: { type: "integer", description: "Max audit log entries to return for audit_trail (default 20)." },
        },
      },
      annotations: { title: "Manage Multi-Project Workspaces & Audit Trail", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args: Record<string, unknown>) => {
      try {
        return await runMcpToolAction("core_manage_projects", { action: args.action, name: args.name, planning_only: args.planning_only, limit: args.limit });
      } catch (err) {
        return { isError: true, error: String(err) };
      }
    }
  );

  server.registerTool(
    "core_run_platform_self_test",
    {
      description: "Executes the full 6-stage Synapse Platform Diagnostic Self-Test (Vault R/W, AES-256-GCM Secrets, Cartridges/GitOps/Cron, Self-Healing/Checkpoints/Backups/MCP Registry, Core Gateway PKI, and Muscle Tunnel) or toggles verbose debug tracing.",
      inputSchema: {
        type: "object",
        required: ["action"],
        properties: {
          action: { type: "string", enum: ["self_test", "toggle_debug"], description: "Diagnostic action (self_test or toggle_debug)." },
          enabled: { type: "boolean", description: "Optional explicit debug state when action is toggle_debug." },
        },
      },
      annotations: { title: "Run 6-Stage Synapse Platform Diagnostic Self-Test", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args: Record<string, unknown>) => {
      try {
        return await readMcpToolResult("core_run_platform_self_test", { action: args.action, enabled: args.enabled });
      } catch (err) {
        return { isError: true, error: String(err) };
      }
    }
  );

  server.registerTool(
    "core_manage_playbooks",
    {
      description: "Manages scheduled AI Playbooks (list, upsert, delete) and custom AI Rule Cartridges (create_custom_cartridge, delete_custom_cartridge) in the active project.",
      inputSchema: {
        type: "object",
        required: ["action"],
        properties: {
          action: { type: "string", enum: ["list", "upsert", "delete", "create_custom_cartridge", "delete_custom_cartridge"], description: "Playbook or custom cartridge action." },
          playbook_id: { type: "string", description: "Playbook ID for upsert or delete." },
          name: { type: "string", description: "Playbook or custom cartridge title." },
          cron_expression: { type: "string", description: "5-field cron schedule for upsert (default 0 3 * * *)." },
          prompt: { type: "string", description: "Autonomous AI prompt for upsert." },
          target_node_id: { type: "string", description: "Optional target Muscle Peer ID for upsert." },
          enabled: { type: "boolean", description: "Whether the scheduled playbook is enabled." },
          cartridge_id: { type: "string", description: "Custom cartridge ID for delete_custom_cartridge." },
          category: { type: "string", description: "Category for create_custom_cartridge." },
          description: { type: "string", description: "Description for create_custom_cartridge." },
          content: { type: "string", description: "Markdown rule content for create_custom_cartridge." },
        },
      },
      annotations: { title: "Manage Scheduled AI Playbooks & Custom Cartridges", readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (args: Record<string, unknown>) => {
      try {
        return await runMcpToolAction("core_manage_playbooks", { action: args.action, playbook_id: args.playbook_id, name: args.name, prompt: args.prompt });
      } catch (err) {
        return { isError: true, error: String(err) };
      }
    }
  );

  server.registerTool(
    "core_manage_approvals",
    {
      description: "Lists pending TIER_3_SUPERVISED tool approvals or approves/rejects a pending approval request.",
      inputSchema: {
        type: "object",
        required: ["action"],
        properties: {
          action: { type: "string", enum: ["list", "approve", "reject"], description: "Approval action (list, approve, or reject)." },
          approval_id: { type: "string", description: "Approval ID when action is approve or reject." },
        },
      },
      annotations: { title: "Manage Tier-3 Supervised Execution Approvals", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args: Record<string, unknown>) => {
      try {
        return await runMcpToolAction("core_manage_approvals", { action: args.action, approval_id: args.approval_id });
      } catch (err) {
        return { isError: true, error: String(err) };
      }
    }
  );

  server.registerTool(
    "core_invoke_service_action",
    {
      description: "Invokes an HTTP REST request (GET, POST, PUT, DELETE) via the mTLS Reverse Proxy or executes a SQL query against a service's SQLite database on a Muscle node.",
      inputSchema: {
        type: "object",
        required: ["port", "method"],
        properties: {
          node_id: { type: "string", description: "Optional target Muscle Peer ID." },
          port: { type: "integer", description: "Target service port (default 3000)." },
          method: { type: "string", enum: ["GET", "POST", "PUT", "DELETE", "SQL"], description: "HTTP method or SQL." },
          path: { type: "string", description: "URL path (e.g. /health) or SQLite .db path." },
          payload: { type: "string", description: "Optional JSON body or SQL query." },
        },
      },
      annotations: { title: "Invoke Service REST Endpoint or SQLite Query", readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    async (args: Record<string, unknown>) => {
      try {
        return await runMcpToolAction("core_invoke_service_action", { node_id: args.node_id, port: args.port, method: args.method, path: args.path, payload: args.payload });
      } catch (err) {
        return { isError: true, error: String(err) };
      }
    }
  );

  server.registerTool(
    "core_manage_auth_and_ai",
    {
      description: "Inspects WebUI RBAC & 2FA protection status, revokes active WebUI sessions, or configures the project AI Provider endpoint (provider, base_url, model, prompt caching, auto-watchdog).",
      inputSchema: {
        type: "object",
        required: ["action"],
        properties: {
          action: { type: "string", enum: ["inspect_auth", "revoke_sessions", "configure_ai_endpoint"], description: "Auth or AI endpoint action." },
          provider: { type: "string", description: "AI provider (openai-compatible, anthropic, ollama) for configure_ai_endpoint." },
          base_url: { type: "string", description: "LLM API base URL for configure_ai_endpoint." },
          model: { type: "string", description: "Model ID for configure_ai_endpoint." },
          api_key_secret_name: { type: "string", description: "Vault secret key name for configure_ai_endpoint." },
          enable_prompt_caching: { type: "boolean", description: "Enable prompt caching." },
          enable_auto_watchdog: { type: "boolean", description: "Enable autonomous watchdog." },
        },
      },
      annotations: { title: "Manage WebUI RBAC/2FA & AI Provider Endpoint", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args: Record<string, unknown>) => {
      try {
        return await runMcpToolAction("core_manage_auth_and_ai", { action: args.action, provider: args.provider, base_url: args.base_url, model: args.model });
      } catch (err) {
        return { isError: true, error: String(err) };
      }
    }
  );

  server.registerTool(
    "core_manage_topology_bundle",
    {
      description: "Exports or imports the complete declarative project topology bundle (synapse-stack/v2.0: services, mesh links, cartridges, playbooks, cron jobs, custom domains, secret key names) with an automatic Pre-Flight Time-Machine Checkpoint on import.",
      inputSchema: {
        type: "object",
        required: ["action"],
        properties: {
          action: { type: "string", enum: ["export", "import"], description: "Topology bundle action (export or import)." },
          node_id: { type: "string", description: "Optional target Muscle Peer ID." },
          bundle: { type: "object", description: "Declarative topology bundle object or JSON string when action is import." },
        },
      },
      annotations: { title: "Export or Import Declarative Topology Bundle", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args: Record<string, unknown>) => {
      try {
        return await runMcpToolAction("core_manage_topology_bundle", { action: args.action, node_id: args.node_id, bundle: args.bundle });
      } catch (err) {
        return { isError: true, error: String(err) };
      }
    }
  );

  server.registerTool(
    "core_cluster_canary_exec",
    {
      description: "Executes a staged Multi-Node Canary Rollout or verifies fleet health across all assigned Muscle nodes with automatic Pre-Flight Time-Machine Checkpoint and instant canary abort on non-zero exit code.",
      inputSchema: {
        type: "object",
        required: ["action"],
        properties: {
          action: { type: "string", enum: ["canary_rollout", "verify_fleet_health"], description: "Cluster canary action." },
          command: { type: "string", description: "Command to execute in staged canary mode." },
          node_ids: { type: "array", items: { type: "string" }, description: "Optional explicit list of Muscle Node IDs." },
        },
      },
      annotations: { title: "Execute Staged Multi-Node Canary Rollout", readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    async (args: Record<string, unknown>) => {
      try {
        return await runMcpToolAction("core_cluster_canary_exec", { action: args.action, command: args.command, node_ids: args.node_ids });
      } catch (err) {
        return { isError: true, error: String(err) };
      }
    }
  );

  server.registerTool(
    "core_manage_mcp_keys",
    {
      description: "Lists, creates (with SHA-256 hashing and read/execute/admin scopes), or revokes External AI / Model Context Protocol (MCP) API tokens for the active project.",
      inputSchema: {
        type: "object",
        required: ["action"],
        properties: {
          action: { type: "string", enum: ["list", "create", "revoke"], description: "MCP API key lifecycle action." },
          name: { type: "string", description: "Display label when action is create." },
          scopes: { type: "array", items: { type: "string", enum: ["read", "execute", "admin"] }, description: "Token permission scopes when action is create." },
          key_id: { type: "string", description: "MCP Key ID when action is revoke." },
        },
      },
      annotations: { title: "Manage External AI / MCP API Keys", readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    },
    async (args: Record<string, unknown>) => {
      try {
        return await runMcpToolAction("core_manage_mcp_keys", { action: args.action, name: args.name, scopes: args.scopes, key_id: args.key_id });
      } catch (err) {
        return { isError: true, error: String(err) };
      }
    }
  );

  server.registerTool(
    "synapse_list_peers",
    {
      description: "List all connected Axon Muscle peers, their live CPU/RAM/Disk telemetry, Autonomy Tiers, IP addresses, and active PTY sessions.",
      inputSchema: {
        type: "object",
        properties: {
          project_id: { type: "string", description: "Optional project ID (defaults to active workspace)" },
        },
      },
      annotations: { title: "List Connected Axon Muscle Peers", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args: Record<string, unknown>) => {
      try {
        return await readMcpToolResult("synapse_list_peers", { project_id: args.project_id });
      } catch (err) {
        return { isError: true, error: String(err) };
      }
    }
  );

  server.registerTool(
    "synapse_get_project_state",
    {
      description: "Read the complete Synapse Project Brain Vault state (State.json, Architecture.md, Memory.md, active Rule Cartridges, and Secret Key names).",
      inputSchema: {
        type: "object",
        properties: {
          project_id: { type: "string", description: "Optional project ID (defaults to active workspace)" },
        },
      },
      annotations: { title: "Read Project Brain Vault State", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args: Record<string, unknown>) => {
      try {
        return await readMcpToolResult("synapse_get_project_state", { project_id: args.project_id });
      } catch (err) {
        return { isError: true, error: String(err) };
      }
    }
  );

  server.registerTool(
    "synapse_create_join_token",
    {
      description: "Generate a one-time mTLS CSR join token and ready-to-run 'install.sh' + 'axon switch' CLI commands to enroll or rebind a Linux Muscle server.",
      inputSchema: {
        type: "object",
        properties: {
          tier: { type: "string", enum: ["TIER_1_UNLEASHED", "TIER_2_WORKSPACE_JAIL", "TIER_3_SUPERVISED"], description: "Autonomy Tier for the Muscle peer" },
          ttl_minutes: { type: "number", description: "Token validity in minutes (default 30)" },
        },
      },
      annotations: { title: "Generate Muscle Enrollment Join Token", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (args: Record<string, unknown>) => {
      try {
        return await runMcpToolAction("synapse_create_join_token", { tier: args.tier, ttl_minutes: args.ttl_minutes });
      } catch (err) {
        return { isError: true, error: String(err) };
      }
    }
  );

  server.registerTool(
    "synapse_rollback_snapshot",
    {
      description: "Restore a remote file on a Muscle peer to a previous pre-write snapshot ID.",
      inputSchema: {
        type: "object",
        required: ["snapshot_id"],
        properties: {
          snapshot_id: { type: "string", description: "Snapshot ID to restore" },
        },
      },
      annotations: { title: "Rollback File to Pre-Write Snapshot", readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (args: Record<string, unknown>) => {
      try {
        return await runMcpToolAction("synapse_rollback_snapshot", { snapshot_id: args.snapshot_id });
      } catch (err) {
        return { isError: true, error: String(err) };
      }
    }
  );
}
