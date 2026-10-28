# Changelog

All notable changes to **Synapse** are documented in this file.

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
  - Step-by-step **DevOps Interview Mode** (`Fragen` toggle) and `@` context mention autocomplete (`@vps2-muscle`, `@service:4070`, `@Architecture.md`).

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
