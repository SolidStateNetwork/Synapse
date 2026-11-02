# Privacy Policy — Synapse Core Web & MCP Server (`/api/mcp`)

See the root [`PRIVACY.md`](../../PRIVACY.md) for the complete Synapse self-hosted zero-telemetry privacy policy and MCP data handling specification.

- **Self-Hosted Only:** All vault data (`Secrets.enc` encrypted via `AES-256-GCM`), audit logs, and MCP API keys (`syn_mcp_...` hashed via `SHA-256`) remain strictly on your self-hosted instance.
- **Zero Telemetry:** No analytics, prompts, or server metadata are transmitted to SolidStateNetwork.
- **Automatic Secret Scrubbing:** Stored secret values are automatically redacted (`[REDACTED_SECRET]`) from MCP tool outputs and logs.
