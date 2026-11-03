# 🛡️ 04 — Resilience, Zero-Knowledge Security & Container-Native OTA

This document defines the security, backup, self-healing, and over-the-air (OTA) update mechanisms of **Synapse**.

---

## 1. Zero-Leak Secret Vault (`Secrets.enc`) & Hash-Chained Audit Log (`Audit.jsonl`)

Project secrets (database passwords, API tokens, webhook secrets) are never stored in `State.json` or in plaintext:
- **Encryption:** `AES-256-GCM` with a random 12-byte IV, 16-byte authentication tag, and a master key (`SYNAPSE_MASTER_KEY`) derived via `PBKDF2-SHA256` (`100,000` iterations + random 16-byte salt per write, with seamless fallback for legacy SHA-256 ciphertexts).
- **Safe Injection & Output Scrubbing:**
  - The LLM only sees **secret key names** in its system prompt (`secret_keys_available: ["DB_PASSWORD", ...]`).
  - When executing `node_pty_exec`, `core_deploy_git_stack`, or blueprint deployments, decrypted values are injected directly into the protected runtime environment.
  - Before `stdout`/`stderr` or `Audit.jsonl` entries are persisted or returned to the LLM, the **Secret Scrubber** replaces every occurrence of any plaintext secret value with `[REDACTED_SECRET:<KEY>]`.
- **Tamper-Evident Audit Hash Chain:** Every entry appended to `Audit.jsonl` is cryptographically linked via `SHA-256` (`prev_hash` + `entry_hash` starting from `GENESIS`) and verifiable via `verifyAuditChain(projectId)`.

---

## 2. Automatic Pre-Flight Time-Machine Checkpoints (`checkpoints.ts`)

Before every state-changing infrastructure action, Synapse automatically records a **Pre-Flight Time-Machine Checkpoint** (`Checkpoints.json`) and returns its `checkpoint_id` (`chk-...`) in the API response and UI status badge:

| Trigger / Subsystem | Recorded Checkpoint | Rollback Mechanism |
| :--- | :--- | :--- |
| **1-Click Stack Blueprints (`/api/blueprints`)** | Before `deploy` & `undeploy` | Restores service snapshot and blueprint directory. |
| **GitOps Stack Studio (`gitopsDeployer.ts`)** | Before `deploy`, `webhook_redeploy` & `delete` | Executes `git reset --hard HEAD~1` in the stack repository and restores `State.json`. |
| **Custom Service Builder (`serviceMeshAndBuilder.ts`)** | Before `deployCustomServiceOnMuscle` | Backs up the existing service topology and target script directory. |
| **Live-Code Hot-Reload (`v070-studio.ts`)** | Before `hotReloadServiceCodeOnMuscle` | Validates Python syntax (`py_compile`) ahead of time and automatically rolls back to the pre-write snapshot on HTTP 500. |
| **Synapse Shield Firewall (`/api/firewall`)** | Before `toggle_port_shield`, `apply_profile`, `add_ip_rule`, `remove_ip_rule` | Saves the prior `Firewall.json` as a Base64 snapshot for 1-click restoration. |
| **OTA System Update (`/api/system-update`)** | Before `update_core`, `update_muscle`, `update_all` | Records the exact Git commit hash for deterministic `git checkout <commit>` rollback. |

---

## 3. Autonomous Self-Healing & Chaos Resilience (`self-healing/`)

Synapse continuously monitors all registered services and heals outages autonomously:
- **Reactive Self-Healing (`executeServiceSelfHeal`):** If a service exceeds its configured failure threshold (`failure_threshold`) or latency ceiling (`max_latency_ms`), Synapse automatically restarts the underlying container, systemd unit, or workspace process, verifies `HTTP 200 OK`, and records the **MTTR (Mean Time To Recovery)** in milliseconds.
- **Chaos Engineering Simulation (`simulate_crash`):** Operators and AI agents can trigger a controlled 1-click process crash simulation and measure live recovery time.

---

## 4. Container-Native & Bare-Metal OTA Updates (`/api/system-update`)

The integrated Over-The-Air update engine supports both bare-metal installations (`systemd` / `OpenRC`) and the local **2-Container Lab (`containers/`)**:
- **Version & Tree-Hash Verification:** Compares `SYNAPSE_VERSION`, the local Git commit (`HEAD`), the remote branch (`origin/main`), the `agents/axon` Git tree hash (`HEAD:agents/axon`), and the `SHA-256` digests of `core-gateway` and `axon`.
- **Dual-Mode Rollout:** Automatically detects whether `core-gateway`, `core-web`, and `axon` run as systemd units or inside rootless/Docker containers, compiles updated binaries/bundles, and performs a zero-downtime restart.
