# Stage 1: Build Go Core-Gateway & Axon Binaries
FROM golang:1.23-alpine AS go-builder
WORKDIR /src
COPY go.work ./go.work
COPY proto ./proto
COPY agents/axon ./agents/axon
COPY apps/core-gateway ./apps/core-gateway
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -C agents/axon -ldflags="-s -w -X main.version=v2.4.0" -o /out/axon-linux-amd64 ./cmd/axon
RUN CGO_ENABLED=0 GOOS=linux go build -C apps/core-gateway -ldflags="-s -w -X main.version=v2.4.0" -o /out/core-gateway .

# Stage 2: Build Next.js 15 Core-Web Standalone Bundle
FROM node:22-alpine AS web-builder
WORKDIR /workspace
COPY proto ./proto
COPY cartridges ./cartridges
COPY apps/core-web ./apps/core-web
WORKDIR /workspace/apps/core-web
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm ci && npm run build

# Stage 3: Unified Synapse Core Container (Gateway :8081/:8443 + WebUI :3000)
FROM node:22-alpine
RUN apk add --no-cache ca-certificates tzdata curl wget git bash
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV SYNAPSE_DATA_DIR=/var/lib/synapse
ENV SYNAPSE_VAULT_DIR=/var/lib/synapse/projects
ENV SYNAPSE_CARTRIDGES_DIR=/app/cartridges
ENV CORE_GATEWAY_URL=http://127.0.0.1:8081
ENV CORE_GATEWAY_INTERNAL_URL=http://127.0.0.1:8081

COPY --from=go-builder /out/core-gateway /usr/local/bin/core-gateway
COPY --from=go-builder /out/axon-linux-amd64 /app/bin/axon-linux-amd64
COPY --from=web-builder /workspace/cartridges ./cartridges
COPY --from=web-builder /workspace/apps/core-web/.next/standalone ./
COPY --from=web-builder /workspace/apps/core-web/.next/static ./.next/static
COPY containers/core/entrypoint.sh /usr/local/bin/entrypoint-core.sh
RUN chmod +x /usr/local/bin/entrypoint-core.sh && mkdir -p /var/lib/synapse/projects

VOLUME ["/var/lib/synapse"]
EXPOSE 3000 8081 8443
HEALTHCHECK --interval=10s --timeout=5s --start-period=8s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8081/healthz && wget -qO- http://127.0.0.1:3000/api/projects || exit 1
ENTRYPOINT ["/usr/local/bin/entrypoint-core.sh"]
