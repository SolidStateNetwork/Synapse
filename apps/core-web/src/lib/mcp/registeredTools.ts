import { interceptAndExecuteTool, SYNAPSE_TOOL_SCHEMAS } from "@/lib/orchestrator";
import { registerExtendedMcpTools } from "./registeredExtendedTools";

export interface McpToolAnnotations {
  title: string;
  readOnlyHint: boolean;
  destructiveHint: boolean;
  idempotentHint: boolean;
  openWorldHint: boolean;
}

export interface McpToolRegistrationConfig {
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: McpToolAnnotations;
}

export type McpToolHandler = (args: Record<string, unknown>, projectId?: string) => Promise<unknown>;
export type ReadMcpToolFn = (toolName: string, args: Record<string, unknown>, projectId?: string) => Promise<unknown>;
export type RunMcpToolFn = (toolName: string, args: Record<string, unknown>, projectId?: string) => Promise<unknown>;

export interface RegisteredMcpToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: McpToolAnnotations;
  handler: McpToolHandler;
}

export class McpToolServerRegistrar {
  public readonly registry = new Map<string, RegisteredMcpToolDefinition>();

  public registerTool(name: string, config: McpToolRegistrationConfig, handler: McpToolHandler): void {
    this.registry.set(name, {
      name,
      description: config.description,
      inputSchema: config.inputSchema,
      annotations: {
        title: config.annotations.title || name,
        readOnlyHint: Boolean(config.annotations.readOnlyHint),
        destructiveHint: Boolean(config.annotations.destructiveHint),
        idempotentHint: Boolean(config.annotations.idempotentHint),
        openWorldHint: Boolean(config.annotations.openWorldHint),
      },
      handler,
    });
  }
}

const readMcpToolResult: ReadMcpToolFn = async (toolName, args, projectId = "default-project") =>
  await interceptAndExecuteTool(projectId, toolName, args);

const runMcpToolAction: RunMcpToolFn = async (toolName, args, projectId = "default-project") =>
  await interceptAndExecuteTool(projectId, toolName, args);

export function registerCoreMcpTools(server: McpToolServerRegistrar): void {
  server.registerTool(
    "core_update_brain_doc",
    {
      description: "Updates project documentation in the 4-Document SolidState Brain Vault Lexicon (Architecture.md, Memory.md [BB-XXX], Milestones.md, or AGENTS.md) with automatic Zero-Secret and Public Clean-Room sanitization, or syncs all 4 Lexicon docs directly to the Muscle Node workspace (mode='sync_lexicon_to_node').",
      inputSchema: {
        type: "object",
        required: ["mode"],
        properties: {
          document: { type: "string", enum: ["Architecture.md", "Memory.md", "Milestones.md", "AGENTS.md"] },
          mode: { type: "string", enum: ["replace_section", "append", "overwrite_full", "overwrite", "sync_lexicon_to_node"] },
          section_header: { type: "string" },
          content: { type: "string" },
          node_id: { type: "string" },
        },
      },
      annotations: { title: "Update Brain Lexicon Document", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args: Record<string, unknown>) => {
      try {
        return await runMcpToolAction("core_update_brain_doc", { document: args.document, mode: args.mode, section_header: args.section_header, content: args.content, node_id: args.node_id });
      } catch (err) {
        return { isError: true, error: String(err) };
      }
    }
  );

  server.registerTool(
    "core_register_service",
    {
      description: "Registers, updates, or removes a service running on a Connector in State.json and activates real-time health monitoring and Live-Preview tunneling.",
      inputSchema: {
        type: "object",
        required: ["service_id", "node_id"],
        properties: {
          action: { type: "string", enum: ["upsert", "remove"], default: "upsert" },
          service_id: { type: "string" },
          node_id: { type: "string" },
          name: { type: "string" },
          category: { type: "string", enum: ["webui", "backend", "database", "worker"] },
          description: { type: "string" },
          db_path: { type: "string" },
          runtime: { type: "string", enum: ["docker", "systemd", "pm2", "binary"] },
          unit_or_container: { type: "string" },
          bind_address: { type: "string" },
          port: { type: "integer" },
          enable_preview_tunnel: { type: "boolean" },
          auto_heal: { type: "boolean" },
        },
      },
      annotations: { title: "Register Live-Preview Service Endpoint", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args: Record<string, unknown>) => {
      try {
        return await runMcpToolAction("core_register_service", { action: args.action, service_id: args.service_id, node_id: args.node_id, name: args.name, port: args.port });
      } catch (err) {
        return { isError: true, error: String(err) };
      }
    }
  );

  server.registerTool(
    "core_manage_secret",
    {
      description: "Generates or stores a secret inside the encrypted Core Vault (Secrets.enc) without exposing plaintext in logs or LLM context.",
      inputSchema: {
        type: "object",
        required: ["action", "key"],
        properties: {
          action: { type: "string", enum: ["generate_random", "set_value", "set", "delete", "list"] },
          key: { type: "string" },
          value: { type: "string" },
          length: { type: "integer", default: 32 },
        },
      },
      annotations: { title: "Manage AES-256-GCM Encrypted Secrets", readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (args: Record<string, unknown>) => {
      try {
        return await runMcpToolAction("core_manage_secret", { action: args.action, key: args.key, value: args.value, length: args.length });
      } catch (err) {
        return { isError: true, error: String(err) };
      }
    }
  );

  server.registerTool(
    "node_pty_exec",
    {
      description: "Executes a shell command in a persistent PTY session on an assigned Connector. Working directory and environment variables persist across calls.",
      inputSchema: {
        type: "object",
        required: ["node_id", "session_id", "command"],
        properties: {
          node_id: { type: "string" },
          session_id: { type: "string" },
          command: { type: "string" },
          inject_secret_keys: { type: "array", items: { type: "string" } },
          wait_timeout_ms: { type: "integer", default: 30000 },
          send_signal: { type: "string", enum: ["NONE", "SIGINT", "SIGTERM", "SIGKILL"], default: "NONE" },
        },
      },
      annotations: { title: "Execute Command in Persistent Stateful PTY", readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    async (args: Record<string, unknown>) => {
      try {
        return await runMcpToolAction("node_pty_exec", { node_id: args.node_id, session_id: args.session_id, command: args.command, wait_timeout_ms: args.wait_timeout_ms });
      } catch (err) {
        return { isError: true, error: String(err) };
      }
    }
  );

  server.registerTool(
    "node_fs_operation",
    {
      description: "Direct, atomic filesystem operations on a Connector over the mTLS stream (faster and safer than echo/cat over the shell).",
      inputSchema: {
        type: "object",
        required: ["node_id", "operation", "path"],
        properties: {
          node_id: { type: "string" },
          operation: { type: "string", enum: ["read_file", "write_file", "apply_unified_diff", "list_dir", "stat", "delete"] },
          path: { type: "string" },
          content_or_patch: { type: "string" },
          file_mode: { type: "string", default: "0644" },
        },
      },
      annotations: { title: "Execute Remote Atomic Filesystem Operation", readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (args: Record<string, unknown>) => {
      try {
        return await runMcpToolAction("node_fs_operation", { node_id: args.node_id, operation: args.operation, path: args.path, content_or_patch: args.content_or_patch, file_mode: args.file_mode });
      } catch (err) {
        return { isError: true, error: String(err) };
      }
    }
  );

  server.registerTool(
    "core_link_peers",
    {
      description: "Creates or removes a secure Peer-to-Peer Mesh Tunnel between two Muscle Nodes (e.g. connecting a web node on 127.0.0.1:5432 to a database node's port 5432 without exposing public firewall ports).",
      inputSchema: {
        type: "object",
        required: ["source_node_id", "target_node_id", "remote_port"],
        properties: {
          action: { type: "string", enum: ["upsert", "remove"], default: "upsert" },
          source_node_id: { type: "string" },
          target_node_id: { type: "string" },
          local_port: { type: "integer" },
          remote_port: { type: "integer" },
          protocol: { type: "string", enum: ["tcp", "http"], default: "tcp" },
          description: { type: "string" },
        },
      },
      annotations: { title: "Manage Inter-Node Peer Mesh Links", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args: Record<string, unknown>) => {
      try {
        return await runMcpToolAction("core_link_peers", { action: args.action, source_node_id: args.source_node_id, target_node_id: args.target_node_id, local_port: args.local_port, remote_port: args.remote_port });
      } catch (err) {
        return { isError: true, error: String(err) };
      }
    }
  );

  server.registerTool(
    "node_deep_search",
    {
      description: "Performs advanced, structured Senior DevOps searches and deep forensic inspections on an assigned Muscle Node. Supports 6 specialized search modes: 'content_grep', 'file_find', 'log_scan', 'process_and_port_map', 'sqlite_inspect', and 'security_forensics'.",
      inputSchema: {
        type: "object",
        required: ["node_id", "search_mode"],
        properties: {
          node_id: { type: "string" },
          search_mode: { type: "string", enum: ["content_grep", "file_find", "log_scan", "process_and_port_map", "sqlite_inspect", "security_forensics"] },
          query: { type: "string" },
          target_dir: { type: "string" },
          file_glob: { type: "string" },
          context_lines: { type: "integer", default: 2 },
        },
      },
      annotations: { title: "Run Senior DevOps Deep Forensic Search on Muscle", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args: Record<string, unknown>) => {
      try {
        return await readMcpToolResult("node_deep_search", { node_id: args.node_id, search_mode: args.search_mode, query: args.query, target_dir: args.target_dir });
      } catch (err) {
        return { isError: true, error: String(err) };
      }
    }
  );

  server.registerTool(
    "core_vault_search",
    {
      description: "Searches the entire Synapse Core Brain Vault (State.json, Architecture.md, Memory.md, Milestones.md, AGENTS.md, Audit.jsonl history, Registered Services & Endpoints, Rule Cartridges, and Secret Key names) for any keyword, port, service, or configuration.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string" },
          scope: { type: "string", enum: ["all", "architecture", "memory", "milestones", "agents", "services", "audit", "cartridges"], default: "all" },
        },
      },
      annotations: { title: "Search Brain Vault Documents, Audit & History", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args: Record<string, unknown>) => {
      try {
        return await readMcpToolResult("core_vault_search", { query: args.query, scope: args.scope });
      } catch (err) {
        return { isError: true, error: String(err) };
      }
    }
  );

  server.registerTool(
    "node_firewall_control",
    {
      description: "Inspects or configures the Synapse Firewall & Port-Shield on a Linux Muscle server with built-in Anti-Lockout (protects SSH & Synapse Tunnel) and 15-second Dead-Man's Switch Rollback.",
      inputSchema: {
        type: "object",
        required: ["action"],
        properties: {
          node_id: { type: "string" },
          action: { type: "string", enum: ["inspect", "set_profile", "shield_port", "unshield_port", "add_ip_rule", "remove_ip_rule"], default: "inspect" },
          profile: { type: "string", enum: ["web_standard", "synapse_stealth", "custom"] },
          port: { type: "integer" },
          ip_or_cidr: { type: "string" },
          rule_action: { type: "string", enum: ["allow", "block"] },
          note: { type: "string" },
          rule_id: { type: "string" },
        },
      },
      annotations: { title: "Control Synapse Firewall & Port-Shield on Muscle", readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (args: Record<string, unknown>) => {
      try {
        return await runMcpToolAction("node_firewall_control", { node_id: args.node_id, action: args.action, profile: args.profile, port: args.port, ip_or_cidr: args.ip_or_cidr });
      } catch (err) {
        return { isError: true, error: String(err) };
      }
    }
  );

  server.registerTool(
    "core_deploy_git_stack",
    {
      description: "Clones or pulls a Git repository onto a Linux Muscle server, injects decrypted secrets from Secrets.enc into a 0600 .env file, executes docker compose up -d --build, and registers the stack service in State.json.",
      inputSchema: {
        type: "object",
        required: ["name", "repo_url", "port"],
        properties: {
          name: { type: "string" },
          repo_url: { type: "string" },
          branch: { type: "string" },
          port: { type: "integer" },
          node_id: { type: "string" },
          compose_path: { type: "string" },
          start_command: { type: "string" },
        },
      },
      annotations: { title: "Deploy GitOps Repository Stack on Muscle", readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    async (args: Record<string, unknown>) => {
      try {
        return await runMcpToolAction("core_deploy_git_stack", { name: args.name, repo_url: args.repo_url, branch: args.branch, port: args.port, node_id: args.node_id });
      } catch (err) {
        return { isError: true, error: String(err) };
      }
    }
  );

  server.registerTool(
    "core_delete_git_stack",
    {
      description: "Tears down a deployed GitOps stack on a Muscle node (docker compose down, cleans up the stack directory, and removes it from GitStacks.json and State.json).",
      inputSchema: {
        type: "object",
        required: ["stack_id"],
        properties: { stack_id: { type: "string" } },
      },
      annotations: { title: "Tear Down Deployed GitOps Stack on Muscle", readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (args: Record<string, unknown>) => {
      try {
        return await runMcpToolAction("core_delete_git_stack", { stack_id: args.stack_id });
      } catch (err) {
        return { isError: true, error: String(err) };
      }
    }
  );

  server.registerTool(
    "core_tail_service_logs",
    {
      description: "Retrieves live logs for a Docker container, systemd unit, SQLite service, or exposed port on a Muscle node over the mTLS PTY tunnel and highlights detected errors.",
      inputSchema: {
        type: "object",
        properties: { service_id: { type: "string" }, port: { type: "integer" }, node_id: { type: "string" }, container_name: { type: "string" }, unit_name: { type: "string" }, lines: { type: "integer" } },
      },
      annotations: { title: "Tail Live Service & Container Logs on Muscle", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args: Record<string, unknown>) => {
      try {
        return await readMcpToolResult("core_tail_service_logs", { service_id: args.service_id, port: args.port, node_id: args.node_id, lines: args.lines });
      } catch (err) {
        return { isError: true, error: String(err) };
      }
    }
  );

  server.registerTool(
    "core_get_node_telemetry_history",
    {
      description: "Returns the 60-sample ring-buffer telemetry history (CPU, RAM, and Disk trend samples) for a Muscle node.",
      inputSchema: {
        type: "object",
        properties: { node_id: { type: "string" } },
      },
      annotations: { title: "Get 60-Sample Node Telemetry History", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args: Record<string, unknown>) => {
      try {
        return await readMcpToolResult("core_get_node_telemetry_history", { node_id: args.node_id });
      } catch (err) {
        return { isError: true, error: String(err) };
      }
    }
  );

  server.registerTool(
    "core_run_due_cron_jobs",
    {
      description: "Evaluates all enabled Cron-Runbooks in the project and executes due jobs over the mTLS PTY tunnel, automatically dispatching CRITICAL forensic alerts on non-zero exit codes.",
      inputSchema: {
        type: "object",
        properties: { node_id: { type: "string" }, force_all: { type: "boolean" } },
      },
      annotations: { title: "Evaluate and Execute Due Cron-Runbooks", readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    async (args: Record<string, unknown>) => {
      try {
        return await runMcpToolAction("core_run_due_cron_jobs", { node_id: args.node_id, force_all: args.force_all });
      } catch (err) {
        return { isError: true, error: String(err) };
      }
    }
  );

  server.registerTool(
    "core_manage_backup",
    {
      description: "Manages AES-256-GCM encrypted Offsite Core Backups (list, create, restore, delete) pulled from Muscle nodes into the Core Vault.",
      inputSchema: {
        type: "object",
        required: ["action"],
        properties: { action: { type: "string", enum: ["list", "create", "restore", "delete"] }, node_id: { type: "string" }, backup_id: { type: "string" }, title: { type: "string" } },
      },
      annotations: { title: "Manage AES-256-GCM Encrypted Offsite Backups", readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    },
    async (args: Record<string, unknown>) => {
      try {
        return await runMcpToolAction("core_manage_backup", { action: args.action, node_id: args.node_id, backup_id: args.backup_id, title: args.title });
      } catch (err) {
        return { isError: true, error: String(err) };
      }
    }
  );

  server.registerTool(
    "core_manage_checkpoint",
    {
      description: "Manages Time-Machine Server Checkpoints (list, create, rollback) capturing active service states and atomic database snapshots.",
      inputSchema: {
        type: "object",
        required: ["action"],
        properties: { action: { type: "string", enum: ["list", "create", "rollback"] }, node_id: { type: "string" }, checkpoint_id: { type: "string" }, title: { type: "string" }, summary: { type: "string" } },
      },
      annotations: { title: "Manage Time-Machine Server Checkpoints", readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    },
    async (args: Record<string, unknown>) => {
      try {
        return await runMcpToolAction("core_manage_checkpoint", { action: args.action, node_id: args.node_id, checkpoint_id: args.checkpoint_id, title: args.title });
      } catch (err) {
        return { isError: true, error: String(err) };
      }
    }
  );

  server.registerTool(
    "core_manage_alerts",
    {
      description: "Manages Watchdog Alert Rules & Multi-Channel Webhooks (inspect, configure, test_alert, evaluate) for CPU, RAM, Disk, and Service-Down thresholds.",
      inputSchema: {
        type: "object",
        required: ["action"],
        properties: { action: { type: "string", enum: ["inspect", "configure", "test_alert", "evaluate"] }, enabled: { type: "boolean" }, webhook_url: { type: "string" }, telegram_bot_token: { type: "string" }, telegram_chat_id: { type: "string" }, cpu_threshold: { type: "integer" }, ram_threshold: { type: "integer" }, disk_threshold: { type: "integer" }, alert_on_service_down: { type: "boolean" }, title: { type: "string" }, message: { type: "string" }, severity: { type: "string", enum: ["INFO", "WARNING", "CRITICAL"] } },
      },
      annotations: { title: "Manage Watchdog Alert Rules & Webhooks", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (args: Record<string, unknown>) => {
      try {
        return await runMcpToolAction("core_manage_alerts", { action: args.action, enabled: args.enabled, webhook_url: args.webhook_url, severity: args.severity });
      } catch (err) {
        return { isError: true, error: String(err) };
      }
    }
  );

  server.registerTool(
    "core_intrusion_scan",
    {
      description: "Scans Linux Muscle SSH/Auth logs for brute-force attacker IPs and optionally blocks an offending IP via UFW/IPTables.",
      inputSchema: {
        type: "object",
        required: ["action"],
        properties: { action: { type: "string", enum: ["scan", "block_ip"] }, node_id: { type: "string" }, ip: { type: "string" } },
      },
      annotations: { title: "Scan Muscle SSH/Auth Logs for Brute-Force Intrusions", readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (args: Record<string, unknown>) => {
      try {
        return await runMcpToolAction("core_intrusion_scan", { action: args.action, node_id: args.node_id, ip: args.ip });
      } catch (err) {
        return { isError: true, error: String(err) };
      }
    }
  );

  server.registerTool(
    "core_hot_reload_service_code",
    {
      description: "Inspects or hot-reloads the live source code of a running microservice on a Muscle node with Python syntax validation, Pre-Flight Time-Machine Checkpoint, and zero-downtime restart.",
      inputSchema: {
        type: "object",
        required: ["action", "port"],
        properties: { action: { type: "string", enum: ["inspect", "hot_reload"] }, node_id: { type: "string" }, service_id: { type: "string" }, port: { type: "integer" }, file_path: { type: "string" }, code: { type: "string" } },
      },
      annotations: { title: "Inspect or Hot-Reload Microservice Code on Muscle", readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (args: Record<string, unknown>) => {
      try {
        return await runMcpToolAction("core_hot_reload_service_code", { action: args.action, node_id: args.node_id, service_id: args.service_id, port: args.port, code: args.code });
      } catch (err) {
        return { isError: true, error: String(err) };
      }
    }
  );

  server.registerTool(
    "core_sqlite_studio",
    {
      description: "Inspects SQLite database tables, executes custom SQL queries, or inserts rows on a Muscle node over the mTLS PTY tunnel.",
      inputSchema: {
        type: "object",
        properties: { node_id: { type: "string" }, db_path: { type: "string" }, table: { type: "string" }, custom_sql: { type: "string" }, insert_row: { type: "object" } },
      },
      annotations: { title: "Inspect & Query SQLite Databases on Muscle", readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    },
    async (args: Record<string, unknown>) => {
      try {
        return await runMcpToolAction("core_sqlite_studio", { node_id: args.node_id, db_path: args.db_path, table: args.table, custom_sql: args.custom_sql });
      } catch (err) {
        return { isError: true, error: String(err) };
      }
    }
  );

  server.registerTool(
    "core_manage_cron_jobs",
    {
      description: "Manages scheduled Cron-Runbooks (list, save, delete, run_now) in CronJobs.json and executes individual runbooks on a Muscle node.",
      inputSchema: {
        type: "object",
        required: ["action"],
        properties: { action: { type: "string", enum: ["list", "save", "delete", "run_now"] }, node_id: { type: "string" }, id: { type: "string" }, name: { type: "string" }, cron_expression: { type: "string" }, command: { type: "string" }, enabled: { type: "boolean" } },
      },
      annotations: { title: "Manage Scheduled Cron-Runbooks", readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    async (args: Record<string, unknown>) => {
      try {
        return await runMcpToolAction("core_manage_cron_jobs", { action: args.action, node_id: args.node_id, id: args.id, name: args.name, command: args.command });
      } catch (err) {
        return { isError: true, error: String(err) };
      }
    }
  );

  registerExtendedMcpTools(server, readMcpToolResult, runMcpToolAction);
}

const singletonServer = new McpToolServerRegistrar();
registerCoreMcpTools(singletonServer);

export function getRegisteredMcpToolDefinitions() {
  const schemaMap = new Map(
    SYNAPSE_TOOL_SCHEMAS.map((s) => [s.function.name, s.function.parameters])
  );
  return Array.from(singletonServer.registry.values()).map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: schemaMap.get(t.name) || t.inputSchema,
    annotations: t.annotations,
  }));
}
