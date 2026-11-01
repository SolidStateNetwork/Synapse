# 🏗️ 01 – Tech-Stack, Monorepo-Struktur & Qualitäts-Gates

Dieses Dokument definiert die verbindliche Verzeichnisstruktur, den Technologie-Stack und die technischen Qualitäts-Gates des **Synapse**-Monorepos (`SolidStateNetwork/Synapse`).

---

## 1. Technologie-Stack im Überblick

| Schicht | Technologie | Begründung |
| :--- | :--- | :--- |
| **Core WebUI & AI Studio** | **Next.js 15 (App Router)**, **React 19**, **TypeScript 5.7 (Strict)**, **Tailwind CSS 3.4**, **Lucide Icons**, **Xterm.js** | Ermöglicht ein reaktives Echtzeit-Cockpit (Topology Canvas, eingebettetes Terminal, SSE-Streaming) sowie Server-Routes für den AI-Orchestrator und den `/api/mcp`-Endpunkt in einem einzigen Standalone-Bundle. |
| **Core Gateway (`apps/core-gateway`)** | **Go 1.23**, `crypto/tls` (TLS 1.3), `crypto/ecdsa` (P-256), `hashicorp/yamux` | Hochperformanter, speichersicherer mTLS-1.3-Endpunkt, CSR-Token-CA, Reverse-Proxy-Tunnel und Heartbeat-Hub ohne externe C-Abhängigkeiten (`CGO_ENABLED=0`). |
| **Muscle Agent (`agents/axon`)** | **Go 1.23**, `creack/pty`, `hashicorp/yamux` | Kompiliert zu einem einzigen statischen Linux-Binary (`amd64` / `arm64`), das sofort auf jedem Linux-System (Systemd, OpenRC/Alpine oder Container) läuft. |
| **Shared Tunnel Protocol (`proto`)** | **Go 1.23 (`tunnelv1`)** | Gemeinsame, streng typisierte Nachrichten-Definitionen für Heartbeats, PTY-Streams, Dateisystem-Operationen, Firewall-Steuerung und Reverse-Proxy-Frames. |

---

## 2. Monorepo-Verzeichnisstruktur

```text
Synapse/
├── agents/
│   └── axon/                    # Go Muscle Agent ('The Hands')
│       ├── cmd/axon/            # CLI Entrypoint (run, status, switch, version)
│       └── internal/            # Modulare Agent-Subsysteme (fs, guard, health, pty, tunnel)
├── apps/
│   ├── core-gateway/            # Go mTLS 1.3 Hub, PKI Authority & Reverse-Proxy ('The Brain' Gateway)
│   │   └── internal/            # hub, pki, proxy
│   └── core-web/                # Next.js 15 Control Center, Brain Vault, AI Orchestrator & MCP Server
│       └── src/
│           ├── app/api/         # REST, SSE & MCP JSON-RPC 2.0 API-Routen
│           ├── components/      # Modulare React-Views, Canvas-Controller & Modals
│           ├── hooks/           # Custom Hooks für System-, Infra-, Firewall- & Studio-Aktionen
│           ├── lib/             # Vault, Crypto, Checkpoints, Self-Healing & AI/MCP Tool-Dispatcher
│           └── __tests__/       # Vollständige TypeScript Unit- & Integrations-Test-Suite
├── architecture/                # Verbindliche Architektur-Spezifikationen (00 bis 04)
├── cartridges/                  # Modulare AI Rule Cartridges (.md Policy-Module)
├── containers/                  # Lokales 2-Container-Test- & Entwicklungslabor (Core + Muscle)
│   ├── core/                    # Dockerfile, Entrypoint & Runtime für Container 1 (synapse-core)
│   ├── muscle/                  # Dockerfile, Entrypoint & Runtime für Container 2 (synapse-muscle)
│   ├── docker-compose.yml       # 2-Container Compose-Stack
│   └── manage.sh                # Orchestrierungs-Skript (Docker & Rootless Linux Namespace Fallback)
├── docs/assets/                 # SVG-Architekturdiagramme & UI-Vorschauen für README
├── memory/                      # Persistentes Projekt-Gedächtnis (PROJECT_STATE, MILESTONES, BLACKBOX)
├── playbooks/                   # Standard Operating Procedures (Feature-SOP & Release-SOP)
├── proto/                       # Geteiltes Go-Paket (tunnelv1) für Core-Gateway & Axon
└── scripts/                     # Hardened Deployment- & Installer-Skripte (deploy-core.sh, install-axon.sh)
```

---

## 3. Unverhandelbare Code- & Qualitäts-Gates (CI & Pre-Commit)

Jeder Commit und jeder Pull Request wird durch `.githooks/pre-commit` sowie `.github/workflows/ci.yml` gegen folgende harte Schwellenwerte geprüft:

1. **Strikte Dateigrößen-Obergrenzen (Modularisierungs-Pflicht):**
   - **Go-Dateien (`*.go`):** Maximal **`499` Zeilen** (`< 500` Zeilen).
   - **TypeScript-/React-Dateien (`*.ts`, `*.tsx`):** Maximal **`599` Zeilen** (`< 600` Zeilen).
   - **Orchestrator-Tool-Module (`src/lib/orchestrator/*Tools.ts`):** Kompakt und fokussiert (`< 220`–`300` Zeilen).
2. **Strikte Typisierung (`0` `any`):**
   - `npx tsc --noEmit` muss mit `0` Fehlern durchlaufen; ungetypte `any`-Konstrukte in TypeScript sind verboten.
3. **Verbindliche Test-Coverage-Gates:**
   - **Go Unit- & Race-Tests (`go test -race -cover`):** Mindestens **`85.0 %` Statement-Coverage** in jedem einzelnen der 11 Go-Pakete.
   - **TypeScript Test-Suite (`npm test -- --experimental-test-coverage`):** Mindestens **`90.0 %` Line-Coverage** über das gesamte `apps/core-web/src/lib/`- und API-System.
4. **ShellCheck-Konformität:**
   - Alle Shell-Skripte unter `scripts/` müssen `bash -n`, `sh -n` und `shellcheck -S warning` mit `0` Warnungen bestehen.
5. **Public Clean-Room Hygiene (`0` Private Data):**
   - Keinerlei echte Server-IPs, keine lokalen Benutzerpfade (`/home/<user>`), keine privaten Domains und keine Secrets im gesamten Git-Baum.
