# Stage 1: Build Static Axon Muscle Binary
FROM golang:1.23-alpine AS builder
WORKDIR /src
COPY go.work ./go.work
COPY proto ./proto
COPY agents/axon ./agents/axon
COPY apps/core-gateway ./apps/core-gateway
RUN CGO_ENABLED=0 GOOS=linux go build -C agents/axon -ldflags="-s -w -X main.version=v1.7.0" -o /out/axon ./cmd/axon

# Stage 2: Synapse Muscle Runtime Container
FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata bash curl wget git python3 py3-pip sqlite procps psmisc iproute2
WORKDIR /opt/axon
COPY --from=builder /out/axon /usr/local/bin/axon
COPY containers/muscle/entrypoint.sh /usr/local/bin/entrypoint-muscle.sh
RUN chmod +x /usr/local/bin/axon /usr/local/bin/entrypoint-muscle.sh && \
    mkdir -p /etc/axon /opt/axon/workspaces

VOLUME ["/etc/axon", "/opt/axon/workspaces"]
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD /usr/local/bin/axon status --config-dir /etc/axon >/dev/null 2>&1 || exit 1
ENTRYPOINT ["/usr/local/bin/entrypoint-muscle.sh"]
