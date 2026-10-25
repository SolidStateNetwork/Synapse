# Security Policy

## Security Architecture Overview

Synapse enforces a defense-in-depth security model that **never relies solely on LLM system prompts**:

1. **Mutual TLS 1.3 (mTLS) + One-Time CSR Enrollment**:
   - Every `axon` Muscle Node generates an ECDSA P-256 keypair locally and exchanges a short-lived (15-minute) single-use token for a client certificate signed by the Core Gateway Root CA.
   - All `hashicorp/yamux` streams require strict `tls.RequireAndVerifyClientCert`.
2. **Deterministic Self-Lockout Guardrails (`agents/axon/internal/guard`)**:
   - `axon` inspects every shell command prior to execution and blocks any command that would terminate its own PID, stop/mask `axon.service`, or drop firewall traffic (`ufw`, `iptables`, `nftables`) to the Core Gateway (`ERR_SELF_PROTECTION_VIOLATION`).
3. **Zero-Leak Secret Vault (`Secrets.enc`)**:
   - Project secrets are stored encrypted on disk using **AES-256-GCM** (PBKDF2-SHA256 derived master key).
   - The LLM only sees secret key names (`inject_secret_keys`). Secret values are injected directly into the remote PTY environment and scrubbed from `stdout`/`stderr` streams (`[REDACTED_SECRET:KEY]`) before returning to the Control Plane.
4. **Enforced Autonomy Tiers**:
   - `TIER_1_UNLEASHED`: Full system administration autonomy.
   - `TIER_2_WORKSPACE_JAIL`: Strict canonical path containment (`filepath.Clean` + `filepath.EvalSymlinks`) inside `/opt/axon/workspaces/<project_id>`.
   - `TIER_3_SUPERVISED`: Mandatory human-in-the-loop approval gate in the Core Policy Interceptor for all mutating filesystem and shell operations.

## Reporting a Vulnerability

If you discover a security vulnerability in Synapse, please report it privately via [GitHub Security Advisories](https://github.com/SolidStateNetwork/Synapse/security/advisories/new) rather than opening a public issue.
