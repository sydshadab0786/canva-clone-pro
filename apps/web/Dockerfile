# syntax=docker/dockerfile:1
# ── Canva Clone Pro Web image (build context = repo root) ───────────
# Uses Next.js standalone output for a small runtime image.

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY apps/web apps/web
# NEXT_PUBLIC_* are inlined at build time; override via build args in CI.
ARG NEXT_PUBLIC_API_URL=http://localhost:4000/api
ARG NEXT_PUBLIC_WS_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
RUN pnpm --filter @ccp/web build

FROM base AS runtime
ENV NODE_ENV=production
RUN addgroup -S app && adduser -S app -G app
# Standalone server + static assets (monorepo layout).
COPY --from=build --chown=app:app /app/apps/web/.next/standalone ./
COPY --from=build --chown=app:app /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=app:app /app/apps/web/public ./apps/web/public
USER app
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
