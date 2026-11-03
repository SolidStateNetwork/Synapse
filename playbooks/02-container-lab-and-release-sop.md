# 🚀 Playbook 02 — Local 2-Container Lab & Release Rollout (SOP)

This playbook describes the workflow for live testing in the local **2-Container Lab (`containers/`)** and the standardized GitHub release process.

---

## 1. Local 2-Container Lab (`containers/manage.sh`)

Synapse includes an isolated 2-container environment under [`containers/`](../containers/):
- **Container 1 (`synapse-core` / `synapse-core-container`):** Runs `core-gateway` (`:8081` HTTP, `:8443` mTLS) and the Next.js 15 standalone WebUI (`:3000`).
- **Container 2 (`synapse-muscle` / `synapse-muscle-container`):** Runs the `axon` agent (`node_id: "local-muscle"`, `TIER_1_UNLEASHED`), automatically requests a one-time enrollment token from the Core, and connects over mTLS 1.3 (`:8443`).

### Key Commands:
```bash
# Build, restart, and verify live container health
bash containers/manage.sh restart

# Inspect status of Core-Gateway (:8081/healthz), WebUI (:3000/api/debug) & Muscle nodes
bash containers/manage.sh status

# Tail container logs
bash containers/manage.sh logs

# Stop containers
bash containers/manage.sh stop
```

---

## 2. Single-Source Version Bump (Release Preparation)

When preparing a new release (`vX.Y.Z`), synchronize all version references across the repository:
1. `apps/core-web/src/lib/version.ts` (`SYNAPSE_SEMVER = "X.Y.Z"`)
2. `apps/core-web/package.json` & `packages/mcp-server/package.json` (`"version": "X.Y.Z"`)
3. `apps/core-gateway/main.go` & `apps/core-gateway/main_test.go` (`"version": "vX.Y.Z"`)
4. `agents/axon/cmd/axon/main.go` (`version = "vX.Y.Z"`)
5. `containers/core/Dockerfile`, `containers/muscle/Dockerfile`, `containers/docker-compose.yml` & `containers/manage.sh`
6. `scripts/deploy-core.sh`, `SECURITY.md`, `CHANGELOG.md`, and version assertions in `apps/core-web/src/__tests__/api-routes.test.ts`
7. `memory/PROJECT_STATE.md`, `memory/MILESTONES.md`, and `memory/BLACKBOX.md` (`[BB-XXX]`)

---

## 3. Clean-Room Check, Git Tag, Container Rollout & CI Verification

```bash
# 1. Run Pre-Commit & Lexicon Clean-Room verification
bash .githooks/pre-commit
python3 playbooks/scripts/verify-lexicon-completeness.py

# 2. Commit & push annotated release tag
git add -A
git commit -m "feat(vX.Y.Z): <concise English release summary>"
git tag -a vX.Y.Z -m "Synapse vX.Y.Z — <Release Title>"
git push origin main
git push origin vX.Y.Z

# 3. Update local containers to vX.Y.Z
bash containers/manage.sh restart

# 4. Verify GitHub Actions CI & Release workflows complete with 0 errors
```
