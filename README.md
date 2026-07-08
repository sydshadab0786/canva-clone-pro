# Canva Clone Pro

A production-grade online design platform (a Canva-style editor) built as a
TypeScript monorepo. This repository is developed in **phases** — each phase
ships real, tested, runnable code before the next begins.

> **Status:** Phase 1 complete — monorepo, database, authentication, and the
> web foundation are implemented, typechecked, and unit-tested.

---

## Tech stack

| Layer         | Technology |
|---------------|------------|
| Frontend      | Next.js 15 (App Router), React 19, TypeScript, TailwindCSS, shadcn-style UI, Redux Toolkit, React Query, React Hook Form, Zod, Framer Motion |
| Backend       | NestJS 10, TypeScript, Prisma ORM, PostgreSQL, JWT (access + rotating refresh), Argon2, TOTP 2FA, Passport, Swagger/OpenAPI |
| Infrastructure| Docker Compose — PostgreSQL, Redis, MinIO (S3), Elasticsearch, MailHog |
| Tooling       | pnpm workspaces, Turborepo, Vitest, Prettier |

## Architecture at a glance

A **modular monolith** — NestJS with strict module boundaries (`auth`,
`users`, …). Each module is self-contained and can be extracted into its own
service later without rewriting business logic. See
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full rationale and the
service map.

```
canva-clone-pro/
├── apps/
│   ├── api/          # NestJS backend (modular monolith)
│   │   ├── prisma/   # schema, migrations, seed
│   │   └── src/
│   │       ├── common/    # config, prisma, guards, decorators, filters
│   │       └── modules/   # auth, users, health (feature modules)
│   └── web/          # Next.js 15 frontend
│       └── src/
│           ├── app/       # App Router routes (landing, auth, dashboard)
│           ├── components/# UI primitives + providers
│           └── lib/       # api client, redux store, api hooks
├── docker/           # local infrastructure (docker-compose.yml)
├── docs/             # architecture & further docs
└── packages/         # shared packages (added in later phases)
```

## Prerequisites

- Node.js ≥ 20
- pnpm 9 (`corepack enable && corepack prepare pnpm@9.15.0 --activate`)
- Docker + Docker Compose (for local infrastructure)

## Getting started

```bash
# 1. Install dependencies (all workspaces)
pnpm install

# 2. Copy environment template and adjust as needed
cp .env.example .env

# 3. Start local infrastructure (Postgres, Redis, MinIO, ES, MailHog)
pnpm infra:up

# 4. Generate the Prisma client, run migrations, and seed
pnpm db:generate
pnpm db:migrate
pnpm db:seed          # creates plans + admin@canvaclone.pro / Admin123!Change

# 5. Run everything in dev
pnpm dev              # api on :4000, web on :3000
```

- Web: <http://localhost:3000>
- API: <http://localhost:4000/api>
- API docs (Swagger): <http://localhost:4000/api/docs>
- Mail catcher (MailHog): <http://localhost:8025>
- MinIO console: <http://localhost:9001>

## Verifying Phase 1

```bash
# Backend unit tests (auth: TOTP, backup codes, token rotation & reuse detection)
pnpm --filter @ccp/api test

# Typecheck both apps
pnpm typecheck

# Build the web app
pnpm --filter @ccp/web build
```

## Authentication (implemented)

- Email + password registration with Argon2 hashing
- Email verification tokens (single-use, hashed at rest)
- Login with a JWT **access** token + opaque **refresh** token
- **Refresh-token rotation** with reuse detection (a replayed token revokes
  the whole session family)
- Password reset flow (request + reset, invalidates all sessions)
- **TOTP two-factor authentication** (setup with QR, verify, backup codes)
- Session/device listing, global rate limiting, RBAC guard, security headers

## Roadmap

| Phase | Scope |
|-------|-------|
| 1 ✅ | Setup, architecture, database, authentication, web foundation |
| 2 | Editor engine — canvas, objects, layers, history |
| 3 | Templates, media library, uploads, search |
| 4 | AI features, real-time collaboration |
| 5 | Video editor, animation, timeline |
| 6 | Payments, admin panel, analytics |
| 7 | Optimization, full test suite, deployment |

## License

Proprietary — internal project scaffold.
