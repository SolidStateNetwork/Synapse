# ⬛ GLOBAL MEMORY BLACKBOX – Chronologisches Entwicklungs-Logbuch & ADRs

> **ZWECK DIESER DATEI:**  
> Die `BLACKBOX.md` ist das zentrale, unveränderliche Langzeitgedächtnis (Append-Only Engineering Log & Architecture Decision Record) von **Synapse (`SolidStateNetwork/Synapse`)**.  
> **Jeder KI-Agent und Entwickler**, der Features implementiert, die Architektur erweitert oder Releases durchführt, **muss** hier einen strukturierten Eintrag hinterlassen (neueste Einträge immer **oben**).

---

## 📝 Vorlage für neue Blackbox-Einträge

```markdown
### [BB-XXX] YYYY-MM-DD HH:MM (TZ) – [MODUL / VERSION] Kurztitel der Änderung
- **Akteur:** <KI-Modell / Agent / Entwickler>
- **Typ:** `ARCHITECTURE` | `FEATURE` | `SECURITY` | `UI` | `TEST` | `RELEASE`
- **Betroffene Module:** `ARCH-LEXICON` | `CORE-GATEWAY` | `AXON-AGENT` | `AI-ORCHESTRATOR` | `MCP-SERVER` | `RESILIENCE-DR` | `WEB-STUDIO-UI` | `CONTAINER-LAB`
- **Ziel / Hintergrund:** Warum wurde die Änderung durchgeführt?
- **Durchgeführte Schritte:** Welche Dateien, Go-Packages oder TS-Module wurden erstellt/angepasst?
- **Verifikation:** Testergebnisse, Coverage-Werte (`>= 85 %` Go / `>= 90 %` TS), Line-Count-Audit (`< 500` Go / `< 600` TS) & CI-Status.
```

---

## 🏛️ Architecture Decision Records (ADRs)

| ADR-ID | Entscheidung | Begründung |
| :--- | :--- | :--- |
| **ADR-001** | **Strikte Core („The Brain“) & Muscle („The Hands“) Trennung über Outbound mTLS 1.3 + Yamux** | Verhindert, dass Zielserver eingehende Firewall-Ports öffnen müssen, und isoliert die KI-Steuerzentrale inkl. `Secrets.enc` vollständig von der Code-Ausführung auf den verwalteten Linux-Knoten. |
| **ADR-002** | **Deterministischer Self-Lockout Guard & 3 Autonomie-Stufen (`TIER_1`–`TIER_3`) im Agenten** | Sicherheit darf niemals allein von LLM-System-Prompts abhängen. `axon` blockiert Befehle gegen die eigene PID/Firewall (`ERR_SELF_PROTECTION_VIOLATION`) und erzwingt kanonische Workspace-Jails (`TIER_2`) bzw. menschliche Freigaben (`TIER_3`) deterministisch im Code. |
| **ADR-003** | **100 % Full-Stack AI & Model Context Protocol (`MCP`) Tool-Parität** | Jede Funktion des Web-Cockpits ist gleichzeitig als typisiertes Tool im internen AI-Orchestrator und über `/api/mcp` (`JSON-RPC 2.0`) für externe KI-Clients (Claude, Cursor, Windsurf) nutzbar. |
| **ADR-004** | **Automatische Pre-Flight Time-Machine Checkpoints (`chk-...`) vor jeder Mutation** | Vor jedem Blueprint-Deploy, GitOps-Rollout/Teardown, Custom-Service-Deploy, Code-Hot-Reload, Firewall-Eingriff und OTA-System-Update wird automatisch ein Snapshot angelegt, um 1-Click-Rollbacks zu garantieren. |
| **ADR-005** | **Harte Modularisierungs- & Coverage-Gates (`< 500` Zeilen Go, `< 600` Zeilen TS/TSX, `>= 85 %` Go / `>= 90 %` TS Coverage)** | Verhindert monolithische Dateien, hält den Kontext für KI-Agenten präzise und erzwingt durch automatisierte CI- und Pre-Commit-Prüfungen dauerhafte Code-Qualität ohne `any`-Typen. |
| **ADR-006** | **Public Clean-Room Policy & Lokales 2-Container-Labor (`containers/`)** | Als öffentliches Repository darf Synapse keinerlei echte Server-IPs, lokale Benutzerpfade (`/home/<user>`) oder Geheimnisse enthalten. Die gesamte Ende-zu-Ende-Entwicklung und Verifikation läuft isoliert in zwei lokalen Containern (`synapse-core` + `synapse-muscle`). |

---

## 📜 Chronologisches Logbuch (Neueste zuerst)

### [BB-005] 2026-11-01 01:16 (CET) – [ARCH-LEXICON] Einführung des Enterprise Architektur-Lexikons, Multi-IDE KI-Governance & Public Pre-Commit Guardrails
- **Akteur:** Antigravity AI & Project Lead
- **Typ:** `ARCHITECTURE` | `SECURITY`
- **Betroffene Module:** `ARCH-LEXICON` (`architecture/00`–`04`, `memory/*`, `playbooks/01`–`02`, `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `.cursorrules`, `.windsurfrules`, `.github/copilot-instructions.md`, `.agents/hooks.json`, `.githooks/pre-commit`, `README.md`, `README.de.md`)
- **Ziel / Hintergrund:** Vereinheitlichung der GitHub-Repository-Struktur von `SolidStateNetwork/Synapse` nach dem bewährten Enterprise-Lexikon-Standard (`Strata`), inklusive automatischer Kontext-Injektion bei Session-Start und technischem Pre-Commit-Blocker für das öffentliche Repository.
- **Durchgeführte Schritte:**
  1. 5 modulare Architektur-Spezifikationen unter `architecture/00-product-vision.md` bis `04-resilience-security-and-ota.md` erstellt.
  2. Persistentes Projekt-Gedächtnis unter `memory/PROJECT_STATE.md`, `memory/MILESTONES.md` und `memory/BLACKBOX.md` (inkl. `ADR-001` bis `ADR-006`) aufgebaut.
  3. Standard Operating Procedures unter `playbooks/01-feature-and-milestone-sop.md` und `playbooks/02-container-lab-and-release-sop.md` dokumentiert.
  4. Multi-IDE Root-Direktiven (`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `.cursorrules`, `.cursor/rules/00-lexicon-governance.mdc`, `.windsurfrules`, `.github/copilot-instructions.md`), Lifecycle-Hooks (`.agents/hooks.json`) sowie den technischen Pre-Commit-Guardrail (`.githooks/pre-commit`) eingerichtet.
  5. `README.md`, `README.de.md` und die GitHub-Repository-Metadaten auf den vollständigen `v1.9.0`-Funktionsumfang aktualisiert.
- **Verifikation:** Zero-Private-Data-Scan (`0` Treffer), Pre-Commit-Hook aktiv, alle Go- und TypeScript-Tests 100 % grün.

### [BB-004] 2026-11-01 00:55 (CET) – [AI-ORCHESTRATOR / MCP-SERVER / v1.9.0] Service-Workbench, RBAC & AI-Endpoint Tools, Pre-Flight Custom-Service Checkpoints & Studio Badges
- **Akteur:** Antigravity AI & Project Lead
- **Typ:** `FEATURE` | `RELEASE`
- **Betroffene Module:** `AI-ORCHESTRATOR`, `MCP-SERVER`, `RESILIENCE-DR`, `WEB-STUDIO-UI`, `CONTAINER-LAB`
- **Ziel / Hintergrund:** Abschluss der 100 % AI/MCP-Parität für die interaktive Service-Workbench (`GET`/`POST`/`PUT`/`DELETE`/`SQL`), den RBAC/2FA-Status und die AI-Endpoint-Konfiguration sowie automatische Pre-Flight Checkpoints beim Custom-Service-Deploy.
- **Durchgeführte Schritte:**
  - `workbenchAndAuthTools.ts` (`core_invoke_service_action`, `core_manage_auth_and_ai`) erstellt und in `extendedToolSchemas.ts`, `coreTools.ts`, `autonomousFallback.ts` und `/api/mcp/route.ts` integriert.
  - `deployCustomServiceOnMuscle` (`serviceMeshAndBuilder.ts`) und `triggerGitOpsWebhookRedeploy` (`gitopsDeployer.ts`) um automatische Pre-Flight Checkpoints (`checkpoint_id`) erweitert.
  - Checkpoint-Badges in `GitOpsStudioPanel.tsx` und `useCanvasStudioAndDomainActions.ts` ergänzt.
- **Verifikation:** Go Coverage `88.0 %`, TS Line Coverage `94.31 %`, Max Go `499` Zeilen, Max TS `596` Zeilen, CI (`41254447815`) & Release (`41254450359`) mit `0` Annotationen grün, lokale Container auf `v1.9.0` ausgerollt.

### [BB-003] 2026-11-01 00:36 (CET) – [AI-ORCHESTRATOR / AXON-AGENT / v1.8.0] Playbooks & Approvals AI/MCP Tools, Vollständige Ephemeral-PTY-GC & Blueprint/OTA Badges
- **Akteur:** Antigravity AI & Project Lead
- **Typ:** `FEATURE` | `RELEASE`
- **Betroffene Module:** `AI-ORCHESTRATOR`, `AXON-AGENT`, `WEB-STUDIO-UI`
- **Ziel / Hintergrund:** Bereitstellung von `core_manage_playbooks` und `core_manage_approvals` für AI/MCP, Schließen aller verbleibenden One-Shot-PTY-Sessions in `axon` und Anzeige der `checkpoint_id` in Blueprints & System-Update UI.
- **Durchgeführte Schritte:**
  - `playbookAndApprovalTools.ts` implementiert; `svc-cleanup-`, `sys-update-`, `mesh-` und `custom-svc-` in `IsEphemeralSessionID` (`pty_discovery.go`) ergänzt; Badges in `useCanvasOpsController.ts`, `useSystemAndInfraActions.ts` und `SystemUpdateAndDebugTabs.tsx` eingebaut.
- **Verifikation:** Go Coverage `88.0 %`, TS Coverage `94.30 %`, CI (`41253206064`) & Release (`41253209196`) 100 % grün.

### [BB-002] 2026-11-01 00:15 (CET) – [AI-ORCHESTRATOR / CONTAINER-LAB / v1.6.0 & v1.7.0] Firewall/Cartridges/Cluster/Projects/Diagnostics Tools, Container-Native OTA & 2-Container-Lab
- **Akteur:** Antigravity AI & Project Lead
- **Typ:** `ARCHITECTURE` | `FEATURE` | `RELEASE`
- **Betroffene Module:** `CONTAINER-LAB`, `AI-ORCHESTRATOR`, `SECOPS-SHIELD`, `RESILIENCE-DR`
- **Ziel / Hintergrund:** Umstellung der lokalen Entwicklung auf zwei isolierte Container (`containers/manage.sh`: `synapse-core` + `synapse-muscle`), Modularisierung der Tool-Schemas (`extendedToolSchemas.ts`), Pre-Flight Checkpoints für Firewall & System-Updates sowie Container-native OTA-Rollouts.
- **Durchgeführte Schritte:**
  - `containers/` Setup (`core/Dockerfile`, `muscle/Dockerfile`, `docker-compose.yml`, `manage.sh`) aufgebaut.
  - `firewallCartridgeAndClusterTools.ts` (`v1.6.0`) und `projectAndDiagnosticTools.ts` (`v1.7.0`) sowie Pre-Flight Checkpoints in `/api/firewall` und `/api/system-update` implementiert.
- **Verifikation:** Lokale Container laufen stabil auf `:3000`/`:8081`/`:8443` (`local-muscle` verbunden), alle CI- & Release-Pipelines grün.

### [BB-001] 2026-10-31 22:30 (CET) – [GLOBAL / v1.0.0 – v1.5.0] Produktions-Meilenstein v1.0.0 & Ausbau der DevOps-, Resilience- & Blueprint-Suites
- **Akteur:** Antigravity AI & Project Lead
- **Typ:** `ARCHITECTURE` | `RELEASE`
- **Betroffene Module:** Alle Module (`PROTO-V1` bis `WEB-STUDIO-UI`)
- **Ziel / Hintergrund:** Abschluss der `v1.0.0` Public-Clean-Room-Architektur (`< 500` Go / `< 600` TS Zeilen, `>= 85 %` Go / `>= 90 %` TS Coverage) und schrittweiser Ausbau bis `v1.5.0` (GitOps, Live-Logs, Disaster-Recovery, SecOps, Hot-Reload, SQLite-Studio, Self-Healing, Service-Mesh, Blueprints, Domain/TLS & 6-Stufen Self-Test).
- **Verifikation:** 100 % grüne GitHub Actions CI- und Multi-Arch-Release-Pipelines (`v1.0.0` bis `v1.5.0`).
