# 📋 Playbook 01 — Feature & Milestone Development (SOP)

This playbook defines the mandatory Standard Operating Procedure (SOP) for developing features and milestones in **Synapse (`SolidStateNetwork/Synapse`)**.

---

## 1. Pre-Flight Check (Read First & Single-Repo Scope)
1. Operate strictly inside this repository (`CWD`); never access sibling repositories (`../`).
2. Read [`AGENTS.md`](../AGENTS.md), [`memory/PROJECT_STATE.md`](../memory/PROJECT_STATE.md), [`memory/BLACKBOX.md`](../memory/BLACKBOX.md), and [`memory/MILESTONES.md`](../memory/MILESTONES.md).
3. Review the relevant architecture specification under [`architecture/`](../architecture/) (`00` through `04`).

---

## 2. Architectural & Coding Rules During Implementation

1. **Strict File Size Discipline:**
   - No Go file (`*.go`) may reach `500` lines (target: `< 490` lines).
   - No TypeScript/React file (`*.ts`, `*.tsx`) may reach `600` lines (target: `< 585` lines).
   - New orchestrator tools belong in focused domain modules under `apps/core-web/src/lib/orchestrator/<domain>Tools.ts` (`< 220` lines) and must be registered in `extendedToolSchemas.ts` (`< 300` lines), `coreTools.ts`, `autonomousFallback.ts`, `/api/mcp/route.ts`, and `packages/mcp-server/index.mjs`.
2. **Pre-Flight Time-Machine Checkpoints:**
   - Every new mutating infrastructure action must call `recordCheckpoint(projectId, ...)` from `@/lib/checkpoints` beforehand and return `checkpoint_id` in both the response payload and UI status banner.
3. **Ephemeral PTY Sessions:**
   - New one-shot PTY invocations must either reuse an existing ephemeral session prefix (`IsEphemeralSessionID` in `agents/axon/internal/pty/pty_discovery.go`) or register the new prefix there with a corresponding unit test in `pty_test.go`.
4. **Zero `any` Types, 100% English Repo Content & Public Clean-Room:**
   - Use strict TypeScript interfaces. Keep 100% of repository documentation, code, comments, and commit messages in English. Never write real server IPs, local user paths (`/home/<user>`), or secrets into code or tests.

---

## 3. Mandatory Local Verification Before Every Commit

Run the following verification checks before committing:

```bash
export LC_ALL=C PATH="${HOME}/.local/go/bin:${PATH}"

# 1. File size audit (< 500 Go / < 600 TS)
find proto agents/axon apps/core-gateway -name "*.go" -exec wc -l {} + | grep -v " total$" | sort -nr | head -n 5
find apps/core-web/src -name "*.ts" -o -name "*.tsx" | xargs wc -l | grep -v " total$" | sort -nr | head -n 5

# 2. Go unit & race tests (>= 90.0% statement coverage across all 11 packages)
go test -race -cover ./proto/... ./agents/axon/... ./apps/core-gateway/...

# 3. TypeScript strict typecheck & test suite
cd apps/core-web
npx tsc --noEmit
npm test

# 4. Lexicon & Clean-Room completeness check
cd ../..
python3 playbooks/scripts/verify-lexicon-completeness.py
```
