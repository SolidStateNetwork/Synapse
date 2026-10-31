export const EXTENDED_SYNAPSE_TOOL_SCHEMAS = [
  {
    type: "function",
    function: {
      name: "core_hot_reload_service_code",
      description:
        "Inspects or hot-reloads the live source code of a running microservice on a Muscle node with Python syntax validation, Pre-Flight Time-Machine Checkpoint, and zero-downtime restart.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["inspect", "hot_reload"], description: "Inspect or hot_reload service code." },
          node_id: { type: "string", description: "Optional target Muscle Peer ID." },
          service_id: { type: "string", description: "Service ID (e.g. svc-4050)." },
          port: { type: "integer", description: "Service port number." },
          file_path: { type: "string", description: "Optional remote script path." },
          code: { type: "string", description: "New source code when action is hot_reload." },
        },
        required: ["action", "port"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "core_sqlite_studio",
      description:
        "Inspects SQLite database tables, executes custom SQL queries, or inserts rows on a Muscle node over the mTLS PTY tunnel.",
      parameters: {
        type: "object",
        properties: {
          node_id: { type: "string", description: "Optional target Muscle Peer ID." },
          db_path: { type: "string", description: "Optional SQLite database file path." },
          table: { type: "string", description: "Optional table name to inspect or insert into." },
          custom_sql: { type: "string", description: "Optional SQL query to execute." },
          insert_row: { type: "object", description: "Optional key-value row object to insert." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "core_manage_cron_jobs",
      description:
        "Manages scheduled Cron-Runbooks (list, save, delete, run_now) in CronJobs.json and executes individual runbooks on a Muscle node.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["list", "save", "delete", "run_now"], description: "Cron-Runbook action." },
          node_id: { type: "string", description: "Optional target Muscle Peer ID." },
          id: { type: "string", description: "Cron job ID for save, delete, or run_now." },
          name: { type: "string", description: "Runbook title when action is save." },
          cron_expression: { type: "string", description: "5-field cron schedule (e.g. */15 * * * *)." },
          command: { type: "string", description: "Bash command when action is save." },
          enabled: { type: "boolean", description: "Whether the Cron-Runbook is enabled." },
        },
        required: ["action"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "core_manage_self_healing",
      description:
        "Manages Autonomous Self-Healing & Chaos-Resilience policies and triggers immediate service recovery or MTTR crash simulation on a Muscle node.",
      parameters: {
        type: "object",
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
        required: ["action"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "core_probe_service_mesh",
      description:
        "Probes live service HTTP/TCP health, measures Service-Mesh link latency between two ports, or deploys a custom microservice (python_http, static_webui, sqlite_rest) on a Muscle node.",
      parameters: {
        type: "object",
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
        required: ["action"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "core_manage_blueprint",
      description:
        "Lists, deploys, or undeploys official 1-Click Stack Blueprints on a Muscle node with automatic secret generation and Pre-Flight Time-Machine Checkpoint.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["list", "deploy", "undeploy"], description: "Blueprint action." },
          node_id: { type: "string", description: "Optional target Muscle Peer ID." },
          blueprint_id: { type: "string", description: "Blueprint ID for deploy or undeploy." },
        },
        required: ["action"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "core_manage_domain_tls",
      description:
        "Manages Custom Domain & Auto-TLS Reverse-Proxy bindings (list, bind, unbind) in Domains.json.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["list", "bind", "unbind"], description: "Domain TLS action." },
          node_id: { type: "string", description: "Optional target Muscle Peer ID." },
          service_id: { type: "string", description: "Service ID to bind/unbind." },
          port: { type: "integer", description: "Target service port." },
          domain: { type: "string", description: "Custom domain name (e.g. api.example.com)." },
          auto_tls: { type: "boolean", description: "Whether to issue automatic TLS." },
        },
        required: ["action"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "core_system_ota_status",
      description: "Returns the OTA System Update status including SYNAPSE_VERSION, Git commit sync, and Core/Muscle binary SHA-256 verification.",
      parameters: {
        type: "object",
        properties: {
          inspect_nodes: { type: "boolean", description: "If true, probes connected Muscle nodes for installed binary SHA-256." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "core_manage_firewall",
      description: "Manages Synapse Shield firewall policy on a Muscle node (inspect, toggle_port_shield, apply_profile, add_ip_rule, remove_ip_rule) with automatic Pre-Flight Time-Machine Checkpoint.",
      parameters: {
        type: "object",
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
        required: ["action"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "core_manage_cartridges",
      description: "Lists, toggles, activates, or deactivates modular AI Rule Cartridges (e.g. docker-first, zero-trust-networking, native-systemd) on the active project.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["list", "toggle", "activate", "deactivate"], description: "Cartridge action." },
          cartridge_id: { type: "string", description: "Cartridge ID for toggle, activate, or deactivate." },
        },
        required: ["action"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "core_manage_cluster_nodes",
      description: "Lists live Muscle nodes, generates one-time CSR join tokens, or assigns/unassigns Muscle nodes to the active project.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["list", "create_join_token", "assign_node", "unassign_node"], description: "Cluster node action." },
          node_id: { type: "string", description: "Muscle Node ID for assign_node or unassign_node." },
          tier: { type: "string", enum: ["TIER_1_UNLEASHED", "TIER_2_WORKSPACE_JAIL", "TIER_3_SUPERVISED"], description: "Autonomy Tier for create_join_token." },
          ttl_minutes: { type: "integer", description: "Token validity in minutes (default 30)." },
        },
        required: ["action"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "core_manage_projects",
      description: "Lists all Synapse project workspaces, creates a new project workspace, toggles planning_only mode, or retrieves recent Audit.jsonl entries.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["list", "create", "set_planning_only", "audit_trail"], description: "Project workspace management action." },
          name: { type: "string", description: "New project name when action is create." },
          planning_only: { type: "boolean", description: "Planning-Only guardrail state when action is set_planning_only." },
          limit: { type: "integer", description: "Max audit log entries to return for audit_trail (default 20)." },
        },
        required: ["action"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "core_run_platform_self_test",
      description: "Executes the full 6-stage Synapse Platform Diagnostic Self-Test (Vault R/W, AES-256-GCM Secrets, Cartridges/GitOps/Cron, Self-Healing/Checkpoints/Backups/MCP Registry, Core Gateway PKI, and Muscle Tunnel) or toggles verbose debug tracing.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["self_test", "toggle_debug"], description: "Diagnostic action (self_test or toggle_debug)." },
          enabled: { type: "boolean", description: "Optional explicit debug state when action is toggle_debug." },
        },
        required: ["action"],
      },
    },
  },
];
