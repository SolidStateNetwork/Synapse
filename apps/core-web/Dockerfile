FROM node:22-alpine AS builder
WORKDIR /workspace
COPY proto ./proto
COPY cartridges ./cartridges
COPY apps/core-web ./apps/core-web
WORKDIR /workspace/apps/core-web
RUN npm ci && npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV SYNAPSE_VAULT_DIR=/var/lib/synapse/projects
ENV SYNAPSE_CARTRIDGES_DIR=/app/cartridges
COPY --from=builder /workspace/cartridges ./cartridges
COPY --from=builder /workspace/apps/core-web/.next/standalone ./
COPY --from=builder /workspace/apps/core-web/.next/static ./apps/core-web/.next/static
VOLUME ["/var/lib/synapse"]
EXPOSE 3000
CMD ["node", "apps/core-web/server.js"]
