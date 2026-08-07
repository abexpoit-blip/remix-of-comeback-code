#!/usr/bin/env bash
# Sync the app .env with the currently running self-hosted Supabase stack keys.

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/sleepox-app-new}"
SUPABASE_DIR="${SUPABASE_DIR:-/opt/supabase-docker}"
APP_ENV="$APP_DIR/.env"
PUBLIC_API_URL="${PUBLIC_API_URL:-${API_URL:-https://supabase.sleepox.com}}"
SERVER_API_URL="${SERVER_API_URL:-}"
PROJECT_ID="${PROJECT_ID:-sleepox}"

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

validate_jwt_role() {
  local token="$1"
  local expected_role="$2"
  node - "$token" "$expected_role" <<'NODE'
const [token, expectedRole] = process.argv.slice(2);
try {
  const parts = token.split('.');
  if (parts.length !== 3) process.exit(2);
  const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64url').toString('utf8'));
  process.exit(payload.role === expectedRole ? 0 : 3);
} catch {
  process.exit(4);
}
NODE
}

detect_local_api_url() {
  local candidate code
  for candidate in http://127.0.0.1:8000 http://127.0.0.1:54321; do
    code="$(curl -ksS -o /dev/null -w '%{http_code}' --max-time 3 "$candidate/auth/v1/health" || true)"
    if [ "$code" != "000" ] && [ "$code" != "502" ] && [ "$code" != "503" ] && [ "$code" != "504" ]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done
  return 1
}



upsert_env() {
  local file="$1"
  local key="$2"
  local value="$3"
  if grep -qE "^${key}=" "$file"; then
    python3 - "$file" "$key" "$value" <<'PY'
import sys
path, key, value = sys.argv[1:]
lines = open(path).read().splitlines()
out = []
done = False
for line in lines:
    if line.startswith(key + "="):
        if not done:
            out.append(f'{key}="{value}"')
            done = True
        continue
    out.append(line)
open(path, "w").write("\n".join(out).rstrip() + "\n")
PY
  else
    printf '%s="%s"\n' "$key" "$value" >> "$file"
  fi
}

echo "🔐 Syncing app environment with self-hosted backend keys..."

compose_dir="$(find_compose_dir)"
supabase_env="$compose_dir/.env"

anon_key="$(read_env_value "$supabase_env" "ANON_KEY")"
service_key="$(read_env_value "$supabase_env" "SERVICE_ROLE_KEY")"

if [ -z "$anon_key" ] || [ -z "$service_key" ]; then
  echo "❌ Could not find ANON_KEY and SERVICE_ROLE_KEY in $supabase_env" >&2
  exit 1
fi

if ! validate_jwt_role "$anon_key" "anon"; then
  echo "❌ ANON_KEY in $supabase_env is not a valid anon JWT." >&2
  exit 1
fi

if ! validate_jwt_role "$service_key" "service_role"; then
  echo "❌ SERVICE_ROLE_KEY in $supabase_env is not a valid service_role JWT." >&2
  exit 1
fi

if [ ! -f "$APP_ENV" ]; then
  echo "❌ App .env not found at $APP_ENV" >&2
  exit 1
fi

if [ -z "$SERVER_API_URL" ]; then
  SERVER_API_URL="$(detect_local_api_url || true)"
fi
if [ -z "$SERVER_API_URL" ]; then
  SERVER_API_URL="$PUBLIC_API_URL"
fi

cp "$APP_ENV" "$APP_ENV.sleepox-backup-$(date +%Y%m%d%H%M%S)"

upsert_env "$APP_ENV" "SUPABASE_URL" "$SERVER_API_URL"
upsert_env "$APP_ENV" "VITE_SUPABASE_URL" "$PUBLIC_API_URL"
upsert_env "$APP_ENV" "SUPABASE_PROJECT_ID" "$PROJECT_ID"
upsert_env "$APP_ENV" "VITE_SUPABASE_PROJECT_ID" "$PROJECT_ID"
upsert_env "$APP_ENV" "SUPABASE_ANON_KEY" "$anon_key"
upsert_env "$APP_ENV" "VITE_SUPABASE_ANON_KEY" "$anon_key"
upsert_env "$APP_ENV" "SUPABASE_PUBLISHABLE_KEY" "$anon_key"
upsert_env "$APP_ENV" "VITE_SUPABASE_PUBLISHABLE_KEY" "$anon_key"
upsert_env "$APP_ENV" "SUPABASE_SERVICE_ROLE_KEY" "$service_key"
upsert_env "$APP_ENV" "SUPABASE_SECRET_KEY" "$service_key"

chmod 600 "$APP_ENV"

cd "$APP_DIR"
bun run verify-env

echo "✅ App .env now matches the self-hosted backend keys. No secrets were printed."
echo "✅ Server API URL: $SERVER_API_URL"
echo "✅ Browser API URL: $PUBLIC_API_URL"
echo "Next: run ./deploy.sh restart and then ./deploy.sh logs"