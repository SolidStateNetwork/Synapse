FROM golang:1.23-alpine AS builder
WORKDIR /src
COPY go.work ./go.work
COPY proto ./proto
COPY agents/axon ./agents/axon
COPY apps/core-gateway ./apps/core-gateway
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -C agents/axon -ldflags="-s -w" -o /out/axon-linux-amd64 ./cmd/axon
RUN CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build -C agents/axon -ldflags="-s -w" -o /out/axon-linux-arm64 ./cmd/axon
RUN CGO_ENABLED=0 GOOS=linux go build -C apps/core-gateway -ldflags="-s -w" -o /out/core-gateway .

FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata wget curl
WORKDIR /app
COPY --from=builder /out/core-gateway /usr/local/bin/core-gateway
COPY --from=builder /out/axon-linux-amd64 /usr/local/bin/axon-linux-amd64
COPY --from=builder /out/axon-linux-arm64 /usr/local/bin/axon-linux-arm64
RUN mkdir -p /var/lib/synapse
VOLUME ["/var/lib/synapse"]
EXPOSE 8081 8443
HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8081/healthz || exit 1
ENTRYPOINT ["/usr/local/bin/core-gateway"]
