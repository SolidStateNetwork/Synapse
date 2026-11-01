# 📊 PROJECT_STATE – Echtzeit-Statusmatrix von Synapse

> **Single Source of Truth (SSOT) für den aktuellen Entwicklungs- und Produktionsstand aller Module von `SolidStateNetwork/Synapse`.**  
> Wird nach jedem abgeschlossenen Feature oder Release aktualisiert.

---

## 1. Projekt-Steckbrief

| Eigenschaft | Wert |
| :--- | :--- |
| **Projektname** | **Synapse** (`SolidStateNetwork/Synapse`) |
| **Kurzbeschreibung** | AI-Managed Linux Server & Infrastructure Control Center („The Brain & The Hands“) |
| **Aktuelle Version** | **`v2.0.0`** |
| **Sichtbarkeit** | **Public Repository** (Strikte Clean-Room- & Zero-Private-Data-Policy) |
| **Lizenz** | **Synapse Source-Available Non-Commercial License** |
| **Tech-Stack** | **Go 1.23** (`core-gateway` + `axon` + `proto`) · **Next.js 15 / React 19 / TypeScript 5.7 / Tailwind CSS** (`core-web`) |
| **Qualitäts-Metriken** | Go Coverage: **`88.0 %`** (`>= 85 %` Gate) · TS Coverage: **`94.31 %`** (`>= 90 %` Gate) · Max Go: **`499` Z.** (`< 500`) · Max TS: **`596` Z.** (`< 600`) |

---

## 2. Subsystem- & Modul-Statusmatrix

| Modul-ID | Komponente | Pfad / Bereich | Beschreibung | Status |
| :--- | :--- | :--- | :--- | :---: |
| **`ARCH-LEXICON`** | **Architektur- & KI-Lexikon** | `architecture/`, `memory/`, `playbooks/`, `AGENTS.md` | Vollständige Spezifikation (`00`–`04`), ADRs, Blackbox, Multi-IDE-Regeln & Pre-Commit-Blocker | 🟢 `PRODUCTION (v2.0.0)` |
| **`PROTO-V1`** | **Tunnel Protocol (`tunnelv1`)** | `proto/` | Geteilte Go-Nachrichten-Typen für mTLS-1.3-Frames, PTY, FS, Firewall & Reverse-Proxy | 🟢 `PRODUCTION (100 % Cov)` |
| **`CORE-GATEWAY`** | **mTLS 1.3 Hub & PKI Authority** | `apps/core-gateway/` | ECDSA P-256 Root CA, CSR Join-Tokens, Yamux-Stream-Hub, 60-Sample Telemetrie & Reverse-Proxy | 🟢 `PRODUCTION (v2.0.0)` |
| **`AXON-AGENT`** | **Statischer Linux Muscle-Agent** | `agents/axon/` | Outbound mTLS 1.3 Client, Ephemeral PTY GC (`IsEphemeralSessionID`), Workspace-Jail & Self-Lockout Guard | 🟢 `PRODUCTION (v2.0.0)` |
| **`BRAIN-VAULT`** | **Encrypted Project Brain Vault** | `apps/core-web/src/lib/vault*` | Atomare `State.json`-Transaktionen, `AES-256-GCM` `Secrets.enc`, `Architecture.md`, `Memory.md` & `Audit.jsonl` | 🟢 `PRODUCTION (v2.0.0)` |
| **`AI-ORCHESTRATOR`** | **Multi-LLM & Fallback Engine** | `apps/core-web/src/lib/orchestrator/` | 31 Core/Node-Tools, Prompt-Caching, `TIER_3` Approval-Interceptor & deterministischer Fallback | 🟢 `PRODUCTION (v2.0.0)` |
| **`MCP-SERVER`** | **Model Context Protocol API** | `apps/core-web/src/app/api/mcp/` | JSON-RPC 2.0 + REST MCP-Server (`35` Tools inkl. Meta-Tools, `read`/`execute`/`admin` Scopes) | 🟢 `PRODUCTION (v2.0.0)` |
| **`RESILIENCE-DR`** | **Time-Machine, Backups & Self-Heal** | `src/lib/checkpoints.ts`, `backups.ts`, `self-healing/` | Automatische Pre-Flight Checkpoints (`chk-...`), `AES-256-GCM` Offsite-Backups & MTTR-Self-Healing | 🟢 `PRODUCTION (v2.0.0)` |
| **`DEVOPS-STUDIO`** | **GitOps, Hot-Reload, SQLite & Cron** | `src/lib/projects/`, `src/lib/v070-studio.ts` | GitOps Stack-Deployer, Syntax-geprüfter Code-Hot-Reload, SQLite-Studio & Cron-Due-Runner | 🟢 `PRODUCTION (v2.0.0)` |
| **`SECOPS-SHIELD`** | **Synapse Shield Firewall & RBAC** | `src/app/api/firewall/`, `src/lib/auth.ts` | 4 Firewall-Sicherheitsprofile, Port-Shielding, SSH-Intrusion-Radar, RBAC & 2FA-TOTP | 🟢 `PRODUCTION (v2.0.0)` |
| **`WEB-STUDIO-UI`** | **Next.js 15 Visual Control Center** | `apps/core-web/src/components/` | Interaktiver Topology Canvas, Live-Preview Tunnel, Checkpoint-Badges, Bilingual (`DE`/`EN`) | 🟢 `PRODUCTION (v2.0.0)` |
| **`CONTAINER-LAB`** | **Lokales 2-Container-Labor & OTA** | `containers/`, `/api/system-update` | Isoliertes 2-Container-Setup (`synapse-core` + `synapse-muscle`) & Container-native OTA-Updates | 🟢 `PRODUCTION (v2.0.0)` |
