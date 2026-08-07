#!/usr/bin/env bash
# Sync Supabase DB secrets across docker-compose + ensure GoTrue pool settings.
# Safe to re-run. Never prints secret values.
set -euo pipefail

COMPOSE_DIR="${COMPOSE_DIR:-/opt/supabase/docker}"
COMPOSE_FILE="$COMPOSE_DIR/docker-compose.yml"
ENV_FILE="$COMPOSE_DIR/.env"

say() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
ok()  { printf '\033[1;32m  ok\033[0m %s\n' "$*"; }
err() { printf '\033[1;31m  !!\033[0m %s\n' "$*" >&2; }

[ -f "$COMPOSE_FILE" ] || { err "compose file not found: $COMPOSE_FILE (set COMPOSE_DIR=...)"; exit 1; }
[ -f "$ENV_FILE" ]     || { err ".env not found: $ENV_FILE"; exit 1; }

say "Backup"
cp "$COMPOSE_FILE" "$COMPOSE_FILE.bak.$(date +%s)"
cp "$ENV_FILE" "$ENV_FILE.bak.$(date +%s)"
ok "backups written"

say "Reading canonical POSTGRES_PASSWORD from .env"
PGPASS="$(grep -E '^POSTGRES_PASSWORD=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"'"'"'')"
if [ -z "${PGPASS:-}" ]; then err "POSTGRES_PASSWORD missing in $ENV_FILE"; exit 1; fi
ok "found (length ${#PGPASS})"

say "Normalising literal passwords -> \${POSTGRES_PASSWORD} and ensuring GoTrue pool"
COMPOSE_FILE="$COMPOSE_FILE" PGPASS="$PGPASS" python3 - <<'PY'
import os, re
p = os.environ['COMPOSE_FILE']
pw = os.environ['PGPASS']
s = open(p).read()
orig = s

# 1) replace any hardcoded occurrence of the real password with the env var
if pw and pw in s:
    s = s.replace(pw, '${POSTGRES_PASSWORD}')
    print('  replaced literal password occurrences')

# 2) ensure GoTrue pool settings exist in the auth service env block
if 'GOTRUE_DB_MAX_POOL_SIZE' not in s:
    add = ("      GOTRUE_DB_MAX_POOL_SIZE: 50\n"
           "      GOTRUE_DB_MAX_IDLE_CONNS: 15\n"
           "      GOTRUE_DB_CONN_MAX_LIFETIME: 30m\n"
           "      GOTRUE_DB_CONN_MAX_IDLE_TIME: 5m\n"
           "      GOTRUE_API_MAX_REQUEST_DURATION: 15s\n")
    m = (re.search(r'^\s*GOTRUE_DB_MIGRATIONS_PATH:.*\n', s, re.M)
         or re.search(r'^\s*GOTRUE_DB_DRIVER:.*\n', s, re.M))
    if m:
        s = s[:m.end()] + add + s[m.end():]
        print('  added GoTrue pool settings')
    else:
        print('  WARN: auth env block not found; pool settings not added')
else:
    print('  GoTrue pool settings already present')

if s != orig:
    open(p, 'w').write(s)
    print('  compose file updated')
else:
    print('  no changes needed')
PY

say "Validating compose config"
cd "$COMPOSE_DIR"
if docker compose config >/dev/null 2>&1; then ok "compose config valid"; else err "compose config INVALID — restore from .bak"; exit 1; fi

say "Recreating auth (and rest) with synced secrets — no full stack downtime"
docker compose up -d --no-deps auth rest >/dev/null
sleep 8

say "Container status"
for c in supabase-auth supabase-rest supabase-db; do
  docker inspect -f "  $c status={{.State.Status}} restarts={{.RestartCount}}" "$c" 2>/dev/null || echo "  $c not found"
done

say "Verify every container's DB password matches .env (no value printed)"
MISMATCH=0
for c in $(docker ps --format '{{.Names}}' | grep -E '^supabase-' || true); do
  envdump="$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$c" 2>/dev/null || true)"
  vals="$(printf '%s' "$envdump" | grep -E '^(POSTGRES_PASSWORD|PGPASSWORD)=' | cut -d= -f2- || true)"
  [ -z "$vals" ] && continue
  while IFS= read -r v; do
    [ -z "$v" ] && continue
    if [ "$v" != "$PGPASS" ]; then err "$c has a DB password that differs from .env"; MISMATCH=1; fi
  done <<< "$vals"
  # gotrue DB url check
  dburl="$(printf '%s' "$envdump" | grep -E '^GOTRUE_DB_DATABASE_URL=' | cut -d= -f2- || true)"
  if [ -n "$dburl" ] && ! printf '%s' "$dburl" | grep -q "$PGPASS"; then
    err "$c GOTRUE_DB_DATABASE_URL password differs from .env"; MISMATCH=1
  fi
done
[ "$MISMATCH" -eq 0 ] && ok "all container secrets match .env"

say "Health"
curl -sS --max-time 15 https://sleepox.com/api/public/health || err "health endpoint unreachable"
echo
ok "done"
