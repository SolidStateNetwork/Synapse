# 🤖 AGENTS.md — AI Engineering Manual & Governance for Synapse

> **MANDATORY DIRECTIVE FOR ALL AI AGENTS (Antigravity, Claude Code, Gemini, Cursor, Windsurf, GitHub Copilot, Codex):**
> - **Read these rules BEFORE doing anything.**
> - **Follow them at all times — zero exceptions.**
> - **Commit and push after EVERY change in the same turn.**
> - **No batching. No postponing. No skipping steps.**

---

## 1. Strict Single-Repository Isolation & Language Standard

1. **Strict Single-Repository Isolation (Operate Strictly in `CWD`):**
   - Always operate **100% inside the current working directory (`CWD`)** of this repository (`SolidStateNetwork/Synapse`).
   - **Never** read, modify, run git/build commands, or execute scripts in sibling directories (`../`) or on external servers unless explicitly instructed by the user.
   - Keep this repository 100% self-contained with zero references to external sibling projects.
2. **Language Standard (Chat: German · Repository: 100% English):**
   - Communicate with the user in the chat in **German**.
   - Write **100% of repository files** (`README.md`, `AGENTS.md`, `GEMINI.md`, `CLAUDE.md`, `.github/copilot-instructions.md`, `memory/*`, `architecture/*`, `playbooks/*`, code, comments, tests, and commit messages) in **clean, idiomatic English** (only explicit i18n locale dictionaries or bilingual end-user UI copy may contain non-English strings).

---

## 2. Pre-Change & Architecture Protocol (Read First, Check Standards)

### Step 1: Load Context Before Doing Anything
Before writing new code or modifying existing modules, you **must** read:
1. [`memory/PROJECT_STATE.md`](./memory/PROJECT_STATE.md) — Active subsystems, ports, security tiers, and version (`v2.5.0`).
2. [`memory/BLACKBOX.md`](./memory/BLACKBOX.md) — Recent engineering steps (`[BB-XXX]`) and Architecture Decision Records (`ADR-001` through `ADR-006`).
3. [`memory/MILESTONES.md`](./memory/MILESTONES.md) — Completed phases and active roadmap targets.

### Step 2: Verify Architectural Compliance
Every implementation must strictly follow the specifications in [`architecture/`](./architecture/):
- [`architecture/00-product-vision.md`](./architecture/00-product-vision.md) — Core ("The Brain") & Muscle ("The Hands") separation and the 3 Autonomy Tiers (`TIER_1`–`TIER_3`).
- [`architecture/01-tech-stack-and-monorepo.md`](./architecture/01-tech-stack-and-monorepo.md) — Go 1.23 + Next.js 15 / React 19 / TypeScript + strict file size and test coverage gates.
- [`architecture/02-mtls-tunnel-and-axon-agent.md`](./architecture/02-mtls-tunnel-and-axon-agent.md) — mTLS 1.3 PKI, Yamux multiplexing, Ephemeral PTY GC (`IsEphemeralSessionID`), and Deterministic Self-Lockout Guard.
- [`architecture/03-ai-orchestrator-and-mcp-server.md`](./architecture/03-ai-orchestrator-and-mcp-server.md) — 100% tool parity across the AI Orchestrator, deterministic fallback engine, and `/api/mcp` (`JSON-RPC 2.0`).
- [`architecture/04-resilience-security-and-ota.md`](./architecture/04-resilience-security-and-ota.md) — `AES-256-GCM` `Secrets.enc`, Pre-Flight Time-Machine Checkpoints (`chk-...`), Self-Healing, and Container/Systemd OTA.

### Step 3: Non-Negotiable Code, Coverage & Clean-Room Gates
- **File Size Limits:** Every Go file (`*.go`) must remain **`< 500` lines**; every TypeScript/React file (`*.ts`, `*.tsx`) must remain **`< 600` lines**.
- **Strict Typing:** **`0` `any` types** (`npx tsc --noEmit` must pass with 0 errors).
- **Test Coverage Gates:** At least **`90.0%` statement coverage** in each of the 11 Go packages (`go test -race -cover`) and at least **`90.0%` line coverage** in TypeScript (`npm test -- --experimental-test-coverage`).
- **Public Clean-Room Policy:** Never commit real API tokens, private keys (`*.key`), `Secrets.enc`, `ca.key`, `.env` files, local workstation user paths (`/home/<username>/...`), real server IPs, or private internal domains to Git.

---

## 3. Mandatory Post-Change Protocol (Same-Turn Commit & Push)

> **CRITICAL RULE:** After **every** change — whether code, configuration, tests, or documentation — you **must** execute the complete Post-Change Checklist below **in the exact same turn** before concluding your response.  
> **No batching. No postponing. No skipping steps. Never say "I will commit later."**

### Mandatory Post-Change Checklist
- [ ] **1. Update Project State & Roadmap (if applicable):** Update [`memory/PROJECT_STATE.md`](./memory/PROJECT_STATE.md) and check off completed items (`[x]`) in [`memory/MILESTONES.md`](./memory/MILESTONES.md).
- [ ] **2. Prepend Blackbox Entry:** Prepend a new dated `[BB-XXX]` entry at the top of [`memory/BLACKBOX.md`](./memory/BLACKBOX.md) documenting the change and verification results.
- [ ] **3. Run Lexicon & Clean-Room Verifier:** Execute `python3 playbooks/scripts/verify-lexicon-completeness.py` and ensure it exits with `0`.
- [ ] **4. Same-Turn Git Commit & Push:** Stage all changes (`git add -A`), commit with a clear English commit message (`git commit -m "..."`), and push immediately (`git push origin main`). Verify `git status --porcelain` is empty.
