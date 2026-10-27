<div align="center">

<img src="./docs/assets/synapse-hero-banner.svg" alt="Synapse Control Center — Autonomous AI Server & DevOps Engineer" width="100%" />

<br />

[![CI Pipeline](https://github.com/SolidStateNetwork/Synapse/actions/workflows/ci.yml/badge.svg)](https://github.com/SolidStateNetwork/Synapse/actions/workflows/ci.yml)
[![Latest Release](https://img.shields.io/github/v/release/SolidStateNetwork/Synapse?label=Release&color=f68330&labelColor=181a1d)](https://github.com/SolidStateNetwork/Synapse/releases)
[![GHCR Core Images](https://img.shields.io/badge/GHCR-synapse--core-f68330?logo=docker&logoColor=white&labelColor=181a1d)](https://github.com/orgs/SolidStateNetwork/packages)
[![Go 1.23+](https://img.shields.io/badge/Go-1.23%2B-38bdf8?logo=go&logoColor=white&labelColor=181a1d)](https://go.dev/)
[![Next.js 15](https://img.shields.io/badge/Control_Center-Next.js_15-31c48d?logo=next.js&logoColor=white&labelColor=181a1d)](https://nextjs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-9ca3af?labelColor=181a1d)](./LICENSE)

### **Your Autonomous AI DevOps & Server Engineer.**
Tell Synapse in plain English what you want to build, host, or fix—and watch it write the code, configure your Linux servers, preview live web apps, and heal crashed services automatically.

[What is Synapse?](#-what-is-synapse-in-plain-english) · [Core AI Features](#-core-ai-features) · [Quickstart (1-Command Deploy)](#-quickstart--1-command-deployment) · [Control Center UI](#-visual-ai-control-center) · [Safety & Guardrails](#️-ai-safety--autonomy-tiers) · [Architecture](#-how-it-works-under-the-hood-brain--muscle)

</div>

---

## 💡 What is Synapse? (In Plain English)

Normally, deploying an application or managing a Linux server requires hours of terminal work: connecting via SSH, editing configuration files, setting up Docker containers, managing passwords, and debugging crashes at 3 AM.

**Synapse turns an AI into a hands-on systems engineer that safely operates your servers for you.**

Think of Synapse as having two parts—just like a human body:
1. 🧠 **The Brain (`synapse-core`):** The visual dashboard and AI mind. It plans your project, remembers how your servers are set up, stores encrypted passwords, and decides which steps to take next.
2. 💪 **The Muscle (`axon`):** A tiny, lightweight helper program that you install on any Linux server (cloud VPS, Raspberry Pi, or homelab) with a single command. It acts as the AI's hands—executing terminal commands, editing files, and checking whether your apps are healthy.

### What Can You Ask Synapse to Do?
Instead of typing complex Linux commands yourself, you simply chat with the AI in the **Control Center**:
- *"Create a Node.js API on port 4050, start it in the background, and open a live preview for me."*
- *"Set up a PostgreSQL database with a random 32-character password and connect my backend to it."*
- *"My web service just went offline—check the last 30 lines of the log, fix the bug, and restart it."*

---

## 🤖 Core AI Features

### 1. Autonomous Multi-Step Execution (Not Just a Chatbot)
Standard AI chatbots only give you code snippets that you have to copy and paste yourself. Synapse uses a **Multi-Turn ReAct (Reason + Act) Loop** with **5 specialized DevOps tools** to do the actual work end-to-end:

| AI Tool | What the AI Does With It |
| :--- | :--- |
| **`node_fs_operation`** | Reads, creates, deletes, or patches files directly on your server using atomic writes and Unified Diffs—faster and safer than copy-pasting over SSH. |
| **`node_pty_exec`** | Runs commands inside a real, persistent Linux terminal (`bash`). The AI remembers its current folder (`cwd`), environment variables, and running background processes across turns. |
| **`core_register_service`** | Registers any web app or microservice the AI builds so Synapse can monitor its health 24/7 and stream it right into your browser. |
| **`core_manage_secret`** | Generates and injects encrypted passwords or API keys (`AES-256-GCM`) directly into your server's memory—**without the AI or logs ever seeing the plaintext password**. |
| **`core_update_brain_doc`** | Automatically updates your project's system diagrams (`Architecture.md`) and engineering diary (`Memory.md`) after every change. |

### 2. Long-Term Project Memory ("The Brain Vault")
Most AI assistants suffer from amnesia: when you start a new chat, they forget how your server is configured.
Synapse gives every project a persistent **Brain Vault**:
- **`Architecture.md`:** A living blueprint (with visual Mermaid diagrams and file paths) that the AI updates automatically whenever it installs a service or changes your setup.
- **`Memory.md`:** An engineering journal where the AI records lessons learned, fixed bugs, and server quirks so it never makes the same mistake twice.
- **`State.json`:** Real-time awareness of every connected server, its CPU/RAM/Disk load, active terminal sessions, and running services—injected fresh into the AI's brain before every single reply.

### 3. Drag-and-Drop AI "Skill Cartridges"
Want the AI to follow strict best practices without writing long prompts? On the visual canvas, you can connect **Rule Cartridges** (`/cartridges/*.md`) directly to your servers like video-game power-ups:
- 🐳 **[`Docker-First`](./cartridges/docker-first.md):** Forces the AI to package everything cleanly inside `docker-compose.yml` containers instead of cluttering your host OS.
- 🔒 **[`Zero-Trust Networking`](./cartridges/zero-trust-networking.md):** Forbids exposing ports to the public internet (`0.0.0.0`); forces the AI to bind services to `127.0.0.1` and tunnel them securely.
- ⚙️ **[`Native Systemd`](./cartridges/native-systemd.md):** Instructs the AI to create hardened Linux `systemd` background services (`ProtectSystem=strict`, `NoNewPrivileges=true`).
- 🌐 **[`Auto-SSL Caddy`](./cartridges/auto-ssl-caddy.md):** Guides the AI to configure automatic HTTPS and security headers via Caddy.

### 4. 24/7 Self-Healing, Proactive Watchdog & 1-Click Rollback
- **Proactive Auto-Watchdog:** Every 5 seconds, your servers report their hardware health and test all registered web apps (`HTTP`, `TCP`, or custom scripts). If a service fails consecutive health checks, the **Proactive Auto-Watchdog** automatically inspects the crash logs, restarts the daemon, verifies `HTTP 200 OK`, and posts a recovery report in the chat.
- **Pre-Write File Snapshots & 1-Click Rollback:** Before the AI overwrites or patches any file on your server, Synapse automatically saves a snapshot. Every file mutation in the chat includes a **⏪ Rollback** button to undo changes with a single click.

### 5. Multimodal Drag & Drop Vision, `@`-Mentions & Smart Caching
- **Drag & Drop Vision (Images, Diagrams & Logs):** Drop screenshots of broken UIs, architecture diagrams, or log files directly into the chat (or paste screenshots with `Ctrl+V`). The AI inspects the visual input and translates it directly into server configurations or code fixes.
- **Smart `@`-Context Mentions:** Type `@` in the chat to autocomplete and reference specific Muscle Peers (`@node-01`), running services (`@service:4050`), or Brain Vault documents (`@Architecture.md`, `@Memory.md`).
- **Multi-Level Prompt & Tool Caching:** Static system layers (`Core Laws`, `Rule Cartridges`, `Architecture.md`, `Memory.md`) are structured for automatic prefix caching (OpenAI / DeepSeek / Anthropic `cache_control: ephemeral`), while repeated read-only file calls (`read_file`, `list_dir`, `stat`) are served from an in-memory cache that automatically invalidates on writes.

### 6. Bring Your Own AI (Cloud or 100% Local)
Synapse is completely model-agnostic and streams live reasoning traces (`<think>`) and tokens in real time:
- **Cloud Models:** OpenAI (`gpt-4o`), Anthropic (`claude-3-5-sonnet`), or OpenRouter.
- **100% Local & Private:** Connect **Ollama** or **vLLM** (`llama3.1`, `qwen2.5-coder`, `deepseek-r1`, `llama3.2-vision`) so neither your code nor your server logs ever leave your own hardware.
- **Built-in Deterministic Engine:** Test workflows and policy locks out-of-the-box even before adding an API key.

---

## ⚡ Visual AI Control Center

Synapse replaces black-and-white terminal windows with a **60 FPS interactive Control Center**. Every server, AI model, rule cartridge, secret vault, and live web preview is visualized on an interactive map with live animated data streams:

<div align="center">
  <img src="./docs/assets/control-center-ui-preview.svg" alt="Synapse Interactive Control Center UI Preview" width="100%" />
</div>

### Highlights of the Control Center
- **Interactive Node Canvas:** Drag and arrange your **Muscle Servers**, **AI Skill Cartridges**, and **Brain Vault** freely across the infinite canvas. Draw cables between a server and a cartridge to change how the AI behaves in real time.
- **4 Live Topology Views:** Switch seamlessly between **Peer Connections**, **AI Agent Flow**, **Autonomy Groups**, and **Yamux Tunnels**.
- **Watch the AI Work Live (`xterm.js`):** Open the docked **AI Orchestrator Chat** on the right and pop up the **Live PTY Terminal** at the bottom to watch every command the AI types on your server in real time—or jump in and type commands yourself.
- **Instant Browser Preview (Zero Firewall Setup):** When the AI starts a web app on a remote server (even on `127.0.0.1:3000`), Synapse tunnels it directly into an interactive preview inside your Control Center (`/preview/<project_id>/<node_id>/<port>`).

---

## 🛡️ AI Safety & Autonomy Tiers

Giving an AI access to a server sounds scary—**if** you rely only on polite prompts. Synapse enforces **hardcoded, deterministic security rules in Go and TypeScript** that the AI cannot bypass, even if it hallucinates:

<div align="center">
  <img src="./docs/assets/security-autonomy-tiers.svg" alt="Synapse Security & Autonomy Tiers" width="100%" />
</div>

### You Choose How Much Freedom the AI Gets (Per Server)
1. 🟢 **`TIER_3_SUPERVISED` (Human-in-the-Loop Copilot):**
   The AI can read files and inspect status freely, but **every file change, diff, or terminal command pauses automatically**. You get an interactive approval card in the WebUI to review, approve, or reject the action before anything happens on your server.
2. 🟡 **`TIER_2_WORKSPACE_JAIL` (Sandboxed Project Folder — Default):**
   The AI can build and run apps autonomously, but is strictly locked inside `/opt/axon/workspaces/<project_id>/`. Any attempt to touch system files outside that folder (including symlink tricks) or run host admin commands (`sudo`, `systemctl`, `ufw`) is blocked instantly.
3. 🔴 **`TIER_1_UNLEASHED` (Full Autonomous Server Admin):**
   For dedicated VMs or containers where you want the AI to install packages, configure Docker/systemd, and manage the entire machine autonomously.
4. 🔒 **Planning-Only Mode (Zero-Server Lock):**
   If no server is assigned to your project yet, the AI can only design architectures and write plans in `Architecture.md`—all execution tools are physically locked.

### Built-in Hardcoded Guardrails (`agents/axon/internal/guard`)
- **Anti-Self-Lockout Protection:** The server agent (`axon`) knows its own process ID (`PID`), its `axon.service` unit, and the connection route to the Brain. If the AI ever tries to kill the agent, stop its service, or block its own connection with a firewall rule (`ufw`, `iptables`, `nft`), the command is rejected before execution.
- **Zero-Knowledge Secret Scrubbing:** When the AI needs a database password or API key, Synapse injects it silently into the terminal environment. If any command output tries to print that password back, the agent scrubs it into `[REDACTED_SECRET:KEY_NAME]` *before* the text ever leaves your server.
- **Smart Log Truncation (16 KB Cap):** If a command prints megabytes of logs, `axon` saves the full log to `/tmp/axon-logs/<cmd_id>.log` on the server and sends only the first 4 KB + last 12 KB to the AI—preventing AI context overload and saving token costs.

---

## 🚀 Quickstart & 1-Command Deployment

### Step 1 — Start "The Brain" (`synapse-core`) via Docker
Run this single command on any machine with Docker to launch the **Control Center UI**, the **AI Orchestrator**, the **Encrypted Brain Vault**, and the **mTLS Gateway**:

```bash
curl -fsSL https://raw.githubusercontent.com/SolidStateNetwork/Synapse/main/scripts/deploy-core.sh | bash
```

> **What happens automatically:**
> 1. Pulls the prebuilt images (`ghcr.io/solidstatenetwork/synapse-core-gateway:latest` & `ghcr.io/solidstatenetwork/synapse-core-web:latest`).
> 2. Generates a random 256-bit `SYNAPSE_MASTER_KEY` to encrypt your `Secrets.enc` vault (`AES-256-GCM`).
> 3. Opens the Control Center at `http://<CORE_IP>:3000` and prints a ready-to-copy **Join Command** for your first server.

### Step 2 — Connect Any Linux Server ("The Muscle" — `axon`)
Click **`+ Add Peer`** in the Control Center (`http://<CORE_IP>:3000`) to generate a 15-minute one-time token, then paste the one-liner onto any Linux server (`x86_64` or `arm64`):

```bash
curl -fsSL http://<CORE_IP>:8081/install.sh | sudo sh -s -- <ONE_TIME_JOIN_TOKEN> TIER_2_WORKSPACE_JAIL
```

> **Zero-Firewall Setup:**
> You do **not** need to open any incoming ports on your Linux server. The `axon` binary downloads automatically, exchanges a cryptographic certificate (ECDSA P-256 mTLS 1.3), installs itself as a `systemd` service, and connects outbound to your Control Center.

### Prebuilt Static Release Binaries (`CGO_ENABLED=0`)
Prefer manual installation? All binaries are compiled with zero external dependencies and available on [GitHub Releases](https://github.com/SolidStateNetwork/Synapse/releases):

| Binary | Architecture | Target OS | Direct Download |
| :--- | :--- | :--- | :--- |
| **`axon-linux-amd64`** | `x86_64` | Linux | [Download Latest](https://github.com/SolidStateNetwork/Synapse/releases/latest/download/axon-linux-amd64) |
| **`axon-linux-arm64`** | `aarch64` | Linux | [Download Latest](https://github.com/SolidStateNetwork/Synapse/releases/latest/download/axon-linux-arm64) |
| **`axon-darwin-amd64`** | `x86_64` | macOS | [Download Latest](https://github.com/SolidStateNetwork/Synapse/releases/latest/download/axon-darwin-amd64) |
| **`axon-darwin-arm64`** | `Apple Silicon` | macOS | [Download Latest](https://github.com/SolidStateNetwork/Synapse/releases/latest/download/axon-darwin-arm64) |
| **`core-gateway-linux-amd64`** | `x86_64` | Linux | [Download Latest](https://github.com/SolidStateNetwork/Synapse/releases/latest/download/core-gateway-linux-amd64) |

---

## 🧠 How It Works Under the Hood (Brain & Muscle)

> **ARCHITECTURAL LAW:** The Synapse Core Control Plane (**The Brain**) **NEVER** compiles or executes user application code. All shell execution, file changes, and service hosting happen exclusively on enrolled **Axon Muscle Peers** over a single outbound **mTLS 1.3 + `hashicorp/yamux` multiplexed reverse tunnel**.

<div align="center">
  <img src="./docs/assets/brain-muscle-architecture.svg" alt="Synapse Brain & Muscle Architecture Diagram" width="100%" />
</div>

### 5-Layer Dynamic AI System Prompt (`apps/core-web/src/lib/orchestrator.ts`)
Before every single AI turn, Synapse assembles a structured 5-layer prompt so the AI always has complete situational awareness:
1. **Layer 1 — Immutable Brain-Muscle Laws:** Teaches the AI its role, tools, and self-preservation rules.
2. **Layer 2 — Live Infrastructure & Telemetry (`State.json`):** Injects live CPU/RAM/Disk metrics, IP addresses, Autonomy Tiers, and active PTY sessions for every connected server.
3. **Layer 3 — Active Rule Cartridges (`/cartridges/*.md`):** Injects the exact DevOps rules currently wired to the project on the Control Center canvas.
4. **Layer 4 — Project Brain Context (`Architecture.md` & `Memory.md`):** Injects the current Mermaid topology diagram, remote file layout, and past troubleshooting notes.
5. **Layer 5 — Execution & Live-Preview Protocol:** Ensures web services bind to `127.0.0.1:<port>` and register automatically for live browser tunneling.

### 4 Multiplexed Virtual Streams Over 1 Connection (`hashicorp/yamux` + mTLS 1.3)
Over a single outbound TCP connection on port `8443`, `core-gateway` and `axon` multiplex four dedicated channels:
1. **Stream 1 — Atomic Filesystem & Unified Diff Engine (`internal/fs`):** Executes `read_file`, atomic temp-file + rename `write_file`, `apply_unified_diff`, `list_dir`, `stat`, `delete`, and octal `file_mode` (`0644` / `0755`) mutations directly on disk.
2. **Stream 2 — Persistent Sentinel-Framed PTY (`internal/pty` + `creack/pty`):** Runs commands inside a persistent `/dev/ptmx` bash session using deterministic boundary sentinels (`__SYNAPSE_EOF_<cmd_id>:<exit_code>__`), preserving environment variables and `/proc/<shell_pid>/cwd` across AI turns while streaming live output to `xterm.js`.
3. **Stream 3 — Zero-Firewall Loopback Reverse Proxy (`127.0.0.1:<port>`):** Tunnels HTTP/TCP services bound strictly to `127.0.0.1:<port>` on the Muscle Peer directly into the Control Center Live Preview (`/preview/<project_id>/<node_id>/<port>`).
4. **Stream 4 — 5-Second Telemetry & Service Health Probes (`gopsutil`):** Pushes real-time CPU, RAM, Disk utilization, active PTY sessions, and HTTP/TCP/EXEC healthcheck statuses into `State.json`.

---

## 🛠️ Build & Test from Source

```bash
# 1. Run deterministic unit & integration tests across Go modules (proto, axon, core-gateway)
CGO_ENABLED=0 go test -v ./proto/... ./agents/axon/... ./apps/core-gateway/...

# 2. Build static Go binaries
CGO_ENABLED=0 go build -o bin/axon ./agents/axon/cmd/axon
CGO_ENABLED=0 go build -o bin/core-gateway ./apps/core-gateway

# 3. Build Next.js 15 Control Center WebUI
npm --prefix apps/core-web ci
npm --prefix apps/core-web run build
```

## 📄 License

Released under the [MIT License](./LICENSE). See [SECURITY.md](./SECURITY.md) for vulnerability reporting and [CONTRIBUTING.md](./CONTRIBUTING.md) for contribution guidelines.
