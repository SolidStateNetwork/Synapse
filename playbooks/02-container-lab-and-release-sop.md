# 🚀 Playbook 02 – Lokales 2-Container-Labor & Release-Rollout (SOP)

Dieses Playbook beschreibt den Ablauf für Live-Tests im lokalen **2-Container-Labor (`containers/`)** sowie den standardisierten Release-Prozess auf GitHub.

---

## 1. Lokales 2-Container-Labor (`containers/manage.sh`)

Synapse enthält unter [`containers/`](../containers/) eine vollständig isolierte 2-Container-Umgebung:
- **Container 1 (`synapse-core` / `synapse-core-container`):** Führt `core-gateway` (`:8081` HTTP, `:8443` mTLS) und das Next.js 15 Standalone-WebUI (`:3000`) aus.
- **Container 2 (`synapse-muscle` / `synapse-muscle-container`):** Führt den `axon`-Agenten (`node_id: "local-muscle"`, `TIER_1_UNLEASHED`) aus, holt sich automatisch ein Einmal-Enrollment-Token vom Core und verbindet sich über mTLS 1.3 (`:8443`).

### Wichtige Befehle:
```bash
# Container bauen, neu starten und Live-Health prüfen
bash containers/manage.sh restart

# Status von Core-Gateway (:8081/healthz), WebUI (:3000/api/debug) & Muscle-Nodes prüfen
bash containers/manage.sh status

# Container-Logs einsehen
bash containers/manage.sh logs

# Container stoppen
bash containers/manage.sh stop
```

---

## 2. Single-Source Versions-Erhöhung (Release-Vorbereitung)

Bei einem neuen Release (`vX.Y.Z`) müssen alle Versions-Referenzen synchron angehoben werden:
1. `apps/core-web/src/lib/version.ts` (`SYNAPSE_SEMVER = "X.Y.Z"`)
2. `apps/core-web/package.json` (`"version": "X.Y.Z"`)
3. `apps/core-gateway/main.go` & `apps/core-gateway/main_test.go` (`"version": "vX.Y.Z"`)
4. `agents/axon/cmd/axon/main.go` (`version = "vX.Y.Z"`)
5. `containers/core/Dockerfile`, `containers/muscle/Dockerfile`, `containers/docker-compose.yml` & `containers/manage.sh`
6. `scripts/deploy-core.sh`, `SECURITY.md`, `CHANGELOG.md` sowie die Versions-Assertions in `apps/core-web/src/__tests__/api-routes.test.ts`
7. `memory/PROJECT_STATE.md`, `memory/MILESTONES.md` und `memory/BLACKBOX.md` (`[BB-XXX]`)

---

## 3. Clean-Room-Check, Git-Tag, Container-Rollout & CI-Überwachung

```bash
# 1. Pre-Commit & Clean-Room Check ausführen
bash .githooks/pre-commit

# 2. Commit & Annotated Tag erstellen und pushen
git add -A
git commit -m "feat(vX.Y.Z): <prägnante englische Release-Beschreibung>"
git tag -a vX.Y.Z -m "Synapse vX.Y.Z — <Release-Titel>"
git push origin main
git push origin vX.Y.Z

# 3. Lokale Container live auf vX.Y.Z aktualisieren
bash containers/manage.sh restart

# 4. GitHub Actions CI & Release Workflows überwachen (Ziel: 100 % grün, 0 Annotationen)
gh run list --limit 4
```
