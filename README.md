# Synapse — The "Brain & Muscle" AI DevOps & Development Platform

**Synapse** is an open-source, self-hosted AI DevOps & autonomous engineering platform built around the **Brain & Muscle paradigm**: a strictly **Stateless Control Plane (`synapse-core`)** paired with **Stateful Remote Execution Nodes (`axon`)** connected over a single outbound **mTLS + `hashicorp/yamux` multiplexed reverse tunnel**.

---

## 1. Architectural Law & Topology

> **ARCHITECTURAL LAW:** The Synapse Core Control Plane **NEVER** compiles or executes user application code. It holds zero developer runtimes. All shell execution, filesystem mutations, and service hosting occur exclusively on enrolled **Axon Muscle Nodes**. Without at least one assigned Connector Node, a project is deterministically locked in **Planning-Only Mode**.

```mermaid
flowchart LR
    subgraph Core["The Brain (synapse-core — docker-compose)"]
        CW["core-web (Next.js 15 App Router)\n• AI Orchestrator (OpenAI/Anthropic/Ollama)\n• Tier-3 Policy Interceptor\n• Project Brain Vault Manager"]
        CG["core-gateway (Go)\n• mTLS X.509 Termination & CSR CA\n• hashicorp/yamux Multiplexer\n• TCP/HTTP Live-Preview Reverse Proxy"]
        Vault[("Project Brain Vault\n/var/lib/synapse/projects/<project_id>/\n├── Architecture.md\n├── State.json\n├── Memory.md\n├── Secrets.enc (AES-256-GCM)\n└── Audit.jsonl")]
        CW <-->|"HTTP RPC + SSE"| CG
        CW <--> Vault
        CG --> Vault
    end

    subgraph Muscle["The Muscle (axon — Static CGO_ENABLED=0 Go Binary)"]
        AX["axon Agent\n• Self-Lockout Guardrail\n• Secret Redactor\n• 16KB Head/Tail Truncation"]
        S1["Stream 1: Atomic FS Ops\nread/write/unified_diff/list/stat/delete"]
        S2["Stream 2: Persistent PTY (creack/pty)\nSentinel Framing + /proc/<pid>/cwd + xterm.js"]
        S3["Stream 3: Live TCP/HTTP Port-Forward\n127.0.0.1:<port> -> /preview/<proj>/<node>/<port>"]
        S4["Stream 4: 5s Telemetry (gopsutil)\nCPU, RAM, Disk & Service Health Probes"]
        AX --> S1
        AX --> S2
        AX --> S3
        AX --> S4
    end

    AX ===|"Single Outbound mTLS 1.3 + hashicorp/yamux Tunnel"| CG
```

---

## 2. Core Subsystems

### 2.1 The Brain (`synapse-core`)
1. **`apps/core-gateway` (Go):**
   - Initializes a self-contained X.509 Root CA and issues one-time CSR join tokens (`/api/v1/tokens`).
   - Signs ECDSA P-256 Certificate Signing Requests submitted via `axon join <token>` (`/api/v1/bootstrap/csr`).
   - Terminates strict mutual TLS (`tls.RequireAndVerifyClientCert`) on port `8443` and multiplexes 4 stream types via `hashicorp/yamux`.
   - Exposes the authenticated **Live-Preview Reverse Proxy** at `/preview/<project_id>/<node_id>/<port>`, tunneling traffic directly to `127.0.0.1:<port>` on the remote node.
2. **`apps/core-web` (Next.js 15 App Router + TypeScript):**
   - Manages the on-disk **Project Brain Vault** (`/var/lib/synapse/projects/<project_id>/`):
     - `Architecture.md`: Living Mermaid system topology and remote file layout.
     - `State.json`: Assigned nodes, 5-second hardware telemetry, active PTY sessions, and registered services.
     - `Memory.md`: Chronological engineering journal and lessons learned.
     - `Secrets.enc`: AES-256-GCM encrypted key-value store.
     - `Audit.jsonl`: Immutable append-only log of all AI tool calls, policy intercepts, and user approvals.
   - Implements the **AI Orchestrator & Policy Interceptor** supporting OpenAI, Anthropic, Ollama, and the built-in deterministic Synapse execution engine.

### 2.2 The Muscle (`agents/axon`)
- Single static binary (`CGO_ENABLED=0`) for external Linux servers:
  - `axon join --core http://<core-host>:8081 --tier TIER_2_WORKSPACE_JAIL --run <token>`
  - `axon run`
  - `axon status`
- **Persistent PTY Sentinel Framing (`internal/pty`):**
  Every `node_pty_exec` command is wrapped inside a persistent `creack/pty` bash session with a deterministic boundary sentinel:
  ```bash
  command; echo -e "\n__SYNAPSE_EOF_<cmd_id>:$?__"
  ```
  `axon` reads until `__SYNAPSE_EOF_<cmd_id>:<exit_code>__` appears or `wait_timeout_ms` expires, resolves `/proc/<shell_pid>/cwd`, strips the sentinel, scrubs secrets, and returns clean output + exit code + CWD.

---

## 3. Deterministic Security, Autonomy Tiers & Guardrails

### Hardcoded Node Guardrails (`agents/axon/internal/guard`)
1. **Self-Lockout Prevention:** Detects `axon`'s own PID, `axon.service`, and the outbound Core Gateway IP/port. Blocks any command (`kill`, `pkill`, `systemctl stop/disable/mask axon`, `ufw`/`iptables`/`nft` drop rules) that would terminate the agent or sever the mTLS tunnel.
2. **Context-Window Protection (Head/Tail Truncation):** Strips ANSI escape sequences and enforces a **16 KB output cap** per command (first **4 KB head** + last **12 KB tail**), persisting the full un-truncated output to `/tmp/axon-logs/<cmd_id>.log`.
3. **Secret Redaction:** Secrets from `Secrets.enc` injected into PTY sessions are deterministically scrubbed as `[REDACTED_SECRET:KEY]` before leaving the node.

### Node Autonomy Tiers
- `TIER_1_UNLEASHED`: Full root/sudo autonomy for full-stack server provisioning.
- `TIER_2_WORKSPACE_JAIL`: Path-jailed strictly to `/opt/axon/workspaces/<project_id>`. Host administration commands and path traversals are blocked.
- `TIER_3_SUPERVISED`: Read operations execute immediately; write/exec tools (`node_pty_exec`, `write_file`, `apply_unified_diff`, `delete`) pause in the Core Policy Interceptor until approved by the operator in the WebUI.

### Pluggable Rule Cartridges (`/cartridges/*.md`)
- `docker-first.md`: Enforces containerized workloads with healthchecks and loopback bindings.
- `native-systemd.md`: Enforces hardened `systemd` unit files with `ProtectSystem=strict`.
- `zero-trust-networking.md`: Enforces `127.0.0.1` bindings and firewall safety rules.
- `auto-ssl-caddy.md`: Configures Caddy automated TLS ingress with security headers.

---

## 4. Quickstart

### Run with Docker Compose
```bash
docker compose up --build -d
# WebUI:        http://localhost:3000
# Core Gateway: http://localhost:8081 (HTTP Control & Live-Preview) / :8443 (mTLS Yamux)
```

### Build & Test from Source
```bash
# 1. Test and build Go modules (proto, axon, core-gateway)
CGO_ENABLED=0 go test -v ./proto/... ./agents/axon/... ./apps/core-gateway/...
CGO_ENABLED=0 go build ./proto/... ./agents/axon/... ./apps/core-gateway/...

# 2. Build Next.js 15 Core WebUI
npm --prefix apps/core-web ci
npm --prefix apps/core-web run build
```
