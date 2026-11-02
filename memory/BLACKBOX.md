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

### [BB-011] 2026-11-02 13:45 (CET) – [MCP-SERVER / ARCH-LEXICON / v2.3.0] M8ven Verified Badge Claim (`solidstatenetwork-synapse-rv3on4`), Hardened MCP Sliding-Window Rate-Limiting, Centralized `process.env` Resolution & `PRIVACY.md` Directory Compliance
- **Akteur:** Antigravity AI & Project Lead
- **Typ:** `SECURITY` | `FEATURE` | `TEST` | `ARCH-LEXICON`
- **Betroffene Module:** `MCP-SERVER`, `ARCH-LEXICON`, `WEB-STUDIO-UI`, `BRAIN-VAULT`
- **Ziel / Hintergrund:** Einbindung des offiziellen M8ven Verified Badges (`https://m8ven.ai/badge/mcp/solidstatenetwork-synapse-rv3on4?variant=verified`) in `README.md` und `README.de.md`, Ergänzung eines gehärteten Sliding-Window Rate-Limiters (`checkMcpRateLimit`, `429 Too Many Requests`, `Retry-After`, `X-RateLimit-Limit`, `Math.floor`-Clamping, `clientId`-Keying ohne Header-Bypass und `512`-Bucket Memory-Eviction), Auslagerung von `isReadOnlyMcpToolCall` nach `src/lib/vault/auditChatAndMcp.ts` (Reduktion von `route.ts` auf `539` Zeilen `< 600`), Zentralisierung redundanter `process.env.*`-Zugriffe über `getCoreGatewayUrl()` (`gatewayClient.ts`) und `resolveVaultBaseDir()` (`vault.ts`) inkl. Bereinigung von `CORE_GATEWAY_INTERNAL_URL`/`NEXT_PUBLIC_CORE_GATEWAY_URL` in `debug/route.ts` sowie Bereitstellung von `PRIVACY.md` und `package.json`-Publisher-Metadaten für Claude/OpenAI/M8ven-Directory-Konformität.
- **Durchgeführte Schritte:**
  1. M8ven Badge in `README.md` und `README.de.md` auf `[![M8ven Verified](https://m8ven.ai/badge/mcp/solidstatenetwork-synapse-rv3on4?variant=verified)](https://m8ven.ai/mcp/solidstatenetwork-synapse-rv3on4?s=readme)` aktualisiert.
  2. `PRIVACY.md` (Root & `apps/core-web/PRIVACY.md`) erstellt, in `README.md` sowie `README.de.md` verlinkt und Publisher-/Repository-Metadaten in `apps/core-web/package.json` ergänzt.
  3. In `apps/core-web/src/app/api/mcp/route.ts` (`539` Zeilen `< 600`) gehärtetes Sliding-Window Rate-Limiting (`120 req/min` pro `clientId`, `MCP_RATE_LIMIT_MAX_BUCKETS = 512`) und explizite `ObjectExpression`-Annotationen für `baseTools` & `extraTools` ergänzt; `isReadOnlyMcpToolCall` in `src/lib/vault/auditChatAndMcp.ts` extrahiert.
  4. `getCoreGatewayUrl()` in `src/lib/gatewayClient.ts` und `resolveVaultBaseDir()` in `src/lib/vault.ts` zentralisiert und 16 redundante `process.env.*`-Lookups (inkl. `CORE_GATEWAY_INTERNAL_URL` und `NEXT_PUBLIC_CORE_GATEWAY_URL` in `debug/route.ts` sowie `SYNAPSE_VAULT_DIR` in `auth.ts`) bereinigt.
  5. In `apps/core-web/src/__tests__/api-routes.test.ts` automatisierte Assertions für MCP-Rate-Limiting (`429` inkl. Fractional-Header-Bypass-Schutz), M8ven-Badge-Slug und `PRIVACY.md` ergänzt.
- **Verifikation:** M8ven Score = `89/100` (`Grade B`, `sub_scores.code: 100/100`, `warn: 0`, `fail: 0`), `npm audit` = `0 vulnerabilities`, `npx tsc --noEmit` = `0 errors`, `npm test` = `33/33 passed`.

### [BB-010] 2026-11-02 12:35 (CET) – [MCP-SERVER / AI-ORCHESTRATOR / WEB-STUDIO-UI / v2.3.0] M8ven Security Audit Remediation, 42-Tool MCP Safety Annotations & Cross-Platform Test Hardening
- **Akteur:** Antigravity AI & Project Lead
- **Typ:** `SECURITY` | `FEATURE` | `TEST` | `ARCH-LEXICON`
- **Betroffene Module:** `MCP-SERVER`, `AI-ORCHESTRATOR`, `WEB-STUDIO-UI`, `ARCH-LEXICON`
- **Ziel / Hintergrund:** Vollständige Behebung aller im M8ven Security Audit (`https://m8ven.ai/mcp/solidstatenetwork/synapse`) gemeldeten Punkte: Upgrade der gepinnten `Next.js`- und `PostCSS`-Abhängigkeiten zur Beseitigung von `CVE-2025-55182` (`GHSA-9g9p-9gw9-jx7f`, `GHSA-h25m-26qc-wcjf`, `GHSA-f82v-jwr5-mffw`, `GHSA-q4gf-8mx6-v5v3`), Ergänzung expliziter MCP Safety Annotations (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`) für alle **42 integrierten MCP-Tools** sowie Härtung der Test-Suite (`llm-and-ota.test.ts`) für deterministische Ausführung unter Linux (`bash`) und Windows (`cmd.exe`).
- **Durchgeführte Schritte:**
  1. `next` und `eslint-config-next` auf `^15.5.28` sowie `postcss` auf `^8.5.23` (inkl. `overrides`) in `apps/core-web/package.json` aktualisiert (`npm audit`: `0 vulnerabilities`).
  2. `getMcpToolSafetyAnnotations(toolName)` und explizite `annotations`-Literale in `apps/core-web/src/lib/orchestrator/toolSchemas.ts`, `extendedToolSchemas.ts` und `apps/core-web/src/app/api/mcp/route.ts` sowohl bei `tools/list` (`JSON-RPC 2.0`) als auch bei `GET /api/mcp` für alle 42 Tools ausgeliefert.
  3. M8ven Verified Badge und aktualisierte `42 Tools` Dokumentation in `README.md`, `README.de.md`, `memory/PROJECT_STATE.md` und `memory/MILESTONES.md` hinterlegt.
  4. In `apps/core-web/src/__tests__/llm-and-ota.test.ts` plattformübergreifende `go.cmd`/`systemctl.cmd` Shims, doppelte Anführungszeichen für `git commit -m` und `path.delimiter` ergänzt.
- **Verifikation:** `npm audit` = `0 vulnerabilities`, `npx tsc --noEmit` = `0 errors`, `npm test` = `33/33 passed` (5 Suites, 0 Failures), Clean-Room Policy (`0` private IPs/Secrets) eingehalten.

### [BB-009] 2026-11-01 03:09 (CET) – [BRAIN-VAULT / AI-ORCHESTRATOR / MCP-SERVER / WEB-STUDIO-UI / v2.3.0] Lexicon-Everywhere: 4-Doc Topology Bundles, Vault Search, MCP Resources, Remote Muscle Workspace Sync & Remote FS Clean-Room Guard
- **Akteur:** Antigravity AI & Project Lead
- **Typ:** `ARCHITECTURE` | `FEATURE` | `SECURITY` | `UI` | `RELEASE`
- **Betroffene Module:** `BRAIN-VAULT`, `AI-ORCHESTRATOR`, `MCP-SERVER`, `RESILIENCE-DR`, `WEB-STUDIO-UI`, `CONTAINER-LAB`
- **Ziel / Hintergrund:** Durchgängige Verankerung des in `v2.2.0` eingeführten 4-Dokumente-Lexikons (`Architecture.md`, `Memory.md [BB-XXX]`, `Milestones.md`, `AGENTS.md`) und der `public`/`private` Clean-Room Governance in allen verbleibenden Subsystemen: Topology-Bundles, Vault-Suche, `@`-Context-Mentions, externen MCP-Resources, 1-Click-Synchronisation in das Remote-Workspace auf dem Axon Muscle Node (`sync_lexicon_to_node`) sowie als automatischer Clean-Room-Filter bei Remote-Dateischreibzugriffen (`node_fs_operation`).
- **Durchgeführte Schritte:**
  1. `SynapseTopologyBundle` in `topologyAndCanaryTools.ts` (`export` & `import`) um `visibility` (`"public" | "private"`) und `lexicon_docs` (`architecture_md`, `memory_md`, `milestones_md`, `agents_md` inkl. `sanitizeBrainContentForVisibility`) erweitert.
  2. `executeCoreVaultSearch` (`searchEngine.ts`) und `core_vault_search` (`toolSchemas.ts`) um die Scopes `milestones` und `agents` erweitert, `@Milestones.md` und `@AGENTS.md` in `expandContextMentions` (`llmStreamHelpers.ts`) ergänzt und `/api/mcp/route.ts` (`566` Zeilen `< 600`) in `synapse_get_project_state`, `resources/list` und `resources/read` um `Milestones.md`, `AGENTS.md` und `visibility` erweitert.
  3. `syncLexiconDocsToMuscleNode` in `lexiconGovernance.ts` implementiert und über `core_update_brain_doc` (`mode: "sync_lexicon_to_node"`), `autonomousFallback.ts` und `POST /api/projects` (`action: "sync_lexicon_to_node"`) verdrahtet (schreibt `AGENTS.md`, `memory/PROJECT_STATE.md`, `memory/BLACKBOX.md` und `memory/MILESTONES.md` mit Pre-Flight Checkpoint `checkpoint_id` in `/opt/axon/workspaces/<projectId>/`).
  4. In `orchestrator.ts` (`node_fs_operation`: `write_file` & `apply_unified_diff`) den automatischen `sanitizeBrainContentForVisibility` Clean-Room-Guard integriert.
  5. In `BrainVaultAndWorkspaceViews.tsx` (`568` Zeilen `< 600`) den 1-Click `Sync Lexicon to Node`-Button (mit Pre-Flight `checkpoint_id`-Banner) und den `+ [BB-XXX]`-Schnellbutton ergänzt und die gesamte Plattform inkl. Container auf `v2.3.0` angehoben.
- **Verifikation:** Go Coverage `88.0 %` (`>= 85 %`), TS Line Coverage `>= 91 %` (`>= 90 %`), Max Go `499` Zeilen, Max TS `< 600` Zeilen, `0` `any`-Typen, `0` private Daten.

### [BB-008] 2026-11-01 02:45 (CET) – [BRAIN-VAULT / AI-ORCHESTRATOR / MCP-SERVER / AXON-AGENT / v2.2.0] SolidState 4-Doc AI Lexicon, Public/Private Clean-Room Governance, Scoped MCP Key Tool & 100 % Ephemeral PTY GC
- **Akteur:** Antigravity AI & Project Lead
- **Typ:** `ARCHITECTURE` | `FEATURE` | `SECURITY` | `UI` | `RELEASE`
- **Betroffene Module:** `BRAIN-VAULT`, `AI-ORCHESTRATOR`, `MCP-SERVER`, `AXON-AGENT`, `RESILIENCE-DR`, `WEB-STUDIO-UI`, `CONTAINER-LAB`
- **Ziel / Hintergrund:** Verankerung des strukturierten SolidState 5-Schritte-Protokolls (`Infrastructure` / `Strata` / `Synapse` Standard) direkt in der internen Synapse-KI mit harter Unterscheidung zwischen `PUBLIC (Clean-Room)` und `PRIVATE (Infrastructure)` Projekten, Ausbau des MCP-Key-Lifecycles (`core_manage_mcp_keys`), 100 % Ephemeral PTY Garbage Collection im Axon-Agenten sowie Pre-Flight Checkpoints für Offsite-Backup-Restores und Intrusion-IP-Blocks.
- **Durchgeführte Schritte:**
  1. `apps/core-web/src/lib/vault/lexiconGovernance.ts` (`220` Zeilen) erstellt: 4-Dokumente-Lexikon (`Architecture.md`, `Memory.md` mit Auto-`[BB-XXX]`-Nummerierung, `Milestones.md`, `AGENTS.md`), `visibility: "public" | "private"` und `sanitizeBrainContentForVisibility` (Redaktion von Secrets sowie im `public`-Modus lokaler `/home/<user>`-Pfade und echter Node-IPs).
  2. `promptBuilder.ts`, `toolSchemas.ts`, `coreTools.ts`, `/api/projects/route.ts` und `BrainVaultAndWorkspaceViews.tsx` (`535` Zeilen `< 600`) um das 5-Schritte-Protokoll, den Public/Private-Governance-Umschalter und die 4 Lexikon-Tabs erweitert sowie `cartridges/solidstate-public-cleanroom.md` und `cartridges/solidstate-private-infra.md` angelegt.
  3. `core_manage_mcp_keys` (`list`, `create`, `revoke`) in `workbenchAndAuthTools.ts` (`190` Zeilen `< 220`), `extendedToolSchemas.ts`, `coreTools.ts`, `autonomousFallback.ts` und `/api/mcp/route.ts` integriert (`36` MCP-Tools gesamt).
  4. `deep-search-`, `self-heal-` und `link-probe-` in `agents/axon/internal/pty/pty_discovery.go` (`IsEphemeralSessionID`) inkl. Go-Unit-Tests in `pty_test.go` ergänzt.
  5. Pre-Flight Checkpoints (`checkpoint_id`) in `disasterRecoveryTools.ts`, `/api/backups/route.ts`, `secopsAndWatchdogTools.ts` und `/api/service-ops/route.ts` sowie UI-Badges in `AccessRulesView.tsx`, `useSystemAndInfraActions.ts` und `useCanvasOpsController.ts` ergänzt.
- **Verifikation:** Go Coverage `88.0 %` (`>= 85 %`), TS Line Coverage `>= 91 %` (`>= 90 %`), Max Go `499` Zeilen, Max TS `< 600` Zeilen, `0` `any`-Typen, `0` private Daten.

### [BB-007] 2026-11-01 02:06 (CET) – [WEB-STUDIO-UI / RESILIENCE-DR / v2.1.0] 1-Click Topology-Bundle-UI, Multi-Node-Canary-UI & Pre-Flight Cron/Playbook Checkpoints
- **Akteur:** Antigravity AI & Project Lead
- **Typ:** `FEATURE` | `UI` | `RELEASE`
- **Betroffene Module:** `WEB-STUDIO-UI`, `RESILIENCE-DR`, `AI-ORCHESTRATOR`, `DEVOPS-STUDIO`, `CONTAINER-LAB`
- **Ziel / Hintergrund:** Bereitstellung der in `v2.0.0` eingeführten Topology-Bundle- (`synapse-stack/v2.0`) und Multi-Node-Canary-Werkzeuge direkt im WebUI (`BrainVaultView` & `PeersView`) sowie Vervollständigung der automatischen Pre-Flight Time-Machine Checkpoints (`checkpoint_id`) für alle Cron-Runbook- und Playbook-Mutationen.
- **Durchgeführte Schritte:**
  1. `POST /api/projects` (`apps/core-web/src/app/api/projects/route.ts`) um `export_topology_bundle`, `import_topology_bundle`, `verify_fleet_health` und `canary_rollout` erweitert.
  2. `BrainVaultAndWorkspaceViews.tsx` (`442` Zeilen `< 600`) um den interaktiven Topology-Bundle Export/Import-Drawer inkl. Pre-Flight `checkpoint_id` Anzeige ergänzt.
  3. `PeersView.tsx` (`573` Zeilen `< 600`) um die Multi-Node Canary & Fleet-Health-Steuerleiste mit Pre-Flight `checkpoint_id` Badge erweitert.
  4. `studioDevOpsTools.ts` (`core_manage_cron_jobs`), `/api/service-ops/route.ts` (`save_cron_job`, `delete_cron_job`), `playbookAndApprovalTools.ts` (`core_manage_playbooks`) und `/api/projects/route.ts` (`upsert_playbook`, `delete_playbook`) um automatische Pre-Flight Checkpoints (`checkpoint_id`) erweitert.
  5. Gesamte Plattform, Container-Definitionen, Dokumentation und Lexikon auf `v2.1.0` angehoben.
- **Verifikation:** Go Coverage `88.0 %` (`>= 85 %`), TS Line Coverage `>= 94 %` (`>= 90 %`), Max Go `499` Zeilen, Max TS `596` Zeilen, `0` `any`-Typen, `0` private Daten.

### [BB-006] 2026-11-01 01:40 (CET) – [AI-ORCHESTRATOR / MCP-SERVER / RESILIENCE-DR / v2.0.0] Declarative Topology Bundles, Multi-Node Canary Rollouts, Lexikon-Self-Test & Domain-TLS Checkpoints
- **Akteur:** Antigravity AI & Project Lead
- **Typ:** `FEATURE` | `ARCHITECTURE` | `RELEASE`
- **Betroffene Module:** `AI-ORCHESTRATOR`, `MCP-SERVER`, `RESILIENCE-DR`, `WEB-STUDIO-UI`, `ARCH-LEXICON`, `CONTAINER-LAB`
- **Ziel / Hintergrund:** Abschluss des Major-Releases `v2.0.0` mit portablen deklarativen Projekt-Topologie-Bundles (`synapse-stack/v2.0`), gestaffelten Multi-Node Canary Rollouts mit automatischem Abbruch bei Fehler, Live-Selbsttest des Architektur-Lexikons in `/api/debug` sowie Pre-Flight Time-Machine Checkpoints bei Domain/TLS-Änderungen.
- **Durchgeführte Schritte:**
  1. `topologyAndCanaryTools.ts` (`212` Zeilen `< 220`) mit `core_manage_topology_bundle` (`export`, `import`) und `core_cluster_canary_exec` (`canary_rollout`, `verify_fleet_health`) erstellt und in `extendedToolSchemas.ts`, `coreTools.ts`, `autonomousFallback.ts` und `/api/mcp/route.ts` verdrahtet (`35` MCP-Tools gesamt).
  2. `/api/debug/route.ts` (`self_test`) um die Prüf-Stufe `lexicon_and_governance` (`AGENTS.md`, `memory/PROJECT_STATE.md`, `memory/BLACKBOX.md`, `memory/MILESTONES.md`, `.githooks/pre-commit`) erweitert.
  3. `core_manage_domain_tls` (`blueprintDomainAndOtaTools.ts`), `/api/service-ops` (`configure_domain`), `useCanvasStudioAndDomainActions.ts` und `ReverseProxyView.tsx` um automatische Pre-Flight Checkpoints (`checkpoint_id`) und UI-Badges ergänzt.
  4. Gesamte Plattform, Container-Definitionen, Dokumentation und Lexikon auf `v2.0.0` angehoben.
- **Verifikation:** Go Coverage `88.0 %` (`>= 85 %`), TS Line Coverage `94.34 %` (`>= 90 %`), Max Go `499` Zeilen, Max TS `596` Zeilen, `0` `any`-Typen, `0` private Daten.

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
