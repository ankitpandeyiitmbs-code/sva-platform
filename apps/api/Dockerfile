# SVA Platform API — Fly.io Dockerfile
# Builds the Fastify API from the monorepo at apps/api

FROM node:20-slim

# OpenSSL is required by Prisma client at runtime
RUN apt-get update -y && \
    apt-get install -y --no-install-recommends openssl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ── Step 1: Install dependencies ──────────────────────
# Copy all workspace package.json files so npm ci can resolve the workspace graph
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/db/package.json ./packages/db/
COPY packages/types/package.json ./packages/types/
COPY packages/ui/package.json ./packages/ui/

# Copy prisma schema before install (apps/api's postinstall runs `prisma generate`,
# we skip scripts and run it explicitly below to avoid any web postinstall noise)
COPY apps/api/prisma ./apps/api/prisma

# Install workspace dependencies (no postinstall scripts yet)
RUN npm ci --ignore-scripts

# ── Step 2: Generate Prisma client ────────────────────
RUN cd apps/api && npx prisma generate

# ── Step 3: Copy source and build ─────────────────────
COPY apps/api ./apps/api
COPY packages ./packages

RUN cd apps/api && npm run build

# ── Runtime ───────────────────────────────────────────
ENV NODE_ENV=production
ENV PORT=4000

# Fly health check hits /health — see fly.toml
EXPOSE 4000

WORKDIR /app/apps/api
CMD ["node", "dist/server.js"]
