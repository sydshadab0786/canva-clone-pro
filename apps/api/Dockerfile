# syntax=docker/dockerfile:1
# ── Canva Clone Pro API image (build context = repo root) ───────────
# Multi-stage: install → build → prune → slim runtime.

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

# ── Dependencies (with native build toolchain for argon2) ───────────
FROM base AS deps
RUN apk add --no-cache python3 make g++
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile

# ── Build + generate Prisma client, then prune to prod deps ─────────
FROM deps AS build
COPY apps/api apps/api
RUN pnpm --filter @ccp/api prisma:generate \
 && pnpm --filter @ccp/api build \
 && pnpm --filter @ccp/api --prod deploy /prod/api

# ── Runtime ─────────────────────────────────────────────────────────
FROM base AS runtime
ENV NODE_ENV=production
# argon2's native module needs libstdc++ at runtime.
RUN apk add --no-cache libstdc++ && addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /prod/api /app
USER app
EXPOSE 4000
# Apply migrations, then start. In multi-instance setups run migration as a
# one-shot job instead (see docker-compose / k8s notes in DEPLOYMENT.md).
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
