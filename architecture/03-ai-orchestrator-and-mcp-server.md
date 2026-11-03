# 🤖 03 — AI Orchestrator & Model Context Protocol (`MCP`) Server

This document describes the architecture of the **Synapse AI Orchestrator**, the prompt-caching engine, the deterministic offline fallback engine, and the built-in + standalone **MCP Server (`/api/mcp` & `packages/mcp-server/`)**.

---

## 1. 100% Full-Stack Tool Parity (42 Tools Total: 38 Core/Node Tools + 4 MCP Meta-Tools)

Synapse guarantees that both the internal **AI Copilot** and external AI clients (Claude Desktop, Cursor, Windsurf, Cline) have access to the exact same structured tools as a human operator in the WebUI.

### Tool Module Matrix (`apps/core-web/src/lib/orchestrator/`)

| Module | Provided Tools | Purpose |
| :--- | :--- | :--- |
| **`toolSchemas.ts` & `nodeTools.ts`** | `node_pty_exec`, `node_fs_operation`, `node_deep_search`, `node_firewall_control`, `core_vault_search` | Base interaction with Muscle nodes (PTY shell, filesystem with pre-write snapshots, 6-mode forensic search, host firewall, and vault search). |
| **`coreTools.ts`** | `core_update_brain_doc`, `core_register_service`, `core_manage_secret`, `core_link_peers`, `core_deploy_git_stack`, `core_delete_git_stack`, `core_tail_service_logs`, `core_get_node_telemetry_history`, `core_run_due_cron_jobs` | Management of `Architecture.md`, `Memory.md`, `Milestones.md` & `AGENTS.md`, service registration, `Secrets.enc`, peer mesh relays, GitOps stacks, live logs, and telemetry. |
| **`disasterRecoveryTools.ts`** | `core_manage_backup`, `core_manage_checkpoint` | Creating, listing, restoring, and deleting `AES-256-GCM` offsite backups and Time-Machine checkpoints. |
| **`secopsAndWatchdogTools.ts`** | `core_manage_alerts`, `core_intrusion_scan` | 24/7 watchdog thresholds, webhook test alerts, SSH intrusion radar, and 1-click attacker IP blocking. |
| **`studioDevOpsTools.ts`** | `core_hot_reload_service_code`, `core_sqlite_studio`, `core_manage_cron_jobs` | Syntax-checked live-code hot-reload, SQLite table/SQL studio, and cron runbook management. |
| **`resilienceAndMeshTools.ts`** | `core_manage_self_healing`, `core_probe_service_mesh` | Self-healing policy, MTTR chaos simulation, service-mesh latency probes, and custom microservice builder. |
| **`blueprintDomainAndOtaTools.ts`** | `core_manage_blueprint`, `core_manage_domain_tls`, `core_system_ota_status` | 1-click stack blueprints, custom domain/TLS bindings, and OTA system update status. |
| **`firewallCartridgeAndClusterTools.ts`** | `core_manage_firewall`, `core_manage_cartridges`, `core_manage_cluster_nodes` | Synapse Shield firewall profiles and port shields, AI Rule Cartridges, and cluster node enrollment. |
| **`projectAndDiagnosticTools.ts`** | `core_manage_projects`, `core_run_platform_self_test` | Project workspaces, `planning_only` guardrail, `Audit.jsonl` queries, and 6-stage platform self-test. |
| **`playbookAndApprovalTools.ts`** | `core_manage_playbooks`, `core_manage_approvals` | Multi-stage DAG AI playbooks, custom Rule Cartridges, and approval/rejection of `TIER_3_SUPERVISED` actions. |
| **`workbenchAndAuthTools.ts`** | `core_invoke_service_action`, `core_manage_auth_and_ai` | Service Workbench (`GET`/`POST`/`PUT`/`DELETE`/`SQL`), RBAC/2FA status, session revocation, and AI provider configuration. |
| **`topologyAndCanaryTools.ts` & `extendedToolSchemas.ts`** | `core_manage_topology_bundle`, `core_cluster_canary_exec`, `core_manage_mcp_keys` | Cryptographically signed project topology bundles (`export`, `import`, `simulate_apply`), multi-node canary rollouts, and scoped MCP key lifecycle management. |
| **`/api/mcp/route.ts` (MCP Meta-Tools)** | `synapse_list_peers`, `synapse_get_project_state`, `synapse_create_join_token`, `synapse_rollback_snapshot` | Direct queries for connected Muscle peers, complete 4-doc Project Brain Vault state, one-time mTLS CSR join tokens, and pre-write file rollbacks. |

---

## 2. Prompt-Cache-Optimized System Prompt (`promptBuilder.ts`)

To minimize latency and token cost across multi-step agent runs, `buildCacheOptimizedSystemPromptParts` splits every prompt into two segments:
1. **`staticPrefix` (Cacheable):** Contains the core architectural laws, active **AI Rule Cartridges** (`cartridges/*.md`), and the 4-document Brain Vault (`AGENTS.md`, `Architecture.md`, `Memory.md`, `Milestones.md`). This prefix remains stable across turns and is cached via `cache_control: { type: "ephemeral" }` (Anthropic) or automatic prefix caching (OpenAI).
2. **`dynamicSuffix` (Live State):** Contains live node telemetry, registered services, available secret key names (never plaintext values!), and autonomy tier rules.

---

## 3. Model Context Protocol (`MCP`) Server (`/api/mcp` & `packages/mcp-server/`)

At `/api/mcp` (and via the standalone `packages/mcp-server/index.mjs` Stdio/HTTP bridge), Synapse implements a standards-compliant **MCP Streamable HTTP (`JSON-RPC 2.0`) + REST Tool Server** (`protocolVersion: "2024-11-05"`):

- **Supported JSON-RPC Methods:** `initialize`, `notifications/initialized`, `ping`, `tools/list`, `tools/call`, `resources/list`, `resources/read` (`Architecture.md`, `Memory.md`, `Milestones.md`, `AGENTS.md`, `State.json`, `Audit.jsonl`), and `prompts/list`.
- **Hashed API Keys, 3-Tier Scopes & HMAC Signing (`syn_mcp_...`):**
  - Every MCP API key is displayed in plaintext only once upon creation and persisted in `State.json` exclusively as a **SHA-256 hash**.
  - **3-Tier Scope Enforcement (`read` / `execute` / `admin`):** `read`-only keys may execute inspection, diagnostic, self-test, and `GET` calls; mutating tools require `execute` or `admin`; security-critical administrative tools (`isAdminOnlyMcpToolCall`) strictly require `admin`.
  - **Per-Key Rate Limiting & HMAC-SHA256 Request Signing:** Enforces configurable sliding-window rate limits (`rate_limit_per_min`, default `120 req/min`) and optional `X-Synapse-Signature` + `X-Synapse-Timestamp` (`300s` replay window) verification.
