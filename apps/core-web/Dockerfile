# Stage 1: Install Dependencies
FROM node:22-alpine AS deps
WORKDIR /app

COPY apps/core-web/package.json apps/core-web/package-lock.json* ./
RUN npm ci

# Stage 2: Build Next.js Application
FROM node:22-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY apps/core-web/ ./

ENV NEXT_TELEMETRY_DISABLED=1
RUN mkdir -p public && npm run build

# Stage 3: Production Runner
FROM node:22-alpine AS runner
WORKDIR /app

RUN apk add --no-cache wget ca-certificates tzdata

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV SYNAPSE_DATA_DIR=/var/lib/synapse

RUN mkdir -p /var/lib/synapse

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./next.config.ts

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/projects || exit 1

CMD ["npm", "run", "start"]
