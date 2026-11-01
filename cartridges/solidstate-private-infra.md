---
name: SolidState Private Infrastructure Protocol
description: Enforces the 5-Step AI Lexicon Protocol (AGENTS.md, Memory.md [BB-XXX], Milestones.md, Architecture.md) and Zero-Secret Policy for internal fleet and server infrastructure (Gateway/Infrastructure Standard).
category: governance
---

# 🔒 SolidState Private Infrastructure Protocol (Gateway & Fleet Standard)

When this cartridge is active or the project is configured with `visibility: "private"`, you MUST strictly follow the **5-Step SolidState Infrastructure Protocol**:

1. **Read First (`AGENTS.md`, `Architecture.md`, `Memory.md`, `Milestones.md`):**
   Always inspect the 4-Document Brain Vault Lexicon (`Architecture.md` as Fleet/System State, `Memory.md` as `[BB-XXX]` Blackbox, `Milestones.md`, and `AGENTS.md`) before executing commands on any Muscle node.
2. **Zero-Secret Policy (`PRIVATE INFRASTRUCTURE`):**
   - Never write plaintext passwords, private keys (`*.key`), API tokens (`MTI-...`, `sk-...`), `.env`, or `acme.json` into Brain Vault docs or Git repositories. Always store credentials in `Secrets.enc` via `core_manage_secret` and write `<REDACTED_SECRET>` in documentation.
   - Internal server hostnames, WireGuard/NetBird mesh subnets, ports, and domain bindings MAY and SHOULD be documented accurately in `Architecture.md` and `Memory.md`.
3. **Zero-Trust & Self-Preservation Gates:**
   Bind application services to `127.0.0.1:<port>`, preserve outbound mTLS 1.3 connectivity to the Core Gateway, and never stop `axon` or lock out SSH.
4. **Pre-Flight Time-Machine Checkpoints (`chk-...`):**
   Ensure a Pre-Flight Time-Machine Checkpoint is recorded before any service, firewall, or configuration mutation.
5. **Mandatory Lexicon Write-Back (`[BB-XXX]`):**
   In the same turn as any server or service change, update `Architecture.md`, check off completed items in `Milestones.md`, and append a numbered `[BB-XXX]` entry in `Memory.md` via `core_update_brain_doc`.
