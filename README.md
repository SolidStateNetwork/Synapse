<div align="center">

<img src="./docs/assets/synapse-hero-banner.svg" alt="Synapse Control Center — Brain & Muscle AI DevOps Platform" width="100%" />

<br />

[![CI Pipeline](https://github.com/SolidStateNetwork/Synapse/actions/workflows/ci.yml/badge.svg)](https://github.com/SolidStateNetwork/Synapse/actions/workflows/ci.yml)
[![Latest Release](https://img.shields.io/github/v/release/SolidStateNetwork/Synapse?label=Release&color=f68330&labelColor=181a1d)](https://github.com/SolidStateNetwork/Synapse/releases)
[![GHCR Core Images](https://img.shields.io/badge/GHCR-synapse--core-f68330?logo=docker&logoColor=white&labelColor=181a1d)](https://github.com/orgs/SolidStateNetwork/packages)
[![Go 1.23+](https://img.shields.io/badge/Go-1.23%2B-38bdf8?logo=go&logoColor=white&labelColor=181a1d)](https://go.dev/)
[![Next.js 15](https://img.shields.io/badge/Control_Center-Next.js_15-31c48d?logo=next.js&logoColor=white&labelColor=181a1d)](https://nextjs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-9ca3af?labelColor=181a1d)](./LICENSE)

**Interactive Overlay Control Center** · **Stateless Cognitive Brain (`synapse-core`)** · **Stateful Single-Binary Nodes (`axon`)** · **Outbound mTLS 1.3 + Yamux**

[Quickstart (1-Command Deploy)](#-quickstart--1-command-deployment) · [Control Center UI](#-interactive-control-center-ui) · [Architecture](#-system-architecture--4-stream-yamux-multiplexing) · [Security & Autonomy Tiers](#-deterministic-security--autonomy-tiers) · [Releases](https://github.com/SolidStateNetwork/Synapse/releases)

</div>

---

## ⚡ Interactive Control Center UI

**Synapse** features a real-time, 60 FPS interactive **Control Center** inspired by modern zero-trust overlay networks. Every enrolled **Muscle Peer (`axon`)**, **Autonomy Policy**, **DevOps Rule Cartridge**, **Project Brain Vault**, and **Loopback Reverse-Proxy Tunnel** is mapped onto an interactive canvas with live animated Bezier streams:

<div align="center">
  <img src="./docs/assets/control-center-ui-preview.svg" alt="Synapse Interactive Control Center UI Preview" width="100%" />
</div>

### Key Control Center Capabilities
- **60 FPS Free-Form Node Graph:** Drag and arrange **Muscle Peers**, **Policy & Cartridge Pills**, and **Brain Resource Frames** freely across the infinite dot-grid canvas with mouse-wheel zoom, pan, auto-layout, and focus-mode dimming.
- **Drag-to-Connect Policy Cables:** Draw connections directly from a Muscle Peer handle to any **Rule Cartridge Pill** (`Docker-First`, `Zero-Trust Networking`, `Native Systemd`, `Auto-SSL Caddy`) to toggle runtime prompt injections on the fly.
- **4 Dynamic Topology Views (`FlowSelector`):** Switch instantaneously between **Peer Connections**, **AI Agent Flow**, **Autonomy Groups**, and **Yamux Tunnels**.
- **Docked Multi-Turn ReAct AI Orchestrator + Live `xterm.js` PTY:** Watch the AI execute autonomous DevOps workflows in real time, inspect tool calls, approve Tier-3 diffs inline, or pop open the bottom **Live PTY Shell** mirrored directly from the remote node.

---

## 🚀 Quickstart & 1-Command Deployment

### Step 1 — Deploy the Core ("The Brain" — `synapse-core`) via Docker
Deploy the entire Stateless Control Plane (`core-web` Control Center + `core-gateway` mTLS/Yamux Hub + AES-256-GCM Brain Vault) on any Linux host with Docker using a single command:

```bash
curl -fsSL https://raw.githubusercontent.com/SolidStateNetwork/Synapse/main/scripts/deploy-core.sh | bash
```

> **What `deploy-core.sh` does automatically:**
> 1. Pulls the prebuilt multi-service images (`ghcr.io/solidstatenetwork/synapse-core-gateway:latest` & `ghcr.io/solidstatenetwork/synapse-core-web:latest`).
> 2. Generates a cryptographically random 256-bit `SYNAPSE_MASTER_KEY` for `Secrets.enc` (`AES-256-GCM`).
> 3. Starts the Control Center on `:3000`, the Gateway API on `:8081`, and the mTLS 1.3 + Yamux listener on `:8443`.
> 4. Prints a ready-to-run **15-minute One-Time Join Command** for your first Muscle Peer.

### Step 2 — Enroll Any Linux Server ("The Muscle" — `axon`) with One Command
Click **`+ Add Peer`** in the Control Center (`http://<CORE_IP>:3000`) to generate a 15-minute setup token, then run the one-liner on any target Linux server (`x86_64` or `arm64`):

```bash
curl -fsSL http://<CORE_IP>:8081/install.sh | sudo sh -s -- <ONE_TIME_JOIN_TOKEN> TIER_2_WORKSPACE_JAIL
```

> **Zero-Firewall mTLS Bootstrap:**
> 1. Detects the host architecture (`amd64` / `arm64`) and downloads the static `CGO_ENABLED=0` `axon` binary directly from your Core Gateway (or GitHub Releases fallback).
> 2. Generates a local **ECDSA P-256** private key, submits a Certificate Signing Request (CSR) authenticated by `<ONE_TIME_JOIN_TOKEN>`, and receives a Core-signed X.509 client certificate (`/etc/axon/node.crt`).
> 3. Installs and starts `axon.service` via `systemd`, establishes the outbound **mTLS 1.3 + `hashicorp/yamux` reverse tunnel** to `<CORE_IP>:8443`, and **automatically binds the peer to your active project** in the Control Center.

### Prebuilt Static Release Binaries (`CGO_ENABLED=0`)
All agent and gateway binaries are built and published automatically on [GitHub Releases](https://github.com/SolidStateNetwork/Synapse/releases):

| Binary | Architecture | Target OS | Direct Download |
| :--- | :--- | :--- | :--- |
| **`axon-linux-amd64`** | `x86_64` | Linux | [Download Latest](https://github.com/SolidStateNetwork/Synapse/releases/latest/download/axon-linux-amd64) |
| **`axon-linux-arm64`** | `aarch64` | Linux | [Download Latest](https://github.com/SolidStateNetwork/Synapse/releases/latest/download/axon-linux-arm64) |
| **`axon-darwin-amd64`** | `x86_64` | macOS | [Download Latest](https://github.com/SolidStateNetwork/Synapse/releases/latest/download/axon-darwin-amd64) |
| **`axon-darwin-arm64`** | `Apple Silicon` | macOS | [Download Latest](https://github.com/SolidStateNetwork/Synapse/releases/latest/download/axon-darwin-arm64) |
| **`core-gateway-linux-amd64`** | `x86_64` | Linux | [Download Latest](https://github.com/SolidStateNetwork/Synapse/releases/latest/download/core-gateway-linux-amd64) |

---

## 🧠 System Architecture & 4-Stream Yamux Multiplexing

> **ARCHITECTURAL LAW:** The Synapse Core Control Plane (**The Brain**) **NEVER** compiles or executes user application code. It holds zero developer runtimes. All shell execution, filesystem mutations, and service hosting occur exclusively on enrolled **Axon Muscle Peers** over a single outbound **mTLS 1.3 + `hashicorp/yamux` multiplexed reverse tunnel**. Without at least one enrolled Muscle Peer, a project is deterministically locked in **Planning-Only Mode**.

<div align="center">
  <img src="./docs/assets/brain-muscle-architecture.svg" alt="Synapse Brain & Muscle Architecture Diagram" width="100%" />
</div>

### The 4 Multiplexed Virtual Streams (`hashicorp/yamux` over mTLS 1.3)
Over a single outbound TCP connection on port `8443` (requiring **zero inbound firewall ports** on your remote servers), `core-gateway` and `axon` multiplex four dedicated stream channels:

1. **Stream 1 — Atomic Filesystem & Unified Diff Engine (`internal/fs`):**
   Executes `read_file`, atomic temp-file + rename `write_file`, `apply_unified_diff`, `list_dir`, `stat`, `delete`, and octal `file_mode` (`0644` / `0755`) mutations directly on the remote disk.
2. **Stream 2 — Persistent Sentinel-Framed PTY (`internal/pty` + `creack/pty`):**
   Runs commands inside a persistent `/dev/ptmx` bash session using deterministic boundary sentinels (`__SYNAPSE_EOF_<cmd_id>:<exit_code>__`), preserving environment variables, background processes, and `/proc/<shell_pid>/cwd` across AI turns while streaming live output to `xterm.js`.
3. **Stream 3 — Zero-Firewall Loopback Reverse Proxy (`127.0.0.1:<port>`):**
   Tunnels HTTP/TCP services bound strictly to `127.0.0.1:<port>` on the Muscle Peer directly into the Control Center Live Preview (`/preview/<project_id>/<node_id>/<port>`).
4. **Stream 4 — 5-Second Telemetry & Service Health Probes (`gopsutil`):**
   Pushes real-time CPU, RAM, Disk utilization, active PTY sessions, and HTTP/TCP healthcheck statuses into `State.json`, triggering automated AI self-healing when a service degrades.

---

## 🛡️ Deterministic Security & Autonomy Tiers

Synapse **never** relies on LLM system prompts alone for safety. Every tool call passes through a two-stage deterministic policy engine (**Core Interceptor** + **Hardcoded Go Enforcement inside `axon`**):

<div align="center">
  <img src="./docs/assets/security-autonomy-tiers.svg" alt="Synapse Security & Autonomy Tiers" width="100%" />
</div>

### Hardcoded Node Guardrails (`agents/axon/internal/guard`)
- **Self-Lockout Prevention (`ERR_SELF_PROTECTION_VIOLATION`):** At startup, `axon` discovers its own PID, `axon.service` systemd unit, and the Core Gateway IP/port. Any command or firewall rule (`kill`, `pkill`, `systemctl stop/disable/mask axon`, `ufw`/`iptables`/`nft` drop rules) that would terminate the agent or sever the mTLS tunnel is deterministically rejected before execution.
- **Context-Window Protection (16 KB Head/Tail Truncation):** Strips ANSI escape sequences and caps command output at **16 KB** (**4 KB head** + **12 KB tail**) before returning to the LLM, while saving the complete unedited log to `/tmp/axon-logs/<cmd_id>.log` on the node for targeted `grep` inspection.
- **Zero-Trust Secret Redaction (`Secrets.enc`):** Secrets are encrypted at rest with **AES-256-GCM** in the Brain Vault, injected as environment variables into the remote PTY at runtime, and scrubbed via regex pipeline as `[REDACTED_SECRET:KEY_NAME]` before any `stdout`/`stderr` leaves the node.

### Pluggable DevOps Rule Cartridges (`/cartridges/*.md`)
Toggle modular architectural constraints per project directly from the Control Center canvas:
- [`docker-first.md`](./cartridges/docker-first.md) — Enforces containerized `docker-compose.yml` deployments with healthchecks and `127.0.0.1` loopback port bindings.
- [`zero-trust-networking.md`](./cartridges/zero-trust-networking.md) — Prohibits `0.0.0.0` public port exposure; mandates loopback binding + Yamux Stream 3 tunneling.
- [`native-systemd.md`](./cartridges/native-systemd.md) — Enforces native Linux service users and hardened `systemd` unit files (`ProtectSystem=strict`, `NoNewPrivileges=true`).
- [`auto-ssl-caddy.md`](./cartridges/auto-ssl-caddy.md) — Automates Caddy reverse-proxy blocks with TLS and strict security headers.

---

## 🛠️ Build & Test from Source

```bash
# 1. Run deterministic unit & integration tests across Go modules (proto, axon, core-gateway)
CGO_ENABLED=0 go test -v ./proto/... ./agents/axon/... ./apps/core-gateway/...

# 2. Build static Go binaries
CGO_ENABLED=0 go build -o bin/axon ./agents/axon
CGO_ENABLED=0 go build -o bin/core-gateway ./apps/core-gateway

# 3. Build Next.js 15 Control Center WebUI
npm --prefix apps/core-web ci
npm --prefix apps/core-web run build
```

## 📄 License

Released under the [MIT License](./LICENSE). See [SECURITY.md](./SECURITY.md) for vulnerability reporting and [CONTRIBUTING.md](./CONTRIBUTING.md) for contribution guidelines.
