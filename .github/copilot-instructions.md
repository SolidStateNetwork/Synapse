# GitHub Copilot Instructions – SolidStateNetwork/Synapse

This repository (`SolidStateNetwork/Synapse`) is a public project governed by the **Architecture Lexicon & AI Memory System** (`architecture/` & `memory/`).

## Mandatory 5-Step Protocol (see `AGENTS.md`):
1. **Read First:** Before writing or modifying code, read `AGENTS.md`, `memory/PROJECT_STATE.md`, `memory/BLACKBOX.md`, and `memory/MILESTONES.md`.
2. **Check Standards:** Follow all architectural specifications under `architecture/` (`00` through `04`).
3. **Strict Modularization & Coverage Gates:** Keep every Go file `< 500` lines, every TS/TSX file `< 600` lines, `0` `any` types, `>= 85%` Go coverage, and `>= 90%` TS coverage.
4. **Public Repo Clean-Room Guardrails:**
   - Never commit secrets, API tokens, private keys (`*.key`), `Secrets.enc`, or `.env` files.
   - Never commit hardcoded local user paths (`/home/<user>/...`), private server IPs, or internal domain names.
5. **Write Back & Push:** After completing any feature or milestone, update `memory/PROJECT_STATE.md`, `memory/MILESTONES.md`, and `memory/BLACKBOX.md` (prepend `[BB-XXX]`), then commit and push to `origin main`.
