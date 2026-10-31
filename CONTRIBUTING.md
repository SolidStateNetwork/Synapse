# Contributing to Synapse

Thank you for contributing to **Synapse**!

## Monorepo Layout

```text
Synapse/
├── proto/                  # Wire protocol definitions (tunnel.proto, Go & TypeScript bindings)
├── agents/
│   └── axon/               # "The Muscle" — Single-binary Go remote execution agent (CGO_ENABLED=0)
├── apps/
│   ├── core-gateway/       # "The Brain (Hub)" — Go mTLS 1.3 CA, Yamux multiplexer & live-preview proxy
│   └── core-web/           # "The Brain (Studio)" — Next.js 15 App Router UI, Vault & AI Orchestrator
└── cartridges/             # Modular DevOps Rule Cartridges (*.md with YAML frontmatter)
```

## Local Development Setup

### Prerequisites
- **Go 1.23+**
- **Node.js 22+ / 24 LTS** & `npm`

### Running Tests & Building
```bash
# 1. Run all Go unit & concurrency tests (-race) with >= 85% per-package coverage gate
go test -v -race -cover ./proto/... ./agents/axon/... ./apps/core-gateway/...

# 2. Build static binaries
CGO_ENABLED=0 go build -C agents/axon -o ../../bin/axon ./cmd/axon
CGO_ENABLED=0 go build -C apps/core-gateway -o ../../bin/core-gateway .

# 3. Install, strict type-check (0 any), test & build Next.js Studio
npm --prefix apps/core-web ci
npx --prefix apps/core-web tsc -p apps/core-web/tsconfig.json --noEmit
npm --prefix apps/core-web test
npm --prefix apps/core-web run build
```

## Code Quality & Modularization Gates
- **File Size Limits**: Every Go file (`*.go`) must stay under `< 500` lines; every TypeScript/React file (`*.ts`, `*.tsx`) must stay under `< 600` lines.
- **Strict Typing**: `0` occurrences of explicit `any` in `apps/core-web/src` and clean `tsc --noEmit`.
- **Coverage Gate**: Every Go package in `./proto/...`, `./agents/axon/...`, and `./apps/core-gateway/...` must maintain `>= 85%` statement coverage with `-race` enabled.
- **Shell Script Verification**: Installer and HA scripts (`scripts/*.sh`) must pass `bash -n`, `sh -n`, and `shellcheck -S warning`.

## Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):
- `feat(axon): ...`
- `feat(core-web): ...`
- `feat(core-gateway): ...`
- `fix(...): ...`
- `arch(...): ...`
- `chore(...): ...`
