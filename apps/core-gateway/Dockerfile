FROM golang:1.23-alpine AS builder
WORKDIR /src
COPY proto ./proto
COPY agents/axon ./agents/axon
COPY apps/core-gateway ./apps/core-gateway
RUN CGO_ENABLED=0 GOOS=linux go build -C agents/axon -ldflags="-s -w" -o /out/axon-linux-amd64 ./cmd/axon
RUN CGO_ENABLED=0 GOOS=linux go build -C apps/core-gateway -ldflags="-s -w" -o /out/core-gateway .

FROM alpine:3.20
RUN apk add --no-cache ca-certificates
WORKDIR /app
COPY --from=builder /out/core-gateway /usr/local/bin/core-gateway
COPY --from=builder /out/axon-linux-amd64 /usr/local/bin/axon-linux-amd64
VOLUME ["/var/lib/synapse"]
EXPOSE 8081 8443
ENTRYPOINT ["/usr/local/bin/core-gateway"]
