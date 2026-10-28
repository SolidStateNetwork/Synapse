# Stage 1: Build Go Core Gateway Binary
FROM golang:1.23-alpine AS builder

RUN apk add --no-cache git ca-certificates

WORKDIR /src
COPY go.work ./
COPY packages/ ./packages/
COPY agents/ ./agents/
COPY apps/core-gateway/ ./apps/core-gateway/

ARG VERSION=v0.3.0
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/core-gateway ./apps/core-gateway

# Stage 2: Minimal Runtime Container
FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata wget

WORKDIR /app
COPY --from=builder /out/core-gateway /usr/local/bin/core-gateway

# Ensure data directory exists for PKI, Enrollment Store, and Vault
RUN mkdir -p /var/lib/synapse

ENV SYNAPSE_DATA_DIR=/var/lib/synapse

EXPOSE 8443 8081

HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8081/api/v1/status || exit 1

ENTRYPOINT ["/usr/local/bin/core-gateway"]
CMD ["--mtls-addr", ":8443", "--http-addr", ":8081"]
