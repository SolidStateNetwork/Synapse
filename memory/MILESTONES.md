# 🎯 MILESTONES — Synapse Engineering Roadmap

> **Purpose:** Tracks the completion of all development phases of **Synapse (`SolidStateNetwork/Synapse`)**.  
> **Current Status:** **Phases 1 through 8 (`v2.5.0`) are 100% completed and verified in production (`59/59` TypeScript tests & `11/11 >= 90.0%` Go statement coverage).**

---

## ✅ Phase 1: Foundation — mTLS Tunnel, Go Core-Gateway & Static Axon Binary (`v0.1.0`)
- [x] **M1.1:** Protobuf & JSON wire framing (`proto/tunnel.proto` & `proto/tunnel.pb.go`, 32 MB max frame, single-write framing).
- [x] **M1.2:** ECDSA P-256 Root CA, one-time CSR join tokens & `tls.RequireAndVerifyClientCert` mTLS 1.3 server (`apps/core-gateway/internal/pki/`).
- [x] **M1.3:** Yamux stream multiplexing hub for `StreamTypeRpcFs`, `StreamTypePty`, `StreamTypePortForward`, and `StreamTypeTelemetry` (`apps/core-gateway/internal/hub/`).
- [x] **M1.4:** Static Linux Muscle agent (`agents/axon/`) with outbound-only mTLS dialer, deterministic Self-Lockout Guardrail (`internal/guard/`), and persistent stateful PTYs (`internal/pty/`).

---

## ✅ Phase 2: Project Brain Vault & AI Orchestrator Interceptor (`v0.2.0` – `v0.5.0`)
- [x] **M2.1:** Multi-Project Brain Vault (`State.json`, `Architecture.md`, `Memory.md`, `Secrets.enc`, `Audit.jsonl`, `ChatHistory.json`) with `AES-256-GCM` encryption and `.bak` self-healing.
- [x] **M2.2:** OpenAI-compatible AI Orchestrator with 42 DevOps tools, Anthropic/OpenAI prompt caching (`cache_control: ephemeral`), and deterministic offline fallback engine.
- [x] **M2.3:** 3-Tier autonomy enforcement (`TIER_1_UNLEASHED`, `TIER_2_WORKSPACE_JAIL`, `TIER_3_SUPERVISED` approval queue) + 1-click pre-write file rollbacks.

---

## ✅ Phase 3: Full-Stack DevOps Workbench, GitOps & Self-Healing (`v1.0.0`)
- [x] **M3.1:** Interactive React-Flow Topology Canvas (`Overview`) with live telemetry sparklines, Node Inspector, and drag-and-drop service binding.
- [x] **M3.2:** Service Workbench (`GET`/`POST`/`PUT`/`DELETE` HTTP tester over the mTLS reverse proxy `:8081/proxy/...` with zero open firewall ports) & SQLite Data Studio.
- [x] **M3.3:** GitOps Stack Deployer (`.env` secret injection `0600`, webhook redeploy & teardown), live-code hot-reload with Python syntax validation & autonomous Self-Healing Watchdog (MTTR tracking & Chaos Engineering crash simulation).

---

## ✅ Phase 4: Enterprise Modularization & Strict Line-Count Governance (`v2.0.0`)
- [x] **M4.1:** 100% modularization of all Go files (`< 500` lines) and TypeScript/React files (`< 600` lines) with zero monolithic files.
- [x] **M4.2:** Local 2-Container Lab (`containers/manage.sh` for Docker Compose & rootless Linux namespaces) for isolated end-to-end verification of `synapse-core` and `synapse-muscle`.

---

## ✅ Phase 5: Model Context Protocol (`MCP`) Server & Multi-Distro Support (`v2.1.0` – `v2.2.0`)
- [x] **M5.1:** Integrated Streamable HTTP JSON-RPC 2.0 MCP Server (`/api/mcp`) with 42 tools, 6 Brain Vault resources, stack blueprint prompts, and `SHA-256` scoped API keys (`syn_mcp_...`).
- [x] **M5.2:** Multi-distro installer (`scripts/install-axon.sh` & `/install.sh`) with `curl`/`wget` fallback, `SHA-256` checksum verification, and Systemd + Alpine OpenRC support.
- [x] **M5.3:** Automatic **Pre-Flight Time-Machine Checkpoints (`chk-...`)** prior to every mutating operation (Blueprint, GitOps, Custom Service, Hot-Reload, Firewall, OTA Update).

---

## ✅ Phase 6: Declarative Topology Bundles, Multi-Node Canary Rollouts & 4-Doc AI Lexicon (`v2.0.0` – `v2.3.0`)
- [x] **M6.1:** Declarative `SynapseTopologyBundle` engine (`core_manage_topology_bundle` `export` / `diff` / `import`) for 1-click cloning of complete multi-service architectures.
- [x] **M6.2:** Multi-Node Canary Rollout Engine (`core_multi_node_rollout`) with automated canary gate, health-probe verification, and automatic rollback on failure.
- [x] **M6.3:** Complete Architecture Lexicon (`architecture/`, `memory/`, `playbooks/`, `AGENTS.md`, `GEMINI.md`, `CLAUDE.md`, `.githooks/pre-commit`) and automated lexicon completeness verifier (`playbooks/scripts/verify-lexicon-completeness.py`).
- [x] **M6.4:** **4-Document Brain Vault (`Architecture.md`, `Memory.md` with `[BB-XXX]`, `Milestones.md`, `AGENTS.md`) & Public/Private Clean-Room Governance:** Every project in Synapse automatically receives the 4-document lexicon, a `PUBLIC (Clean-Room)` vs. `PRIVATE (Infrastructure)` toggle in the UI, automatic zero-secret/IP sanitization for `public` projects, and the built-in Rule Cartridges `solidstate-private-infra` and `solidstate-public-cleanroom`.
- [x] **M6.5:** **Scoped MCP Key Tool (`core_manage_mcp_keys`) & 100% Ephemeral PTY Garbage Collection:** Dedicated AI/MCP tool for programmatic lifecycle management of `syn_mcp_...` keys plus complete reaping of short-lived diagnostic/health/test PTY sessions (`IsEphemeralSessionID` in `agents/axon/internal/pty/pty_discovery.go`) so `active_pty_sessions` remains `0` at idle.
- [x] **M6.6 (`v2.3.0`):** **Lexicon-Everywhere Integration:** 4-doc lexicon & `visibility` in Topology Bundles (`core_manage_topology_bundle`), Vault Search (`milestones` & `agents` scopes), `@Milestones.md`/`@AGENTS.md` context mentions and `/api/mcp` resources, 1-click & AI-driven synchronization of the 4-doc lexicon to the remote Muscle workspace (`sync_lexicon_to_node` with Pre-Flight Checkpoint), and automatic Public Clean-Room Guard for `node_fs_operation` (`write_file`/`apply_unified_diff`).
- [x] **M6.7 (`v2.3.0`):** **M8ven Security Audit Remediation (`Next.js ^15.5.28` & `PostCSS ^8.5.23` upgrade incl. `overrides`, `0 vulnerabilities` in `npm audit`)**, explicit MCP Tool Safety Annotations (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`) for all **42 integrated MCP tools** (`toolSchemas.ts`, `extendedToolSchemas.ts` & `/api/mcp/route.ts`), sliding-window rate limiting (`429 Too Many Requests`) on `/api/mcp`, `PRIVACY.md` (Zero-Telemetry Policy for Claude/OpenAI MCP directories), official M8ven Verified Badge (`solidstatenetwork-synapse-rv3on4?variant=verified` in `README.md`), and cross-platform Windows/Linux test suite hardening.

---

## ✅ Phase 7: Zero-Trust Security Hardening, Audit Hash-Chaining, Standalone MCP Server & Supply-Chain Integrity (`v2.4.0`)

- [x] **M7.1 (`v2.4.0`):** **3-Tier MCP Scope Enforcement (`read` / `execute` / `admin`), Per-Key Rate Limits, HMAC-SHA256 Request Signing & Tamper-Evident `Audit.jsonl` Hash Chain (`apps/core-web/src/lib/vault/`, `/api/mcp/route.ts`)**
  - [x] Strict enforcement of the `admin` scope (`isAdminOnlyMcpToolCall`) in `/api/mcp` for security-critical operations (`synapse_create_join_token`, `core_manage_secrets` `set`/`delete`/`generate_random`, `core_manage_node_enrollment` `generate_join_token`/`set_node_tier`/`remove_node`, `core_disaster_RecoveryVault` `restore_backup`, `core_manage_approvals` `approve`/`reject`, `core_configure_ai_engine` `update`).
  - [x] Configurable sliding-window rate limits per MCP API key (`rate_limit_per_min` in `McpApiKey`, default `120 req/min`) plus optional `HMAC-SHA256` request signature verification (`X-Synapse-Signature` + `X-Synapse-Timestamp` with 300s replay guard).
  - [x] Cryptographic `SHA-256` hash chaining (`prev_hash` + `entry_hash` from `GENESIS`) for every entry in `Audit.jsonl` (`appendAuditLog`) including `verifyAuditChain(projectId)` integrity verification in `/api/mcp` and `synapse_get_project_state`.

- [x] **M7.2 (`v2.4.0`):** **mTLS 1.3 Cipher/Curve Pinning, Automatic Certificate Rotation (`StreamTypeCertRenew`), Symlink-Ancestor Jail & Deterministic `AllowedCommands` (`apps/core-gateway/`, `agents/axon/`, `proto/`)**
  - [x] Explicit pinning of TLS 1.3 ECDHE curves (`tls.X25519`, `tls.CurveP256`) in `ServerTLSConfig()` (`pki.go`) and `buildTLSConfigForTarget()` (`diagnostics.go`) plus exponential reconnect backoff with cryptographic jitter (`ComputeReconnectBackoff` `1s -> 30s` `±25%`).
  - [x] Zero-downtime X.509 client certificate rotation (`StreamTypeCertRenew` in `proto/tunnel.pb.go`, `RenewClientCert` in `pki.go`, `NeedsCertRotation` & `RotateTargetCertificate` in `diagnostics.go` / `tunnel.go`) when `< 30` days remain.
  - [x] Hardening of `ResolvePath` (`agents/axon/internal/fs/fs.go` + extraction of `diff.go` `< 500` lines) in `TIER_2_WORKSPACE_JAIL` via recursive resolution of the deepest existing parent path (`filepath.EvalSymlinks`) plus `os.Lstat`/`os.Readlink` validation of broken symlinks.
  - [x] Extension of `GuardrailConfig` (`agents/axon/internal/guard/guard.go`) with a deterministic `AllowedCommands` allowlist (`ValidateCommandWithAllowlist`) and detection of flag-reordered `systemctl` and interface-lockout commands.

- [x] **M7.3 (`v2.4.0`):** **Dedicated Standalone MCP Server (`packages/mcp-server/`) for MCP Registries (M8ven, Glama, Smithery)**
  - [x] Dependency-free standalone Node.js MCP server (`packages/mcp-server/package.json` & `packages/mcp-server/index.mjs`) for Stdio & Streamable HTTP clients (`npx @solidstatenetwork/synapse-mcp-server`).
  - [x] Full exposure of all **42 tools** (including explicit boolean `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint` annotations), all **6 Lexicon & Brain Vault resources** (`Architecture.md`, `Memory.md`, `Milestones.md`, `AGENTS.md`, `State.json`, `Audit.jsonl`), `signMcpPayload` HMAC signing, timeout/retry, and offline fallback.

- [x] **M7.4 (`v2.4.0`):** **Brain Vault `PBKDF2-SHA256` Secret KDF & 100% Atomic Write-Temp-and-Rename Persistence (`apps/core-web/src/lib/vault.ts`)**
  - [x] Upgrade of key derivation for `Secrets.enc` to `PBKDF2-SHA256` (`100,000` iterations + random 16-byte salt per write) with seamless backward compatibility for existing `SHA-256`-encrypted `Secrets.enc` files.
  - [x] Migration of all remaining direct `fs.writeFileSync` calls in `vault.ts`, `lexiconGovernance.ts`, `auditChatAndMcp.ts`, `cartridges.ts`, and `disasterRecoveryTools.ts` to atomic `atomicWriteTextSync` (`write-temp-and-rename`).

- [x] **M7.5 (`v2.4.0`):** **CI/CD Supply-Chain Security, `npm audit` Gate & CycloneDX SBOM Generation (`.github/workflows/ci.yml`)**
  - [x] Integration of `npm audit --audit-level=high`, `node --check packages/mcp-server/index.mjs`, and automatic CycloneDX SBOM generation (`npm sbom --sbom-format cyclonedx`) in `.github/workflows/ci.yml`.

- [x] **M7.6 (`v2.4.0`):** **Comprehensive Test Suite Expansion (`47/47` TypeScript Tests & `>= 88%` Go Coverage Across All 11 Packages)**
  - [x] Expansion of the TypeScript test suite to **47 unit & fault-injection tests** (`src/__tests__/v240-security.test.ts` + updated `api-routes.test.ts`).
  - [x] Expansion of Go unit tests (`pki_test.go`, `hub_test.go`, `tunnel_test.go`, `fs_test.go`, `guard_test.go`, `main_test.go`) raising the mandatory CI coverage gate to **`>= 88.0%`** across all 11 Go packages.

---

## ✅ Phase 8: Autonomous Multi-Agent Workflows, mTLS CRL Revocation, Procfs Telemetry & OpenMetrics Observability (`v2.5.0` — Completed)

> **Architectural Goal for `v2.5.0`:** Evolution of Synapse into a declarative multi-agent DevOps platform with real-time Certificate Revocation Lists (CRL), procfs/socket-based process anomaly detection on Muscle nodes, OpenMetrics export, and cryptographically signed topology bundles.

- [x] **M8.1 (`v2.5.0`):** **Real-Time X.509 Certificate Revocation List (`CRL.json`) & Instant Session Eviction (`apps/core-gateway/internal/pki/`, `internal/hub/`)**
  - [x] Persistent X.509 serial-number revocation list (`CRL.json`) in `pki.Authority` (`RevokeCertSerial`, `IsCertRevoked`) with real-time verification during the TLS handshake (`VerifyPeerCertificate`) and immediate eviction of active Yamux sessions upon node removal (`remove_node`).

- [x] **M8.2 (`v2.5.0`):** **Cryptographically Signed Topology Bundles (`HMAC-SHA256`) & Dry-Run Drift Simulator (`apps/core-web/src/lib/orchestrator/`)**
  - [x] Extension of `SynapseTopologyBundle` (`core_manage_topology_bundle`) with a cryptographic bundle signature (`bundle_signature`, `signed_at`, `signer_fingerprint`) and a deterministic `simulate_apply` dry-run mode that computes all file, port, and container changes ahead of time with zero side effects.

- [x] **M8.3 (`v2.5.0`):** **Multi-Stage DAG Playbooks & Event-Driven Webhook Triggers (`apps/core-web/src/lib/vault/`, `/api/playbooks/`)**
  - [x] Support for multi-stage playbook pipelines (DAG steps with `on_success` / `on_failure` rollback branching and Pre-Flight Checkpoint) plus authenticated webhook triggers (`POST /api/playbooks/webhook`) for automated CI/CD deployments.

- [x] **M8.4 (`v2.5.0`):** **Lightweight Procfs/Socket Anomaly Detector & Resource Quota Guard in `axon` (`agents/axon/internal/health/`, `internal/pty/`)**
  - [x] Detection of unexpected outbound TCP bursts and sudden CPU/FD spikes directly inside the `axon` telemetry collector (`AnomalyAlerts` in `NodeHeartbeat`) plus configurable `ulimit`/timeout ceilings per PTY command.

- [x] **M8.5 (`v2.5.0`):** **OpenTelemetry / Prometheus Metrics Exporter (`/api/metrics` & `:8081/metrics`)**
  - [x] Prometheus/OpenMetrics-compatible endpoint for node telemetry (CPU, RAM, Disk, Yamux streams, MTTR, MCP tool latencies, and audit-chain integrity) with Bearer token protection.

- [x] **M8.6 (`v2.5.0`):** **Full-Stack E2E Test Matrix Expansion (`59/59` TypeScript Tests & `>= 90%` Go Coverage Across All 11 Packages)**
  - [x] Expansion of the automated test suite to **59 TypeScript tests** (`59/59` green) and **`>= 90.0%` Go statement coverage** across all 11 Go packages including CRL revocation, signed bundle, DAG playbook fault-injection, and 42-tool MCP handler isolation tests.

- [x] **M8.7 (`v2.5.0`):** **M8ven MCP Trust Index Verification Upgrade & Public npm Registry Publication (`apps/core-web/mcp-stdio.mjs`, `apps/core-web/src/lib/mcp/registeredTools.ts`)**
  - [x] Added self-contained zero-dependency Stdio MCP entrypoint (`apps/core-web/mcp-stdio.mjs`) with `"bin"` declarations and published `@solidstatenetwork/synapse@2.5.0` (and `@solidstatenetwork/synapse-mcp-server@2.5.0`) to the public npm registry (`https://www.npmjs.com/package/@solidstatenetwork/synapse`) for sandbox execution and publisher consistency.
  - [x] Registered all **42 MCP tools** via `server.registerTool(...)` with explicit JSON schemas, 4 boolean safety annotations (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`), and isolated `try/catch` handlers (`registeredTools.ts` & `registeredExtendedTools.ts`).
