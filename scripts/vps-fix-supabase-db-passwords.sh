#!/usr/bin/env bash
# Repair self-hosted Supabase internal database role passwords.
# Run on the VPS when containers log FATAL 28P01 invalid_password for
# supabase_admin, supabase_storage_admin, supabase_auth_admin, or authenticator.

set -euo pipefail

SUPABASE_DIR="${SUPABASE_DIR:-/opt/supabase-docker}"
DB_CONTAINER="${DB_CONTAINER:-supabase-db}"
PSQL_ADMIN_ROLE=""
PSQL_ADMIN_SUPERUSER="f"

find_compose_dir() {
  for dir in "$SUPABASE_DIR" /opt/supabase-docker /opt/supabase/docker /opt/supabase; do
    if [ -f "$dir/.env" ] && { [ -f "$dir/docker-compose.yml" ] || [ -f "$dir/docker-compose.yaml" ] || [ -f "$dir/compose.yml" ] || [ -f "$dir/compose.yaml" ]; }; then
      printf '%s\n' "$dir"
      return 0
    fi
  done
  return 1
}

read_env_value() {
  local file="$1"
  local key="$2"
  grep -E "^${key}=" "$file" | tail -n 1 | cut -d= -f2- | sed -E 's/^"(.*)"$/\1/; s/^'"'"'(.*)'"'"'$/\1/'
}

sql_quote_literal() {
  python3 - "$1" <<'PY'
import sys
print("'" + sys.argv[1].replace("'", "''") + "'")
PY
}

role_exists() {
  local role="$1"
  docker exec "$DB_CONTAINER" psql -U "$PSQL_ADMIN_ROLE" -d postgres -tAc "select 1 from pg_roles where rolname = '$role'" 2>/dev/null | grep -q 1
}

db_exists() {
  local db="$1"
  docker exec "$DB_CONTAINER" psql -U "$PSQL_ADMIN_ROLE" -d postgres -tAc "select 1 from pg_database where datname = '$db'" 2>/dev/null | grep -q 1
}

detect_local_admin() {
  local role super super_roles super_role
  for role in supabase_admin postgres; do
    if docker exec "$DB_CONTAINER" psql -U "$role" -d postgres -tAc 'select 1' >/dev/null 2>&1; then
      super="$(docker exec "$DB_CONTAINER" psql -U "$role" -d postgres -tAc "select rolsuper from pg_roles where rolname = current_user" 2>/dev/null | tr -d '[:space:]')"
      if [ "$super" = "t" ]; then
        PSQL_ADMIN_ROLE="$role"
        PSQL_ADMIN_SUPERUSER="t"
        return 0
      fi
      if [ -z "$PSQL_ADMIN_ROLE" ]; then
        PSQL_ADMIN_ROLE="$role"
        PSQL_ADMIN_SUPERUSER="f"
      fi
      super_roles="$(docker exec "$DB_CONTAINER" psql -U "$role" -d postgres -tAc "select rolname from pg_roles where rolsuper order by rolname" 2>/dev/null || true)"
      for super_role in $super_roles; do
        if docker exec "$DB_CONTAINER" psql -U "$super_role" -d postgres -tAc 'select 1' >/dev/null 2>&1; then
          PSQL_ADMIN_ROLE="$super_role"
          PSQL_ADMIN_SUPERUSER="t"
          return 0
        fi
      done
    fi
  done
  [ -n "$PSQL_ADMIN_ROLE" ]
}

alter_role_password() {
  local role="$1"
  local password_literal="$2"
  local tmp_err
  tmp_err="$(mktemp)"
  if role_exists "$role"; then
    if printf 'ALTER ROLE %s WITH PASSWORD %s;\n' "$role" "$password_literal" \
      | docker exec -i "$DB_CONTAINER" psql -U "$PSQL_ADMIN_ROLE" -d postgres -v ON_ERROR_STOP=1 >/dev/null 2>"$tmp_err"; then
      echo "✅ Password synced for database role: $role"
      rm -f "$tmp_err"
      return 0
    fi
    echo "❌ Could not sync password for database role: $role"
    sed -n '1,4p' "$tmp_err" >&2
    rm -f "$tmp_err"
    return 1
  else
    echo "⚠️  Role not found, skipped: $role"
    rm -f "$tmp_err"
    return 0
  fi
}

test_role_login() {
  local role="$1"
  local db="$2"
  local password="$3"
  docker exec -e PGPASSWORD="$password" "$DB_CONTAINER" \
    psql -h 127.0.0.1 -U "$role" -d "$db" -tAc 'select 1' >/dev/null 2>&1
}

wait_for_db() {
  for i in $(seq 1 30); do
    if docker exec "$DB_CONTAINER" pg_isready -U postgres >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  return 1
}

ensure_db_container_running() {
  local running
  running="$(docker inspect -f '{{.State.Running}}' "$DB_CONTAINER" 2>/dev/null || true)"
  if [ "$running" != "true" ]; then
    echo "▶️  Starting stopped database container..."
    docker start "$DB_CONTAINER" >/dev/null
  fi
  wait_for_db
}

force_offline_role_password_repair() {
  local password_literal="$1"
  local image pgdata tmp_sql stopped_file role repair_status

  image="$(docker inspect -f '{{.Config.Image}}' "$DB_CONTAINER")"
  pgdata="$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$DB_CONTAINER" | awk -F= '$1=="PGDATA"{print $2}' | tail -n 1)"
  pgdata="${pgdata:-/var/lib/postgresql/data}"
  tmp_sql="$(mktemp)"
  stopped_file="$(mktemp)"
  chmod 644 "$tmp_sql"
  chmod 600 "$stopped_file"

  echo "🧰 No connectable superuser found. Using offline single-user repair mode..."
  echo "   This temporarily stops backend containers, updates DB roles directly, then starts them again."

  for role in authenticator supabase_auth_admin supabase_storage_admin pgbouncer supabase_read_only_user; do
    if role_exists "$role"; then
      printf 'ALTER ROLE %s WITH LOGIN PASSWORD %s;\n' "$role" "$password_literal" >> "$tmp_sql"
    fi
  done
  if role_exists "supabase_admin"; then
    printf 'ALTER ROLE supabase_admin WITH SUPERUSER LOGIN PASSWORD %s;\n' "$password_literal" >> "$tmp_sql"
  fi
  if role_exists "postgres"; then
    printf 'ALTER ROLE postgres WITH SUPERUSER LOGIN PASSWORD %s;\n' "$password_literal" >> "$tmp_sql"
  fi

  docker ps --format '{{.Names}}' \
    | grep -E '^(supabase-|realtime-dev\.supabase-realtime)' \
    | grep -v "^${DB_CONTAINER}$" > "$stopped_file" || true

  if [ -s "$stopped_file" ]; then
    echo "⏸️  Stopping backend containers before offline database repair..."
    xargs -r docker stop < "$stopped_file" >/dev/null
  fi

  echo "⏸️  Stopping database container for single-user repair..."
  docker stop "$DB_CONTAINER" >/dev/null

  echo "🔧 Running offline role repair inside the database image..."
  set +e
  docker run --rm \
    --volumes-from "$DB_CONTAINER" \
    -v "$tmp_sql:/tmp/sleepox-role-repair.sql:ro" \
    --user postgres \
    --entrypoint bash \
    "$image" \
    -lc "postgres --single -D '$pgdata' postgres < /tmp/sleepox-role-repair.sql" >/dev/null
  repair_status=$?
  set -e

  rm -f "$tmp_sql"

  echo "▶️  Starting database container..."
  docker start "$DB_CONTAINER" >/dev/null
  wait_for_db

  if [ -s "$stopped_file" ]; then
    echo "▶️  Starting backend containers again..."
    xargs -r docker start < "$stopped_file" >/dev/null || true
  elif [ -n "${compose_dir:-}" ]; then
    echo "▶️  Starting backend stack again..."
    (cd "$compose_dir" && (docker compose up -d || docker-compose up -d || true))
  fi
  rm -f "$stopped_file"

  if [ "$repair_status" -ne 0 ]; then
    echo "❌ Offline role repair failed, but stopped containers were started again." >&2
    exit "$repair_status"
  fi
}

restart_backend_services() {
  local compose_dir="$1"
  echo "♻️  Restarting backend containers that use these database roles..."
  # Restart each container directly by name; ignore ones that don't exist on this host.
  for c in supabase-auth supabase-rest supabase-storage supabase-pooler supabase-analytics realtime-dev.supabase-realtime supabase-kong supabase-meta supabase-edge-functions; do
    if docker inspect "$c" >/dev/null 2>&1; then
      docker restart "$c" >/dev/null 2>&1 || true
    fi
  done
}

verify_container_password_sources() {
  local container env_dump
  echo "🧪 Verifying running containers no longer use a different DB password..."
  for container in supabase-auth supabase-rest supabase-storage supabase-pooler supabase-analytics realtime-dev.supabase-realtime; do
    if ! docker inspect "$container" >/dev/null 2>&1; then
      continue
    fi
    env_dump="$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$container" 2>/dev/null || true)"
    if printf '%s\n' "$env_dump" | grep -E '(^|_)DB_(DATABASE_)?URL=' | grep -q 'postgres'; then
      if ! printf '%s\n' "$env_dump" | grep -E '(^|_)DB_(DATABASE_)?URL=' \
        | python3 -c 'import sys, urllib.parse
expected=sys.argv[1]
urls=[line.split("=",1)[1].strip() for line in sys.stdin if "=" in line]
raise SystemExit(0 if all(urllib.parse.unquote(urllib.parse.urlsplit(url).password or "") == expected for url in urls) else 1)' "$postgres_password"; then
        echo "❌ $container is running with a DB password different from POSTGRES_PASSWORD." >&2
        return 1
      fi
    fi
  done
  echo "✅ Running container DB credentials match without printing secrets."
}

echo "🔐 Repairing self-hosted backend database role passwords..."

compose_dir="$(find_compose_dir)"
supabase_env="$compose_dir/.env"
postgres_password="$(read_env_value "$supabase_env" "POSTGRES_PASSWORD")"
postgres_db="$(read_env_value "$supabase_env" "POSTGRES_DB")"
postgres_db="${postgres_db:-postgres}"

if [ -z "$postgres_password" ]; then
  echo "❌ POSTGRES_PASSWORD was not found in $supabase_env" >&2
  exit 1
fi

if ! docker inspect "$DB_CONTAINER" >/dev/null 2>&1; then
  echo "❌ Database container '$DB_CONTAINER' was not found." >&2
  echo "   If your DB container has another name, run: DB_CONTAINER=<name> ./scripts/vps-fix-supabase-db-passwords.sh" >&2
  exit 1
fi

echo "🧪 Checking database readiness..."
ensure_db_container_running

if ! detect_local_admin; then
  echo "❌ Could not connect locally to the database as postgres, supabase_admin, or any visible superuser." >&2
  exit 1
fi

echo "✅ Using local database admin role: $PSQL_ADMIN_ROLE (superuser=$PSQL_ADMIN_SUPERUSER)"

password_literal="$(sql_quote_literal "$postgres_password")"

if [ "$PSQL_ADMIN_SUPERUSER" != "t" ]; then
  force_offline_role_password_repair "$password_literal"
  PSQL_ADMIN_ROLE="postgres"
  PSQL_ADMIN_SUPERUSER="t"
fi

echo "🔁 Aligning common self-hosted backend roles to the POSTGRES_PASSWORD from $supabase_env..."
role_sync_failures=0
for role in authenticator supabase_auth_admin supabase_storage_admin supabase_admin pgbouncer supabase_read_only_user postgres; do
  alter_role_password "$role" "$password_literal" || role_sync_failures=1
done

if [ "$role_sync_failures" -ne 0 ]; then
  echo "❌ Database role password repair did not complete." >&2
  exit 1
fi

if role_exists "supabase_admin" && ! db_exists "_supabase"; then
  echo "🗄️  Creating missing _supabase database for the pooler..."
  docker exec "$DB_CONTAINER" createdb -U "$PSQL_ADMIN_ROLE" -O supabase_admin _supabase >/dev/null
fi

echo "🧪 Verifying password login for internal roles..."
failures=0
for check in \
  "authenticator:$postgres_db" \
  "supabase_auth_admin:$postgres_db" \
  "supabase_storage_admin:$postgres_db" \
  "supabase_admin:$postgres_db" \
  "supabase_admin:_supabase" \
  "pgbouncer:$postgres_db"; do
  role="${check%%:*}"
  db="${check#*:}"
  if role_exists "$role" && db_exists "$db"; then
    if test_role_login "$role" "$db" "$postgres_password"; then
      echo "✅ Login OK: $role -> $db"
    else
      echo "❌ Login failed: $role -> $db"
      failures=1
    fi
  fi
done

if [ "$failures" -ne 0 ]; then
  echo "❌ Some internal role password checks still failed. Review the database logs before restarting services." >&2
  exit 1
fi

restart_backend_services "$compose_dir"
verify_container_password_sources

echo "⏳ Waiting for API gateway to settle..."
for i in $(seq 1 30); do
  code="$(curl -ksS -o /dev/null -w '%{http_code}' --max-time 5 https://supabase.sleepox.com/auth/v1/health || true)"
  if [ "$code" != "502" ] && [ "$code" != "503" ] && [ "$code" != "504" ] && [ "$code" != "000" ]; then
    echo "✅ API gateway is responding with HTTP $code"
    echo "✅ Database role password repair complete. No secrets were printed."
    echo "Next: run ./scripts/vps-smoke-test.sh"
    exit 0
  fi
  sleep 2
done

echo "⚠️  Passwords were repaired, but the gateway is still warming up or another service is failing."
echo "Next: run ./scripts/vps-diagnose-restarting.sh | tail -c 8000"