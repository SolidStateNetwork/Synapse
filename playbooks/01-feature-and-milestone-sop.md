# 📋 Playbook 01 – Feature- & Meilenstein-Entwicklung (SOP)

Dieses Playbook definiert den verbindlichen Standard-Ablauf (Standard Operating Procedure) für jede Erweiterung von **Synapse (`SolidStateNetwork/Synapse`)**.

---

## 1. Vorab-Check (Read First)
1. Lies [`AGENTS.md`](../AGENTS.md), [`memory/PROJECT_STATE.md`](../memory/PROJECT_STATE.md), [`memory/BLACKBOX.md`](../memory/BLACKBOX.md) und [`memory/MILESTONES.md`](../memory/MILESTONES.md).
2. Prüfe die passende Architektur-Spezifikation unter [`architecture/`](../architecture/) (`00` bis `04`).

---

## 2. Architektur- & Code-Regeln während der Implementierung

1. **Strikte Dateigrößen-Disziplin:**
   - Keine Go-Datei (`*.go`) darf `500` Zeilen erreichen (Ziel: `< 490` Zeilen).
   - Keine TypeScript-/React-Datei (`*.ts`, `*.tsx`) darf `600` Zeilen erreichen (Ziel: `< 585` Zeilen).
   - Neue Orchestrator-Tools gehören in dedizierte, fokussierte Module unter `apps/core-web/src/lib/orchestrator/<domain>Tools.ts` (`< 220` Zeilen) und werden in `extendedToolSchemas.ts` (`< 300` Zeilen), `coreTools.ts`, `autonomousFallback.ts` und `/api/mcp/route.ts` registriert.
2. **Pre-Flight Time-Machine Checkpoints:**
   - Jede neue mutierende Infrastruktur-Aktion muss vorab `recordCheckpoint(projectId, ...)` aus `@/lib/checkpoints` aufrufen und `checkpoint_id` im Ergebnis sowie im UI-Status-Banner zurückgeben.
3. **Ephemeral PTY Sessions:**
   - Neue One-Shot-PTY-Aufrufe müssen entweder ein bestehendes ephemerales Session-Präfix (`IsEphemeralSessionID` in `agents/axon/internal/pty/pty_discovery.go`) nutzen oder das neue Präfix dort inkl. Unit-Test in `pty_test.go` registrieren.
4. **0 `any`-Typen & Public Clean-Room:**
   - Verwende strikte TypeScript-Interfaces. Schreibe niemals echte Server-IPs, lokale Benutzerpfade (`/home/<user>`) oder Geheimnisse in Code oder Tests.

---

## 3. Lokale Pflicht-Verifikation vor jedem Commit

Führe vor jedem Commit die folgenden Prüfungen aus:

```bash
export LC_ALL=C PATH="${HOME}/.local/go/bin:${PATH}"

# 1. Dateigrößen-Audit (< 500 Go / < 600 TS)
find proto agents/axon apps/core-gateway -name "*.go" -exec wc -l {} + | grep -v " total$" | sort -nr | head -n 5
find apps/core-web/src -name "*.ts" -o -name "*.tsx" | xargs wc -l | grep -v " total$" | sort -nr | head -n 5

# 2. Go Unit- & Race-Tests (>= 85.0 % Statement-Coverage in allen 11 Paketen)
go test -race -cover ./proto/... ./agents/axon/... ./apps/core-gateway/...

# 3. TypeScript Strict Typecheck & Coverage-Suite (>= 90.0 % Line-Coverage)
cd apps/core-web
npx tsc --noEmit
npm test -- --experimental-test-coverage
```
