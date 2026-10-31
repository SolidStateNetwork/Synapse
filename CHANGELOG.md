# Changelog

All notable changes to **Synapse** are documented in this file.

## [v0.6.0] — 2026-10-31 (Service-Mesh & Live-Log Observability, GitOps Stack-Deployer & Autonomous Cron-Due-Runner)

### Added & Improved
- **Live Service-Log-Tailer, Cross-Node Mesh-Relay & 60-Sample Telemetry History (`apps/core-web/src/lib/self-healing/serviceMeshAndBuilder.ts`)**:
  - `tailServiceLogs` (`POST /api/service-ops` -> `tail_logs` / `tail_service_logs`) retrieves live `docker logs`, `journalctl -u`, SQLite WAL state, and workspace process logs over the mTLS PTY tunnel with automated error-line detection.
  - `fetchNodeTelemetryHistory` (`POST /api/service-ops` -> `node_telemetry_history`) exposes 60-sample CPU/RAM/Disk telemetry time-series per connected Muscle node alongside cross-node mesh forwarding probes.
- **GitOps & Docker-Compose Stack-Deployer with `Secrets.enc` Injection & Webhook (`apps/core-web/src/lib/projects/gitopsDeployer.ts`)**:
  - `deployGitStackOnMuscle` (`POST /api/service-ops` -> `deploy_git_stack`) clones/updates Git repositories onto Muscle nodes, injects decrypted secrets from `Secrets.enc` into `0600` `.env` files, runs `docker compose up -d --build` or custom start commands, and auto-registers services in `State.json`.
  - `triggerGitOpsWebhookRedeploy` (`POST /api/service-ops` -> `gitops_webhook`) verifies SHA-256 hashed `syn_git_...` webhook tokens for zero-downtime GitOps redeployments.
- **Autonomous Cron-Runbook Due-Scheduler & Forensic Alerts (`apps/core-web/src/lib/v070-studio/sqliteAndCron.ts`)**:
  - `parseCronIntervalMinutes` and `runDueCronJobsOnMuscle` (`POST /api/service-ops` -> `run_due_cron_jobs`) evaluate due Cron-Runbooks and execute them over the mTLS tunnel.
  - Non-zero exit codes (`exitCode !== 0`) automatically trigger enriched `CRITICAL` forensic alerts via `dispatchAlertEvent`.

---

## [v0.5.0] — 2026-10-30 (Live Code Hot-Reload, SQLite Data Studio, Cron Runbooks, Multi-Core Mesh & Production Hardening)

### Added & Improved
- **Live Code Hot-Reload Studio, SQLite Data Studio & Scheduled Cron-Runbooks (`apps/core-web/src/lib/v070-studio.ts`)**:
  - Real-time microservice code inspection and syntax-validated hot-reload (`python3 -m py_compile` with automatic `.synapse.bak` rollback on syntax errors).
  - Embedded **SQLite Data Studio** for inspecting tables, schemas, row counts, and inserting/querying rows directly over the mTLS reverse tunnel.
  - **Cron-Runbook Manager** with one-click live execution, exit-code capture, and execution duration telemetry.
- **Autonomous Self-Healing Engine, Time-Machine Checkpoints & 1-Click Custom Service Builder**:
  - Automated crash recovery runbooks (`self-healing.ts`) with forensic log snapshots, MTTR tracking, and 24/7 Watchdog notifications (Telegram, Discord, Webhook).
  - **Time-Machine Server Checkpoints** (`checkpoints.ts`) and AES-256-GCM encrypted **Offsite Backups** (`backups/route.ts`).
  - **1-Click Custom Service Builder** (`serviceMeshAndBuilder.ts`) for deploying Python HTTP APIs, Static WebUIs, and SQLite REST microservices directly from the Control Center Canvas.
- **Multi-Core High-Availability Mesh & Deterministic Service Lifecycle (`agents/axon` & `apps/core-gateway`)**:
  - Multi-Core target deduplication and shared health collector across Primary and Standby Core Gateways.
  - Persistent `dismissed_services` tracking so removed services or auto-discovered ports (`auto-svc-*`) are never inadvertently re-imported.
- **Zero-Trust RBAC, 2FA PIN & Model Context Protocol (MCP) Server (`/api/mcp`)**:
  - Role-based access control (`Admin` vs `Operator`) with optional 6-digit 2FA PIN protection (`auth.ts`).
  - Streamable HTTP JSON-RPC 2.0 MCP Server (`/api/mcp`) with SHA-256 hashed API keys and granular `read` / `execute` / `admin` scopes.
- **Production Hardening, `.bak` Self-Healing Stores & Cross-Platform Installer**:
  - Atomic JSON persistence with automatic `.bak` self-healing (`atomicWriteJsonSync` / `safeReadJsonWithBackupSync`) across all project stores (`State.json`, `Alerts.json`, `Auth.json`, `Checkpoints.json`, `SelfHealing.json`, `ServiceLinks.json`, `CronJobs.json`).
  - Timeout- and abort-guarded `safeFetchJson` across all frontend hooks, views, Next.js API routes, and backend libraries.
  - Hardened `/install.sh` and `scripts/install-axon.sh` with automatic `curl`/`wget` fallback, SHA-256 binary integrity verification, `systemd`, `OpenRC` (Alpine Linux), and rootless daemon support.
  - Enforced automated CI/Release quality gates: `< 500` lines per Go file, `< 600` lines per TypeScript/React file, `0` explicit `any` types, `shellcheck -S warning` on all shell scripts, `>= 85%` statement coverage across all 11 Go packages (`-race`), and `>= 90%` line coverage across `apps/core-web`.

---

## [v0.4.0] — 2026-10-29 (Firewall Port-Shield, RBAC Security & Time-Machine Snapshots)

### Added & Improved
- **Interactive Firewall & Port-Shield (`apps/core-web/src/lib/firewall.ts`)**:
  - Live Port-Radar (`ss -tlnp`), one-click Port-Shielding (`ufw` / `iptables` / `nftables` with `127.0.0.1` Synapse Reverse-Tunnel whitelist), Anti-Lockout SSH protection, and 15-second Dead-Man's Switch Rollback.
- **Zero-Trust RBAC & Watchdog Alert Engine (`auth.ts`, `alerts.ts`)**:
  - Multi-role login (`Admin` / `Operator`), optional 6-digit TOTP PIN, and 24/7 Watchdog threshold alerts.

---

## [v0.3.0] — 2026-10-28 (GPU-Accelerated Control Center, Unified Service Workbench & Full Bilingual UI)

### Added & Improved
- **GPU-Accelerated Interactive Control Center Canvas (`InteractiveControlCenterCanvas.tsx` & `globals.css`)**:
  - Replaced expensive SVG `<feGaussianBlur>` filters with layered vector geometry and GPU-composited CSS `@keyframes` (`offset-path`, `stroke-dashoffset`, `will-change: offset-distance, transform`), eliminating frame drops during pan, zoom, and hover.
  - Invariant particle animation durations (`forwardDur`, `reverseDur`, `staggerSec`) across hover states so animated data-flow packets never jump or reset when highlighting nodes (`<1.3px` natural frame delta).
  - Deduplicated port socket indicators and coalesced pointer dragging via `requestAnimationFrame`.
- **Redesigned Unified Service Workbench (`apps/core-web/src/app/page.tsx`)**:
  - Fluid **Service Selector Cards** with live health status dots, category icons (`WebUI`, `API`, `DB`), node badges, and endpoint counters.
  - Single-row **Unified Workbench Header Bar** with a framed Segmented Mode Switcher (`API- & DB-Tester` | `Web-Vorschau`), external proxy link, and remove action.
  - Deduplicated quick-select endpoint pills, unified Request Composer Bar, and structured Response Console with status badge and latency metrics.
- **Extensible Bilingual Localization System (`apps/core-web/src/lib/i18n.tsx`)**:
  - Full 1:1 German (`DE`) and English (`EN`) coverage across all 8 views (`Übersicht`, `Services`, `Server & Mesh`, `Brain Vault`, `Dateien`, `Regeln`, `Audit-Log`, `Einstellungen`), all modals, and the AI Copilot drawer.
  - Dedicated **Language & Localization** settings tab (`Sprache & Region`) plus a height-matched (`32px`) header language switcher (`DE` | `EN`).
- **Bilingual Documentation & Interactive SVG Diagrams (`README.md`, `README.de.md`, `docs/assets/`)**:
  - Complete English primary `README.md` and full German `README.de.md` connected via one-click language switch badges.
  - Updated `hero-banner.svg`, `architecture-flow.svg`, `control-center-preview.svg`, and `ai-skills-pipeline.svg`.
- **Code Cleanup & UI Optimization**:
  - Removed unused legacy prototype component `RemoteWorkspaceExplorer.tsx` (`371` lines).
  - Unified card headers, icon badges, and semantic `<main>` layout across all Settings tabs, Audit Log filters, and Onboarding modals.

---

## [v0.2.0] — 2026-10-27 (Over-the-Air Rollout, DevOps AI Skills & Interview Mode)

### Added
- **1-Click System Update & Over-the-Air (OTA) Muscle Rollout (`/api/system-update`)**:
  - Live Git commit synchronization for the Core Plane and automated OTA binary rollout (`/usr/local/bin/axon`) with SHA-256 verification across all connected Muscle nodes.
  - NetBird-style version & update status card in the bottom-left sidebar.
- **5 Specialized DevOps AI Skills & Interactive Interview Mode**:
  - `CheckSystem` (6-phase SRE infrastructure audit), `CheckOpsec` (DevSecOps socket, SSH & firewall audit), `CheckUpdates` (Muscle & backend update inspector), `DeepForensics` (root-cause & log analysis), and `SkillSearch` (full-stack code, DB & UI search).
  - Step-by-step **DevOps Interview Mode** (`Fragen` toggle) and `@` context mention autocomplete (`@edge-node-01`, `@service:4070`, `@Architecture.md`).

---

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
  - **Calm 2026 Studio UI**: Reader-mode Markdown viewer (`RichMarkdownDocument`), live Mermaid topology viewer (`MermaidTopologyView`), `Ctrl+K` Command Palette, and real-time `UNHEALTHY` service auto-heal banner.
