#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────
# Start the whole Canva Clone Pro stack locally (WSL / bare Linux).
#
#   ./scripts/dev-up.sh          start everything
#   ./scripts/dev-up.sh --stop   stop the app servers
#
# Brings up: PostgreSQL, MinIO (S3), the NestJS API, and the Next.js web app.
# Idempotent — anything already running is left alone.
# ────────────────────────────────────────────────────────────────
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="${ROOT}/.logs"
mkdir -p "$LOG_DIR"

DB_URL="postgresql://ccp:ccp_password@localhost:5432/canva_clone_pro?schema=public"

green() { printf '\033[32m%s\033[0m\n' "$1"; }
red()   { printf '\033[31m%s\033[0m\n' "$1"; }

up() { curl -sf "$1" >/dev/null 2>&1; }

kill_port() {
  local port="$1"
  local pids
  pids=$(ss -lptn "sport = :${port}" 2>/dev/null | grep -oP 'pid=\K[0-9]+' | sort -u)
  for p in $pids; do kill -9 "$p" 2>/dev/null; done
}

if [[ "${1:-}" == "--stop" ]]; then
  kill_port 3000; kill_port 4000
  green "Stopped web (:3000) and api (:4000). Postgres/MinIO left running."
  exit 0
fi

# ── PostgreSQL ──────────────────────────────────────────────────
if pg_isready -h localhost -U ccp -d canva_clone_pro >/dev/null 2>&1; then
  green "postgres  :5432  already up"
else
  echo "starting postgres (needs sudo)..."
  sudo service postgresql start >/dev/null 2>&1
  until pg_isready -h localhost -U ccp -d canva_clone_pro >/dev/null 2>&1; do sleep 1; done
  green "postgres  :5432  started"
fi

# ── MinIO (S3-compatible object storage) ────────────────────────
if up http://localhost:9000/minio/health/live; then
  green "minio     :9000  already up"
else
  echo "starting minio..."
  mkdir -p "$HOME/minio-data"
  MINIO_ROOT_USER=minioadmin MINIO_ROOT_PASSWORD=minioadmin \
    setsid nohup minio server "$HOME/minio-data" --address :9000 --console-address :9001 \
    > "$LOG_DIR/minio.log" 2>&1 < /dev/null &
  disown
  until up http://localhost:9000/minio/health/live; do sleep 1; done
  green "minio     :9000  started (console :9001)"
fi

# ── API ─────────────────────────────────────────────────────────
if up http://localhost:4000/api/v1/health; then
  green "api       :4000  already up"
else
  echo "starting api..."
  (cd "$ROOT/apps/api" && DATABASE_URL="$DB_URL" setsid nohup npx nest start \
    > "$LOG_DIR/api.log" 2>&1 < /dev/null &)
  until up http://localhost:4000/api/v1/health; do sleep 2; done
  green "api       :4000  started"
fi

# ── Web ─────────────────────────────────────────────────────────
if up http://localhost:3000; then
  green "web       :3000  already up"
else
  echo "starting web (first compile takes ~40s)..."
  (cd "$ROOT/apps/web" && setsid nohup npx next dev -p 3000 \
    > "$LOG_DIR/web.log" 2>&1 < /dev/null &)
  until up http://localhost:3000; do sleep 2; done
  green "web       :3000  started"
fi

echo
green "Stack is up:"
echo "  App        http://localhost:3000"
echo "  API docs   http://localhost:4000/api/docs"
echo "  MinIO      http://localhost:9001  (minioadmin / minioadmin)"
echo
echo "  Login      admin@canvaclone.pro / Admin123!Change"
echo "  Logs       $LOG_DIR/{api,web,minio}.log"
