## Summary
Briefly describe the changes introduced by this Pull Request.

## Checklist
- [ ] **Clean Open-Source Hygiene:** Zero private IP addresses, hostnames, tokens, or local user paths (`git grep` clean).
- [ ] **Modularization Gate:** Every `.ts`, `.tsx`, and `.go` file remains strictly `< 600` lines.
- [ ] **Resilience & Fault Tolerance:** Network calls use `safeFetchJson` and state persistence uses atomic `.bak` writes (`atomicWriteJsonSync`).
- [ ] **Automated Verification:**
  - [ ] `go test -v ./proto/... ./agents/axon/... ./apps/core-gateway/...` passes
  - [ ] `cd apps/core-web && npm test && npm run build` passes
