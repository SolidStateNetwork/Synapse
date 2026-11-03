# 🤖 AGENTS.md — AI Engineering Manual & Governance for Synapse

> **MANDATORY DIRECTIVE FOR ALL AI AGENTS (Antigravity, Claude Code, Cursor, Windsurf, Copilot, Codex):**  
> This repository (`SolidStateNetwork/Synapse`) is a **self-contained public repository** governed by a central **Architecture Lexicon & Long-Term Memory (`memory/`)**.  
> **Never modify code or architecture without first reading and subsequently updating this lexicon!**

---

## 1. Strict Single-Repository Boundary & Language Standard

1. **Strict Single-Repository Scope (Zero Repo-Hopping):**
   - Operate **100% inside the current working directory (`CWD`)** of this repository.
   - **Never** read, modify, run git/build commands, or execute scripts in sibling directories (`../`) or on external servers unless explicitly instructed by the user.
   - Keep this repository 100% self-contained with zero references to external sibling projects.
2. **100% English Repository Standard (Chat in German):**
   - Communicate with the user in the chat in **German**.
   - Write **100% of repository files** (`README.md`, `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `memory/*`, `architecture/*`, `playbooks/*`, code, comments, tests, and commit messages) in **clean, idiomatic English** (only explicit i18n locale dictionaries or bilingual end-user UI copy may contain non-English strings).

---

## 2. The Mandatory 5-Step Protocol for Every AI Session

### Step 1: Load Context (Read First)
Before writing new code or modifying existing modules, you **must** read:
1. [`memory/PROJECT_STATE.md`](./memory/PROJECT_STATE.md) — Active subsystems, ports, security tiers, and version (`v2.5.0`).
2. [`memory/BLACKBOX.md`](./memory/BLACKBOX.md) — Recent engineering steps (`[BB-XXX]`) and Architecture Decision Records (`ADR-001` through `ADR-006`).
3. [`memory/MILESTONES.md`](./memory/MILESTONES.md) — Completed phases and active roadmap targets.

### Step 2: Verify Architectural Compliance (Check Standards)
Every implementation must strictly follow the specifications in [`architecture/`](./architecture/):
- [`architecture/00-product-vision.md`](./architecture/00-product-vision.md) — Core ("The Brain") & Muscle ("The Hands") separation and the 3 Autonomy Tiers (`TIER_1`–`TIER_3`).
- [`architecture/01-tech-stack-and-monorepo.md`](./architecture/01-tech-stack-and-monorepo.md) — Go 1.23 + Next.js 15 / React 19 / TypeScript + strict file size and test coverage gates.
- [`architecture/02-mtls-tunnel-and-axon-agent.md`](./architecture/02-mtls-tunnel-and-axon-agent.md) — mTLS 1.3 PKI, Yamux multiplexing, Ephemeral PTY GC (`IsEphemeralSessionID`), and Deterministic Self-Lockout Guard.
- [`architecture/03-ai-orchestrator-and-mcp-server.md`](./architecture/03-ai-orchestrator-and-mcp-server.md) — 100% tool parity across the AI Orchestrator, deterministic fallback engine, and `/api/mcp` (`JSON-RPC 2.0`).
- [`architecture/04-resilience-security-and-ota.md`](./architecture/04-resilience-security-and-ota.md) — `AES-256-GCM` `Secrets.enc`, Pre-Flight Time-Machine Checkpoints (`chk-...`), Self-Healing, and Container/Systemd OTA.

### Step 3: Non-Negotiable Code, Coverage & Modularization Gates
- **File Size Limits:** Every Go file (`*.go`) must remain **`< 500` lines**; every TypeScript/React file (`*.ts`, `*.tsx`) must remain **`< 600` lines**.
- **Strict Typing:** **`0` `any` types** (`npx tsc --noEmit` must pass with 0 errors).
- **Test Coverage Gates:** At least **`90.0%` statement coverage** in each of the 11 Go packages (`go test -race -cover`) and at least **`90.0%` line coverage** in TypeScript (`npm test -- --experimental-test-coverage`).
- **Local 2-Container Lab (`containers/`):** Local live tests and rollouts run isolated inside the two local containers (`bash containers/manage.sh restart`).

### Step 4: Public-Repository Security Guardrails (Clean-Room Policy)
Because this repository is **public** on GitHub, the following rules apply without exception:
- **Zero-Secret Policy:** NEVER commit real API tokens, private keys (`*.key`), `Secrets.enc`, `ca.key`, or `.env` files to Git!
- **Zero-Personal & Zero-Infra Data Policy:** NEVER leave local workstation user paths (`/home/<username>/...`), real server IPs, or private internal domains in code, tests, comments, or documentation!

### Step 5: Documentation & Blackbox Write-Back (Write Back & Push)
After **every** completed feature or release, you must **in the same turn**:
1. Update the status in [`memory/PROJECT_STATE.md`](./memory/PROJECT_STATE.md).
2. Check off completed items in [`memory/MILESTONES.md`](./memory/MILESTONES.md) (`[x]`).
3. Prepend a new dated log entry `[BB-XXX]` at the top of [`memory/BLACKBOX.md`](./memory/BLACKBOX.md).
4. Run `python3 playbooks/scripts/verify-lexicon-completeness.py`, commit cleanly, and push via `git push origin main`.
