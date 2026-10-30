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
- **Node.js 22+** & `npm`

### Running Tests & Building
```bash
# 1. Run all Go unit & E2E tests (Guardrails, Sentinel PTY, Atomic FS, mTLS PKI)
CGO_ENABLED=0 go test -v ./proto/... ./agents/axon/... ./apps/core-gateway/...

# 2. Build static binaries
CGO_ENABLED=0 go build -C agents/axon -o ../../bin/axon ./cmd/axon
CGO_ENABLED=0 go build -C apps/core-gateway -o ../../bin/core-gateway .

# 3. Install, test & build Next.js Studio
npm --prefix apps/core-web ci
npm --prefix apps/core-web test
npm --prefix apps/core-web run build
```

## Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):
- `feat(axon): ...`
- `feat(core-web): ...`
- `feat(core-gateway): ...`
- `fix(...): ...`
- `arch(...): ...`
- `chore(...): ...`
