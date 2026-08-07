#!/usr/bin/env bash
# Lift auth / signup rate limits on the self-hosted Supabase stack.
#  - raises GoTrue rate limits (token, verify, signup email)
#  - keeps the DB pool settings
#  - reports any nginx limit_req rules that could throttle logins
# Safe: backs up compose file, recreates only the auth container.
set -euo pipefail

say() { printf '\n==> %s\n' "$*"; }
ok()  { printf '  ok %s\n' "$*"; }
bad() { printf '  !! %s\n' "$*"; }

COMPOSE=$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project.config_files"}}' supabase-auth 2>/dev/null || true)
[ -n "$COMPOSE" ] || { bad "cannot find docker-compose file for supabase-auth"; exit 1; }
DIR=$(dirname "$COMPOSE")

say "Compose file: $COMPOSE"
cp "$COMPOSE" "$COMPOSE.bak.$(date +%s)"
ok "backup created"

say "Patching GoTrue rate limits"
COMPOSE="$COMPOSE" python3 - <<'PY'
import os, re
p = os.environ['COMPOSE']
s = open(p).read()
want = {
    'GOTRUE_RATE_LIMIT_HEADER': 'X-Forwarded-For',
    'GOTRUE_RATE_LIMIT_EMAIL_SENT': '1000',
    'GOTRUE_RATE_LIMIT_SMS_SENT': '1000',
    'GOTRUE_RATE_LIMIT_VERIFY': '10000',
    'GOTRUE_RATE_LIMIT_TOKEN_REFRESH': '10000',
    'GOTRUE_RATE_LIMIT_SSO': '10000',
    'GOTRUE_RATE_LIMIT_ANONYMOUS_USERS': '10000',
    'GOTRUE_DB_MAX_POOL_SIZE': '50',
    'GOTRUE_DB_MAX_IDLE_CONNS': '15',
}
m = (re.search(r'^(\s*)GOTRUE_DB_DRIVER:.*\n', s, re.M)
     or re.search(r'^(\s*)GOTRUE_SITE_URL:.*\n', s, re.M))
assert m, 'auth env block not found'
indent = m.group(1)
add = ''
for k, v in want.items():
    if re.search(rf'^\s*{k}:', s, re.M):
        s = re.sub(rf'^(\s*){k}:.*$', rf'\g<1>{k}: {v}', s, flags=re.M)
    else:
        add += f'{indent}{k}: {v}\n'
s = s[:m.end()] + add + s[m.end():]
open(p, 'w').write(s)
print('patched')
PY

say "Recreating auth container"
( cd "$DIR" && docker compose up -d --no-deps auth )
sleep 8
docker inspect -f '  status={{.State.Status}} restarts={{.RestartCount}}' supabase-auth

say "Active limits"
docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' supabase-auth | grep -E 'RATE_LIMIT|POOL' || bad "no limits found"

say "Nginx throttling rules (should be empty)"
if grep -rn "limit_req\|limit_conn" /etc/nginx 2>/dev/null | grep -v '^\s*#' ; then
  bad "nginx has request limits — remove/raise them if users report 503"
else
  ok "no nginx rate limits"
fi

say "Health"
curl -sS https://sleepox.com/api/public/health; echo
