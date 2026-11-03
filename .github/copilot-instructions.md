# 🤖 GitHub Copilot Instructions — AI Enforcement Directive for Synapse

> **MANDATORY DIRECTIVE FOR GITHUB COPILOT & IDE AI AGENTS:**
> Read [`AGENTS.md`](../AGENTS.md) **BEFORE** taking any action in this repository (`SolidStateNetwork/Synapse`). Follow every rule at all times without exception.

---

## Core Non-Negotiable Rules

1. **Read First:** Always read [`AGENTS.md`](../AGENTS.md), [`memory/PROJECT_STATE.md`](../memory/PROJECT_STATE.md), [`memory/BLACKBOX.md`](../memory/BLACKBOX.md), and [`memory/MILESTONES.md`](../memory/MILESTONES.md) before modifying any file.
2. **Strict Single-Repository Isolation (`CWD` Only):** Operate exclusively inside the current working directory (`CWD`). Never read, modify, or run commands in sibling directories (`../`).
3. **Language Standard:** Communicate with the user in **German** in chat. Write **100% of repository files, code, comments, documentation, and commit messages in English**.
4. **Quality & Clean-Room Gates:** Keep Go files `< 500` lines (`>= 90%` coverage across 11 packages), TypeScript/React files `< 600` lines (`0` `any` types), and never commit secrets, local user paths, or real server IPs.

---

## Mandatory Post-Change Checklist (Execute in the Same Turn)

**No batching. No postponing. No skipping steps.** After **every** change, complete all steps below in the **same turn**:

- [ ] **1. Read & Comply:** Confirm all changes adhere to [`AGENTS.md`](../AGENTS.md) and [`architecture/`](../architecture/).
- [ ] **2. Update Memory Lexicon:** Update [`memory/PROJECT_STATE.md`](../memory/PROJECT_STATE.md) / [`memory/MILESTONES.md`](../memory/MILESTONES.md) (if applicable) and prepend a new `[BB-XXX]` entry in [`memory/BLACKBOX.md`](../memory/BLACKBOX.md).
- [ ] **3. Run Automated Verification:** Run `python3 playbooks/scripts/verify-lexicon-completeness.py` (plus relevant Go/TS tests) and ensure `EXIT 0`.
- [ ] **4. Commit & Push Immediately:** Run `git add -A && git commit -m "..." && git push origin main` in the **same turn** and verify a clean working tree (`git status --porcelain`).
