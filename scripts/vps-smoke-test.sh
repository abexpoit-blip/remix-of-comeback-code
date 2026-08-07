#!/usr/bin/env bash
# Smoke test to verify HTTPS and Supabase API routing from the VPS.

set -u

DOMAIN="supabase.sleepox.com"
BASE_URL="https://$DOMAIN"
LOCAL_BASE_URL="${LOCAL_SUPABASE_URL:-http://127.0.0.1:8000}"
ANON_KEY="${SUPABASE_ANON_KEY:-}"
FAILURES=0

if [ -z "$ANON_KEY" ] && [ -f .env ]; then
  ANON_KEY="$(grep -E '^VITE_SUPABASE_(PUBLISHABLE_KEY|ANON_KEY)=' .env | head -n 1 | cut -d= -f2- | tr -d '"' || true)"
fi

check_url() {
  local label="$1"
  local url="$2"
  shift 2
  local tmp_body
  tmp_body="$(mktemp)"
  echo ""
  echo "🌐 $label"
  local code
  code="$(curl -sS -o "$tmp_body" -w "%{http_code}" "$@" "$url" || true)"
  echo "HTTP $code"
  head -c 500 "$tmp_body"
  echo ""
  if grep -qi "<center><h1>404 Not Found</h1></center>" "$tmp_body"; then
    echo "❌ Generic Nginx 404 detected. The domain is not proxying to Supabase Kong."
    rm -f "$tmp_body"
    return 1
  fi
  if [ "$code" = "502" ] || [ "$code" = "503" ] || [ "$code" = "504" ] || [ "$code" = "000" ]; then
    echo "❌ Gateway error detected. Nginx is configured for the domain, but cannot reach the backend API gateway."
    rm -f "$tmp_body"
    return 1
  fi
  rm -f "$tmp_body"
}

check_rest_schema() {
  local label="$1"
  local base_url="$2"
  if [ -z "$ANON_KEY" ]; then
    return 0
  fi
  check_url "$label" "$base_url/rest/v1/links?select=id&limit=1" \
    -H "apikey: $ANON_KEY" \
    -H "Authorization: Bearer $ANON_KEY" || return 1
}

check_auth_health() {
  if [ -n "$ANON_KEY" ]; then
    check_url "Auth health" "$BASE_URL/auth/v1/health" \
      -H "apikey: $ANON_KEY" \
      -H "Authorization: Bearer $ANON_KEY" || return 1
  else
    check_url "Auth health (no anon key found, 401 JSON is OK if not generic Nginx)" "$BASE_URL/auth/v1/health" || return 1
  fi
}

check_auth_cors() {
  local headers
  headers="$(mktemp)"
  curl -sS -o /dev/null -D "$headers" -X OPTIONS "$BASE_URL/auth/v1/token?grant_type=password" \
    -H "Origin: https://sleepox.com" \
    -H "Access-Control-Request-Method: POST" \
    -H "Access-Control-Request-Headers: apikey,authorization,content-type,x-client-info" || true
  if ! grep -qi '^access-control-allow-origin:' "$headers" \
    || ! grep -qi '^access-control-allow-methods:.*POST' "$headers"; then
    echo "❌ Auth CORS preflight failed; logins may fail on other devices."
    rm -f "$headers"
    return 1
  fi
  rm -f "$headers"
  echo "✅ Auth CORS preflight is valid for browser login."
}

check_recent_auth_errors() {
  local failures
  failures="$(docker logs --since 15m supabase-auth 2>&1 \
    | grep -Ec 'password authentication failed|failed to connect to .host=db|\"status\":500' || true)"
  if [ "$failures" -gt 0 ]; then
    echo "❌ Auth emitted $failures database/500 errors in the last 15 minutes."
    return 1
  fi
  echo "✅ No auth database/500 errors in the last 15 minutes."
}

show_backend_diagnostics() {
  echo ""
  echo "🧰 Backend proxy diagnostics"
  echo "Docker containers:"
  docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -Ei "supabase|kong|auth|rest|postgrest|gotrue" || true

  local kong_container
  kong_container="$(docker ps --format '{{.Names}}' | grep -Ei '(^|[-_])kong($|[-_])|supabase.*kong|kong' | head -n 1 || true)"
  if [ -n "$kong_container" ]; then
    echo ""
    echo "Kong container: $kong_container"
    docker port "$kong_container" 8000/tcp 2>/dev/null || true
    local kong_ip
    kong_ip="$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$kong_container" 2>/dev/null | head -n 1 || true)"
    if [ -n "$kong_ip" ]; then
      echo "Kong container IP: $kong_ip"
      echo "Direct container Auth health:"
      curl -sS -i --max-time 5 "http://$kong_ip:8000/auth/v1/health" | head -n 20 || true
    fi
    echo ""
    echo "Recent Kong logs:"
    docker logs --tail 80 "$kong_container" 2>&1 || true
  fi

  echo ""
  echo "Nginx domain references:"
  grep -R "server_name .*${DOMAIN}\|${DOMAIN}" /etc/nginx/sites-enabled /etc/nginx/sites-available /etc/nginx/conf.d 2>/dev/null || true

  if docker logs --tail 250 supabase-storage 2>&1 | grep -q 'password authentication failed for user "supabase_storage_admin"' \
    || docker logs --tail 250 supabase-pooler 2>&1 | grep -q 'password authentication failed for user "supabase_admin"' \
    || docker logs --tail 250 realtime-dev.supabase-realtime 2>&1 | grep -q 'password authentication failed for user "supabase_admin"'; then
    echo ""
    echo "🔐 Internal DB password mismatch detected. Run:"
    echo "   chmod +x scripts/vps-fix-supabase-db-passwords.sh && ./scripts/vps-fix-supabase-db-passwords.sh"
  fi
}

echo "🔐 TLS certificate check..."
echo | openssl s_client -connect "$DOMAIN:443" -servername "$DOMAIN" 2>/dev/null \
  | openssl x509 -noout -subject -issuer -dates -ext subjectAltName

check_auth_health || FAILURES=1
check_auth_cors || FAILURES=1
check_recent_auth_errors || FAILURES=1

if [ -n "$ANON_KEY" ]; then
  check_url "REST API root" "$BASE_URL/rest/v1/" \
    -H "apikey: $ANON_KEY" \
    -H "Authorization: Bearer $ANON_KEY" || FAILURES=1
  check_rest_schema "REST schema query through public domain" "$BASE_URL" || FAILURES=1
  check_rest_schema "REST schema query through local gateway" "$LOCAL_BASE_URL" || FAILURES=1
else
  check_url "REST API root (no anon key found, 401/404 JSON is still OK if not generic Nginx)" "$BASE_URL/rest/v1/" || FAILURES=1
fi

echo ""
echo "🌐 DNS Lookup..."
host "$DOMAIN"

echo ""
if [ "$FAILURES" -ne 0 ]; then
  show_backend_diagnostics
  echo ""
  echo "❌ Smoke test failed. Run ./scripts/vps-fix-supabase-ssl.sh again after pulling the latest script, then rerun this test."
  exit 1
fi

echo "✅ Smoke test complete. If there is no browser certificate warning and no generic Nginx 404, login can be tested now."
