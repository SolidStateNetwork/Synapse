---
name: SolidState Public Clean-Room Protocol
description: Enforces the 5-Step AI Lexicon Protocol (AGENTS.md, Memory.md [BB-XXX], Milestones.md, Architecture.md), Zero-Secret Policy, and Public Clean-Room Guardrails (Strata/Synapse Standard).
category: governance
---

# 🌐 SolidState Public Clean-Room Protocol (Strata & Synapse Standard)

When this cartridge is active or the project is configured with `visibility: "public"`, you MUST strictly follow the **5-Step SolidState AI Engineering Protocol**:

1. **Read First (`AGENTS.md`, `Architecture.md`, `Memory.md`, `Milestones.md`):**
   Never modify infrastructure, code, or configuration without first verifying the current state in the 4-Document Brain Vault Lexicon.
2. **Zero-Secret & Clean-Room Guardrails (`PUBLIC REPOSITORY`):**
   - **Zero-Secret Policy:** Never write API keys, tokens, passwords, private keys (`*.key`), or `.env` values in plaintext. Store all credentials in `Secrets.enc` via `core_manage_secret` and use `<REDACTED_SECRET>` in documentation.
   - **Zero-Personal & Zero-Infra Data:** Never expose local user paths, real server public IPs, or private internal domains in code, comments, or Brain Vault documentation. Use RFC-5737 documentation IPs (`203.0.113.x`) or `<REDACTED_PUBLIC_IP>`.
3. **Code & Modularization Gates:**
   - Keep every Go file `< 500` lines and every TypeScript/React file `< 600` lines with `0` `any` types.
   - Write public code, comments, and external docs in **English**; keep internal lexicon notes and German user chat in **German**.
4. **Pre-Flight Time-Machine Checkpoints (`chk-...`):**
   Verify that a Pre-Flight Checkpoint exists before any service deployment, firewall change, or topology update.
5. **Mandatory Lexicon Write-Back (`[BB-XXX]`):**
   Immediately after completing a task, update `Architecture.md`, check off completed milestones in `Milestones.md`, and append a numbered `[BB-XXX]` log entry to `Memory.md` via `core_update_brain_doc`.
