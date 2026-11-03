# 🔐 02 — mTLS 1.3 Tunnel, PKI & Axon Muscle Agent

This document specifies the security and communication architecture between the **Synapse Core Gateway** (`apps/core-gateway`) and **Axon Muscle Nodes** (`agents/axon`).

---

## 1. Zero-Trust Enrollment & ECDSA P-256 PKI (`internal/pki`)

Synapse does not use static shared passwords for server connectivity. Instead, it enforces a dedicated **Mutual TLS 1.3 (mTLS) Public Key Infrastructure**:

1. **Core Root CA Initialization:**
   - On first startup, `core-gateway` generates a self-signed **ECDSA P-256 Root CA certificate** (`ca.crt` & `ca.key`, mode `0600`) inside the data directory.
2. **One-Time CSR Join Token (`syn_join_...`):**
   - An operator or MCP client requests a short-lived one-time token (default: 15–30 minutes TTL) via `POST /api/v1/tokens` (or `core_manage_cluster_nodes`), bound to a specific autonomy tier (`TIER_1`–`TIER_3`).
3. **Local Key Generation & CSR Exchange:**
   - The Muscle server generates its private key pair (`client.key`) **exclusively locally** on the target host.
   - Via `POST /api/v1/enroll`, `axon` sends only a **Certificate Signing Request (CSR)** together with the one-time token to the Core Gateway.
   - The Gateway invalidates the token immediately upon first use, signs the client certificate (`client.crt`) with the Root CA, and encodes the authorized `Autonomy Tier` in the certificate metadata.
4. **Real-Time Certificate Revocation (`CRL.json`) & Auto-Rotation (`StreamTypeCertRenew`):**
   - Revoked certificate serial numbers are persisted in `CRL.json` (`RevokeCertSerial`, `IsCertRevoked`) and checked during every TLS 1.3 handshake (`VerifyPeerCertificate`), with instant eviction of active Yamux sessions (`EvictNode`).
   - Before certificate expiry (`< 30` days remaining), `axon` rotates its X.509 client certificate seamlessly over `StreamTypeCertRenew`.

---

## 2. Multiplexed Yamux Tunnel Over TLS 1.3 (`:8443`)

Once `axon` holds `ca.crt`, `client.crt`, and `client.key`, the agent establishes a persistent outbound TCP connection to the Core Gateway tunnel port (`:8443`):

- **Strict TLS 1.3 Configuration:** `MinVersion: tls.VersionTLS13`, `ClientAuth: tls.RequireAndVerifyClientCert`, pinned ECDHE curves (`tls.X25519`, `tls.CurveP256`).
- **Stream Multiplexing (`hashicorp/yamux`):** Over this single outbound TCP connection, the Core Gateway opens concurrent, isolated virtual streams to the Muscle node on demand:
  - **Heartbeat & Telemetry Stream:** Reports CPU, RAM, and disk utilization, OS architecture, network IPs, procfs/socket `AnomalyAlerts`, and live status of registered services every 5 seconds (stored in a 60-sample ring buffer in the Gateway hub).
  - **PTY Execution Streams (`/api/v1/rpc/pty`):** Executes shell commands inside persistent (`default-<project>`) or ephemeral one-shot PTY sessions with optional `ulimit` resource quotas.
  - **Filesystem RPC Streams (`/api/v1/rpc/fs`):** Atomic file operations (`read_file`, `write_file`, `list_dir`, `stat`, `delete`, `apply_unified_diff`) with automatic pre-write snapshots.
  - **Live-Preview Reverse-Proxy Streams (`/preview/<project>/<node>/<port>`):** Tunnels HTTP/WebSocket traffic from the browser cockpit directly to `127.0.0.1:<port>` on the Muscle server without opening public firewall ports.

---

## 3. Ephemeral PTY Garbage Collection (`pty_discovery.go`)

To ensure automated background probes, health checks, and one-shot deployments never leave orphaned shell processes (`bash`/`sh`) on the Muscle server, `IsEphemeralSessionID` in `agents/axon/internal/pty/pty_discovery.go` classifies temporary sessions by prefix:

- **Automatically Reaped One-Shot Prefixes:**
  - `probe-`, `link-probe-`, `service-logs-`, `deep-search-` (live health checks, log inspector & forensic search)
  - `cron-`, `heal-`, `self-heal-`, `chaos-`, `secops-` (cron runbooks, self-healing & intrusion radar)
  - `chk-`, `bkp-`, `bp-`, `gitops-`, `sqlite-` (checkpoints, backups, blueprints, GitOps & SQLite studio)
  - `hot-reload-`, `fw-`, `svc-cleanup-`, `sys-update-`, `mesh-`, `custom-svc-` (hot-reload, firewall sync, teardown, OTA update & service mesh)
- **Persistent Operator Sessions:**
  - Sessions such as `default-<project_id>` or interactive WebUI terminals persist across individual commands so working directories (`cd`) and environment variables are preserved.

---

## 4. Deterministic Self-Lockout Guard (`agents/axon/internal/guard`)

Even in `TIER_1_UNLEASHED` mode, `axon` deterministically validates every command before execution to prevent self-sabotage (`ERR_SELF_PROTECTION_VIOLATION`):

1. **Process & Service Self-Protection:** Blocks `kill`/`pkill` targeting the `axon` PID as well as `systemctl stop/disable/mask axon` (including flag-reordered invocations) and `sshd`.
2. **Firewall Anti-Lockout:** Blocks `ufw`/`iptables`/`nftables`/`ip link` commands that would sever the outbound mTLS tunnel to the Core Gateway or disable loopback traffic.
3. **Destructive Root Protection:** Blocks destructive filesystem commands targeting the root filesystem (`rm -rf /`, `mkfs` on mounted system partitions).
