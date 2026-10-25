FROM golang:1.23-alpine AS builder
WORKDIR /src
COPY proto ./proto
COPY apps/core-gateway ./apps/core-gateway
WORKDIR /src/apps/core-gateway
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /out/core-gateway .

FROM alpine:3.20
RUN apk add --no-cache ca-certificates
WORKDIR /app
COPY --from=builder /out/core-gateway /usr/local/bin/core-gateway
VOLUME ["/var/lib/synapse"]
EXPOSE 8081 8443
ENTRYPOINT ["/usr/local/bin/core-gateway"]
