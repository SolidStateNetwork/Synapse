# 🌐 PROJECT STATE – Synapse Architecture & Subsystem Matrix

> **Zweck:** Diese Datei ist die zentrale **Single Source of Truth** für alle Subsysteme, Port-Belegungen, Sicherheits-Tiers und Test-Metriken des Synapse-Ökosystems (`SolidStateNetwork/Synapse`).  
> **WICHTIG FÜR KI-AGENTEN:** Vor jeder Code-Änderung lesen und nach jeder Architektur- oder Feature-Änderung aktualisieren!

---

## 1. Plattform-Metadaten

| Eigenschaft | Wert |
| :--- | :--- |
| **Projektname** | **Synapse** – Distributed AI DevOps & Infrastructure Control Center |
| **Repository** | `git@github.com:SolidStateNetwork/Synapse.git` (`https://github.com/SolidStateNetwork/Synapse`) |
| **Aktuelle Version** | **`v2.4.0`** |
| **Lizenz** | Source-Available (Non-Commercial) – siehe [`LICENSE`](../LICENSE) |
| **Architektur-Paradigma** | **Core ("The Brain")** & **Muscle ("The Hands")** über Outbound-Only **mTLS 1.3 + Yamux Multiplexing** |
| **Code-Qualitäts-Gates** | Go `< 500` Zeilen/Datei (`>= 88%` Coverage über 11 Pakete) · TypeScript/React `< 600` Zeilen/Datei (`47/47` Tests) |

---

## 2. Subsystem-Matrix (Production Inventory)

| Subsystem-ID | Komponente | Pfad im Monorepo | Primäre Funktion | Port / Protokoll | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`ARCH-LEXICON`** | **Architektur- & KI-Lexikon** | `architecture/`, `memory/`, `playbooks/`, `AGENTS.md` | Vollständige Spezifikation (`00`–`04`), ADRs, Blackbox, Multi-IDE-Regeln & Pre-Commit-Blocker | Git / Markdown | 🟢 `PRODUCTION (v2.4.0)` |
| **`PROTO-WIRE`** | **Wire-Framing & Protobuf** | `proto/tunnel.proto`, `proto/tunnel.pb.go` | Längenpräfixiertes JSON-Wire-Framing (`MaxFrameSize = 32 MB`) für 5 Yamux-Stream-Typen (`1..5` inkl. `StreamTypeCertRenew`) | Yamux Binary Frame | 🟢 `PRODUCTION (94.7% Cov)` |
| **`CORE-GATEWAY`** | **mTLS 1.3 Hub & PKI Authority** | `apps/core-gateway/` | ECDSA P-256 Root CA, CSR Join-Tokens, Auto-Cert-Rotation (`RenewClientCert`), Yamux-Hub & Reverse-Proxy | `8443/tcp` (mTLS 1.3)<br>`8081/tcp` (HTTP API) | 🟢 `PRODUCTION (v2.4.0)` |
| **`AXON-AGENT`** | **Statischer Linux Muscle-Agent** | `agents/axon/` | Outbound mTLS 1.3 Client (`X25519`/`P-256` pinned + Auto-Rotation), Ephemeral PTY GC, Ancestor-Symlink-Jail & `AllowedCommands` Guard | Outbound `-> 8443/tcp` | 🟢 `PRODUCTION (v2.4.0)` |
| **`CORE-WEB`** | **Next.js 15 Control Center UI** | `apps/core-web/src/components/` | React-Flow Topologie-Canvas, Multi-Tab Terminal, Service-Workbench, GitOps-Deployer, Brain-Vault & Security-Shield | `3000/tcp` (HTTP) | 🟢 `PRODUCTION (v2.4.0)` |
| **`AI-ORCHESTRATOR`** | **42-Tool AI Engine & Interceptor** | `apps/core-web/src/lib/orchestrator/` | OpenAI-kompatibler Tool-Loop, Prompt-Caching, Pre-Flight Time-Machine Checkpoints (`chk-...`) & Offline-Fallback | Intern (`core-web`) | 🟢 `PRODUCTION (42 Tools)` |
| **`MCP-SERVER`** | **Built-In + Standalone MCP Server** | `apps/core-web/src/app/api/mcp/`, `packages/mcp-server/` | Streamable HTTP JSON-RPC 2.0 + Standalone Stdio/HTTP Server (`42` Tools, `read`/`execute`/`admin` Scopes, HMAC Signing, 6 Lexikon-Ressourcen) | `/api/mcp` (`POST`/`GET`) + Stdio | 🟢 `PRODUCTION (v2.4.0)` |
| **`BRAIN-VAULT`** | **4-Doc Lexikon, PBKDF2 Secret Vault & Hash-Chained Audit** | `apps/core-web/src/lib/vault.ts`, `src/lib/vault/` | `State.json` (`.bak` Self-Healing), `Architecture.md`, `Memory.md`, `Milestones.md`, `AGENTS.md`, `Secrets.enc` (`PBKDF2-SHA256` + `AES-256-GCM`) & `Audit.jsonl` (`SHA-256` Hash-Chain) | `/var/lib/synapse/projects/<id>/` | 🟢 `PRODUCTION (v2.4.0)` |
| **`RULE-CARTRIDGES`** | **Modulare KI-Architektur-Regeln** | `cartridges/*.md`, `src/lib/cartridges.ts` | 7 Built-In Cartridges (`docker-first`, `zero-trust-networking`, `native-systemd`, `nodejs-pm2`, `python-fastapi-uv`, `solidstate-5step-protocol`, `solidstate-public-cleanroom`) + Custom Cartridges | Markdown / Prompt-Injektion | 🟢 `PRODUCTION (7 Built-In)` |
| **`CONTAINER-LAB`** | **2-Container Local Lab** | `containers/manage.sh`, `containers/docker-compose.yml` | Reproduzierbare 2-Container-Umgebung (`synapse-core` + `synapse-muscle`) via Docker Compose oder Rootless Linux Namespaces | `3000`, `8081`, `8443` | 🟢 `PRODUCTION` |

---

## 3. Die 3 Sicherheits- & Autonomie-Stufen (`AutonomyTier`)

| Tier | Bezeichner | Durchsetzungsort | Verhalten |
| :--- | :--- | :--- | :--- |
| 🔴 **Stufe 1** | `TIER_1_UNLEASHED` | Core Interceptor + `axon` (`internal/guard`) | Vollständige Server-Administration durch die KI; nur `Self-Lockout-Guardrail` (`axon.service`, `sshd`, eigener PID, Core-Tunnel-Firewall) sowie optionale `AllowedCommands` werden hart blockiert. |
| 🟡 **Stufe 2** | `TIER_2_WORKSPACE_JAIL` *(Default)* | Core Interceptor + `axon` (`internal/fs`) | Alle Dateisystem-Operationen sind strikt auf `/opt/axon/workspaces/<project_id>/` beschränkt; rekursive `filepath.EvalSymlinks`-Prüfung des längsten existierenden Eltern-Pfades + `os.Lstat`/`os.Readlink`-Prüfung gebrochener Symlinks. |
| 🟢 **Stufe 3** | `TIER_3_SUPERVISED` | Core Interceptor (`pending_approvals`) | Reine Lese-Tools laufen sofort; **jede** mutierende Datei-, PTY-, Service- oder Firewall-Aktion wird angehalten und erfordert eine explizite Operator-Freigabe in der WebUI. |

---

## 4. Aktueller Test- & Verifikations-Status

- **Go Unit- & Race-Tests (`11` Pakete):** Alle **11 Pakete** erreichen **`>= 88.0%`** Statement-Coverage (`proto`, `apps/core-gateway`, `internal/hub`, `internal/pki`, `internal/proxy`, `agents/axon/cmd/axon`, `internal/fs`, `internal/guard`, `internal/health`, `internal/pty`, `internal/tunnel`).
- **TypeScript / Next.js 15 Test-Suite (`6` Test-Suiten, `47/47` Tests grün):**
  - `src/__tests__/synapse.test.ts` (Vault, Orchestrator, Cartridges, 4-Doc Lexikon, Clean-Room Guard)
  - `src/__tests__/fault-injection.test.ts` (Corrupted JSON Self-Healing, Rate-Limiting, Guardrail-Faults)
  - `src/__tests__/api-routes.test.ts` (Alle REST- & MCP-Endpunkte inkl. `v2.4.0` Version-Synchronisation)
  - `src/__tests__/core-deep.test.ts` (Prompts, Search-Engine, Topology-Bundles, Canary-Rollouts)
  - `src/__tests__/llm-and-ota.test.ts` (Streaming LLM-Tool-Loops, OTA-Updater, Pre-Flight Checkpoints)
  - `src/__tests__/v240-security.test.ts` (3-Tier MCP Scopes, Per-Key Rate-Limits, HMAC-SHA256 Signing & Replay-Protection, `Audit.jsonl` SHA-256 Hash-Chain & Tamper-Detection, `PBKDF2-SHA256` Secret-KDF + Legacy-Upgrade, Atomic Writes & Standalone `packages/mcp-server` 42-Tool Parity)
