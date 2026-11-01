# 🤖 CLAUDE.md – Mandatory AI Engineering Directive (SolidStateNetwork/Synapse)

> **[CRITICAL SYSTEM DIRECTIVE FOR ALL AI AGENTS]**  
> Dieses Repository (`SolidStateNetwork/Synapse`) ist ein **öffentliches Projekt (Public Repository)** und wird über das zentrale Architektur-Lexikon und Langzeitgedächtnis (`memory/`) gesteuert.  
> **Keine Code- oder Architektur-Änderung ohne vorheriges Lesen und anschließendes Aktualisieren dieses Lexikons!**

---

## Verbindliches 5-Schritte-Pflichtprotokoll (Siehe [`AGENTS.md`](./AGENTS.md))

1. **READ FIRST (Kontext laden):** Lies vor jeder Aufgabe [`AGENTS.md`](./AGENTS.md), [`memory/PROJECT_STATE.md`](./memory/PROJECT_STATE.md), [`memory/BLACKBOX.md`](./memory/BLACKBOX.md) und [`memory/MILESTONES.md`](./memory/MILESTONES.md).
2. **CHECK STANDARDS (Architektur-Konformität):** Halte dich strikt an [`architecture/00-product-vision.md`](./architecture/00-product-vision.md) bis [`architecture/04-resilience-security-and-ota.md`](./architecture/04-resilience-security-and-ota.md).
3. **CODE & COVERAGE GATES:**
   - Jede Go-Datei `< 500` Zeilen, jede TS/TSX-Datei `< 600` Zeilen, `0` `any`-Typen.
   - Go Coverage `>= 85 %` über alle 11 Pakete, TypeScript Line Coverage `>= 90 %`.
4. **PUBLIC REPO CLEAN-ROOM GUARDRAILS:**
   - **Zero-Secret-Policy:** Niemals API-Tokens, Private Keys (`*.key`), `Secrets.enc` oder `.env`-Dateien committen.
   - **Zero-Personal-Data:** Niemals lokale Benutzerpfade (`/home/<user>/...`), echte Server-IPs oder private Domains ins öffentliche Repository schreiben.
5. **WRITE BACK & PUSH:** Aktualisiere nach **jedem** abgeschlossenen Schritt sofort:
   - [`memory/PROJECT_STATE.md`](./memory/PROJECT_STATE.md)
   - [`memory/MILESTONES.md`](./memory/MILESTONES.md)
   - [`memory/BLACKBOX.md`](./memory/BLACKBOX.md) (neuer `[BB-XXX]` Eintrag ganz oben)
   - Führe anschließend `git commit` und `git push origin main` aus.
