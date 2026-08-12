#!/usr/bin/env bash
# Post-deploy smoke test: app routes, auth host, CORS, recent auth errors.
set -uo pipefail

SITE="${SITE:-https://sleepox.com}"
AUTH_HOST="${AUTH_HOST:-https://supabase.sleepox.com}"
FAIL=0

say() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
ok()  { printf '\033[1;32m  ok\033[0m %s\n' "$*"; }
bad() { printf '\033[1;31m  !!\033[0m %s\n' "$*"; FAIL=1; }

code() { curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$@"; }

# Resolve the anon/publishable key so auth probes are authenticated.
ANON_KEY="${ANON_KEY:-}"
if [ -z "$ANON_KEY" ]; then
  for f in ./.env /opt/sleepox-app-new/.env /opt/supabase/docker/.env; do
    [ -f "$f" ] || continue
    ANON_KEY="$(grep -E '^(VITE_SUPABASE_PUBLISHABLE_KEY|VITE_SUPABASE_ANON_KEY|ANON_KEY)=' "$f" | head -1 | cut -d= -f2- | tr -d '"'"'"'')"
    [ -n "$ANON_KEY" ] && break
  done
fi
if [ -n "$ANON_KEY" ]; then
  printf '  using anon key from env/.env (length %s)\n' "${#ANON_KEY}"
  AUTH_ARGS=(-H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY")
else
  printf '  \033[1;33m(no anon key found — auth probes may return 401)\033[0m\n'
  AUTH_ARGS=()
fi


say "App routes"
for p in / /login /signup /dashboard /pricing /api/public/health; do
  c=$(code "$SITE$p")
  case "$c" in 200|302|304) ok "$p -> $c";; *) bad "$p -> $c";; esac
done

say "Health payload"
curl -sS --max-time 20 "$SITE/api/public/health"; echo

say "Auth host reachability"
c=$(code ${AUTH_ARGS+"${AUTH_ARGS[@]}"} "$AUTH_HOST/auth/v1/health")
case "$c" in 200) ok "auth health -> 200";; 401) bad "auth health -> 401 (anon key missing/wrong)";; *) bad "auth health -> $c";; esac

say "CORS preflight from site origin"
hdrs=$(curl -s -i -X OPTIONS --max-time 20 \
  -H "Origin: $SITE" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: authorization,apikey,content-type" \
  "$AUTH_HOST/auth/v1/token?grant_type=password")
echo "$hdrs" | head -1
if echo "$hdrs" | grep -qi 'access-control-allow-origin'; then
  ok "CORS allow-origin present"
else
  bad "CORS allow-origin MISSING for $SITE"
fi

say "Login endpoint responds (bad creds probe)"
resp=$(curl -s -o /tmp/_sx_probe.json -w '%{http_code}' --max-time 20 -X POST \
  -H 'Content-Type: application/json' \
  -H "Origin: $SITE" \
  ${AUTH_ARGS+"${AUTH_ARGS[@]}"} \
  --data '{"email":"smoke-probe@sleepox.invalid","password":"wrong-password-probe"}' \
  "$AUTH_HOST/auth/v1/token?grant_type=password")
case "$resp" in
  400) ok "auth returns 400 invalid_credentials (healthy)";;
  401) bad "auth 401 — anon key missing/invalid in .env (VITE_SUPABASE_PUBLISHABLE_KEY)"; head -c 300 /tmp/_sx_probe.json; echo;;
  429) bad "auth rate-limited (429) — raise GOTRUE rate limits";;
  5*)  bad "auth 5xx ($resp) — DB/pool problem"; head -c 300 /tmp/_sx_probe.json; echo;;
  *)   bad "unexpected $resp"; head -c 300 /tmp/_sx_probe.json; echo;;
esac


say "Bundle points at production backend"
asset=$(curl -s --compressed --max-time 20 "$SITE/login" | grep -aoE '/assets/[A-Za-z0-9._-]+\.js' | sort -u | head -5)
if [ -z "$asset" ]; then
  echo "  (no asset refs found in HTML — SSR only, skipping)"
else
  leak=0
  for a in $asset; do
    # Ignore SDK documentation placeholders; real hosted project references
    # are exactly 20 lowercase alphanumeric characters.
    if curl -s --compressed --max-time 20 "$SITE$a" | grep -aEq 'https://[a-z0-9]{20}\.supabase\.co'; then
      bad "leak in $a"; leak=1
    fi
  done
  [ "$leak" -eq 1 ] && bad "bundle still references *.supabase.co (wrong .env at build time)" || ok "bundle uses self-hosted auth host"
fi


say "Recent auth errors (last 1h)"
if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -q '^supabase-auth$'; then
  dbfail=$(docker logs --since 1h supabase-auth 2>&1 | grep -c 'failed to connect to `host=db')
  e500=$(docker logs --since 1h supabase-auth 2>&1 | grep -c '"status":500')
  echo "  db-connect failures: $dbfail"
  echo "  500 responses:      $e500"
  [ "$dbfail" -gt 0 ] && bad "DB connect failures present — increase GOTRUE_DB_MAX_POOL_SIZE"
  [ "$e500" -gt 0 ] && bad "auth 500s present"
  [ "$dbfail" -eq 0 ] && [ "$e500" -eq 0 ] && ok "no auth DB errors / 500s"
  docker inspect -f '  pool={{range .Config.Env}}{{if eq (slice . 0 (len "GOTRUE_DB_MAX_POOL_SIZE")) "GOTRUE_DB_MAX_POOL_SIZE"}}{{.}}{{end}}{{end}}' supabase-auth 2>/dev/null || true
else
  echo "  (docker/supabase-auth not available here — skipping)"
fi

say "Result"
[ "$FAIL" -eq 0 ] && { ok "ALL CHECKS PASSED"; exit 0; } || { bad "SOME CHECKS FAILED"; exit 1; }
