# Changelog

All notable changes to **Synapse** are documented in this file.

## [v0.1.0] — 2026-10-25 ("Brain & Muscle" Reference Architecture Release)

### Added
- **Multiplexed Reverse-Tunnel Wire Protocol (`proto/tunnel.proto`)**:
  - Single outbound TCP/443 mTLS 1.3 connection multiplexed via `hashicorp/yamux` across 4 logical streams:
    - Stream 1: Atomic Filesystem Operations (`read_file`, `write_file`, `apply_unified_diff`, `list_dir`, `stat`, `delete`, octal `file_mode`).
    - Stream 2: Persistent Stateful PTY Sessions (`creack/pty`, boundary sentinel framing `__SYNAPSE_EOF_<cmd_id>:<exit_code>__`, `/proc/<pid>/cwd` resolution, `send_signal`, live `xterm.js` mirroring).
    - Stream 3: Authenticated Loopback Reverse Proxy (`/preview/<project_id>/<node_id>/<port>` -> `127.0.0.1:<port>`).
    - Stream 4: 5-Second Hardware Telemetry (`gopsutil` CPU, RAM, Disk, OS info, IPv4, and `HTTP`/`TCP`/`SYSTEMD`/`EXEC` service health probes).
- **Axon Muscle Single-Binary Agent (`agents/axon`)**:
  - Zero-CGO (`CGO_ENABLED=0`) static binary for Linux (`amd64`, `arm64`) and macOS (`amd64`, `arm64`).
  - Automated X.509 ECDSA P-256 CSR bootstrap (`axon join <token>`) and systemd enrollment script (`/install.sh`).
  - Hardcoded deterministic **Self-Lockout Prevention** (`ERR_SELF_PROTECTION_VIOLATION`) protecting the agent PID, `axon.service`, and Core Gateway tunnel route.
  - Real-time **Secret Redaction** (`[REDACTED_SECRET:KEY]`) and **16 KB Head/Tail Output Truncation** (4 KB head + 12 KB tail, full log persisted to `/tmp/axon-logs/<cmd_id>.log`).
- **Synapse Core Control Plane (`apps/core-gateway` & `apps/core-web`)**:
  - On-disk **Project Brain Vault** (`Architecture.md`, `State.json`, `Memory.md`, `Secrets.enc` AES-256-GCM, `Audit.jsonl`, `Chat.jsonl`).
  - **5-Layer XML Master-System-Prompt Assembler** (`<system_identity>`, `<project_brain_vault>`, `<infrastructure_state>`, `<active_rule_cartridges>`, `<operational_directives>`).
  - Multi-turn **ReAct AI Orchestrator** supporting OpenAI, Anthropic, Ollama, Custom API Base URLs, and deterministic execution.
  - **Autonomy Tiers**: `TIER_1_UNLEASHED`, `TIER_2_WORKSPACE_JAIL`, and `TIER_3_SUPERVISED` (interactive command & diff approval cards in the WebUI).
  - **4 Official DevOps Rule Cartridges**: `docker-first.md`, `native-systemd.md`, `zero-trust-networking.md`, and `auto-ssl-caddy.md`.
  - **Calm 2026 Studio UI**: Reader-mode Markdown viewer (`RichMarkdownDocument`), live Mermaid topology viewer (`MermaidTopologyView`), remote workspace explorer (`RemoteWorkspaceExplorer`), `Ctrl+K` Command Palette, and real-time `UNHEALTHY` service auto-heal banner.
