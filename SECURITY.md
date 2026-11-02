# Security Policy

## Supported Versions

Currently supported versions of **Synapse** receiving security updates:

| Version | Supported |
| :--- | :--- |
| `2.4.x` (Current — Zero-Trust Security, Hash-Chained Audit & Standalone MCP) | ✅ Yes |
| `2.3.x` (Lexicon-Everywhere & 42-Tool MCP Safety Annotations) | ✅ Yes |
| `2.2.x` (Full-Stack DevOps Workbench, Pre-Flight Checkpoints & OTA) | ✅ Yes |
| `2.1.x` (Model Context Protocol Server & Multi-Distro Support) | ✅ Yes |
| `2.0.x` (Enterprise Modular Architecture) | ✅ Yes |
| `< 2.0.0` | ❌ No |

## Reporting a Vulnerability

Please **do not** report security vulnerabilities through public GitHub issues, discussions, or pull requests.

Instead, please report them privately via:
- **GitHub Security Advisories:** Use the ["Report a vulnerability"](https://github.com/SolidStateNetwork/Synapse/security/advisories/new) button in the **Security** tab of this repository.

Please include:
1. Type of issue (e.g., Autonomy Tier bypass, mTLS handshake issue, secret redaction bypass, SSRF, or command injection).
2. Full paths of the source file(s) related to the manifestation of the issue (`apps/core-gateway`, `apps/core-web`, `agents/axon`, or `packages/mcp-server`).
3. Step-by-step instructions to reproduce the issue.

We will acknowledge receipt of your vulnerability report within **48 hours** and strive to release a verified patch within **7 days**.

## Built-In Security Architecture

Synapse (`v2.4.0`) enforces a defense-in-depth security model that **never relies solely on LLM system prompts**:

1. **Zero-Inbound Muscle Architecture:** Muscle nodes (`axon`) initiate outbound **TLS 1.3 mTLS** connections with pinned ECDHE curves (`X25519` / `P-256`) and automatic X.509 certificate rotation (`StreamTypeCertRenew`) to the Core Gateway (`:8443`) using ECDSA P-256 certificates and single-use, TTL-bound Join Tokens.
2. **Hard Autonomy Tiers (`TIER_1_UNLEASHED`, `TIER_2_WORKSPACE_JAIL`, `TIER_3_SUPERVISED`):** Enforced both in the Core Orchestrator Interceptor and inside the Axon Go binary (`internal/fs/fs.go` with longest-existing-ancestor `filepath.EvalSymlinks` + broken-symlink target validation).
3. **Self-Lockout & Optional Command Allowlist Guardrail:** `agents/axon/internal/guard/guard.go` blocks commands that would stop `axon.service`, kill the agent's own PID, sever outbound Core/SSH connectivity, or violate a node's deterministic `allowed_commands` allowlist.
4. **Encrypted Secrets (`PBKDF2-SHA256` + `AES-256-GCM`) & Automatic Redaction:** Secrets are stored encrypted at rest in `Secrets.enc` using `PBKDF2-SHA256` (`100,000` iterations + random 16-byte salt) and automatically scrubbed from all PTY outputs (`[REDACTED_SECRET:KEY]`) before reaching LLM context windows or UI logs.
5. **3-Tier Scoped MCP API Keys, HMAC Request Signing & Hash-Chained Audit Log:** External MCP clients authenticate via `SHA-256` hashed `syn_mcp_...` tokens with strict `read` / `execute` / `admin` scope separation, per-key sliding-window rate limits, optional `HMAC-SHA256` request signing (`X-Synapse-Signature` / `X-Synapse-Timestamp` 300s replay guard), and a tamper-evident SHA-256 hash chain in `Audit.jsonl`.
