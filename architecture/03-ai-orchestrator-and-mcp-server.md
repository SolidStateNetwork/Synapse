# 🤖 03 – AI Orchestrator & Model Context Protocol (`MCP`) Server

Dieses Dokument beschreibt die Architektur des **Synapse AI Orchestrators**, das Prompt-Caching-System, die deterministische Fallback-Engine sowie den integrierten **MCP-Server (`/api/mcp`)**.

---

## 1. 100 % Full-Stack Tool-Parität (35 Tools total: 31 Core/Node-Tools + 4 MCP-Meta-Tools)

Synapse stellt sicher, dass sowohl der interne **AI Copilot** als auch externe KI-Agenten (Claude Desktop, Cursor, Windsurf, Cline) über exakt dieselben strukturierten Werkzeuge verfügen wie ein menschlicher Administrator im WebUI.

### Übersicht der Tool-Module (`apps/core-web/src/lib/orchestrator/`)

| Modul | Bereitgestellte Tools | Funktion |
| :--- | :--- | :--- |
| **`toolSchemas.ts` & `nodeTools.ts`** | `node_pty_exec`, `node_fs_operation`, `node_deep_search`, `node_firewall_control`, `core_vault_search` | Basis-Interaktion mit Muscle-Nodes (PTY-Shell, Dateisystem mit Pre-Write-Snapshot, 6-Modus Forensik-Suche, Host-Firewall & Vault-Suche). |
| **`coreTools.ts`** | `core_update_brain_doc`, `core_register_service`, `core_manage_secret`, `core_link_peers`, `core_deploy_git_stack`, `core_delete_git_stack`, `core_tail_service_logs`, `core_get_node_telemetry_history`, `core_run_due_cron_jobs` | Pflege von `Architecture.md` & `Memory.md`, Service-Registrierung, `Secrets.enc`, Peer-Mesh-Relays, GitOps-Stacks, Live-Logs & Telemetrie. |
| **`disasterRecoveryTools.ts`** | `core_manage_backup`, `core_manage_checkpoint` | Erstellen, Auflisten, Wiederherstellen und Löschen von `AES-256-GCM` Offsite-Backups und Time-Machine Checkpoints. |
| **`secopsAndWatchdogTools.ts`** | `core_manage_alerts`, `core_intrusion_scan` | 24/7 Watchdog-Schwellenwerte, Webhook-Testalarme, SSH-Intrusion-Radar und 1-Click Angreifer-IP-Sperre. |
| **`studioDevOpsTools.ts`** | `core_hot_reload_service_code`, `core_sqlite_studio`, `core_manage_cron_jobs` | Syntax-geprüfter Live-Code Hot-Reload, SQLite-Tabellen-/SQL-Studio und Cron-Runbook-Verwaltung. |
| **`resilienceAndMeshTools.ts`** | `core_manage_self_healing`, `core_probe_service_mesh` | Self-Healing-Policy, MTTR-Chaos-Simulation, Service-Mesh-Latenz-Probes & Custom-Microservice-Builder. |
| **`blueprintDomainAndOtaTools.ts`** | `core_manage_blueprint`, `core_manage_domain_tls`, `core_system_ota_status` | 1-Click Stack-Blueprints, Custom-Domain/TLS-Bindings & OTA-System-Update-Status. |
| **`firewallCartridgeAndClusterTools.ts`** | `core_manage_firewall`, `core_manage_cartridges`, `core_manage_cluster_nodes` | Synapse Shield Firewall-Profile & Port-Schilde, AI Rule Cartridges & Cluster-Node-Enrollment. |
| **`projectAndDiagnosticTools.ts`** | `core_manage_projects`, `core_run_platform_self_test` | Projekt-Workspaces, `planning_only`-Guardrail, `Audit.jsonl`-Abfrage & 6-stufiger Plattform-Selbsttest. |
| **`playbookAndApprovalTools.ts`** | `core_manage_playbooks`, `core_manage_approvals` | Geplante KI-Playbooks, eigene Rule-Cartridges & Freigabe/Ablehnung von `TIER_3_SUPERVISED`-Aktionen. |
| **`workbenchAndAuthTools.ts`** | `core_invoke_service_action`, `core_manage_auth_and_ai` | Service-Workbench (`GET`/`POST`/`PUT`/`DELETE`/`SQL`), RBAC/2FA-Status, Session-Revocation & AI-Provider-Konfiguration. |
| **`topologyAndCanaryTools.ts`** | `core_manage_topology_bundle`, `core_cluster_canary_exec` | Deklarativer Export/Import kompletter Projekt-Topologien (`synapse-stack/v2.0`) & Multi-Node Canary Rollouts mit Pre-Flight Checkpoint. |

---

## 2. Prompt-Cache-Optimierter System-Prompt (`promptBuilder.ts`)

Um Latenz und Token-Kosten bei Multi-Step-Agentenläufen drastisch zu senken, teilt `buildCacheOptimizedSystemPromptParts` jeden Prompt in zwei Teile:
1. **`staticPrefix` (Cacheable):** Enthält die System-Direktive, die aktiven **AI Rule Cartridges** (`cartridges/*.md`) und das vollständige `Architecture.md`. Dieser Block ändert sich zwischen Chat-Schritten kaum und wird über `cache_control: { type: "ephemeral" }` (Anthropic) bzw. automatisches Prefix-Caching (OpenAI) gecacht.
2. **`dynamicSuffix` (Live State):** Enthält die aktuelle Knoten-Telemetrie, registrierte Dienste, Secret-Key-Namen (niemals Klartext-Werte!) und die letzten Einträge aus `Memory.md`.

---

## 3. Model Context Protocol (`MCP`) Server (`/api/mcp`)

Unter `/api/mcp` implementiert Synapse einen standardkonformen **MCP Streamable HTTP (`JSON-RPC 2.0`) + REST Tool Server** (`protocolVersion: "2024-11-05"`):

- **Unterstützte JSON-RPC-Methoden:** `initialize`, `notifications/initialized`, `ping`, `tools/list`, `tools/call`, `resources/list`, `resources/read` (`Architecture.md`, `Memory.md`, `State.json`, `Audit.jsonl`), `prompts/list`.
- **Gehashte API-Keys & Scopes (`syn_mcp_...`):**
  - Jeder MCP-API-Schlüssel wird nur bei der Erstellung einmalig im Klartext angezeigt und in `State.json` ausschließlich als **SHA-256-Hash** gespeichert.
  - **Scope-Enforcement (`isReadOnlyTool`):** Schlüssel mit reinem `read`-Scope dürfen alle Inspektions-, Diagnose-, Selbsttest- und `GET`-Abfragen ausführen, werden aber bei mutierenden Tools deterministisch blockiert.
