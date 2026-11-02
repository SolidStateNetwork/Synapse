# Privacy Policy — Synapse Control Center & MCP Server

**Last Updated:** 2026-04-12  
**Repository:** `https://github.com/SolidStateNetwork/Synapse`  
**MCP Endpoint:** `/api/mcp` (`synapse-core-mcp`)

---

## 1. Self-Hosted & Zero-Telemetry Architecture

Synapse is a **100% self-hosted** Linux server and infrastructure control center (`synapse-core` + `axon` Muscle agents) with an embedded **Model Context Protocol (`MCP`) Server** (`/api/mcp`).

- **Zero Telemetry / No Phone-Home:** Neither `synapse-core` nor the `axon` agent transmits usage analytics, telemetry, server metrics, IP addresses, or audit logs to SolidStateNetwork or any external third party.
- **Full Operator Sovereignty:** All project state (`State.json`, `Architecture.md`, `Memory.md`), time-machine checkpoints, offsite backups, and audit logs remain strictly on the filesystem of the host machine where the operator deploys `synapse-core`.

---

## 2. MCP Server (`/api/mcp`) Data Handling

When connecting external MCP clients (such as Claude Desktop, Cursor, Windsurf, or OpenAI-compatible agents) to a self-hosted Synapse instance:

1. **Local Authentication & Scoping:** Requests to `/api/mcp` are authenticated locally against `SHA-256` hashed API keys (`syn_mcp_...`) stored in the operator's local project vault with granular `read`, `execute`, or `admin` scopes.
2. **Rate Limiting & Abuse Protection:** `/api/mcp` enforces local sliding-window rate limiting per client/token to prevent accidental infinite loops or brute-force token probing.
3. **Secret Redaction (`Secrets.enc`):** Secrets stored in the `AES-256-GCM` vault (`Secrets.enc`) are decrypted only in memory when injecting environment variables into authorized workloads and are automatically scrubbed (`[REDACTED_SECRET]`) from tool outputs, chat transcripts, and MCP responses.

---

## 3. Optional Third-Party AI Provider Connections

If the operator configures an external LLM provider inside the Synapse AI Orchestrator (e.g., OpenAI, Anthropic, or a custom OpenAI-compatible endpoint) or connects an external MCP client:

- Prompts and tool execution outputs are transmitted **only** to the LLM endpoint explicitly configured and authorized by the operator using the operator's own API credentials.
- Operators requiring air-gapped or local-only inference can point Synapse to a local model server (such as Ollama, vLLM, or LM Studio).

---

## 4. Data Retention & Deletion

Because all data resides on the operator's own infrastructure:
- Operators can inspect, export, or permanently purge any project vault, checkpoint, backup, or audit log at any time via the Synapse WebUI or by deleting the local `SYNAPSE_DATA_DIR` / `SYNAPSE_VAULT_DIR` directory.
- MCP API keys (`syn_mcp_...`) can be revoked immediately with 1 click in the WebUI or via the `/api/mcp` `revoke_key` action.

---

## 5. Contact & Security Disclosures

For privacy questions or security vulnerability reports, please follow the disclosure process documented in [`SECURITY.md`](./SECURITY.md).
