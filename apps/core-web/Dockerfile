FROM node:22-alpine AS builder
WORKDIR /workspace
COPY proto ./proto
COPY cartridges ./cartridges
COPY apps/core-web ./apps/core-web
WORKDIR /workspace/apps/core-web
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm ci && npm run build

FROM node:22-alpine AS runner
RUN apk add --no-cache git curl wget ca-certificates tzdata
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV SYNAPSE_VAULT_DIR=/var/lib/synapse/projects
ENV SYNAPSE_CARTRIDGES_DIR=/app/cartridges
COPY --from=builder /workspace/cartridges ./cartridges
COPY --from=builder /workspace/apps/core-web/.next/standalone ./
COPY --from=builder /workspace/apps/core-web/.next/static ./.next/static
VOLUME ["/var/lib/synapse"]
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/projects || exit 1
CMD ["node", "server.js"]
