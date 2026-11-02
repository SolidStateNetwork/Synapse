# 🤖 AGENTS.md – AI Engineering Manual & Governance für Synapse

> **VERBINDLICHE DIREKTIVE FÜR ALLE KI-AGENTEN (Antigravity, Claude Code, Cursor, Windsurf, Copilot, Codex):**  
> Dieses Repository (`SolidStateNetwork/Synapse`) ist ein **öffentliches Projekt (Public Repository)** und nutzt ein zentrales **Architektur-Lexikon & Langzeitgedächtnis (`memory/`)**.  
> **Keine Code- oder Architektur-Änderung ohne vorheriges Lesen und anschließendes Aktualisieren dieses Lexikons!**

---

## 1. Das 5-Schritte-Pflichtprotokoll für jede KI-Session

### Schritt 1: Kontext laden (Read First)
Bevor du neuen Code schreibst oder bestehende Module änderst, lies **zwingend**:
1. [`memory/PROJECT_STATE.md`](./memory/PROJECT_STATE.md) – Welche Subsysteme und Versionen (`v2.4.0`) sind aktiv?
2. [`memory/BLACKBOX.md`](./memory/BLACKBOX.md) – Was waren die letzten Entwicklungs-Schritte (`[BB-XXX]`) und welche Architecture Decision Records (`ADR-001` bis `ADR-006`) gelten?
3. [`memory/MILESTONES.md`](./memory/MILESTONES.md) – Welche Phasen sind abgeschlossen und welche Ziele stehen an?

### Schritt 2: Architektur-Konformität prüfen (Check Standards)
Jede Implementierung muss exakt den Spezifikationen unter [`architecture/`](./architecture/) folgen:
- [`architecture/00-product-vision.md`](./architecture/00-product-vision.md) – Core („The Brain“) & Muscle („The Hands“) Trennung, 3 Autonomie-Stufen (`TIER_1`–`TIER_3`).
- [`architecture/01-tech-stack-and-monorepo.md`](./architecture/01-tech-stack-and-monorepo.md) – Go 1.23 + Next.js 15 / React 19 / TypeScript + strikte Dateigrößen- & Coverage-Gates.
- [`architecture/02-mtls-tunnel-and-axon-agent.md`](./architecture/02-mtls-tunnel-and-axon-agent.md) – mTLS 1.3 PKI, Yamux, Ephemeral PTY GC (`IsEphemeralSessionID`) & Self-Lockout Guard.
- [`architecture/03-ai-orchestrator-and-mcp-server.md`](./architecture/03-ai-orchestrator-and-mcp-server.md) – 100 % Tool-Parität zwischen AI-Orchestrator, deterministischem Fallback und `/api/mcp` (`JSON-RPC 2.0`).
- [`architecture/04-resilience-security-and-ota.md`](./architecture/04-resilience-security-and-ota.md) – `AES-256-GCM` `Secrets.enc`, Pre-Flight Time-Machine Checkpoints (`chk-...`), Self-Healing & Container/Systemd OTA.

### Schritt 3: Unverhandelbare Code-, Coverage- & Modularisierungs-Gates
- **Dateigrößen-Limit:** Jede Go-Datei (`*.go`) muss **`< 500` Zeilen** bleiben; jede TypeScript-/React-Datei (`*.ts`, `*.tsx`) muss **`< 600` Zeilen** bleiben.
- **Strikte Typisierung:** **`0` `any`-Typen** (`npx tsc --noEmit` muss fehlerfrei sein).
- **Test-Coverage-Gates:** Mindestens **`85.0 %` Statement-Coverage** in jedem der 11 Go-Pakete (`go test -race -cover`) und mindestens **`90.0 %` Line-Coverage** in TypeScript (`npm test -- --experimental-test-coverage`).
- **Lokales 2-Container-Labor (`containers/`):** Lokale Live-Tests und Rollouts laufen isoliert in den beiden lokalen Containern (`bash containers/manage.sh restart`).

### Schritt 4: Public-Repository Sicherheits-Guardrails (Clean-Room Policy)
Da dieses Repository **öffentlich (Public)** auf GitHub zugänglich ist, gilt ausnahmslos:
- **Zero-Secret-Policy:** NIEMALS echte API-Tokens, Private Keys (`*.key`), `Secrets.enc`, `ca.key` oder `.env`-Dateien ins Git schreiben!
- **Zero-Personal- & Zero-Infra-Data-Policy:** NIEMALS lokale Benutzerpfade (`/home/<username>/...`), echte Server-IPs, private Domains oder interne Infrastruktur-Daten aus anderen Repositories in Code, Tests, Kommentaren oder Dokumentation hinterlassen!

### Schritt 5: Dokumentation & Blackbox-Update (Write Back & Push)
Nach **jedem** abgeschlossenen Feature oder Release musst du **im selben Arbeitsgang**:
1. Den Status in [`memory/PROJECT_STATE.md`](./memory/PROJECT_STATE.md) aktualisieren.
2. Erledigte Punkte in [`memory/MILESTONES.md`](./memory/MILESTONES.md) abhaken (`[x]`).
3. Einen neuen, datierten Log-Eintrag `[BB-XXX]` ganz oben in [`memory/BLACKBOX.md`](./memory/BLACKBOX.md) einfügen.
4. Die Änderungen sauber committen und per `git push origin main` nach GitHub pushen.

---

## 2. Sprach-Regelung für dieses Repository

- **Öffentliche Außendarstellung (`README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CHANGELOG.md`, Code, Kommentare & Commit-Messages):** **Englisch** (mit zweisprachiger deutscher `README.de.md` und bilingualem `DE`/`EN` WebUI).
- **Internes Architektur- & KI-Lexikon (`AGENTS.md`, `memory/*`, `architecture/*`, `playbooks/*`) sowie Kommunikation mit dem User:** **Deutsch**.
