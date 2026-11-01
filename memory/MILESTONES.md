# 🎯 MILESTONES – End-to-End Entwicklungs- & Release-Fahrplan für Synapse

Dieses Dokument dokumentiert die abgeschlossenen Entwicklungsphasen von **Synapse (`SolidStateNetwork/Synapse`)** sowie den Ausblick auf kommende Ausbaustufen.

---

## ✅ Phase 1: Core & Muscle Fundament, mTLS 1.3 PKI & Brain Vault (`v0.1.0` – `v0.5.0`)
*Referenz: [`architecture/00-product-vision.md`](../architecture/00-product-vision.md) & [`architecture/02-mtls-tunnel-and-axon-agent.md`](../architecture/02-mtls-tunnel-and-axon-agent.md)*
- [x] **M1.1:** Go Workspace (`proto`, `apps/core-gateway`, `agents/axon`) mit ECDSA P-256 Root CA, One-Time CSR Enrollment und `hashicorp/yamux` Stream-Multiplexing.
- [x] **M1.2:** 3 Autonomie-Stufen (`TIER_1_UNLEASHED`, `TIER_2_WORKSPACE_JAIL`, `TIER_3_SUPERVISED`) inkl. kanonischer Pfad-Isolation und Deterministic Self-Lockout Guard (`ERR_SELF_PROTECTION_VIOLATION`).
- [x] **M1.3:** Verschlüsselter Project Brain Vault (`State.json`, `AES-256-GCM` `Secrets.enc`, `Architecture.md`, `Memory.md`, `Audit.jsonl`) und Pre-Write Datei-Rollback-Snapshots.
- [x] **M1.4:** Interaktives Next.js 15 Control Center mit Topology Canvas, Live-Preview Reverse Proxy, Xterm.js PTY-Terminal und modularen AI Rule Cartridges (`cartridges/`).

---

## ✅ Phase 2: Autonomous Resilience, DevOps Studio & Enterprise Security (`v0.6.0` – `v1.0.0`)
*Referenz: [`architecture/04-resilience-security-and-ota.md`](../architecture/04-resilience-security-and-ota.md)*
- [x] **M2.1:** Autonomous Self-Healing Engine, MTTR-Chaos-Simulation, Custom Service Builder (`python_http`, `static_webui`, `sqlite_rest`) und Service-Mesh Latenz-Probes.
- [x] **M2.2:** Live-Code Hot-Reload (mit Python-Syntax-Gate & Auto-Rollback), SQLite Data Studio und geplante Cron-Runbooks (`CronJobs.json`).
- [x] **M2.3:** Time-Machine Server Checkpoints (`Checkpoints.json`), `AES-256-GCM` Offsite-Backups (`Backups.json`), 24/7 Watchdog-Alerts (`Alerts.json`), SSH-Intrusion-Radar und RBAC + 2FA-TOTP (`auth.ts`).
- [x] **M2.4:** Integrierter Model Context Protocol (`MCP`) Server (`/api/mcp` JSON-RPC 2.0) mit gehashten API-Keys (`syn_mcp_...`), `v1.0.0` Public Clean-Room Audit, `< 500` Go / `< 600` TS Modularisierung und `>= 85 %` Go / `>= 90 %` TS Coverage-Gates.

---

## ✅ Phase 3: Full-Stack AI/MCP Tool-Parität & Pre-Flight Time-Machine (`v1.1.0` – `v1.5.0`)
*Referenz: [`architecture/03-ai-orchestrator-and-mcp-server.md`](../architecture/03-ai-orchestrator-and-mcp-server.md)*
- [x] **M3.1 (`v1.1.0`):** GitOps Stack-Deployer (`GitStacks.json`), Live-Service-Log-Inspector, 60-Sample Node-Telemetrie-Historie & Hintergrund-Cron-Due-Scheduler.
- [x] **M3.2 (`v1.2.0`):** AI/MCP Disaster-Recovery-, SecOps- & Watchdog-Tools (`core_manage_backup`, `core_manage_checkpoint`, `core_manage_alerts`, `core_intrusion_scan`) + Pre-Flight Checkpoints vor GitOps-Deployments.
- [x] **M3.3 (`v1.3.0`):** AI/MCP Studio-DevOps-Tools (`core_hot_reload_service_code`, `core_sqlite_studio`, `core_manage_cron_jobs`) + Pre-Flight Checkpoints vor Code-Hot-Reload.
- [x] **M3.4 (`v1.4.0`):** AI/MCP Self-Healing- & Service-Mesh-Tools (`core_manage_self_healing`, `core_probe_service_mesh`), Ephemeral `hot-reload-*` PTY-GC & Hot-Reload Checkpoint-Badge.
- [x] **M3.5 (`v1.5.0`):** AI/MCP Blueprint-, Domain/TLS- & OTA-Tools (`core_manage_blueprint`, `core_manage_domain_tls`, `core_system_ota_status`), Pre-Flight Checkpoints bei Blueprints & 6-stufiger Plattform-Selbsttest (`/api/debug`).

---

## ✅ Phase 4: Lokales 2-Container-Labor, Vollständige PTY-GC & 100 % MCP-Abdeckung (`v1.6.0` – `v1.9.0`)
*Referenz: [`containers/`](../containers/) & [`CHANGELOG.md`](../CHANGELOG.md)*
- [x] **M4.1 (`v1.6.0`):** Lokales 2-Container-Entwicklungslabor (`containers/manage.sh`: `synapse-core` + `synapse-muscle`), AI/MCP Firewall-, Cartridge- & Cluster-Node-Tools (`core_manage_firewall`, `core_manage_cartridges`, `core_manage_cluster_nodes`), Pre-Flight Firewall-Checkpoints & `fw-*` PTY-GC.
- [x] **M4.2 (`v1.7.0`):** Schema-Modularisierung (`extendedToolSchemas.ts`), AI/MCP Projekt- & Diagnose-Tools (`core_manage_projects`, `core_run_platform_self_test`), Container-native OTA-Updates mit Pre-Flight Checkpoints & Firewall Checkpoint-Badge.
- [x] **M4.3 (`v1.8.0`):** AI/MCP Playbook-, Custom-Cartridge- & Approval-Tools (`core_manage_playbooks`, `core_manage_approvals`), vollständige Ephemeral-PTY-GC (`svc-cleanup-`, `sys-update-`, `mesh-`, `custom-svc-`) & Checkpoint-Badges in Blueprints/OTA-UI.
- [x] **M4.4 (`v1.9.0`):** AI/MCP Service-Workbench-, RBAC- & AI-Endpoint-Tools (`core_invoke_service_action`, `core_manage_auth_and_ai`), Pre-Flight Checkpoints bei GitOps-Redeploy/Teardown & Custom-Service-Deploy sowie Studio Checkpoint-Badges.

---

## ✅ Phase 5: Enterprise GitHub-Struktur, Architektur-Lexikon & Public Pre-Commit Guardrails
*Referenz: [`AGENTS.md`](../AGENTS.md), [`architecture/`](../architecture/) & [`memory/`](./)*
- [x] **M5.1:** Aufbau des modularen Architektur-Lexikons (`architecture/00`–`04`) und der Entwicklungs-Playbooks (`playbooks/01` & `02`).
- [x] **M5.2:** Einrichtung des persistenten Projekt-Gedächtnisses (`memory/PROJECT_STATE.md`, `memory/MILESTONES.md`, `memory/BLACKBOX.md` inkl. `ADR-001`–`ADR-006`).
- [x] **M5.3:** Aktivierung der 4-Stufen Multi-IDE KI-Governance (`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `.cursorrules`, `.windsurfrules`, `.github/copilot-instructions.md`, `.agents/hooks.json`) und des technischen Public-Pre-Commit-Blockers (`.githooks/pre-commit`).
- [x] **M5.4:** Aktualisierung der zweisprachigen Public-Dokumentation (`README.md` & `README.de.md`) und der GitHub-Repository-Metadaten.

---

## ✅ Phase 6: Declarative Topology Bundles, Multi-Node Canary Rollouts & SolidState 4-Doc AI Lexicon (`v2.0.0` – `v2.3.0`)
*Referenz: [`architecture/03-ai-orchestrator-and-mcp-server.md`](../architecture/03-ai-orchestrator-and-mcp-server.md) & [`CHANGELOG.md`](../CHANGELOG.md)*
- [x] **M6.1 (`v2.0.0`):** Multi-Node Canary Rollout-Engine (`core_cluster_canary_exec`: `canary_rollout`, `verify_fleet_health`) mit automatischem Pre-Flight Time-Machine Checkpoint und sofortigem Canary-Abbruch bei Exit-Code != 0.
- [x] **M6.2 (`v2.0.0`):** Deklarativer Export & Import kompletter Projekt-Topologien (`core_manage_topology_bundle`: `synapse-stack/v2.0` Schema für Services, Mesh-Links, Cartridges, Playbooks, Cron-Jobs, Domains & Secret-Key-Namen) mit automatischem Pre-Flight Checkpoint.
- [x] **M6.3 (`v2.0.0`):** Live-Verifikation des Architektur-Lexikons (`lexicon_and_governance`) im Plattform-Selbsttest (`/api/debug`) sowie automatische Pre-Flight Checkpoints (`checkpoint_id`) bei Domain/TLS-Mutationen.
- [x] **M6.4 (`v2.1.0`):** 1-Click Topology-Bundle Export/Import-Drawer im Brain-Vault UI (`BrainVaultAndWorkspaceViews.tsx`), Multi-Node Canary & Fleet-Health-Steuerleiste im Peers-UI (`PeersView.tsx`) sowie automatische Pre-Flight Checkpoints (`checkpoint_id`) bei Cron-Runbook- und Playbook-Mutationen.
- [x] **M6.5 (`v2.2.0`):** SolidState 4-Dokumente-Lexikon (`Architecture.md`, `Memory.md [BB-XXX]`, `Milestones.md`, `AGENTS.md`) mit Public/Private Clean-Room Governance & Sanitizer für die interne KI (`lexiconGovernance.ts`, `promptBuilder.ts`, `BrainVaultAndWorkspaceViews.tsx`), Scoped MCP API-Key-Tool (`core_manage_mcp_keys`), 100 % Ephemeral PTY GC (`deep-search-`, `self-heal-`, `link-probe-`) sowie Pre-Flight Checkpoints & UI-Badges für Offsite-Backup-Restores und Intrusion-IP-Blocks.
- [x] **M6.6 (`v2.3.0`):** Lexicon-Everywhere Integration: 4-Doc Lexikon & `visibility` in Topology-Bundles (`core_manage_topology_bundle`), Vault-Search (`milestones` & `agents` Scopes), `@Milestones.md`/`@AGENTS.md` Context-Mentions und `/api/mcp` Resources, 1-Click & KI-gesteuerte Synchronisation des 4-Doc Lexikons in das Remote-Muscle-Workspace (`sync_lexicon_to_node` mit Pre-Flight Checkpoint) sowie automatischer Public Clean-Room Guard für `node_fs_operation` (`write_file`/`apply_unified_diff`).
