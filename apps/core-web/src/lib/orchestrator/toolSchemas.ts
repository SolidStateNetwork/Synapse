export const SYNAPSE_TOOL_SCHEMAS = [
  {
    type: "function",
    function: {
      name: "core_update_brain_doc",
      description:
        "Updates project documentation (Architecture.md or Memory.md) in the Core Vault. Must be called after every structural change on a node.",
      parameters: {
        type: "object",
        properties: {
          document: {
            type: "string",
            enum: ["Architecture.md", "Memory.md"],
            description: "Target document in the Core project vault.",
          },
          mode: {
            type: "string",
            enum: ["replace_section", "append", "overwrite_full", "overwrite"],
            description: "Type of update operation.",
          },
          section_header: {
            type: "string",
            description:
              "Exact Markdown heading (required only when mode is replace_section).",
          },
          content: {
            type: "string",
            description:
              "New Markdown content (including updated Mermaid graphs or remote file paths).",
          },
        },
        required: ["document", "mode", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "core_register_service",
      description:
        "Registers, updates, or removes a service running on a Connector in State.json and activates real-time health monitoring and Live-Preview tunneling.",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["upsert", "remove"],
            default: "upsert",
          },
          service_id: {
            type: "string",
            description: "Unique slug, e.g. svc-api-backend",
          },
          node_id: {
            type: "string",
            description: "ID of the Connector where the service runs.",
          },
          name: { type: "string" },
          category: {
            type: "string",
            enum: ["webui", "backend", "database", "worker"],
            description:
              "Component type so the Core UI renders an interactive WebUI, Backend API, or Database Explorer Box in Reverse-Proxy & Live-Preview.",
          },
          description: {
            type: "string",
            description:
              "Plain-language explanation of what this component does and how the user can interact with it from the outside via Reverse Proxy.",
          },
          db_path: {
            type: "string",
            description:
              "Optional SQLite file path or database target (e.g. /opt/axon/workspaces/<project>/app.db) for interactive SQL queries in the UI.",
          },
          endpoints: {
            type: "array",
            description:
              "Interactive clickable routes, API endpoints, or SQL queries with sample input payloads shown inside the Reverse-Proxy & Live-Preview Box.",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                label: { type: "string" },
                method: {
                  type: "string",
                  enum: ["GET", "POST", "PUT", "DELETE", "SQL"],
                },
                path: {
                  type: "string",
                  description: "HTTP path (e.g. /api/events) or SQL target.",
                },
                description: { type: "string" },
                sample_payload: {
                  type: "string",
                  description:
                    "Editable default JSON payload (for POST/PUT) or SQL query (for SQL) pre-filled in the UI input box.",
                },
              },
              required: ["label", "method", "path"],
            },
          },
          runtime: {
            type: "string",
            enum: ["docker", "systemd", "pm2", "binary"],
          },
          unit_or_container: {
            type: "string",
            description: "Name of the Docker container or systemd unit.",
          },
          bind_address: {
            type: "string",
            description: "IP address, e.g. 127.0.0.1, 0.0.0.0, or VLAN IP.",
          },
          port: { type: "integer" },
          enable_preview_tunnel: {
            type: "boolean",
            description:
              "When true, exposes the port through the Connector tunnel for the Live-Preview iframe in the Core WebUI.",
          },
          auto_heal: {
            type: "boolean",
            description:
              "When true, the Proactive Auto-Watchdog automatically diagnoses and restarts this service if its health probe fails.",
          },
          health_check: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["HTTP", "TCP", "EXEC"] },
              target: {
                type: "string",
                description: "URL, IP:Port, or shell command on the node.",
              },
              interval_sec: { type: "integer", default: 15 },
            },
            required: ["type", "target"],
          },
        },
        required: ["service_id", "node_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "core_manage_secret",
      description:
        "Generates or stores a secret inside the encrypted Core Vault (Secrets.enc) without exposing plaintext in logs or LLM context.",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["generate_random", "set_value", "set", "delete", "list"],
          },
          key: {
            type: "string",
            description: "Env-compliant name, e.g. DB_ROOT_PASSWORD",
          },
          value: {
            type: "string",
            description: "Required only when action is set_value.",
          },
          length: {
            type: "integer",
            default: 32,
            description: "Character length when action is generate_random.",
          },
        },
        required: ["action", "key"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "node_pty_exec",
      description:
        "Executes a shell command in a persistent PTY session on an assigned Connector. Working directory and environment variables persist across calls.",
      parameters: {
        type: "object",
        properties: {
          node_id: {
            type: "string",
            description: "Target Connector ID from State.json.",
          },
          session_id: {
            type: "string",
            description:
              "Name of the PTY session (created automatically if it does not exist), e.g. 'default' or 'db-setup'.",
          },
          command: {
            type: "string",
            description: "Bash command to execute.",
          },
          inject_secret_keys: {
            type: "array",
            items: { type: "string" },
            description:
              "List of secret keys from the Core Vault to inject as environment variables into the shell before execution.",
          },
          wait_timeout_ms: {
            type: "integer",
            default: 30000,
            description:
              "Max wait time for completion. For background daemons/dev servers, returns partial output after timeout while process keeps running.",
          },
          send_signal: {
            type: "string",
            enum: ["NONE", "SIGINT", "SIGTERM", "SIGKILL"],
            default: "NONE",
            description:
              "Optional signal sent to the foreground process of the session (e.g. SIGINT for Ctrl+C).",
          },
        },
        required: ["node_id", "session_id", "command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "node_fs_operation",
      description:
        "Direct, atomic filesystem operations on a Connector over the mTLS stream (faster and safer than echo/cat over the shell).",
      parameters: {
        type: "object",
        properties: {
          node_id: { type: "string" },
          operation: {
            type: "string",
            enum: [
              "read_file",
              "write_file",
              "apply_unified_diff",
              "list_dir",
              "stat",
              "delete",
            ],
          },
          path: {
            type: "string",
            description: "Path on the target Connector.",
          },
          content_or_patch: {
            type: "string",
            description:
              "Full file content (for write_file) or Unified-Diff patch (for apply_unified_diff).",
          },
          file_mode: {
            type: "string",
            default: "0644",
            description: "Octal file permissions, e.g. 0755 for scripts.",
          },
        },
        required: ["node_id", "operation", "path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "core_link_peers",
      description:
        "Creates or removes a secure Peer-to-Peer Mesh Tunnel between two Muscle Nodes (e.g. connecting a web node on 127.0.0.1:5432 to a database node's port 5432 without exposing public firewall ports).",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["upsert", "remove"],
            default: "upsert",
          },
          source_node_id: {
            type: "string",
            description:
              "Source Muscle Peer where the local loopback port is opened.",
          },
          target_node_id: {
            type: "string",
            description:
              "Destination Muscle Peer hosting the target service.",
          },
          local_port: {
            type: "integer",
            description:
              "Local loopback port on source_node_id (127.0.0.1:<local_port>).",
          },
          remote_port: {
            type: "integer",
            description:
              "Target port on target_node_id (127.0.0.1:<remote_port>).",
          },
          protocol: {
            type: "string",
            enum: ["tcp", "http"],
            default: "tcp",
          },
          description: {
            type: "string",
          },
        },
        required: ["source_node_id", "target_node_id", "remote_port"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "node_deep_search",
      description:
        "Performs advanced, structured Senior DevOps searches and deep forensic inspections on an assigned Muscle Node. Supports 6 specialized search modes: 'content_grep' (regex/keyword search across code/configs with file globs & context lines), 'file_find' (recursive file tree discovery with size, permissions, mtime & line counts), 'log_scan' (scans all *.log files, /tmp/*.log, systemd journalctl, and Docker container logs for errors/warnings/tracebacks or custom patterns), 'process_and_port_map' (correlates all listening TCP/UDP sockets, running processes, Docker containers, systemd units, memory/CPU usage, and probes registered service ports), 'sqlite_inspect' (automatically discovers all SQLite .db/.sqlite databases, checks PRAGMA integrity_check, schemas, table row counts, and sample rows), and 'security_forensics' (deep OpSec scan for exposed 0.0.0.0 ports, sshd_config hardening, auth logs, firewall rules, sysctl flags, file permissions, leaked secrets, and HTTP security headers).",
      parameters: {
        type: "object",
        properties: {
          node_id: {
            type: "string",
            description: "Target Connector ID from State.json.",
          },
          search_mode: {
            type: "string",
            enum: [
              "content_grep",
              "file_find",
              "log_scan",
              "process_and_port_map",
              "sqlite_inspect",
              "security_forensics",
            ],
            description: "Specialized DevOps search and inspection mode.",
          },
          query: {
            type: "string",
            description:
              "Optional regex, keyword, filename pattern, or filter string (e.g. 'ERROR|Exception', 'sqlite', '4085', 'def do_POST').",
          },
          target_dir: {
            type: "string",
            description:
              "Optional base directory to search (defaults to /opt/axon/workspaces).",
          },
          file_glob: {
            type: "string",
            description:
              "Optional file glob filter (e.g. '*.py', '*.log', '*.db', '*.json').",
          },
          context_lines: {
            type: "integer",
            default: 2,
            description:
              "Number of surrounding context lines for content_grep / log_scan.",
          },
        },
        required: ["node_id", "search_mode"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "core_vault_search",
      description:
        "Searches the entire Synapse Core Brain Vault (State.json, Architecture.md, Memory.md, Audit.jsonl history, Registered Services & Endpoints, Rule Cartridges, and Secret Key names) for any keyword, port, service, or configuration, and compares documented state against registered infrastructure.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "Keyword, regex, port number, service name, or topic to search across all Brain Vault documents, State.json, and Audit logs. Leave empty for a full Brain & State consistency dump.",
          },
          scope: {
            type: "string",
            enum: [
              "all",
              "architecture",
              "memory",
              "services",
              "audit",
              "cartridges",
            ],
            default: "all",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "node_firewall_control",
      description:
        "Inspects or configures the Synapse Firewall & Port-Shield on a Linux Muscle server with built-in Anti-Lockout (protects SSH & Synapse Tunnel) and 15-second Dead-Man's Switch Rollback. Supports 'inspect' (Live Port-Radar), 'set_profile' ('web_standard', 'synapse_stealth', 'custom'), 'shield_port' (blocks public internet access to a port while keeping 127.0.0.1 Synapse Tunnel open), 'unshield_port', 'add_ip_rule' (allow/block IP or CIDR), and 'remove_ip_rule'.",
      parameters: {
        type: "object",
        properties: {
          node_id: {
            type: "string",
            description: "Target Muscle Peer ID.",
          },
          action: {
            type: "string",
            enum: [
              "inspect",
              "set_profile",
              "shield_port",
              "unshield_port",
              "add_ip_rule",
              "remove_ip_rule",
            ],
            default: "inspect",
          },
          profile: {
            type: "string",
            enum: ["web_standard", "synapse_stealth", "custom"],
            description: "Firewall security profile when action is set_profile.",
          },
          port: {
            type: "integer",
            description:
              "Port number to shield/unshield or target in an IP rule.",
          },
          ip_or_cidr: {
            type: "string",
            description:
              "IPv4/IPv6 address or CIDR (e.g. 203.0.113.50 or 10.0.0.0/24) for add_ip_rule.",
          },
          rule_action: {
            type: "string",
            enum: ["allow", "block"],
            description: "Whether to allow (whitelist) or block the IP.",
          },
          note: {
            type: "string",
            description: "Optional description for the IP rule.",
          },
          rule_id: {
            type: "string",
            description:
              "Rule ID to remove when action is remove_ip_rule.",
          },
        },
        required: ["action"],
      },
    },
  },
];
