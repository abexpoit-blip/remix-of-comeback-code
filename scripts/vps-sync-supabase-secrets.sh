#!/usr/bin/env bash
# Normalize the self-hosted backend compose configuration so every internal
# database service reads the same POSTGRES_PASSWORD from the compose .env.
# The secret is never printed.

set -euo pipefail

SUPABASE_DIR="${SUPABASE_DIR:-/opt/supabase/docker}"
COMPOSE_FILE="${COMPOSE_FILE:-}"
ENV_FILE="${ENV_FILE:-}"

find_compose_file() {
  local candidate
  for candidate in \
    "$SUPABASE_DIR/docker-compose.yml" \
    "$SUPABASE_DIR/docker-compose.yaml" \
    "$SUPABASE_DIR/compose.yml" \
    "$SUPABASE_DIR/compose.yaml" \
    /opt/supabase-docker/docker-compose.yml \
    /opt/supabase/docker/docker-compose.yml; do
    if [ -f "$candidate" ]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done
  return 1
}

if [ -z "$COMPOSE_FILE" ]; then
  COMPOSE_FILE="$(find_compose_file)"
fi
if [ -z "$ENV_FILE" ]; then
  ENV_FILE="$(dirname "$COMPOSE_FILE")/.env"
fi

if [ ! -f "$COMPOSE_FILE" ] || [ ! -f "$ENV_FILE" ]; then
  echo "❌ Compose file or its .env was not found." >&2
  exit 1
fi

if ! grep -qE '^POSTGRES_PASSWORD=.+$' "$ENV_FILE"; then
  echo "❌ POSTGRES_PASSWORD is missing or empty in the backend .env." >&2
  exit 1
fi

chmod 600 "$ENV_FILE"
backup="$COMPOSE_FILE.bak.$(date +%Y%m%d%H%M%S)"
cp "$COMPOSE_FILE" "$backup"

python3 - "$COMPOSE_FILE" <<'PY'
import re
import sys

path = sys.argv[1]
text = open(path, encoding="utf-8").read()

# Replace literal passwords only inside postgres connection URLs. This does not
# touch host names, ports, database names, or unrelated environment values.
roles = (
    "postgres",
    "supabase_admin",
    "supabase_auth_admin",
    "supabase_storage_admin",
    "authenticator",
    "pgbouncer",
    "supabase_read_only_user",
)
for role in roles:
    pattern = rf"(postgres(?:ql)?://{re.escape(role)}:)([^@\s]+)(@)"
    text = re.sub(pattern, rf"\1${{POSTGRES_PASSWORD}}\3", text)

# Keep the auth pool large enough for production login bursts. Add settings to
# the auth environment immediately after its DB driver when they are absent.
if "GOTRUE_DB_MAX_POOL_SIZE" not in text:
    marker = re.compile(r"(?m)^(\s+)(?:-\s*)?GOTRUE_DB_DRIVER:\s*postgres\s*$")
    match = marker.search(text)
    if match:
        indent = match.group(1)
        addition = (
            f"\n{indent}GOTRUE_DB_MAX_POOL_SIZE: 50"
            f"\n{indent}GOTRUE_DB_MAX_IDLE_CONNS: 15"
            f"\n{indent}GOTRUE_DB_CONN_MAX_LIFETIME: 30m"
            f"\n{indent}GOTRUE_DB_CONN_MAX_IDLE_TIME: 5m"
        )
        text = text[:match.end()] + addition + text[match.end():]

open(path, "w", encoding="utf-8").write(text)
PY

echo "🧪 Validating rendered compose configuration..."
compose_dir="$(dirname "$COMPOSE_FILE")"
compose_name="$(basename "$COMPOSE_FILE")"
rendered="$(mktemp)"
trap 'rm -f "$rendered"' EXIT
(cd "$compose_dir" && docker compose -f "$compose_name" config > "$rendered")

if grep -Eq 'postgres(ql)?://(postgres|supabase_admin|supabase_auth_admin|supabase_storage_admin|authenticator|pgbouncer|supabase_read_only_user):\$\{POSTGRES_PASSWORD\}@' "$rendered"; then
  echo "❌ Compose left an unresolved POSTGRES_PASSWORD reference." >&2
  exit 1
fi

echo "🔐 Synchronizing database roles with the canonical backend secret..."
SUPABASE_DIR="$compose_dir" "$(dirname "$0")/vps-fix-supabase-db-passwords.sh"

echo "🧪 Checking auth failures after service restart..."
if docker logs --since 5m supabase-auth 2>&1 | grep -Eq 'password authentication failed|failed to connect to .host=db'; then
  echo "❌ Auth still reports a database credential/connection failure." >&2
  exit 1
fi

echo "✅ Compose, database roles, and auth now share one canonical secret."
echo "✅ Backup saved at: $backup"