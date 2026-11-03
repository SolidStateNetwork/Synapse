# 🌐 PROJECT STATE — Synapse Architecture & Subsystem Matrix

> **Purpose:** This file is the central **Single Source of Truth** for all subsystems, port allocations, security tiers, and verification metrics of **Synapse (`SolidStateNetwork/Synapse`)**.  
> **MANDATORY FOR AI AGENTS:** Read before every code change and update after every architecture or feature change!

---

## 1. Platform Metadata

| Property | Value |
| :--- | :--- |
| **Project Name** | **Synapse** — Distributed AI DevOps & Infrastructure Control Center |
| **Repository** | `git@github.com:SolidStateNetwork/Synapse.git` (`https://github.com/SolidStateNetwork/Synapse`) |
| **Current Version** | **`v2.5.0`** |
| **License** | Source-Available (Non-Commercial) — see [`LICENSE`](../LICENSE) |
| **Architectural Paradigm** | **Core ("The Brain")** & **Muscle ("The Hands")** over Outbound-Only **mTLS 1.3 + Yamux Multiplexing** |
| **Code Quality Gates** | Go `< 500` lines/file (`>= 90%` coverage across 11 packages) · TypeScript/React `< 600` lines/file (`59/59` tests) |

---

## 2. Subsystem Matrix (Production Inventory)

| Subsystem ID | Component | Monorepo Path | Primary Function | Port / Protocol | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`ARCH-LEXICON`** | **Architecture & AI Lexicon** | `architecture/`, `memory/`, `playbooks/`, `AGENTS.md`, `GEMINI.md`, `CLAUDE.md`, `.github/copilot-instructions.md` | Full specifications (`00`–`04`), ADRs, Blackbox, Single-Repo governance, Same-Turn Commit/Push enforcement & Pre-Commit guardrails | Git / Markdown | 🟢 `PRODUCTION (v2.5.0)` |
| **`PROTO-WIRE`** | **Wire Framing & Protobuf** | `proto/tunnel.proto`, `proto/tunnel.pb.go` | Length-prefixed JSON wire framing (`MaxFrameSize = 32 MB`) for 5 Yamux stream types (`1..5` incl. `StreamTypeCertRenew` & `AnomalyAlert`) | Yamux Binary Frame | 🟢 `PRODUCTION (100.0% Cov)` |
| **`CORE-GATEWAY`** | **mTLS 1.3 Hub, CRL & PKI Authority** | `apps/core-gateway/` | ECDSA P-256 Root CA, `CRL.json` revocation (`RevokeCertSerial`, `EvictNode`), auto-cert rotation, Yamux hub, `:8081/metrics` & reverse proxy | `8443/tcp` (mTLS 1.3)<br>`8081/tcp` (HTTP API) | 🟢 `PRODUCTION (v2.5.0)` |
| **`AXON-AGENT`** | **Static Linux Muscle Agent** | `agents/axon/` | Outbound mTLS 1.3 client (`X25519`/`P-256` pinned + auto-rotation), procfs/socket `AnomalyAlerts`, PTY resource quota guard (`ulimit`), Ephemeral PTY GC & ancestor-symlink jail | Outbound `-> 8443/tcp` | 🟢 `PRODUCTION (v2.5.0)` |
| **`CORE-WEB`** | **Next.js 15 Control Center UI** | `apps/core-web/src/components/` | React-Flow Topology Canvas, multi-tab terminal, Service Workbench, GitOps Deployer, Brain Vault, `/api/metrics` & `/api/playbooks/webhook` | `3000/tcp` (HTTP) | 🟢 `PRODUCTION (v2.5.0)` |
| **`AI-ORCHESTRATOR`** | **42-Tool AI Engine & Interceptor** | `apps/core-web/src/lib/orchestrator/` | OpenAI-compatible tool loop, signed topology bundles + `simulate_apply`, multi-stage DAG playbooks, Pre-Flight Checkpoints (`chk-...`) & offline fallback | Internal (`core-web`) | 🟢 `PRODUCTION (42 Tools)` |
| **`MCP-SERVER`** | **Built-In + Standalone MCP Server** | `apps/core-web/src/app/api/mcp/`, `apps/core-web/src/lib/mcp/`, `apps/core-web/mcp-stdio.mjs`, `packages/mcp-server/` | Streamable HTTP JSON-RPC 2.0 + standalone Stdio/HTTP server (`42` registered tools with isolated handlers & full annotations, `read`/`execute`/`admin` scopes, HMAC signing, 6 lexicon resources) | `/api/mcp` (`POST`/`GET`) + Stdio | 🟢 `PRODUCTION (v2.5.0)` |
| **`BRAIN-VAULT`** | **4-Doc Lexicon, PBKDF2 Secret Vault & Hash-Chained Audit** | `apps/core-web/src/lib/vault.ts`, `src/lib/vault/` | `State.json` (`.bak` self-healing), `Architecture.md`, `Memory.md`, `Milestones.md`, `AGENTS.md`, `Secrets.enc` (`PBKDF2-SHA256` + `AES-256-GCM`) & `Audit.jsonl` (`SHA-256` hash chain) | `/var/lib/synapse/projects/<id>/` | 🟢 `PRODUCTION (v2.5.0)` |
| **`RULE-CARTRIDGES`** | **Modular AI Architecture Rules** | `cartridges/*.md`, `src/lib/cartridges.ts` | 7 built-in cartridges (`docker-first`, `zero-trust-networking`, `native-systemd`, `nodejs-pm2`, `python-fastapi-uv`, `solidstate-private-infra`, `solidstate-public-cleanroom`) + custom cartridges | Markdown / Prompt Injection | 🟢 `PRODUCTION (7 Built-In)` |
| **`CONTAINER-LAB`** | **2-Container Local Lab** | `containers/manage.sh`, `containers/docker-compose.yml` | Reproducible 2-container environment (`synapse-core` + `synapse-muscle`) via Docker Compose or rootless Linux namespaces | `3000`, `8081`, `8443` | 🟢 `PRODUCTION` |

---

## 3. The 3 Security & Autonomy Tiers (`AutonomyTier`)

| Tier | Identifier | Enforcement Layer | Behavior |
| :--- | :--- | :--- | :--- |
| 🔴 **Tier 1** | `TIER_1_UNLEASHED` | Core Interceptor + `axon` (`internal/guard`) | Full server administration by the AI; only the `Self-Lockout Guardrail` (`axon.service`, `sshd`, own PID, Core tunnel firewall) and optional `AllowedCommands` are deterministically blocked. |
| 🟡 **Tier 2** | `TIER_2_WORKSPACE_JAIL` *(Default)* | Core Interceptor + `axon` (`internal/fs`) | All filesystem operations are strictly confined to `/opt/axon/workspaces/<project_id>/`; recursive `filepath.EvalSymlinks` validation of the deepest existing parent path + `os.Lstat`/`os.Readlink` validation of broken symlinks. |
| 🟢 **Tier 3** | `TIER_3_SUPERVISED` | Core Interceptor (`pending_approvals`) | Read-only tools execute immediately; **every** mutating file, PTY, service, or firewall action pauses and requires explicit operator approval in the WebUI. |

---

## 4. Current Test & Verification Status

- **Go Unit & Race Tests (`11` Packages):** All **11 packages** achieve **`>= 90.0%`** statement coverage (`proto` `100.0%`, `apps/core-gateway` `91.2%`, `internal/hub` `90.8%`, `internal/pki` `92.2%`, `internal/proxy` `95.9%`, `agents/axon/cmd/axon` `90.0%`, `internal/fs` `91.2%`, `internal/guard` `94.9%`, `internal/health` `91.1%`, `internal/pty` `90.2%`, `internal/tunnel` `90.2%`).
- **TypeScript / Next.js 15 Test Suite (`7` Test Suites, `59/59` Tests Passing):**
  - `src/__tests__/synapse.test.ts` (Vault, Orchestrator, Cartridges, 4-Doc Lexicon, Clean-Room Guard)
  - `src/__tests__/fault-injection.test.ts` (Corrupted JSON self-healing, rate limiting, guardrail faults)
  - `src/__tests__/api-routes.test.ts` (All REST & MCP endpoints incl. `v2.5.0` single-source version synchronization)
  - `src/__tests__/core-deep.test.ts` (Prompts, search engine, topology bundles, canary rollouts)
  - `src/__tests__/llm-and-ota.test.ts` (Streaming LLM tool loops, OTA updater, Pre-Flight Checkpoints)
  - `src/__tests__/v240-security.test.ts` (3-tier MCP scopes, per-key rate limits, HMAC-SHA256 signing & replay protection, `Audit.jsonl` SHA-256 hash chain & tamper detection, `PBKDF2-SHA256` secret KDF + legacy upgrade, atomic writes & standalone `packages/mcp-server` 42-tool parity)
  - `src/__tests__/v250-enterprise.test.ts` (Cryptographically signed topology bundles + tamper detection + `simulate_apply` drift simulator, multi-stage DAG playbooks with `on_success`/`on_failure` rollback & Pre-Flight Checkpoint, `POST /api/playbooks/webhook`, `GET /api/metrics` OpenMetrics exporter, `remove_node` CRL revocation & 42-tool isolated MCP handler registration)
