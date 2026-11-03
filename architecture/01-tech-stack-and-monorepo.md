# 🏗️ 01 — Tech Stack, Monorepo Structure & Quality Gates

This document defines the mandatory directory structure, technology stack, and engineering quality gates of the **Synapse** monorepo (`SolidStateNetwork/Synapse`).

---

## 1. Technology Stack Overview

| Layer | Technology | Rationale |
| :--- | :--- | :--- |
| **Core WebUI & AI Studio** | **Next.js 15 (App Router)**, **React 19**, **TypeScript 5.7 (Strict)**, **Tailwind CSS 3.4**, **Lucide Icons**, **Xterm.js** | Enables a reactive real-time cockpit (Topology Canvas, embedded terminal, SSE streaming) alongside server routes for the AI Orchestrator and `/api/mcp` endpoint in a single standalone bundle. |
| **Core Gateway (`apps/core-gateway`)** | **Go 1.23**, `crypto/tls` (TLS 1.3), `crypto/ecdsa` (P-256), `hashicorp/yamux` | High-performance, memory-safe mTLS 1.3 hub, CSR token CA, CRL authority, reverse-proxy tunnel, and heartbeat hub with zero C dependencies (`CGO_ENABLED=0`). |
| **Muscle Agent (`agents/axon`)** | **Go 1.23**, `creack/pty`, `hashicorp/yamux` | Compiles into a single static Linux binary (`amd64` / `arm64`) that runs out of the box on any Linux distribution (Systemd, OpenRC/Alpine, or containers). |
| **Shared Tunnel Protocol (`proto`)** | **Go 1.23 (`tunnelv1`)** | Shared, strongly typed wire-frame definitions for heartbeats, PTY streams, filesystem operations, certificate rotation, firewall control, and reverse-proxy frames. |

---

## 2. Monorepo Directory Structure

```text
Synapse/
├── agents/
│   └── axon/                    # Go Muscle Agent ('The Hands')
│       ├── cmd/axon/            # CLI entrypoint (run, status, switch, version)
│       └── internal/            # Modular agent subsystems (fs, guard, health, pty, tunnel)
├── apps/
│   ├── core-gateway/            # Go mTLS 1.3 Hub, PKI Authority & Reverse Proxy ('The Brain' Gateway)
│   │   └── internal/            # hub, pki, proxy
│   └── core-web/                # Next.js 15 Control Center, Brain Vault, AI Orchestrator & MCP Server
│       └── src/
│           ├── app/api/         # REST, SSE & MCP JSON-RPC 2.0 API routes
│           ├── components/      # Modular React views, canvas controllers & modals
│           ├── hooks/           # Custom hooks for system, infra, firewall & studio actions
│           ├── lib/             # Vault, crypto, checkpoints, self-healing & AI/MCP tool dispatchers
│           └── __tests__/       # Comprehensive TypeScript unit & fault-injection test suite
├── architecture/                # Mandatory architecture specifications (00 through 04)
├── cartridges/                  # Modular AI Rule Cartridges (.md policy modules)
├── containers/                  # Local 2-Container testing & development lab (Core + Muscle)
│   ├── core/                    # Dockerfile, entrypoint & runtime for Container 1 (synapse-core)
│   ├── muscle/                  # Dockerfile, entrypoint & runtime for Container 2 (synapse-muscle)
│   ├── docker-compose.yml       # 2-Container Compose stack
│   └── manage.sh                # Orchestration script (Docker & rootless Linux namespace fallback)
├── docs/assets/                 # SVG architecture diagrams & UI previews for README
├── memory/                      # Persistent project memory (PROJECT_STATE, MILESTONES, BLACKBOX)
├── packages/mcp-server/         # Standalone Node.js Stdio/HTTP MCP Server package
├── playbooks/                   # Standard Operating Procedures & lexicon verifier
│   └── scripts/                 # verify-lexicon-completeness.py
├── proto/                       # Shared Go package (tunnelv1) for Core-Gateway & Axon
└── scripts/                     # Hardened deployment & installer scripts (deploy-core.sh, install-axon.sh)
```

---

## 3. Non-Negotiable Code & Quality Gates (CI & Pre-Commit)

Every commit and pull request is validated by `.githooks/pre-commit`, `playbooks/scripts/verify-lexicon-completeness.py`, and `.github/workflows/ci.yml` against the following strict thresholds:

1. **Strict File Size Caps (Modularization Requirement):**
   - **Go files (`*.go`):** Maximum **`499` lines** (`< 500` lines).
   - **TypeScript/React files (`*.ts`, `*.tsx`):** Maximum **`599` lines** (`< 600` lines).
   - **Orchestrator tool modules (`src/lib/orchestrator/*Tools.ts`):** Compact and focused (`< 220`–`300` lines).
2. **Strict Typing (`0` `any`):**
   - `npx tsc --noEmit` must pass with `0` errors; untyped `any` constructs in TypeScript are prohibited.
3. **Mandatory Test Coverage Gates:**
   - **Go Unit & Race Tests (`go test -race -cover`):** At least **`90.0%` statement coverage** in each of the 11 Go packages.
   - **TypeScript Test Suite (`npm test -- --experimental-test-coverage`):** At least **`90.0%` line coverage** across the `apps/core-web/src/lib/` and API layer.
4. **ShellCheck Compliance:**
   - All shell scripts under `scripts/` must pass `bash -n`, `sh -n`, and `shellcheck -S warning` with `0` warnings.
5. **Public Clean-Room & Single-Repo Hygiene:**
   - Zero real server IPs, zero local workstation paths (`/home/<user>`), zero private internal domains, zero secrets, and zero cross-repo bloat files in the Git tree.
