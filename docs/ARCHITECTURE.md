# Architecture

This document explains the structural decisions behind Canva Clone Pro and how
the pieces fit together.

## Guiding principles

1. **Ship runnable code every phase.** Each phase compiles, typechecks, and has
   tests before the next begins. No placeholder code.
2. **Boundaries over process count.** We enforce strict module boundaries now so
   services can be extracted later — without paying day-one operational cost.
3. **Security by default.** Auth, validation, rate limiting, and secure headers
   are wired in from the first endpoint, not bolted on.

## Why a modular monolith (not 12 microservices on day one)

The brief lists a dozen "services" (auth, users, projects, editor, media, ai,
payments, notifications, search, analytics…). Running each as a separate
deployable from the start would mean twelve pipelines, twelve dashboards,
cross-service transactions, and network hops between things that currently share
a database — an enormous operational tax for a codebase with one team.

Instead we build a **modular monolith**: one NestJS process, but each domain is
an isolated Nest module with its own controllers, services, and DTOs, talking to
others only through well-defined provider interfaces. This gives us:

- **Extractability** — a module's public surface is already a seam. Promoting
  `media` or `ai` to its own service later is a deploy change, not a rewrite.
- **Transactional simplicity** — related writes stay in one database and one
  transaction until scale actually forces a split.
- **Fast iteration** — one repo, one run command, one debugger.

The logical service map from the brief maps onto modules:

```
Frontend (Next.js)
      │  REST + (later) WebSocket
      ▼
NestJS API  ──►  Global guards: JwtAuth → Throttler → Roles
      ├── modules/auth          JWT, refresh rotation, 2FA, OAuth (phase 1+)
      ├── modules/users         profile, sessions/devices
      ├── modules/projects      designs, folders, versions        (phase 2)
      ├── modules/editor        document ops, autosave            (phase 2)
      ├── modules/media         uploads → S3/MinIO, transforms    (phase 3)
      ├── modules/search        Elasticsearch indexing            (phase 3)
      ├── modules/ai            generation, background jobs        (phase 4)
      ├── modules/collab        realtime, presence (Socket.io)     (phase 4)
      ├── modules/payments      Stripe/PayPal/Razorpay             (phase 6)
      └── modules/admin         users, analytics, feature flags    (phase 6)
      │
      ├── PostgreSQL (Prisma)   system of record
      ├── Redis                 cache, sessions, BullMQ queues
      ├── Object storage (S3)   media assets
      └── Elasticsearch         search index
```

## Authentication design

### Token model

- **Access token** — short-lived (15 min) JWT, stateless, carries `sub`,
  `email`, `role`. Verified on every request by `JwtStrategy`, which also
  re-checks the user is still active (covers mid-token suspension).
- **Refresh token** — long-lived (14 d) opaque random string. Only its
  SHA-256 hash is stored (`Session.refreshTokenHash`); the raw value never
  touches the database.

### Refresh-token rotation with reuse detection

On refresh, the presented token's session is **revoked** and a new pair issued.
If a *already-revoked* token is presented again (classic theft/replay signal),
we revoke **every** session for that user and force re-login. This is the OWASP
recommended pattern and is covered by `token.service.spec.ts`.

### Two-factor authentication

TOTP (RFC 6238), compatible with Google Authenticator / Authy. Setup issues an
`otpauth://` URI + QR; enabling generates ten single-use, hashed backup codes.
The 2FA secret is isolated in `TwoFactorService` so encryption-at-rest can be
added at one boundary.

### Defense in depth

| Concern            | Mechanism |
|--------------------|-----------|
| Password storage   | Argon2id |
| Brute force        | `@nestjs/throttler` (120 req/min/IP) + generic error messages |
| User enumeration   | Constant-time-ish login (dummy hash), non-committal reset responses |
| Input validation   | `class-validator` DTOs + global `ValidationPipe` (whitelist + forbid unknown) |
| Transport headers  | `helmet`, CORS allow-list, secure Next.js headers |
| Authorization      | Global `JwtAuthGuard` + `RolesGuard` with `@Public()`/`@Roles()` |
| Auditability       | `AuditLog` rows for security-relevant actions |

## Data model

See [`apps/api/prisma/schema.prisma`](../apps/api/prisma/schema.prisma). The
schema is normalized (3NF), uses `cuid()` identifiers, soft-deletes recoverable
entities (`deletedAt` on projects/folders/assets) for the Trash feature, and
indexes every foreign key that participates in a query. OAuth identities live in
a dedicated `Account` table so users can link multiple providers without column
bloat on `User`.

## Frontend architecture

- **App Router** with route groups: `(auth)` and `(dashboard)` isolate layouts.
- **State**: Redux Toolkit for session/user state; React Query for server state
  (fetching, caching, retries). The store is created per-mount via a ref to keep
  SSR requests isolated.
- **API client** (`lib/api-client.ts`): a typed fetch wrapper that attaches the
  in-memory access token and performs a single-flight refresh-and-retry on 401.
  The refresh token store is isolated so swapping to httpOnly cookies is a
  one-file change.
- **Design system**: CSS-variable design tokens drive light/dark themes; UI
  primitives follow the shadcn convention (`cn()` + `cva` variants).

## Testing strategy

| Level        | Tooling | Phase 1 coverage |
|--------------|---------|------------------|
| Unit         | Vitest  | TOTP verify, backup codes, token issue/rotate/reuse |
| Integration  | Vitest + Supertest | auth endpoints (phase 1 follow-up) |
| E2E          | Playwright / Cypress | added in phase 7 |
| Load         | k6 | added in phase 7 |
