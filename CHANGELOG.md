# Changelog

All notable changes to **Synapse** are documented in this file.

## [v2.2.0] — 2026-11-01 (SolidState 4-Document AI Lexicon, Public/Private Clean-Room Governance, Scoped MCP Key Tool & 100% Ephemeral PTY GC)

### Added & Improved
- **SolidState 4-Document Brain Vault Lexicon & Public/Private Clean-Room Governance (`lexiconGovernance.ts`, `vault.ts`, `promptBuilder.ts`, `BrainVaultAndWorkspaceViews.tsx`, `cartridges/solidstate-*.md`)**:
  - Expanded every project's Brain Vault to the full 4-document SolidState Lexicon (`Architecture.md`, `Memory.md` with automatic `[BB-XXX]` Blackbox numbering, `Milestones.md`, and `AGENTS.md`) with a 1-click `PUBLIC (Clean-Room)` vs. `PRIVATE (Infrastructure)` governance switcher and automatic Zero-Secret + Public Clean-Room sanitization.
- **Scoped MCP API Key Lifecycle AI/MCP Tool (`core_manage_mcp_keys`) & 100% Ephemeral PTY Garbage Collection (`workbenchAndAuthTools.ts`, `pty_discovery.go`)**:
  - Added `core_manage_mcp_keys` (`list`, `create`, `revoke` with `read`/`execute`/`admin` scopes) across the AI Orchestrator, deterministic fallback, and `/api/mcp`.
  - Added `deep-search-`, `self-heal-`, and `link-probe-` to `IsEphemeralSessionID` in `agents/axon/internal/pty/pty_discovery.go`.
- **Pre-Flight Checkpoints on Offsite Backup Restore/Delete & Intrusion IP Block + UI Badges (`disasterRecoveryTools.ts`, `/api/backups`, `secopsAndWatchdogTools.ts`, `/api/service-ops`, `AccessRulesView.tsx`, `useSystemAndInfraActions.ts`, `useCanvasOpsController.ts`)**:
  - Added automatic Pre-Flight Time-Machine Checkpoints (`checkpoint_id`) on backup restore/delete and intrusion IP block, and surfaced `checkpoint_id` badges across Cron-Runbooks, Playbooks, and Offsite Backups UI.

---

## [v2.1.0] — 2026-11-01 (1-Click Topology Bundle UI, Interactive Multi-Node Canary Control Bar & Cron/Playbook Checkpoints)

### Added & Improved
- **1-Click Topology Bundle (`synapse-stack/v2.0`) Export/Import Drawer in Brain Vault (`BrainVaultAndWorkspaceViews.tsx`, `/api/projects`)**:
  - Added `export_topology_bundle` and `import_topology_bundle` to `POST /api/projects` and integrated an interactive Topology Bundle Export/Import drawer into `BrainVaultView` displaying the Pre-Flight Time-Machine `checkpoint_id` upon import.
- **Interactive Multi-Node Canary Rollout & Fleet-Health Control Bar in Peers View (`PeersView.tsx`, `/api/projects`)**:
  - Added `verify_fleet_health` and `canary_rollout` to `POST /api/projects` and integrated a Multi-Node Canary & Fleet-Health control bar into `PeersView` with live `checkpoint_id` badge.
- **Automatic Pre-Flight Time-Machine Checkpoints on Cron-Runbook & Playbook Mutations (`studioDevOpsTools.ts`, `/api/service-ops`, `playbookAndApprovalTools.ts`, `/api/projects`)**:
  - `core_manage_cron_jobs` (`save`, `delete`), `save_cron_job`/`delete_cron_job` (`/api/service-ops`), `core_manage_playbooks` (`upsert`, `delete`), and `upsert_playbook`/`delete_playbook` (`/api/projects`) now automatically record and return a Pre-Flight Time-Machine Checkpoint (`checkpoint_id`).

---

## [v2.0.0] — 2026-11-01 (Declarative Topology Bundles, Multi-Node Canary Rollouts, Enterprise Architecture Lexicon & Domain/TLS Checkpoints)

### Added & Improved
- **Declarative Topology Bundles & Multi-Node Canary Rollout AI/MCP Tools (`topologyAndCanaryTools.ts`, `extendedToolSchemas.ts`, `coreTools.ts`, `autonomousFallback.ts`, `/api/mcp`)**:
  - Added `core_manage_topology_bundle` (`export`, `import`) to export and atomically import complete project topologies (`synapse-stack/v2.0` schema: services, mesh links, cartridges, playbooks, cron jobs, custom domains, and secret key names) with an automatic Pre-Flight Time-Machine Checkpoint (`checkpoint_id`).
  - Added `core_cluster_canary_exec` (`canary_rollout`, `verify_fleet_health`) to execute staged canary commands across assigned Muscle nodes with automatic Pre-Flight Checkpoint creation and instant canary abort on non-zero exit code.
- **Enterprise Architecture Lexicon & Governance Self-Test (`architecture/`, `memory/`, `playbooks/`, `AGENTS.md`, `.githooks/pre-commit`, `/api/debug`)**:
  - Added the `lexicon_and_governance` verification stage to `POST /api/debug` (`action: "self_test"`) validating `AGENTS.md`, `memory/PROJECT_STATE.md`, `memory/BLACKBOX.md`, `memory/MILESTONES.md`, and `.githooks/pre-commit`.
- **Automatic Pre-Flight Time-Machine Checkpoints on Domain/TLS Mutations (`blueprintDomainAndOtaTools.ts`, `/api/service-ops`, `useCanvasStudioAndDomainActions.ts`, `ReverseProxyView.tsx`)**:
  - Domain bind/unbind operations in `core_manage_domain_tls` and `/api/service-ops` (`configure_domain`) now automatically create a Pre-Flight Time-Machine Checkpoint (`checkpoint_id`) and surface it in the UI status notice.

---

## [v1.9.0] — 2026-11-01 (Service-Workbench, RBAC & AI-Endpoint AI/MCP Parity, Pre-Flight GitOps/Custom-Service Checkpoints & Studio Checkpoint Badges)

### Added & Improved
- **AI-Orchestrator & MCP Service-Workbench, RBAC & AI-Endpoint Tools (`workbenchAndAuthTools.ts`, `extendedToolSchemas.ts`, `coreTools.ts`, `autonomousFallback.ts`, `/api/mcp`)**:
  - Added `core_invoke_service_action` (`GET`, `POST`, `PUT`, `DELETE`, `SQL`) and `core_manage_auth_and_ai` (`inspect_auth`, `revoke_sessions`, `configure_ai_endpoint`) so the AI Copilot and external MCP Clients have 100% full-stack control over interactive Service Action Workbench requests, WebUI RBAC/2FA status, session revocation, and LLM provider configuration.
- **Automatic Pre-Flight Time-Machine Checkpoints on GitOps Redeploy/Teardown & Custom-Service Deploy (`gitopsDeployer.ts`, `serviceMeshAndBuilder.ts`)**:
  - `deployCustomServiceOnMuscle`, `triggerGitOpsWebhookRedeploy`, and `deleteGitStackOnMuscle` now automatically record and return a Pre-Flight Time-Machine Checkpoint (`checkpoint_id`).
- **Pre-Flight Checkpoint-ID Badges in GitOps Studio & Custom-Service Builder UI (`GitOpsStudioPanel.tsx`, `useCanvasStudioAndDomainActions.ts`)**:
  - GitOps deploy/redeploy/teardown notices and the Custom-Service Builder notice now display the Pre-Flight Time-Machine `checkpoint_id` created prior to execution.

---

## [v1.8.0] — 2026-11-01 (Playbooks, Custom Cartridges & Approvals AI/MCP Parity, Complete Ephemeral PTY GC & Blueprint/OTA Checkpoint Badges)

### Added & Improved
- **AI-Orchestrator & MCP Playbook, Custom Cartridge & Approval Tools (`playbookAndApprovalTools.ts`, `extendedToolSchemas.ts`, `coreTools.ts`, `autonomousFallback.ts`, `/api/mcp`)**:
  - Added `core_manage_playbooks` (`list`, `upsert`, `delete`, `create_custom_cartridge`, `delete_custom_cartridge`) and `core_manage_approvals` (`list`, `approve`, `reject`) so the AI Copilot and external MCP Clients have 100% full-stack control over scheduled AI Playbooks, custom Rule Cartridges, and `TIER_3_SUPERVISED` approval requests.
- **Complete Ephemeral PTY Garbage Collection in Axon (`pty_discovery.go`, `pty_test.go`)**:
  - Added `svc-cleanup-`, `sys-update-`, `mesh-`, and `custom-svc-` to `IsEphemeralSessionID` in `agents/axon/internal/pty/pty_discovery.go` so all one-shot PTY sessions across service teardown, system-update checks, mesh relays, and custom service builders are automatically reaped upon completion.
- **Pre-Flight Checkpoint-ID Badges in Blueprint & System-Update UI (`useCanvasOpsController.ts`, `useSystemAndInfraActions.ts`, `SystemUpdateAndDebugTabs.tsx`, `SettingsView.tsx`, `page.tsx`)**:
  - Blueprint deploy/undeploy notices and the System-Update (OTA) header now display the Pre-Flight Time-Machine `checkpoint_id` created prior to rollout.

---

## [v1.7.0] — 2026-11-01 (Project & Diagnostics AI/MCP Parity, Container-Native OTA Updates with Pre-Flight Checkpoints & Firewall Checkpoint Badge)

### Added & Improved
- **AI-Orchestrator & MCP Project & Diagnostics Tools + Schema Modularization (`extendedToolSchemas.ts`, `projectAndDiagnosticTools.ts`, `toolSchemas.ts`, `coreTools.ts`, `autonomousFallback.ts`, `/api/mcp`)**:
  - Modularized `toolSchemas.ts` via `extendedToolSchemas.ts` and added `core_manage_projects` (`list`, `create`, `set_planning_only`, `audit_trail`) and `core_run_platform_self_test` (`self_test`, `toggle_debug`) so the AI Copilot and external MCP Clients have 100% full-stack control over Project Brain Vaults, Planning-Only mode, Audit trails, and Full-Platform Self-Test diagnostics.
- **Container-Native OTA Updates & Automatic Pre-Flight Time-Machine Checkpoints (`/api/system-update`)**:
  - `POST /api/system-update` (`update_core`, `update_muscle`, `update_all`) now automatically records a Pre-Flight Time-Machine Checkpoint (`recordCheckpoint`) prior to rollout and returns `checkpoint_id`, while supporting both bare-metal systemd services and rootless/Docker containers (`containers/`).
- **Pre-Flight Checkpoint-ID Badge in Firewall UI (`FirewallView.tsx`, `useFirewallAndMcpActions.ts`, `page.tsx`)**:
  - The Firewall & Port-Shield status bar now displays the Pre-Flight Time-Machine `checkpoint_id` created on Firewall policy mutations.

---

## [v1.6.0] — 2026-10-31 (Firewall, Cartridges & Cluster-Nodes AI/MCP Parity, Pre-Flight Firewall Checkpoints & Ephemeral FW-PTY Reaping)

### Added & Improved
- **AI-Orchestrator & MCP Firewall, Cartridge & Cluster-Node Tools (`firewallCartridgeAndClusterTools.ts`, `toolSchemas.ts`, `coreTools.ts`, `autonomousFallback.ts`, `/api/mcp`)**:
  - Added `core_manage_firewall` (`inspect`, `toggle_port_shield`, `apply_profile`, `add_ip_rule`, `remove_ip_rule`), `core_manage_cartridges` (`list`, `toggle`, `activate`, `deactivate`), and `core_manage_cluster_nodes` (`list`, `create_join_token`, `assign_node`, `unassign_node`) so the AI Copilot and external MCP Clients have 100% full-stack control over Synapse Shield firewall policies, modular AI Rule Cartridges, and Muscle node enrollment.
- **Automatic Pre-Flight Time-Machine Checkpoints on Firewall Policy Mutations (`/api/firewall` & `firewallCartridgeAndClusterTools.ts`)**:
  - Every mutating firewall action (`toggle_port_shield`, `shield_port`, `unshield_port`, `apply_profile`, `set_profile`, `add_ip_rule`, `remove_ip_rule`) now automatically records a Pre-Flight Time-Machine Checkpoint (`actor: "Auto-Watchdog"`) and returns `checkpoint_id`.
- **Ephemeral `fw-*` PTY Garbage Collection in Axon (`pty_discovery.go`, `pty_test.go`)**:
  - Added `fw-` to `IsEphemeralSessionID` in `agents/axon/internal/pty/pty_discovery.go` so one-shot Firewall inspection and rule-sync PTY sessions (`fw-v1-*`) are automatically reaped upon completion.

---

## [v1.5.0] — 2026-10-31 (Blueprint, Domain/TLS & OTA AI/MCP Parity, Pre-Flight Blueprint Checkpoints & Full-Platform Self-Test)

### Added & Improved
- **AI-Orchestrator & MCP Blueprint, Domain/TLS & OTA System Tools (`blueprintDomainAndOtaTools.ts`, `toolSchemas.ts`, `coreTools.ts`, `autonomousFallback.ts`, `/api/mcp`)**:
  - Added `core_manage_blueprint` (`list`, `deploy`, `undeploy`), `core_manage_domain_tls` (`list`, `bind`, `unbind`), and `core_system_ota_status` (`status`) so the AI Copilot and external MCP Clients can manage 1-Click Stack Blueprints, Custom Domain & Auto-TLS Reverse-Proxy bindings (`Domains.json`), and OTA system status checks.
- **Automatic Pre-Flight Time-Machine Checkpoints on Blueprint Deploy & Undeploy (`/api/blueprints`)**:
  - `POST /api/blueprints` (`deploy` & `undeploy`) now automatically records a Pre-Flight Time-Machine Checkpoint (`actor: "Auto-Watchdog"`) and returns `checkpoint_id`.
- **Full-Platform Self-Test Check `resilience_and_mcp` (`/api/debug`)**:
  - `POST /api/debug` (`action: "self_test"`) now validates the Self-Healing Policy Store, Time-Machine Checkpoints, Offsite Backups, and the complete AI/MCP Tool Registry (`SYNAPSE_TOOL_SCHEMAS.length`).

---

## [v1.4.0] — 2026-10-31 (Self-Healing & Service-Mesh AI/MCP Parity, Ephemeral Hot-Reload PTY-GC & Studio Checkpoint-Badge)

### Added & Improved
- **AI-Orchestrator & MCP Self-Healing & Service-Mesh Tools (`resilienceAndMeshTools.ts`, `toolSchemas.ts`, `coreTools.ts`, `autonomousFallback.ts`, `/api/mcp`)**:
  - Added `core_manage_self_healing` (`inspect`, `configure`, `heal_now`, `simulate_crash`) and `core_probe_service_mesh` (`probe_service`, `probe_link`, `deploy_custom_service`) so the AI Copilot and external MCP Clients can manage Self-Healing policies, trigger immediate service recovery/chaos tests, probe service-mesh links, and deploy custom microservices.
- **Ephemeral `hot-reload-*` PTY Garbage Collection in Axon (`pty_discovery.go`, `pty_test.go`)**:
  - Added `hot-reload-*` to `IsEphemeralSessionID` in `agents/axon/internal/pty/pty_discovery.go` so one-shot Live-Code Hot-Reload sessions are automatically reaped upon completion.
- **Pre-Flight Checkpoint-ID Badge in Live-Code Hot-Reload Studio UI (`ReverseProxyCodeAndSqliteStudios.tsx`)**:
  - The Live-Code Hot-Reload status notice now displays both the pre-write file `snapshot_id` and the Pre-Flight Time-Machine `checkpoint_id` upon Save & Hot-Reload.

---

## [v1.3.0] — 2026-10-31 (Studio-DevOps AI/MCP Parity, Pre-Flight Hot-Reload Time-Machine Checkpoints & 1-Click SecOps Quick-Audit)

### Added & Improved
- **AI-Orchestrator & MCP Studio-DevOps Tools (`studioDevOpsTools.ts`, `toolSchemas.ts`, `coreTools.ts`, `autonomousFallback.ts`, `/api/mcp`)**:
  - Added `core_hot_reload_service_code` (`inspect`, `hot_reload`), `core_sqlite_studio` (`db_path`, `table`, `custom_sql`, `insert_row`), and `core_manage_cron_jobs` (`list`, `save`, `delete`, `run_now`) so the AI Copilot and external MCP Clients have 100% parity with the Studio UI.
- **Automatic Pre-Flight Time-Machine Checkpoints on Live-Code Hot-Reload (`v070-studio.ts`)**:
  - `hotReloadServiceCodeOnMuscle` now automatically records a Pre-Flight Time-Machine Checkpoint (`actor: "Auto-Watchdog"`) before modifying and restarting a live service on a Muscle node, returning `checkpoint_id`.
- **1-Click SecOps & Watchdog Quick-Audit in Studio UI (`GitOpsStudioPanel.tsx`)**:
  - Added a 1-Click **SecOps & Watchdog Check** button in the Service Workbench that runs a combined Watchdog threshold evaluation (`/api/alerts` -> `evaluate`) and SSH intrusion radar scan (`/api/service-ops` -> `intrusion_scan`).

---

## [v1.2.0] — 2026-10-31 (Autonomous SecOps/Watchdog AI & MCP Tools, Background Threshold Evaluator & Ephemeral GitOps/Blueprint PTY Reaping)

### Added & Improved
- **AI-Orchestrator & MCP SecOps/Watchdog Tools (`secopsAndWatchdogTools.ts`, `toolSchemas.ts`, `coreTools.ts`, `autonomousFallback.ts`, `/api/mcp`)**:
  - Added `core_manage_alerts` (`inspect`, `configure`, `test_alert`, `evaluate`) and `core_intrusion_scan` (`scan`, `block_ip`) so the AI Copilot and external MCP Clients can inspect/configure Watchdog Alert Rules, evaluate threshold breaches, scan Linux SSH auth logs for brute-force IPs, and block attackers via UFW/IPTables.
- **Throttled Background Watchdog Threshold Evaluator (`projectTelemetrySync.ts`, `secopsAndWatchdogTools.ts`)**:
  - `syncProjectTelemetryAndWatchdog` now automatically runs `evaluateNodeWatchdogAlerts` on a 60-second cooldown across connected Muscle nodes, dispatching `WARNING`/`CRITICAL` events when `cpu_threshold`, `ram_threshold`, `disk_threshold`, or `alert_on_service_down` are breached.
- **GitOps & Blueprint Ephemeral PTY Reaping & Pre-Flight Checkpoint UI Badge (`pty_discovery.go`, `GitOpsStudioPanel.tsx`)**:
  - Added `gitops-*` and `blueprint-*` to `IsEphemeralSessionID` in `agents/axon/internal/pty/pty_discovery.go` so one-shot GitOps and Blueprint sessions are automatically reaped upon completion.
  - `GitOpsStudioPanel.tsx` now displays the Pre-Flight Time-Machine `checkpoint_id` directly in the status notice after Deploy and Teardown.

---

## [v1.1.0] — 2026-10-31 (AI/MCP Disaster-Recovery & Time-Machine Tools, Pre-Flight GitOps Checkpoints & 1-Click Studio Backup)

### Added & Improved
- **AI-Orchestrator & MCP Disaster-Recovery Tools (`disasterRecoveryTools.ts`, `toolSchemas.ts`, `coreTools.ts`, `autonomousFallback.ts`, `/api/mcp`)**:
  - Added `core_manage_backup` (`list`, `create`, `restore`, `delete`) and `core_manage_checkpoint` (`list`, `create`, `rollback`) so the AI Copilot and external MCP Clients can create and restore AES-256-GCM Offsite Backups and Time-Machine Server Checkpoints autonomously.
  - Added `action: "delete"` to `/api/backups`.
- **Automatic Pre-Flight Time-Machine Checkpoints in GitOps (`gitopsDeployer.ts`)**:
  - `deployGitStackOnMuscle` and `deleteGitStackOnMuscle` now automatically record a Pre-Flight Time-Machine Checkpoint (`actor: "Auto-Watchdog"`) before modifying or tearing down stacks, returning `checkpoint_id`.
- **1-Click Offsite-Backup in GitOps Studio UI (`GitOpsStudioPanel.tsx`)**:
  - Added a 1-Click **Offsite-Backup (`AES-256-GCM`)** button directly inside the Service Workbench Studio Panel.

---

## [v1.0.0] — 2026-10-31 (General Availability GA — Production OTA Sync, Ephemeral OTA-PTY GC, Cluster Self-Test & Bilingual Docs Seal)

### Added & Improved
- **Production-Standalone OTA Updater & `ota-*` Ephemeral PTY GC (`systemUpdateHelpers.ts`, `system-update/route.ts`, `pty_discovery.go`)**:
  - `gatherSystemStatus` (`/api/system-update`) now exposes `version: SYNAPSE_VERSION` (`v1.0.0`) and uses `ota-check` ephemeral PTY sessions.
  - `performCoreUpdate` automatically synchronizes `.next/static` into `.next/standalone/.next/static` on standalone deployments.
  - `IsEphemeralSessionID` in `agents/axon/internal/pty/pty_discovery.go` now automatically reaps `ota-*` sessions upon completion.
- **`v1.0.0` Cluster-Readiness Self-Test (`/api/debug`)**:
  - `GET /api/debug` and `POST /api/debug` (`action: "self_test"`) now report `version: SYNAPSE_VERSION` (`v1.0.0`) and validate Rule Cartridges, Stack Blueprints, GitOps Stacks (`GitStacks.json`), and Cron Runbooks (`CronJobs.json`) store integrity.
- **Bilingual `v1.0.0` Documentation Seal (`README.md`, `README.de.md`, `SECURITY.md`, `CHANGELOG.md`)**:
  - Synchronized English (`README.md`) and German (`README.de.md`) documentation covering the full `v1.0.0` feature suite (GitOps Stack Deployer & Teardown, Interactive Live-Service-Log Inspector, Autonomous Cron-Due Scheduler, 60-Sample Telemetry Sparklines, Ephemeral-PTY GC, and Full MCP/AI Tool Parity).

---

## [v0.9.0] — 2026-10-31 (Single-Source Versioning, Interactive Live-Log Studio & AI/MCP Teardown + Telemetry Parity)

### Added & Improved
- **Single-Source-of-Truth Versioning (`apps/core-web/src/lib/version.ts`)**:
  - Exported `SYNAPSE_VERSION = "v0.9.0"` and `SYNAPSE_SEMVER = "0.9.0"` from a central module and bound all UI version badges (`ControlCenterChrome.tsx`, `CommandPaletteModal.tsx`, `CanvasModalsAndToolbar.tsx`, `ReverseProxyCodeAndSqliteStudios.tsx`, `AccessRulesView.tsx`, `AuditLogView.tsx`, `GitOpsStudioPanel.tsx`) and `/api/mcp` `serverInfo.version` to it, eliminating UI version drift permanently.
- **Interactive Live-Service-Log Inspector in Studio UI (`GitOpsStudioPanel.tsx`, `serviceMeshAndBuilder.ts`)**:
  - Added an interactive Live-Log Inspector (`tail_service_logs` via `/api/service-ops`) with port/container/systemd-unit selection, source detection badge (`docker` / `systemd` / `sqlite` / `workspace`), error line counter, configurable line count (`25` / `50` / `100`), and 1-click log inspection directly on each deployed GitOps stack.
- **100% AI-Orchestrator & MCP Server Parity (`toolSchemas.ts`, `coreTools.ts`, `autonomousFallback.ts`, `/api/mcp`)**:
  - Added `core_delete_git_stack` (GitOps stack teardown) and `core_get_node_telemetry_history` (read-only 60-sample CPU/RAM/Disk trend query) to both the AI Copilot and the MCP Server (`tools/list` & `tools/call`).

---

## [v0.8.0] — 2026-10-31 (Axon Ephemeral-PTY Garbage Collection, GitOps Stack Teardown & 60-Sample Telemetry Sparklines)

### Added & Improved
- **Axon Ephemeral-PTY Garbage Collection & Session-Cap (`agents/axon/internal/pty/pty.go`, `pty_discovery.go`)**:
  - `IsEphemeralSessionID`, `CloseSession`, and `PruneClosedAndExcessSessions` automatically reap one-shot diagnostic, backup, cron, and log PTY sessions (`offsite-bkp-*`, `chaos-resilience-*`, `cron-runner-*`, `service-logs-*`, `probe-*`, `security-radar-*`, `db-explorer-*`, `checkpoint-*`) upon completion and cap total idle sessions to prevent file-descriptor or memory leaks on long-running Muscle nodes.
- **Complete GitOps Stack Lifecycle — Teardown & Delete (`gitopsDeployer.ts`, `/api/service-ops`, `GitOpsStudioPanel.tsx`)**:
  - Added `deleteGitStackOnMuscle` (`POST /api/service-ops` -> `delete_git_stack`) and a 1-click **Teardown** button in `GitOpsStudioPanel.tsx` to run `docker compose down --remove-orphans`, clean up the stack directory, and remove the stack from `GitStacks.json` and `State.json`.
- **60-Sample Live Telemetry Sparklines & Standalone Static Sync (`PeersMeshAndAutomationSubTabs.tsx`, `ensure-core-ha.sh`)**:
  - Added 60-sample CPU, RAM, and Latency sparkline bars in the Server & Mesh overview (`PeersMeshAndAutomationSubTabs.tsx`).
  - Automated `.next/static` synchronization into `.next/standalone/.next/` in `package.json` and `scripts/ensure-core-ha.sh`.

---

## [v0.7.0] — 2026-10-31 (AI-Orchestrator & MCP GitOps/Log/Cron Tools, Interactive GitOps Studio UI & Background Cron Scheduler)

### Added & Improved
- **AI-Orchestrator & MCP-Server Integration (`toolSchemas.ts`, `coreTools.ts`, `autonomousFallback.ts`, `/api/mcp`)**:
  - Exposed `core_deploy_git_stack`, `core_tail_service_logs` (read-scope compatible), and `core_run_due_cron_jobs` across both the built-in Copilot and the Streamable HTTP JSON-RPC 2.0 MCP Server (`/api/mcp`).
  - Added deterministic chat workflows (`gitops:`, `logs:`, `cron-due`) in `autonomousFallback.ts`.
- **Interactive GitOps & Cron-Due Studio Panel (`GitOpsStudioPanel.tsx` & `ReverseProxyView.tsx`)**:
  - Dedicated 1-click GitOps Stack Deployer in the Service Workbench with automatic `Secrets.enc` -> `0600 .env` injection, one-time webhook token preview/copy, active stack list, and 1-click webhook redeploy.
- **Automatic Background Cron-Tick in Telemetry Sync (`projectTelemetrySync.ts`)**:
  - Integrated a throttled (60s cooldown per project) background invocation of `runDueCronJobsOnMuscle` during active Muscle node telemetry synchronization.

---

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
