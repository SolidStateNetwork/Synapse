# 🎯 MILESTONES – Synapse Entwicklungs-Roadmap

> **Zweck:** Verfolgt den Abschluss aller Entwicklungs-Phasen des Synapse-Ökosystems (`SolidStateNetwork/Synapse`).  
> **Aktueller Stand:** **Phase 1 bis Phase 8 (`v2.5.0`) sind zu 100 % abgeschlossen und produktionsreif verifiziert (`58/58` TypeScript-Tests & `11/11 >= 90.0%` Go Statement-Coverage).**

---

## ✅ Phase 1: Foundation – mTLS Tunnel, Go Core-Gateway & Static Axon Binary (`v0.1.0`)
- [x] **M1.1:** Protobuf & JSON-Wire-Framing (`proto/tunnel.proto` & `proto/tunnel.pb.go`, 32 MB Max Frame, Single-Write-Framing).
- [x] **M1.2:** ECDSA P-256 Root CA, One-Time CSR Join-Tokens & `tls.RequireAndVerifyClientCert` mTLS 1.3 Server (`apps/core-gateway/internal/pki/`).
- [x] **M1.3:** Yamux Stream Multiplexing Hub für `StreamTypeRpcFs`, `StreamTypePty`, `StreamTypePortForward` und `StreamTypeTelemetry` (`apps/core-gateway/internal/hub/`).
- [x] **M1.4:** Statischer Linux Muscle-Agent (`agents/axon/`) mit Outbound-Only mTLS-Dialer, Self-Lockout-Guardrail (`internal/guard/`) und persistenten Stateful PTYs (`internal/pty/`).

---

## ✅ Phase 2: Project Brain Vault & AI Orchestrator Interceptor (`v0.2.0` – `v0.5.0`)
- [x] **M2.1:** Multi-Project Brain Vault (`State.json`, `Architecture.md`, `Memory.md`, `Secrets.enc`, `Audit.jsonl`, `ChatHistory.json`) mit `AES-256-GCM` Verschlüsselung und `.bak`-Self-Healing.
- [x] **M2.2:** OpenAI-kompatibler AI Orchestrator mit 42 DevOps-Tools, Anthropic/OpenAI Prompt-Caching (`cache_control: ephemeral`) und deterministischer Offline-Fallback-Engine.
- [x] **M2.3:** 3-Tier Autonomie-Durchsetzung (`TIER_1_UNLEASHED`, `TIER_2_WORKSPACE_JAIL`, `TIER_3_SUPERVISED` Approval-Queue) + 1-Click Pre-Write Datei-Rollbacks.

---

## ✅ Phase 3: Full-Stack DevOps Workbench, GitOps & Self-Healing (`v1.0.0`)
- [x] **M3.1:** Interaktiver React-Flow Topologie-Canvas (`Overview`) mit Live-Telemetrie-Sparklines, Node-Inspector und Drag-and-Drop Service-Zuordnung.
- [x] **M3.2:** Service-Workbench (`GET`/`POST`/`PUT`/`DELETE` HTTP-Tester über den mTLS-Reverse-Proxy `:8081/proxy/...` ohne offene Firewall-Ports) & SQLite Data Studio.
- [x] **M3.3:** GitOps Stack-Deployer (`.env`-Secret-Injektion `0600`, Webhook-Redeploy & Teardown), Live-Code Hot-Reload mit Python-Syntax-Check & Autonomous Self-Healing Watchdog (MTTR-Tracking & Chaos-Engineering-Simulation).

---

## ✅ Phase 4: Enterprise Modularization & Strict Line-Count Governance (`v2.0.0`)
- [x] **M4.1:** 100 % Modularisierung aller Go-Dateien (`< 500` Zeilen) und TypeScript/React-Dateien (`< 600` Zeilen) ohne Monolithen.
- [x] **M4.2:** Lokales 2-Container-Labor (`containers/manage.sh` für Docker Compose & Rootless Linux Namespaces) zur isolierten End-to-End-Verifikation von `synapse-core` und `synapse-muscle`.

---

## ✅ Phase 5: Model Context Protocol (`MCP`) Server & Multi-Distro Support (`v2.1.0` – `v2.2.0`)
- [x] **M5.1:** Integrierter Streamable HTTP JSON-RPC 2.0 MCP-Server (`/api/mcp`) mit 42 Tools, 6 Brain-Vault-Ressourcen, Stack-Blueprint-Prompts und `SHA-256` Scoped API-Keys (`syn_mcp_...`).
- [x] **M5.2:** Multi-Distro Installer (`scripts/install-axon.sh` & `/install.sh`) mit `curl`/`wget`-Fallback, `SHA-256`-Checksum-Prüfung sowie Systemd- und Alpine-OpenRC-Unterstützung.
- [x] **M5.3:** Automatische **Pre-Flight Time-Machine Checkpoints (`chk-...`)** vor jeder mutierenden Aktion (Blueprint, GitOps, Custom-Service, Hot-Reload, Firewall, OTA-Update).

---

## ✅ Phase 6: Declarative Topology Bundles, Multi-Node Canary Rollouts & SolidState 4-Doc AI Lexicon (`v2.0.0` – `v2.3.0`)
- [x] **M6.1:** Deklarative `SynapseTopologyBundle`-Engine (`core_manage_topology_bundle` `export` / `diff` / `import`) für 1-Click Klonen kompletter Multi-Service-Architekturen.
- [x] **M6.2:** Multi-Node Canary Rollout Engine (`core_multi_node_rollout`) mit automatischem Canary-Gate, Health-Probe-Verifikation und Rollback bei Fehlern.
- [x] **M6.3:** Vollständiges Architektur-Lexikon (`architecture/`, `memory/`, `playbooks/`, `AGENTS.md`, `GEMINI.md`, `CLAUDE.md`, `.cursorrules`, `.windsurfrules`, `.githooks/pre-commit`) analog zum `SolidStateNetwork`-Standard.
- [x] **M6.4:** **SolidState 4-Document Brain Vault (`Architecture.md`, `Memory.md` mit `[BB-XXX]`, `Milestones.md`, `AGENTS.md`) & Public/Private Clean-Room Governance:** Jedes Projekt in Synapse erhält automatisch das 4-Dokumente-Lexikon, einen `PUBLIC (Clean-Room)` vs. `PRIVATE (Infrastructure)` Umschalter in der UI und automatische Zero-Secret-/IP-Sanitisierung bei `public`-Projekten sowie die beiden Built-In Rule Cartridges `solidstate-5step-protocol` und `solidstate-public-cleanroom`.
- [x] **M6.5:** **Scoped MCP Key Tool (`core_manage_mcp_keys`) & 100 % Ephemeral PTY Garbage Collection:** Eigenständiges AI/MCP-Tool zur programmatischen Verwaltung von `syn_mcp_...`-Keys sowie vollständige Bereinigung kurzlebiger Diagnose-/Health-/Test-PTY-Sessions (`IsEphemeralSessionID` in `agents/axon/internal/pty/pty_discovery.go`), sodass `active_pty_sessions` im Ruhezustand exakt `0` bleibt.
- [x] **M6.6 (`v2.3.0`):** **Lexicon-Everywhere Integration:** 4-Doc Lexikon & `visibility` in Topology-Bundles (`core_manage_topology_bundle`), Vault-Search (`milestones` & `agents` Scopes), `@Milestones.md`/`@AGENTS.md` Context-Mentions und `/api/mcp` Resources, 1-Click & KI-gesteuerte Synchronisation des 4-Doc Lexikons in das Remote-Muscle-Workspace (`sync_lexicon_to_node` mit Pre-Flight Checkpoint) sowie automatischer Public Clean-Room Guard für `node_fs_operation` (`write_file`/`apply_unified_diff`).
- [x] **M6.7 (`v2.3.0`):** **M8ven Security Audit Remediation (`Next.js ^15.5.28` & `PostCSS ^8.5.23` Upgrade inkl. `overrides`, `0 vulnerabilities` in `npm audit`)**, explizite MCP Tool Safety Annotations (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`) für alle **42 integrierten MCP-Tools** (`toolSchemas.ts`, `extendedToolSchemas.ts` & `/api/mcp/route.ts`), Sliding-Window Rate-Limiting (`429 Too Many Requests`) auf `/api/mcp`, `PRIVACY.md` (Zero-Telemetry Policy für Claude/OpenAI MCP-Directories), offizielles M8ven Verified Badge (`solidstatenetwork-synapse-rv3on4?variant=verified` in `README.md` / `README.de.md`) sowie plattformübergreifende Windows/Linux Test-Suite-Härtung (`33/33` Tests grün).

---

## ✅ Phase 7: Zero-Trust Security Hardening, Audit Hash-Chaining, Standalone MCP Server & Supply-Chain Integrity (`v2.4.0`)

- [x] **M7.1 (`v2.4.0`):** **3-Tier MCP Scope Enforcement (`read` / `execute` / `admin`), Per-Key Rate-Limits, HMAC-SHA256 Request Signing & Tamper-Evident `Audit.jsonl` Hash-Chain (`apps/core-web/src/lib/vault/`, `/api/mcp/route.ts`)**
  - [x] Strikte Durchsetzung des `admin`-Scopes (`isAdminOnlyMcpToolCall`) in `/api/mcp` für sicherheitskritische Operationen (`synapse_create_join_token`, `core_manage_secrets` `set`/`delete`/`generate_random`, `core_manage_node_enrollment` `generate_join_token`/`set_node_tier`/`remove_node`, `core_disaster_RecoveryVault` `restore_backup`, `core_manage_approvals` `approve`/`reject`, `core_configure_ai_engine` `update`).
  - [x] Konfigurierbare Sliding-Window Rate-Limits pro MCP-API-Key (`rate_limit_per_min` in `McpApiKey`, Standard `120 req/min`) sowie optionale `HMAC-SHA256` Request-Signaturprüfung (`X-Synapse-Signature` + `X-Synapse-Timestamp` mit 300s Replay-Guard).
  - [x] Kryptographische `SHA-256` Hash-Verkettung (`prev_hash` + `entry_hash` ab `GENESIS`) für jeden Eintrag in `Audit.jsonl` (`appendAuditLog`) inklusive `verifyAuditChain(projectId)` Integritäts-Prüfer in `/api/mcp` und `synapse_get_project_state`.

- [x] **M7.2 (`v2.4.0`):** **mTLS 1.3 Cipher/Curve Pinning, Automatische Zertifikats-Rotation (`StreamTypeCertRenew`), Symlink-Ancestor-Jail & Deterministische `AllowedCommands` (`apps/core-gateway/`, `agents/axon/`, `proto/`)**
  - [x] Explizites Pinning der TLS 1.3 ECDHE-Kurven (`tls.X25519`, `tls.CurveP256`) in `ServerTLSConfig()` (`pki.go`) und `buildTLSConfigForTarget()` (`diagnostics.go`) sowie exponentielles Reconnect-Backoff mit kryptographischem Jitter (`ComputeReconnectBackoff` `1s -> 30s` `±25%`).
  - [x] Unterbrechungsfreie X.509 Client-Zertifikats-Rotation (`StreamTypeCertRenew` in `proto/tunnel.pb.go`, `RenewClientCert` in `pki.go`, `NeedsCertRotation` & `RotateTargetCertificate` in `diagnostics.go` / `tunnel.go`) bei `< 30` Tagen Restlaufzeit.
  - [x] Härtung von `ResolvePath` (`agents/axon/internal/fs/fs.go` + Auslagerung von `diff.go` `< 500` Zeilen) im `TIER_2_WORKSPACE_JAIL` durch rekursive Auflösung des längsten existierenden Eltern-Pfades (`filepath.EvalSymlinks`) sowie `os.Lstat`/`os.Readlink`-Prüfung gebrochener Symlinks.
  - [x] Erweiterung von `GuardrailConfig` (`agents/axon/internal/guard/guard.go`) um eine deterministische `AllowedCommands`-Allowlist (`ValidateCommandWithAllowlist`) sowie Erkennung Flag-umsortierter `systemctl`- und Interface-Lockout-Befehle.

- [x] **M7.3 (`v2.4.0`):** **Dedizierter Standalone MCP-Server (`packages/mcp-server/`) für MCP-Registries (M8ven, Glama, Smithery)**
  - [x] Bereitstellung eines eigenständigen, abhängigkeitsfreien Node.js MCP-Servers (`packages/mcp-server/package.json` & `packages/mcp-server/index.mjs`) für Stdio- & Streamable-HTTP-Clients (`npx @solidstatenetwork/synapse-mcp-server`).
  - [x] Vollständige Exposition aller **42 Tools** (inkl. expliziter boolescher `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint` Annotations), aller **6 Lexikon- & Brain-Vault-Ressourcen** (`Architecture.md`, `Memory.md`, `Milestones.md`, `AGENTS.md`, `State.json`, `Audit.jsonl`), `signMcpPayload` HMAC-Signierung, Timeout/Retry und Offline-Fallback.

- [x] **M7.4 (`v2.4.0`):** **Brain-Vault `PBKDF2-SHA256` Secret-KDF & 100 % Atomare Write-Temp-and-Rename Persistenz (`apps/core-web/src/lib/vault.ts`)**
  - [x] Upgrade der Schlüsselableitung für `Secrets.enc` auf `PBKDF2-SHA256` (`100.000` Iterationen + zufälliges 16-Byte Salt pro Schreibvorgang) mit nahtloser Abwärtskompatibilität für bestehende `SHA-256`-verschlüsselte `Secrets.enc`-Dateien.
  - [x] Vollständige Umstellung aller verbleibenden direkten `fs.writeFileSync`-Aufrufe in `vault.ts`, `lexiconGovernance.ts`, `auditChatAndMcp.ts`, `cartridges.ts` und `disasterRecoveryTools.ts` auf atomares `atomicWriteTextSync` (`write-temp-and-rename`).

- [x] **M7.5 (`v2.4.0`):** **CI/CD Supply-Chain Security, `npm audit` Gate & CycloneDX SBOM Generation (`.github/workflows/ci.yml`)**
  - [x] Integration von `npm audit --audit-level=high`, `node --check packages/mcp-server/index.mjs` und automatischer CycloneDX-SBOM-Generierung (`npm sbom --sbom-format cyclonedx`) in `.github/workflows/ci.yml`.

- [x] **M7.6 (`v2.4.0`):** **Umfassende Test-Suite-Expansion (`47/47` TypeScript-Tests & `>= 88%` Go-Coverage über alle 11 Pakete)**
  - [x] Ausbau der TypeScript-Test-Suite auf **47 Unit- & Fault-Injection-Tests** (`src/__tests__/v240-security.test.ts` + aktualisierte `api-routes.test.ts`).
  - [x] Ausbau der Go-Unit-Tests (`pki_test.go`, `hub_test.go`, `tunnel_test.go`, `fs_test.go`, `guard_test.go`, `main_test.go`) mit Erhöhung des verbindlichen Coverage-Gates in CI auf **`>= 88.0%`** über alle 11 Go-Pakete.

---

## ✅ Phase 8: Autonomous Multi-Agent Workflows, mTLS CRL Revocation, eBPF Telemetry & OpenTelemetry Observability (`v2.5.0` — Completed)

> **Architektur-Ziel für `v2.5.0`:** Ausbau von Synapse zu einer deklarativen Multi-Agenten-DevOps-Plattform mit Echtzeit-Zertifikats-Sperrlisten (CRL), eBPF/Procfs-basierter Prozess-Anomalie-Erkennung auf den Muscle-Nodes, OpenTelemetry-Metrik-Export und kryptographisch signierten Topology-Bundles.

- [x] **M8.1 (`v2.5.0`):** **Real-Time X.509 Certificate Revocation List (`CRL.json`) & Instant Session Eviction (`apps/core-gateway/internal/pki/`, `internal/hub/`)**
  - [x] Persistente X.509 Seriennummern-Sperrliste (`CRL.json`) in `pki.Authority` (`RevokeCertSerial`, `IsCertRevoked`) mit Echtzeit-Prüfung im TLS-Handshake (`VerifyPeerCertificate`) und sofortigem Schließen aktiver Yamux-Sessions bei Node-Entfernung (`remove_node`).

- [x] **M8.2 (`v2.5.0`):** **Cryptographically Signed Topology Bundles (`Ed25519` / `HMAC-SHA256`) & Dry-Run Drift Simulator (`apps/core-web/src/lib/orchestrator/`)**
  - [x] Erweiterung von `SynapseTopologyBundle` (`core_manage_topology_bundle`) um eine kryptographische Bundle-Signatur (`bundle_signature`, `signed_at`, `signer_fingerprint`) sowie einen deterministischen `simulate_apply`-Modus, der alle Datei-, Port- und Container-Änderungen vorab ohne Seiteneffekte berechnet.

- [x] **M8.3 (`v2.5.0`):** **Multi-Stage DAG Playbooks & Event-Driven Webhook Triggers (`apps/core-web/src/lib/vault/`, `/api/playbooks/`)**
  - [x] Unterstützung mehrstufiger Playbook-Pipelines (DAG-Schritte mit `on_success` / `on_failure` Rollback-Verzweigung und Pre-Flight Checkpoint) sowie authentifizierter Webhook-Trigger (`POST /api/playbooks/webhook`) für automatische CI/CD-Deployments.

- [x] **M8.4 (`v2.5.0`):** **Lightweight Procfs/Socket Anomaly Detector & Resource Quota Guard in `axon` (`agents/axon/internal/health/`, `internal/pty/`)**
  - [x] Erkennung unerwarteter ausgehender TCP-Verbindungen und plötzlicher CPU/FD-Spikes direkt im `axon`-Telemetrie-Collector (`AnomalyAlerts` im `NodeHeartbeat`) sowie konfigurierbare `ulimit`/Timeout-Schranken pro PTY-Befehl.

- [x] **M8.5 (`v2.5.0`):** **OpenTelemetry / Prometheus Metrics Exporter (`/api/metrics` & `:8081/metrics`)**
  - [x] Bereitstellung eines Prometheus/OpenMetrics-kompatiblen Endpunkts für Node-Telemetrie (CPU, RAM, Disk, Yamux-Streams, MTTR, MCP-Tool-Latenzen und Audit-Chain-Status) mit Bearer-Token-Schutz.

- [x] **M8.6 (`v2.5.0`):** **Full-Stack E2E Test Matrix Expansion (`>= 55` TypeScript Tests & `>= 90%` Go Coverage across all 11 Packages)**
  - [x] Ausbau der automatisierten Test-Suite auf **58 TypeScript-Tests** (`58/58` grün) und **`>= 90.0%` Go Statement-Coverage** über alle 11 Go-Pakete inklusive CRL-Revocation-, Signed-Bundle- und DAG-Playbook-Fault-Injection-Tests.

