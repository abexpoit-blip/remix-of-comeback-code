#!/usr/bin/env bash
# Rotate / re-align supabase_auth_admin + postgres passwords to the canonical .env value.
# Never prints secret values. Re-runnable.
set -euo pipefail

COMPOSE_DIR="${COMPOSE_DIR:-/opt/supabase/docker}"
ENV_FILE="$COMPOSE_DIR/.env"

say() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
ok()  { printf '\033[1;32m  ok\033[0m %s\n' "$*"; }
err() { printf '\033[1;31m  !!\033[0m %s\n' "$*" >&2; }

[ -f "$ENV_FILE" ] || { err ".env not found: $ENV_FILE (set COMPOSE_DIR=...)"; exit 1; }

PGPASS="$(grep -E '^POSTGRES_PASSWORD=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"'"'"'')"
[ -n "${PGPASS:-}" ] || { err "POSTGRES_PASSWORD missing"; exit 1; }
ok "canonical password loaded (length ${#PGPASS})"

say "Aligning database roles to the canonical password"
for role in postgres supabase_auth_admin supabase_storage_admin authenticator supabase_admin; do
  if docker exec supabase-db psql -U postgres -tAc "select 1 from pg_roles where rolname='$role'" | grep -q 1; then
    docker exec -e PW="$PGPASS" supabase-db psql -U postgres -v ON_ERROR_STOP=1 -c \
      "ALTER ROLE $role WITH PASSWORD '$(printf '%s' "$PGPASS" | sed "s/'/''/g")';" >/dev/null
    ok "$role updated"
  else
    echo "  (role $role not present, skipped)"
  fi
done

say "Restarting dependent services"
cd "$COMPOSE_DIR"
docker compose up -d --no-deps auth rest storage realtime >/dev/null 2>&1 || docker compose up -d --no-deps auth rest >/dev/null
sleep 8

say "Verifying containers hold the same secret as .env (no value printed)"
MISMATCH=0
for c in $(docker ps --format '{{.Names}}' | grep -E '^supabase-' || true); do
  envdump="$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$c" 2>/dev/null || true)"
  while IFS= read -r line; do
    v="${line#*=}"
    [ -z "$v" ] && continue
    if [ "$v" != "$PGPASS" ]; then err "$c: ${line%%=*} differs from .env"; MISMATCH=1; fi
  done < <(printf '%s' "$envdump" | grep -E '^(POSTGRES_PASSWORD|PGPASSWORD)=' || true)
  dburl="$(printf '%s' "$envdump" | grep -E '_DATABASE_URL=|^DATABASE_URL=' | cut -d= -f2- || true)"
  if [ -n "$dburl" ] && ! printf '%s' "$dburl" | grep -q "$PGPASS"; then
    err "$c: DATABASE_URL password differs from .env"; MISMATCH=1
  fi
done
[ "$MISMATCH" -eq 0 ] && ok "all containers aligned"

say "Auth connectivity check"
docker logs --since 2m supabase-auth 2>&1 | grep -c 'failed to connect to `host=db' | xargs -I{} echo "  db-connect failures (2m): {}"
curl -sS --max-time 15 https://sleepox.com/api/public/health || err "health unreachable"
echo
ok "done"
