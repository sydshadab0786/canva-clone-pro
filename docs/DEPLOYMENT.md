# Deployment Guide

This guide covers running Canva Clone Pro in production with Docker, plus notes
for Kubernetes, monitoring, and backups.

## Overview

```
                       ┌─────────── Nginx (:80/:443) ───────────┐
   Browser  ──────────►│  /  → web (Next.js :3000)              │
                       │  /api        → api (NestJS :4000)      │
                       │  /socket.io  → api (WebSocket)         │
                       └───────────────────────────────────────┘
                                     │
        ┌──────────────┬─────────────┼──────────────┬───────────────┐
     Postgres        Redis         MinIO (S3)   Elasticsearch    Prometheus
                                                                     │
                                                                  Grafana
```

The API is a **modular monolith** — one image, all feature modules. Scale it
horizontally behind Nginx; move a module to its own service only when a real
bottleneck demands it (the module boundaries make that a deploy change, not a
rewrite — see `ARCHITECTURE.md`).

## 1. Prerequisites

- Docker Engine 24+ and Docker Compose v2
- A domain + TLS certificate for production (Let's Encrypt / Cloudflare)
- Strong secrets for `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (`openssl rand -base64 48`)

## 2. Configure environment

```bash
cp .env.example .env
# Edit .env: set strong JWT secrets, DB/Redis creds, S3 keys, provider keys.
# Optional integrations activate only when their keys are present:
#   ANTHROPIC_API_KEY   → real AI (else deterministic local generators)
#   STRIPE_SECRET_KEY   → real payments (else mock activation)
#   ELASTICSEARCH_NODE  → fuzzy search (else Postgres fallback)
```

Set `APP_ORIGIN` (e.g. `https://app.example.com`) so the web image is built
with the correct public API/WS URLs and CORS is locked to your origin.

## 3. Bring up the stack

```bash
# From the repo root
docker compose -f docker/docker-compose.prod.yml up -d --build
```

This builds the `api` and `web` images, starts Postgres/Redis/MinIO/Elasticsearch,
runs Nginx, and starts Prometheus + Grafana. The API container runs
`prisma migrate deploy` on boot.

Seed baseline data (plans, templates, admin user) once:

```bash
docker compose -f docker/docker-compose.prod.yml exec api npx tsx prisma/seed.ts
```

- App: `http://localhost` (or your domain)
- API docs: `http://localhost/api/docs`
- Grafana: `http://localhost:3001` (admin / `GRAFANA_PASSWORD`)
- Prometheus: `http://localhost:9090`
- MinIO console: `http://localhost:9001`

Default admin: `admin@canvaclone.pro` / `Admin123!Change` — **change immediately**.

## 4. TLS

Terminate TLS at Nginx. Add a `443` server block to `docker/nginx/nginx.conf`,
mount your certs, and redirect `80 → 443`. With Cloudflare in front you can also
use Flexible/Full TLS and keep Nginx on `80` behind it.

## 5. Database migrations

- Single instance: the API applies migrations on boot (`prisma migrate deploy`).
- Multiple instances / zero-downtime: disable the boot migration and run it as a
  one-shot job **before** rolling out new API replicas:

  ```bash
  docker compose -f docker/docker-compose.prod.yml run --rm api npx prisma migrate deploy
  ```

## 6. Monitoring

- The API exposes Prometheus metrics at `/api/v1/metrics` (default Node metrics
  + `http_requests_total` + `http_request_duration_seconds`).
- Prometheus scrapes it per `docker/prometheus/prometheus.yml`.
- Import a Node.js / HTTP dashboard into Grafana and point it at Prometheus.
- Liveness/readiness: `GET /api/v1/health` (checks the DB).

## 7. Backups

- **Postgres**: schedule `pg_dump` (or use a managed DB with PITR).
  ```bash
  docker compose -f docker/docker-compose.prod.yml exec postgres \
    pg_dump -U ccp canva_clone_pro | gzip > backup-$(date +%F).sql.gz
  ```
- **Object storage**: replicate the MinIO bucket (`mc mirror`) or use versioned
  S3 in production.

## 8. Kubernetes (notes)

The images are stateless and 12-factor, so the Compose services map directly to
Deployments:

- `api` Deployment (N replicas) + Service; migrations as a `Job`/init container.
- `web` Deployment + Service.
- Ingress replaces Nginx (same routing: `/`, `/api`, `/socket.io`).
- Postgres/Redis/Elasticsearch as managed services or StatefulSets.
- For multi-replica real-time collaboration, add the **Redis Socket.io adapter**
  so presence/cursor events fan out across pods (the gateway is written against
  a swappable presence interface for exactly this).
- Config via `ConfigMap` + `Secret`; scale with an HPA on CPU or request latency.

## 9. CI/CD

`.github/workflows/ci.yml` runs on every push/PR:

1. **verify** — install, Prisma generate, typecheck, unit tests, builds.
2. **e2e** — Playwright smoke tests (installs browsers with system deps).
3. **docker** — builds both images (no push).

Extend the `docker` job with `docker/login-action` + `push: true` to publish to
your registry, then trigger a rollout.
