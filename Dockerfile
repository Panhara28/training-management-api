# syntax=docker/dockerfile:1
# TMS API — production image (NestJS + Prisma/MySQL).
# Migrations are NOT run on start: infra/deploy-production.sh runs
# `npx prisma migrate deploy` once per rollout, before any server is updated.
ARG NODE_IMAGE=node:22.23.3-bookworm-slim

FROM ${NODE_IMAGE} AS base
RUN apt-get update -y \
 && apt-get install -y --no-install-recommends openssl \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ── Build: full dependency tree, compile TypeScript ──────────────────────────
FROM base AS build
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build

# ── Production dependencies only (prisma CLI kept for migrate deploy) ────────
FROM base AS prod-deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev && npx prisma generate && npm cache clean --force

# ── Runtime ──────────────────────────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production \
    PORT=8090
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY prisma ./prisma
COPY assets ./assets
COPY package.json ./
# Files stay root-owned (read-only for the app); the process runs unprivileged.
USER node
EXPOSE 8090
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||8090)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
# exec form: node is PID 1 and receives SIGTERM (Nest shutdown hooks handle it).
CMD ["node", "dist/src/main"]
