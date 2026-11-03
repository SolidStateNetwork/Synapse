# ⬛ GLOBAL MEMORY BLACKBOX — Chronological Engineering Log & ADRs

> **PURPOSE OF THIS FILE:**  
> `BLACKBOX.md` is the central, append-only long-term engineering log and Architecture Decision Record of **Synapse (`SolidStateNetwork/Synapse`)**.  
> **Every AI agent and developer** implementing features, extending the architecture, or cutting releases **must** record a structured entry here (newest entries always at the **top**).

---

## 📝 Template for New Blackbox Entries

```markdown
### [BB-XXX] YYYY-MM-DD HH:MM (TZ) – [MODULE / VERSION] Concise Change Summary
- **Actor:** <AI Model / Agent / Developer>
- **Type:** `ARCHITECTURE` | `FEATURE` | `SECURITY` | `UI` | `TEST` | `RELEASE`
- **Affected Modules:** `ARCH-LEXICON` | `CORE-GATEWAY` | `AXON-AGENT` | `AI-ORCHESTRATOR` | `MCP-SERVER` | `BRAIN-VAULT` | `CORE-WEB` | `CONTAINER-LAB`
- **Goal / Context:** Why was this change introduced?
- **Completed Steps:** Which files, Go packages, or TypeScript modules were created or updated?
- **Verification:** Test results, coverage metrics (`>= 90%` Go / `58/58` TS), line-count audit (`< 500` Go / `< 600` TS) & CI status.
```

---

## 🏛️ Architecture Decision Records (ADRs)

| ADR ID | Decision | Rationale |
| :--- | :--- | :--- |
| **ADR-001** | **Strict Core ("The Brain") & Muscle ("The Hands") Separation Over Outbound mTLS 1.3 + Yamux** | Eliminates the need for inbound firewall ports on managed Linux nodes and completely isolates the AI control plane (including `Secrets.enc`) from code execution on managed hosts. |
| **ADR-002** | **Deterministic Self-Lockout Guard & 3 Autonomy Tiers (`TIER_1`–`TIER_3`) in the Agent** | Security must never rely solely on LLM system prompts. `axon` deterministically blocks commands targeting its own PID/firewall (`ERR_SELF_PROTECTION_VIOLATION`) and enforces canonical workspace jails (`TIER_2`) or human approval (`TIER_3`) in code. |
| **ADR-003** | **100% Full-Stack AI & Model Context Protocol (`MCP`) Tool Parity** | Every feature in the web cockpit is simultaneously available as a typed tool in the internal AI Orchestrator and over `/api/mcp` (`JSON-RPC 2.0`) for external AI clients (Claude, Cursor, Windsurf). |
| **ADR-004** | **Automatic Pre-Flight Time-Machine Checkpoints (`chk-...`) Before Every Mutation** | Before every blueprint deploy, GitOps rollout/teardown, custom service deploy, live-code hot-reload, firewall update, and OTA system update, a restorable snapshot is automatically created to guarantee 1-click rollbacks. |
| **ADR-005** | **Strict Modularization & Coverage Gates (`< 500` Lines Go, `< 600` Lines TS/TSX, `>= 90%` Go Coverage, `0` `any` Types)** | Prevents monolithic files, keeps context windows focused for AI agents, and enforces durable code quality through automated CI and pre-commit checks. |
| **ADR-006** | **Public Clean-Room Policy, Strict Single-Repo Scope & Local 2-Container Lab (`containers/`)** | As a standalone public repository, Synapse contains zero real server IPs, zero local user paths (`/home/<user>`), zero secrets, and zero cross-repo coupling. End-to-end development and verification run inside two isolated local containers (`synapse-core` + `synapse-muscle`). |

---

## 📜 Chronological Engineering Log (Newest First)

### [BB-020] 2026-11-03 22:38 (CET) – [ARCH-LEXICON / v2.5.0] AI Enforcement Directives (`AGENTS.md`, `GEMINI.md`, `CLAUDE.md`, `.github/copilot-instructions.md`) & Mandatory Same-Turn Post-Change Protocol
- **Actor:** Antigravity AI & Project Lead
- **Type:** `ARCHITECTURE` | `SECURITY` | `ARCH-LEXICON`
- **Affected Modules:** `ARCH-LEXICON`
- **Goal / Context:** Standardize and harden the 4 AI enforcement files (`AGENTS.md`, `GEMINI.md`, `CLAUDE.md`, `.github/copilot-instructions.md`) with strict Single-Repository Isolation (`CWD` only), Language Standard (Chat: German, Repository: 100% English), and the Mandatory Post-Change Protocol ("No batching. No postponing. No skipping steps." — same-turn commit & push after every change).
- **Completed Steps:**
  1. Updated `AGENTS.md` with the explicit Mandatory Post-Change Protocol and same-turn commit/push checklist.
  2. Updated `GEMINI.md` and `CLAUDE.md`, and created `.github/copilot-instructions.md` with direct references to `AGENTS.md` and the explicit 4-step Post-Change Checklist.
  3. Updated `playbooks/scripts/verify-lexicon-completeness.py` to require `.github/copilot-instructions.md` alongside `AGENTS.md`, `GEMINI.md`, and `CLAUDE.md`.
- **Verification:** `python3 playbooks/scripts/verify-lexicon-completeness.py` (`PASSED`).

### [BB-019] 2026-11-03 16:55 (CET) – [MCP-SERVER / CORE-WEB / v2.5.0] Public npm Registry Publication of `@solidstatenetwork/synapse@2.5.0` & `@solidstatenetwork/synapse-mcp-server@2.5.0`
- **Actor:** Antigravity AI & Project Lead
- **Type:** `RELEASE` | `MCP-SERVER` | `ARCH-LEXICON`
- **Affected Modules:** `MCP-SERVER`, `CORE-WEB`, `ARCH-LEXICON`
- **Goal / Context:** Publish `@solidstatenetwork/synapse@2.5.0` (`apps/core-web`) and `@solidstatenetwork/synapse-mcp-server@2.5.0` (`packages/mcp-server`) to the official npm registry (`https://www.npmjs.com/package/@solidstatenetwork/synapse`) to enable `npx @solidstatenetwork/synapse` installation and M8ven npm adoption/publisher cross-verification.
- **Completed Steps:**
  1. Normalized `bin`, `files`, and `repository` fields in `apps/core-web/package.json` and `packages/mcp-server/package.json`.
  2. Published `@solidstatenetwork/synapse@2.5.0` and `@solidstatenetwork/synapse-mcp-server@2.5.0` to `https://registry.npmjs.org/` with public access.
  3. Added the official npm version badge to `README.md` and recorded `[BB-019]` in `memory/BLACKBOX.md`.
- **Verification:** `npm view "@solidstatenetwork/synapse" version` -> `2.5.0`, `python playbooks/scripts/verify-lexicon-completeness.py` (`PASSED`).

### [BB-018] 2026-11-03 12:18 (CET) – [MCP-SERVER / CORE-WEB / v2.5.0] M8ven MCP Trust Index Verification Upgrade: 42-Tool Isolated `server.registerTool` Handlers & Sandbox Stdio Entrypoint
- **Actor:** Antigravity AI & Project Lead
- **Type:** `ARCHITECTURE` | `FEATURE` | `SECURITY` | `TEST`
- **Affected Modules:** `MCP-SERVER`, `CORE-WEB`, `ARCH-LEXICON`
- **Goal / Context:** Maximize M8ven MCP Trust Index verification for subpath `apps/core-web` (`repo:solidstatenetwork/synapse#apps/core-web`) by exposing a runnable zero-dependency Stdio MCP binary (`mcp-stdio.mjs`), `@solidstatenetwork/synapse` package identity, and isolated `server.registerTool(...)` handlers for all 42 tools.
- **Completed Steps:**
  1. Updated `apps/core-web/package.json` with `"name": "@solidstatenetwork/synapse"`, removed `"private": true`, and added `"main": "./mcp-stdio.mjs"` plus `"bin"` entrypoints (`synapse`, `synapse-mcp`, `synapse-mcp-server`).
  2. Created `apps/core-web/mcp-stdio.mjs` (and synchronized `packages/mcp-server/index.mjs`) as a self-contained zero-dependency Stdio/HTTP MCP server exposing all 42 annotated tools, 6 Lexicon resources, and stack prompts.
  3. Created `apps/core-web/src/lib/mcp/registeredTools.ts` (`438` lines) and `apps/core-web/src/lib/mcp/registeredExtendedTools.ts` (`472` lines) registering all 42 Synapse MCP tools via `server.registerTool(...)` with inline JSON schemas, all 4 boolean safety annotations (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`), and isolated `try/catch` handlers, wired into `apps/core-web/src/app/api/mcp/route.ts`.
  4. Added unit test `59. M8.7` in `apps/core-web/src/__tests__/v250-enterprise.test.ts` referencing and verifying all 42 registered MCP tools and `mcp-stdio.mjs`.
- **Verification:** `node --check apps/core-web/mcp-stdio.mjs` (`EXIT 0`), `npx tsc --noEmit` (`0` errors), `59/59` TypeScript unit tests passing, and `python playbooks/scripts/verify-lexicon-completeness.py` (`PASSED`).

### [BB-017] 2026-11-03 10:00 (CET) – [ARCH-LEXICON / CORE-WEB / v2.5.0] Single-Repository Clean-Up, De-Coupling, Structural Consolidation & 100% English Standardization
- **Actor:** Antigravity AI & Project Lead
- **Type:** `ARCHITECTURE` | `SECURITY` | `ARCH-LEXICON`
- **Affected Modules:** `ARCH-LEXICON`, `CORE-WEB`, `AI-ORCHESTRATOR`, `RULE-CARTRIDGES`
- **Goal / Context:** Enforce strict single-repository isolation (`CWD` only, zero cross-repo references), remove decoupled bridge/template/duplicate governance clutter, and standardize 100% of repository documentation, architecture specs, memory files, playbooks, and governance scripts in English.
- **Completed Steps:**
  1. Removed decoupled bridge, design, template, secondary locale README, and duplicate IDE rule files.
  2. Translated `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `memory/PROJECT_STATE.md`, `memory/MILESTONES.md`, `memory/BLACKBOX.md`, `architecture/00`–`04`, `playbooks/01`–`02`, and `.agents/scripts/*.py` into 100% idiomatic English and added explicit **Strict Single-Repository Boundary** and **100% English Repository Standard** rules.
  3. Removed external sibling repository references from `README.md`, `BrainVaultAndWorkspaceViews.tsx`, `promptBuilder.ts`, `cartridges/solidstate-public-cleanroom.md`, `cartridges/solidstate-private-infra.md`, and `api-routes.test.ts`.
  4. Updated `playbooks/scripts/verify-lexicon-completeness.py` to verify the streamlined required file set and fail if deleted cross-repo bloat files or forbidden references reappear.
- **Verification:** `python3 playbooks/scripts/verify-lexicon-completeness.py` (`EXIT 0`), `npx tsc --noEmit` (`0` errors), `58/58` TypeScript unit tests passing, `11/11 >= 90.0%` Go statement coverage, and green GitHub Actions CI.

### [BB-016] 2026-11-02 23:35 (CET) – [ARCH-LEXICON / v2.5.0] Addition of Automated Lexicon & Clean-Room Verifier (`playbooks/scripts/verify-lexicon-completeness.py`)
- **Actor:** Antigravity AI & Project Lead
- **Type:** `ARCHITECTURE` | `SECURITY` | `ARCH-LEXICON`
- **Affected Modules:** `ARCH-LEXICON`
- **Goal / Context:** Provide an automated verification script `playbooks/scripts/verify-lexicon-completeness.py` to enforce mandatory governance/memory files and Clean-Room guardrails.
- **Completed Steps:**
  1. Created `playbooks/scripts/verify-lexicon-completeness.py` validating all mandatory governance, architecture, and memory files as well as Clean-Room IP/path/secret guardrails.
- **Verification:** `python3 playbooks/scripts/verify-lexicon-completeness.py` passed with `EXIT 0`.

### [BB-015] 2026-11-02 22:55 (CET) – [ARCH-LEXICON / CORE-WEB / v2.5.0] UI/UX Design Token Audit for the Synapse Canvas Layout
- **Actor:** Antigravity AI & Project Lead
- **Type:** `ARCHITECTURE` | `UI` | `ARCH-LEXICON`
- **Affected Modules:** `ARCH-LEXICON`, `CORE-WEB`
- **Goal / Context:** Document the dark control-plane canvas tokens (`#14161a` `.nb-canvas-grid`, `228px`/`68px` collapsible sidebar, and `380px` inspector drawer) used by the Synapse WebUI.
- **Completed Steps:**
  1. Verified dark-mode color hierarchy and layout geometry across `apps/core-web/src/app/globals.css` and `tailwind.config.ts`.
- **Verification:** Pre-commit guardrail and TypeScript build passed with `EXIT 0`.

### [BB-014] 2026-11-02 20:20 (CET) – [CORE-GATEWAY / AXON-AGENT / AI-ORCHESTRATOR / BRAIN-VAULT / MCP-SERVER / v2.5.0] Full Implementation & Verification of Phase 8 (`v2.5.0`, `M8.1`–`M8.6`): Real-Time X.509 CRL Revocation, Signed Topology Bundles & Drift Simulator, Multi-Stage DAG Playbooks, Procfs Anomaly Detector & OpenMetrics Exporter
- **Actor:** Antigravity AI & Project Lead
- **Type:** `RELEASE` | `SECURITY` | `FEATURE` | `TEST` | `ARCH-LEXICON`
- **Affected Modules:** `CORE-GATEWAY`, `AXON-AGENT`, `AI-ORCHESTRATOR`, `BRAIN-VAULT`, `MCP-SERVER`, `PROTO-WIRE`, `ARCH-LEXICON`
- **Goal / Context:** Complete end-to-end implementation and verification of all 6 milestones of Phase 8 (`v2.5.0`, `M8.1`–`M8.6`) per [`memory/MILESTONES.md`](./MILESTONES.md).
- **Completed Steps:**
  1. **`M8.1` – Real-Time X.509 Certificate Revocation List (`CRL.json`) & Instant Session Eviction (`apps/core-gateway/internal/pki/crl.go`, `internal/hub/eviction.go`, `apps/core-gateway/main.go`):**
     - Implemented persistent X.509 serial-number revocation list (`CRL.json` with atomic `.bak` self-healing) in `pki.Authority` (`RevokeCertSerial`, `IsCertRevoked`, `ListRevokedCerts`) wired directly into `ServerTLSConfig().VerifyPeerCertificate` and `RenewClientCert`.
     - Added `EvictNode(nodeID, reason)` and `GetNodeCertSerial(nodeID)` in the Yamux hub along with `POST /api/v1/nodes/revoke` and `GET /api/v1/pki/crl` in `core-gateway`, linked to `core_manage_node_enrollment` (`remove_node`).
  2. **`M8.2` – Cryptographically Signed Topology Bundles (`HMAC-SHA256`) & Dry-Run Drift Simulator (`apps/core-web/src/lib/vault/v250Enterprise.ts`, `topologyAndCanaryTools.ts`):**
     - Implemented `signTopologyBundle`, `verifyTopologyBundleSignature`, and `simulateTopologyBundleDrift` (`simulate_apply`); export automatically signs canonical topology payloads, import verifies the signature prior to any mutation, and `simulate_apply` deterministically computes services, ports, cartridges, and stacks to add or update without side effects.
  3. **`M8.3` – Multi-Stage DAG Playbooks & Event-Driven Webhook Triggers (`v250Enterprise.ts`, `playbookAndApprovalTools.ts`, `/api/playbooks/webhook/route.ts`):**
     - Implemented multi-stage DAG playbooks (`steps` with `on_success` / `on_failure` branching, Pre-Flight Time-Machine Checkpoint `chk-...`, and automatic rollback on step failure) plus `POST /api/playbooks/webhook` (`X-Synapse-Webhook-Token` / `HMAC-SHA256` signature verification).
  4. **`M8.4` – Lightweight Procfs/Socket Anomaly Detector & PTY Resource Quota Guard (`agents/axon/internal/health/anomaly.go`, `internal/pty/pty_discovery.go`, `pty.go`):**
     - Added `CollectProcfsAndAnomalyTelemetry` (`open_fds`, `outbound_conns`, `AnomalyAlerts`: `ANOMALY_CPU_SPIKE`, `ANOMALY_FD_EXHAUSTION`, `ANOMALY_OUTBOUND_BURST`) in the `axon` health collector and `BuildQuotaWrappedCommand` (`ulimit -v` / `ulimit -t`) in the PTY executor.
  5. **`M8.5` & `M8.6` – OpenMetrics Exporter (`/api/metrics` & `:8081/metrics`), Policy-as-Code Gate (`orchestrator.ts` & `v250Enterprise.ts`) & Full-Stack Test Matrix (`58/58` TS Tests & `11/11 >= 90.0%` Go Coverage):**
     - Implemented Prometheus/OpenMetrics endpoints in `apps/core-gateway/metrics.go` (`:8081/metrics`) and `apps/core-web/src/app/api/metrics/route.ts` (`/api/metrics`) with optional Bearer token protection (`SYNAPSE_METRICS_TOKEN`), signed audit snapshots (`createSignedAuditSnapshot` / `AuditSnapshot.json`), declarative Policy-as-Code evaluation (`evaluatePolicyAsCode` with `path_prefixes`, `deny` > `require_approval` > `allow` precedence in `interceptAndExecuteTool`), and `src/__tests__/v250-enterprise.test.ts` (Tests `48`–`58`).
- **Verification:** `58/58` TypeScript tests passing (`0` errors), `npx tsc --noEmit` (`0` errors), `npm audit --audit-level=high` (`0` vulnerabilities), all `.go` files `< 500` lines and all `.ts`/`.tsx` files `< 600` lines, all 11 Go packages `>= 90.0%` statement coverage.

### [BB-013] 2026-11-02 15:40 (CET) – [MCP-SERVER / BRAIN-VAULT / CORE-GATEWAY / AXON-AGENT / v2.4.0] Full Implementation & Verification of Phase 7 (`v2.4.0`, `M7.1`–`M7.6`) & Specification of Phase 8 (`v2.5.0`, `M8.1`–`M8.6`)
- **Actor:** Antigravity AI & Project Lead
- **Type:** `RELEASE` | `SECURITY` | `FEATURE` | `TEST` | `ARCH-LEXICON`
- **Affected Modules:** `MCP-SERVER`, `BRAIN-VAULT`, `CORE-GATEWAY`, `AXON-AGENT`, `PROTO-WIRE`, `ARCH-LEXICON`
- **Goal / Context:** Complete implementation and end-to-end verification of all milestones in Phase 7 (`v2.4.0`, `M7.1`–`M7.6`) and specification of Phase 8 (`v2.5.0`, `M8.1`–`M8.6`).
- **Completed Steps:**
  1. **`M7.1` – 3-Tier MCP Scopes, Per-Key Rate Limits, HMAC-SHA256 Signing & `Audit.jsonl` Hash Chain (`auditChatAndMcp.ts`, `/api/mcp/route.ts`):**
     - Implemented `isAdminOnlyMcpToolCall` wired into `executeMcpTool`, configurable sliding-window rate limits (`rate_limit_per_min` per API key), optional `HMAC-SHA256` request signature verification (`verifyMcpRequestSignature` with 300s replay window), and cryptographic `SHA-256` hash chaining (`prev_hash` + `entry_hash` from `GENESIS`) in `appendAuditLog` and `verifyAuditChain(projectId)`.
  2. **`M7.2` – Go `core-gateway` & `axon` mTLS 1.3 Auto-Rotation, Curve Pinning, Deep Ancestor Symlink Jail & `AllowedCommands` (`proto/tunnel.pb.go`, `pki.go`, `hub.go`, `diagnostics.go`, `tunnel.go`, `fs.go`, `diff.go`, `guard.go`):**
     - Added `StreamTypeCertRenew = 5`, `RenewClientCert`, `NeedsCertRotation`, and `RotateTargetCertificate`; pinned TLS 1.3 ECDHE curves (`X25519`, `CurveP256`); hardened `ResolvePath` in `fs.go` against broken/ancestor symlinks; and added `ValidateCommandWithAllowlist` in `guard.go`.
  3. **`M7.3` – Standalone MCP Server (`packages/mcp-server/package.json` & `index.mjs`):**
     - Created dependency-free Node.js Stdio/HTTP MCP server (`@solidstatenetwork/synapse-mcp-server`) exposing all 42 annotated tools, 6 lexicon resources, `signMcpPayload`, and offline fallback.
  4. **`M7.4` – `PBKDF2-SHA256` Secret KDF & 100% Atomic Persistence (`vault.ts`, `lexiconGovernance.ts`, `cartridges.ts`, `disasterRecoveryTools.ts`):**
     - Upgraded `encryptSecretsMap` / `decryptSecretsMap` to `PBKDF2-SHA256` (`100,000` iterations + 16-byte salt) with legacy SHA-256 fallback and replaced remaining `fs.writeFileSync` calls with `atomicWriteTextSync`.
  5. **`M7.5` & `M7.6` – CI Supply-Chain Gates & Test Suite Expansion (`47/47` TS Tests & `11/11 >= 88%` Go Coverage):**
     - Extended `.github/workflows/ci.yml` with `npm audit --audit-level=high`, `node --check packages/mcp-server/index.mjs`, CycloneDX SBOM generation, and `src/__tests__/v240-security.test.ts`.
- **Verification:** `47/47` TypeScript tests passing, `npx tsc --noEmit` (`0` errors), `npm audit --audit-level=high` (`0` vulnerabilities), all 11 Go packages `>= 88.0%` coverage.

### [BB-012] 2026-11-02 14:00 (CET) – [ARCH-LEXICON / MCP-SERVER / BRAIN-VAULT / CORE-GATEWAY / AXON-AGENT / v2.4.0 Roadmap] Forensic Codebase Audit & Design of the Phase 7 (`v2.4.0`, `M7.1`–`M7.6`) Enterprise Security Roadmap
- **Actor:** Antigravity AI & Project Lead
- **Type:** `ARCHITECTURE` | `SECURITY` | `ARCH-LEXICON`
- **Affected Modules:** `ARCH-LEXICON`, `MCP-SERVER`, `BRAIN-VAULT`, `CORE-GATEWAY`, `AXON-AGENT`
- **Goal / Context:** Systematic audit of `apps/core-web`, `apps/core-gateway`, `agents/axon`, and `.github/workflows/ci.yml` to specify the `v2.4.0` (Phase 7: `M7.1`–`M7.6`) security hardening roadmap and harmonize tool counts (`42 Tools total: 38 Core/Node Tools + 4 MCP Meta-Tools`).
- **Completed Steps:**
  1. Audited `/api/mcp/route.ts`, `vault.ts`, `pki.go`, and `tunnel.go` and specified milestones `M7.1` through `M7.6` in `memory/MILESTONES.md` and `memory/PROJECT_STATE.md`.
  2. Synchronized `architecture/00-product-vision.md` and `architecture/03-ai-orchestrator-and-mcp-server.md` to document all 42 tools (`38` Core/Node tools + `4` MCP meta-tools).
- **Verification:** Clean-Room Guard (`0` private IPs/domains/secrets), `npx tsc --noEmit` (`0` errors), `npm test` (`33/33` passed).

### [BB-011] 2026-11-02 13:45 (CET) – [MCP-SERVER / ARCH-LEXICON / v2.3.0] M8ven Verified Badge Claim (`solidstatenetwork-synapse-rv3on4`), Hardened MCP Sliding-Window Rate Limiting, Centralized `process.env` Resolution & `PRIVACY.md` Directory Compliance
- **Actor:** Antigravity AI & Project Lead
- **Type:** `SECURITY` | `FEATURE` | `TEST` | `ARCH-LEXICON`
- **Affected Modules:** `MCP-SERVER`, `ARCH-LEXICON`, `CORE-WEB`, `BRAIN-VAULT`
- **Goal / Context:** Embed the official M8ven Verified Badge in `README.md`, add hardened sliding-window rate limiting (`checkMcpRateLimit`, `429 Too Many Requests`, `Retry-After`, `X-RateLimit-Limit`), centralize `getCoreGatewayUrl()` and `resolveVaultBaseDir()`, and provide `PRIVACY.md` for MCP directory compliance.
- **Completed Steps:**
  1. Added M8ven Verified Badge to `README.md` and created `PRIVACY.md` (root & `apps/core-web/PRIVACY.md`).
  2. Added sliding-window rate limiting (`120 req/min` per `clientId`, `MCP_RATE_LIMIT_MAX_BUCKETS = 512`) in `apps/core-web/src/app/api/mcp/route.ts` and extracted `isReadOnlyMcpToolCall` to `src/lib/vault/auditChatAndMcp.ts`.
  3. Centralized `getCoreGatewayUrl()` in `src/lib/gatewayClient.ts` and `resolveVaultBaseDir()` in `src/lib/vault.ts`.
- **Verification:** M8ven Score = `89/100` (`Grade B`, `sub_scores.code: 100/100`), `npm audit` = `0 vulnerabilities`, `npx tsc --noEmit` = `0 errors`, `npm test` = `33/33 passed`.

### [BB-010] 2026-11-02 12:35 (CET) – [MCP-SERVER / AI-ORCHESTRATOR / CORE-WEB / v2.3.0] M8ven Security Audit Remediation, 42-Tool MCP Safety Annotations & Cross-Platform Test Hardening
- **Actor:** Antigravity AI & Project Lead
- **Type:** `SECURITY` | `FEATURE` | `TEST` | `ARCH-LEXICON`
- **Affected Modules:** `MCP-SERVER`, `AI-ORCHESTRATOR`, `CORE-WEB`, `ARCH-LEXICON`
- **Goal / Context:** Remediate all findings reported in the M8ven Security Audit: upgrade pinned `Next.js` and `PostCSS` dependencies, add explicit MCP Safety Annotations (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`) for all 42 integrated MCP tools, and harden `llm-and-ota.test.ts` for cross-platform execution on Linux and Windows.
- **Completed Steps:**
  1. Upgraded `next` and `eslint-config-next` to `^15.5.28` and `postcss` to `^8.5.23` in `apps/core-web/package.json` (`npm audit`: `0 vulnerabilities`).
  2. Added `getMcpToolSafetyAnnotations(toolName)` and explicit `annotations` literals across `toolSchemas.ts`, `extendedToolSchemas.ts`, and `/api/mcp/route.ts` for all 42 tools.
  3. Added cross-platform `go.cmd`/`systemctl.cmd` shims and `path.delimiter` support in `apps/core-web/src/__tests__/llm-and-ota.test.ts`.
- **Verification:** `npm audit` = `0 vulnerabilities`, `npx tsc --noEmit` = `0 errors`, `npm test` = `33/33 passed`.

### [BB-009] 2026-11-01 03:09 (CET) – [BRAIN-VAULT / AI-ORCHESTRATOR / MCP-SERVER / CORE-WEB / v2.3.0] Lexicon-Everywhere: 4-Doc Topology Bundles, Vault Search, MCP Resources, Remote Muscle Workspace Sync & Remote FS Clean-Room Guard
- **Actor:** Antigravity AI & Project Lead
- **Type:** `ARCHITECTURE` | `FEATURE` | `SECURITY` | `UI` | `RELEASE`
- **Affected Modules:** `BRAIN-VAULT`, `AI-ORCHESTRATOR`, `MCP-SERVER`, `CORE-WEB`, `CONTAINER-LAB`
- **Goal / Context:** Integrate the 4-Document Brain Vault (`Architecture.md`, `Memory.md [BB-XXX]`, `Milestones.md`, `AGENTS.md`) and `public`/`private` Clean-Room governance across Topology Bundles, Vault Search, `@` context mentions, MCP resources, 1-click Muscle workspace synchronization (`sync_lexicon_to_node`), and remote filesystem writes (`node_fs_operation`).
- **Completed Steps:**
  1. Extended `SynapseTopologyBundle` in `topologyAndCanaryTools.ts` with `visibility` and `lexicon_docs`.
  2. Extended `executeCoreVaultSearch`, `expandContextMentions`, and `/api/mcp/route.ts` with `Milestones.md` and `AGENTS.md`.
  3. Implemented `syncLexiconDocsToMuscleNode` in `lexiconGovernance.ts` with Pre-Flight Checkpoint support and wired `sanitizeBrainContentForVisibility` into `node_fs_operation`.
- **Verification:** Go coverage `88.0%`, TS line coverage `>= 91%`, max Go `499` lines, max TS `< 600` lines, `0` `any` types.

### [BB-008] 2026-11-01 02:45 (CET) – [BRAIN-VAULT / AI-ORCHESTRATOR / MCP-SERVER / AXON-AGENT / v2.2.0] 4-Doc AI Lexicon, Public/Private Clean-Room Governance, Scoped MCP Key Tool & 100% Ephemeral PTY GC
- **Actor:** Antigravity AI & Project Lead
- **Type:** `ARCHITECTURE` | `FEATURE` | `SECURITY` | `UI` | `RELEASE`
- **Affected Modules:** `BRAIN-VAULT`, `AI-ORCHESTRATOR`, `MCP-SERVER`, `AXON-AGENT`, `CORE-WEB`, `CONTAINER-LAB`
- **Goal / Context:** Embed the 5-step engineering protocol directly into the internal Synapse AI with `PUBLIC (Clean-Room)` vs. `PRIVATE (Infrastructure)` project governance, programmatic MCP key management (`core_manage_mcp_keys`), and 100% Ephemeral PTY Garbage Collection in the Axon agent.
- **Completed Steps:**
  1. Created `apps/core-web/src/lib/vault/lexiconGovernance.ts` for the 4-Document Brain Vault and `sanitizeBrainContentForVisibility`.
  2. Added `cartridges/solidstate-public-cleanroom.md` and `cartridges/solidstate-private-infra.md`.
  3. Implemented `core_manage_mcp_keys` (`list`, `create`, `revoke`) and added `deep-search-`, `self-heal-`, and `link-probe-` to `IsEphemeralSessionID` in `pty_discovery.go`.
- **Verification:** Go coverage `88.0%`, TS line coverage `>= 91%`, max Go `499` lines, max TS `< 600` lines, `0` `any` types.

### [BB-007] 2026-11-01 02:06 (CET) – [CORE-WEB / AI-ORCHESTRATOR / v2.1.0] 1-Click Topology Bundle UI, Multi-Node Canary UI & Pre-Flight Cron/Playbook Checkpoints
- **Actor:** Antigravity AI & Project Lead
- **Type:** `FEATURE` | `UI` | `RELEASE`
- **Affected Modules:** `CORE-WEB`, `AI-ORCHESTRATOR`, `CONTAINER-LAB`
- **Goal / Context:** Expose Topology Bundle (`synapse-stack/v2.0`) and Multi-Node Canary tools directly in the WebUI (`BrainVaultView` & `PeersView`) and add automatic Pre-Flight Time-Machine Checkpoints (`checkpoint_id`) for all cron runbook and playbook mutations.
- **Completed Steps:**
  1. Extended `POST /api/projects`, `BrainVaultAndWorkspaceViews.tsx`, and `PeersView.tsx` with topology bundle export/import and canary rollout controls.
  2. Added automatic Pre-Flight Checkpoints (`checkpoint_id`) to `core_manage_cron_jobs` and `core_manage_playbooks`.
- **Verification:** Go coverage `88.0%`, TS line coverage `>= 94%`, max Go `499` lines, max TS `596` lines.

### [BB-006] 2026-11-01 01:40 (CET) – [AI-ORCHESTRATOR / MCP-SERVER / v2.0.0] Declarative Topology Bundles, Multi-Node Canary Rollouts, Lexicon Self-Test & Domain-TLS Checkpoints
- **Actor:** Antigravity AI & Project Lead
- **Type:** `FEATURE` | `ARCHITECTURE` | `RELEASE`
- **Affected Modules:** `AI-ORCHESTRATOR`, `MCP-SERVER`, `CORE-WEB`, `ARCH-LEXICON`, `CONTAINER-LAB`
- **Goal / Context:** Complete major release `v2.0.0` with portable declarative project topology bundles (`synapse-stack/v2.0`), staged multi-node canary rollouts, live architecture lexicon self-test in `/api/debug`, and Pre-Flight Checkpoints for domain/TLS updates.
- **Completed Steps:**
  1. Created `topologyAndCanaryTools.ts` (`core_manage_topology_bundle` and `core_cluster_canary_exec`).
  2. Extended `/api/debug/route.ts` (`self_test`) with the `lexicon_and_governance` verification stage and added Pre-Flight Checkpoints to `core_manage_domain_tls`.
- **Verification:** Go coverage `88.0%`, TS line coverage `94.34%`, max Go `499` lines, max TS `596` lines.

### [BB-005] 2026-11-01 01:16 (CET) – [ARCH-LEXICON / v1.9.0] Introduction of the Architecture Lexicon, AI Governance & Public Pre-Commit Guardrails
- **Actor:** Antigravity AI & Project Lead
- **Type:** `ARCHITECTURE` | `SECURITY`
- **Affected Modules:** `ARCH-LEXICON` (`architecture/00`–`04`, `memory/*`, `playbooks/01`–`02`, `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `.agents/hooks.json`, `.githooks/pre-commit`, `README.md`)
- **Goal / Context:** Establish the modular architecture specifications (`architecture/00`–`04`), persistent project memory (`memory/`), Standard Operating Procedures (`playbooks/`), session-start context injection, and `.githooks/pre-commit` blocker.
- **Completed Steps:**
  1. Created `architecture/00-product-vision.md` through `04-resilience-security-and-ota.md`, `memory/PROJECT_STATE.md`, `memory/MILESTONES.md`, `memory/BLACKBOX.md`, `playbooks/01`–`02`, `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, and `.githooks/pre-commit`.
- **Verification:** Zero-Private-Data scan (`0` hits), pre-commit hook active, all Go and TypeScript tests 100% green.

### [BB-004] 2026-11-01 00:55 (CET) – [AI-ORCHESTRATOR / MCP-SERVER / v1.9.0] Service Workbench, RBAC & AI-Endpoint Tools, Pre-Flight Custom-Service Checkpoints & Studio Badges
- **Actor:** Antigravity AI & Project Lead
- **Type:** `FEATURE` | `RELEASE`
- **Affected Modules:** `AI-ORCHESTRATOR`, `MCP-SERVER`, `CORE-WEB`, `CONTAINER-LAB`
- **Goal / Context:** Complete 100% AI/MCP parity for the interactive Service Workbench (`GET`/`POST`/`PUT`/`DELETE`/`SQL`), RBAC/2FA status, and AI endpoint configuration, plus automatic Pre-Flight Checkpoints during custom service deployment.
- **Completed Steps:**
  1. Created `workbenchAndAuthTools.ts` (`core_invoke_service_action`, `core_manage_auth_and_ai`) and added Pre-Flight Checkpoints (`checkpoint_id`) to `deployCustomServiceOnMuscle` and `triggerGitOpsWebhookRedeploy`.
- **Verification:** Go coverage `88.0%`, TS line coverage `94.31%`, CI green.

### [BB-003] 2026-11-01 00:36 (CET) – [AI-ORCHESTRATOR / AXON-AGENT / v1.8.0] Playbooks & Approvals AI/MCP Tools, Complete Ephemeral PTY GC & Blueprint/OTA Badges
- **Actor:** Antigravity AI & Project Lead
- **Type:** `FEATURE` | `RELEASE`
- **Affected Modules:** `AI-ORCHESTRATOR`, `AXON-AGENT`, `CORE-WEB`
- **Goal / Context:** Expose `core_manage_playbooks` and `core_manage_approvals` to AI/MCP, reap all remaining one-shot PTY sessions in `axon`, and display `checkpoint_id` badges in Blueprints & System Update UI.
- **Completed Steps:**
  1. Implemented `playbookAndApprovalTools.ts` and added `svc-cleanup-`, `sys-update-`, `mesh-`, and `custom-svc-` prefixes to `IsEphemeralSessionID` (`pty_discovery.go`).
- **Verification:** Go coverage `88.0%`, TS coverage `94.30%`, CI green.

### [BB-002] 2026-11-01 00:15 (CET) – [AI-ORCHESTRATOR / CONTAINER-LAB / v1.6.0 & v1.7.0] Firewall/Cartridges/Cluster/Projects/Diagnostics Tools, Container-Native OTA & 2-Container Lab
- **Actor:** Antigravity AI & Project Lead
- **Type:** `ARCHITECTURE` | `FEATURE` | `RELEASE`
- **Affected Modules:** `CONTAINER-LAB`, `AI-ORCHESTRATOR`, `CORE-WEB`
- **Goal / Context:** Transition local development to two isolated containers (`containers/manage.sh`: `synapse-core` + `synapse-muscle`), modularize tool schemas (`extendedToolSchemas.ts`), and implement container-native OTA rollouts.
- **Completed Steps:**
  1. Built `containers/` setup (`core/Dockerfile`, `muscle/Dockerfile`, `docker-compose.yml`, `manage.sh`) and implemented `firewallCartridgeAndClusterTools.ts` and `projectAndDiagnosticTools.ts`.
- **Verification:** Local containers healthy on `:3000`/`:8081`/`:8443`, all CI & release pipelines green.

### [BB-001] 2026-10-31 22:30 (CET) – [GLOBAL / v1.0.0 – v1.5.0] Production Milestone v1.0.0 & Expansion of the DevOps, Resilience & Blueprint Suites
- **Actor:** Antigravity AI & Project Lead
- **Type:** `ARCHITECTURE` | `RELEASE`
- **Affected Modules:** All Modules (`PROTO-WIRE` through `CORE-WEB`)
- **Goal / Context:** Complete the `v1.0.0` public Clean-Room architecture (`< 500` Go / `< 600` TS lines, `>= 85%` Go / `>= 90%` TS coverage) and expand through `v1.5.0` (GitOps, Live Logs, Disaster Recovery, SecOps, Hot-Reload, SQLite Studio, Self-Healing, Service Mesh, Blueprints, Domain/TLS & 6-stage Self-Test).
- **Verification:** 100% green GitHub Actions CI and multi-arch release pipelines (`v1.0.0` through `v1.5.0`).
