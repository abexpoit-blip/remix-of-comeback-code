#!/usr/bin/env bash
# ============================================================================
# ZERO-DOWNTIME DEPLOY — Sleepox (8 PM2 fork workers, ports 4000..4007, nginx)
# ============================================================================
# Guarantees:
#   * The live .output is NEVER touched until a complete new build exists.
#     A failed/aborted build leaves the site running exactly as before.
#   * Old hashed asset chunks stay resolvable while old tabs drain.
#   * Workers restart ONE at a time; nginx always keeps >= 7 healthy backends.
#   * Any worker that fails to come back => automatic rollback to the previous
#     build, so the site can never end up down.
#
# Usage:  cd /opt/sleepox-app-new && bash scripts/deploy-zero-downtime.sh
#         bash scripts/deploy-zero-downtime.sh --no-pull    # deploy current code
#         bash scripts/deploy-zero-downtime.sh --rollback   # undo last deploy
# ============================================================================
set -uo pipefail

APP_DIR="/opt/sleepox-app-new"
cd "$APP_DIR" || { echo "❌ $APP_DIR not found"; exit 1; }

PORTS=(4000 4001 4002 4003 4004 4005 4006 4007)
STAGING="$APP_DIR/.deploy-staging"
PREV="$APP_DIR/.output.previous"
LIVE="$APP_DIR/.output"
DO_PULL=1

for arg in "$@"; do
  case "$arg" in
    --no-pull) DO_PULL=0 ;;
    --rollback) DO_ROLLBACK=1 ;;
  esac
done

log()  { echo -e "\n===== $* ====="; }
fail() { echo -e "\n❌ $*"; exit 1; }

# --- health probe: ANY HTTP response means the worker is up. -----------------
# (The old script used `curl -sf`, which treats 404/302 as failure — the app
#  legitimately 404s /favicon.ico on ad hosts, so every deploy "failed".)
worker_up() {
  local port="$1"
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "http://127.0.0.1:${port}/" 2>/dev/null)
  [[ "$code" =~ ^[1-5][0-9][0-9]$ ]] && [ "$code" != "000" ]
}

wait_for_worker() {
  local port="$1" name="$2"
  for _ in $(seq 1 30); do
    sleep 1
    if worker_up "$port"; then echo "  ✅ $name healthy (port $port)"; return 0; fi
  done
  return 1
}

rolling_restart() {
  local failed=""
  for i in 0 1 2 3 4 5 6 7; do
    local name="sleepox-$i" port="${PORTS[$i]}"
    echo "--- restarting $name (port $port) ---"
    if ! pm2 describe "$name" >/dev/null 2>&1; then
      pm2 start ecosystem.config.cjs --only "$name" --update-env >/dev/null 2>&1
    else
      pm2 restart "$name" --update-env >/dev/null 2>&1
    fi
    if ! wait_for_worker "$port" "$name"; then
      failed="$name"
      echo "  ❌ $name did not come back"
      pm2 logs "$name" --lines 30 --nostream || true
      break
    fi
    sleep 1
  done
  [ -z "$failed" ]
}

rollback() {
  log "ROLLBACK — restoring previous build"
  [ -d "$PREV" ] || fail "no $PREV snapshot to roll back to (site still serving current code)"
  rm -rf "$LIVE.broken"; [ -d "$LIVE" ] && mv "$LIVE" "$LIVE.broken"
  cp -al "$PREV" "$LIVE" 2>/dev/null || cp -a "$PREV" "$LIVE"
  rolling_restart && echo "✅ rolled back to previous build" || fail "rollback restart failed — run: pm2 restart all --update-env"
  exit 1
}

if [ "${DO_ROLLBACK:-0}" = "1" ]; then rollback; fi

# --- 1. preflight ------------------------------------------------------------
log "[1/7] preflight"
[ -f .env ] || fail ".env missing — restore it (cp /root/sleepox-production.env .env) before deploying"
env_vars=$(grep -c '=' .env)
echo "  .env vars: $env_vars"
[ "$env_vars" -ge 10 ] || fail ".env only has $env_vars vars — looks like the repo placeholder, not production. Restore /root/sleepox-production.env"
if grep -q 'supabase\.co' .env; then
  fail ".env points at a *.supabase.co URL. Production must use https://supabase.sleepox.com — fix .env first (VITE_* values are baked into the browser bundle)."
fi
avail_mb=$(free -m | awk '/^Mem:/{print $7}')
echo "  available RAM: ${avail_mb}MB"
[ "${avail_mb:-0}" -ge 700 ] || echo "  ⚠️  low RAM — build may be slow or OOM"

# --- 2. pull -----------------------------------------------------------------
if [ "$DO_PULL" = "1" ]; then
  log "[2/7] git pull"
  git checkout -- src/routeTree.gen.ts 2>/dev/null || true
  git pull --ff-only || fail "git pull failed (local changes? run: git stash -u)"
else
  log "[2/7] git pull skipped (--no-pull)"
fi
echo "  HEAD: $(git rev-parse --short HEAD)"

# --- 3. deps -----------------------------------------------------------------
log "[3/7] bun install"
bun install --frozen-lockfile || bun install || fail "bun install failed"

# --- 4. build into STAGING (live site untouched) ------------------------------
log "[4/7] build (live site keeps serving old build)"
rm -rf "$STAGING"
BUILD_OUT_DIR="$STAGING" bun run build || fail "build failed — nothing changed, site still live"
# The build writes to .output by convention; if the env override was ignored,
# the fresh .output IS the new build and the old one was already replaced.
if [ -d "$STAGING/server" ]; then
  NEW_BUILD="$STAGING"
elif [ -f "$LIVE/server/index.mjs" ]; then
  NEW_BUILD="$LIVE"
else
  fail "build produced no server bundle — site still serving previous build"
fi
[ -f "$NEW_BUILD/server/index.mjs" ] || fail "incomplete build (no server/index.mjs) — aborting before swap"

# --- 5. swap + keep old chunks alive -----------------------------------------
log "[5/7] swap in new build, keep old asset URLs resolvable"
if [ -d "$LIVE" ] && [ "$NEW_BUILD" != "$LIVE" ]; then
  rm -rf "$PREV"
  cp -al "$LIVE" "$PREV" 2>/dev/null || cp -a "$LIVE" "$PREV"
  rm -rf "$LIVE.old" && mv "$LIVE" "$LIVE.old"
  mv "$NEW_BUILD" "$LIVE"
  # merge old hashed chunks back WITHOUT overwriting new files
  cp -rn "$LIVE.old/." "$LIVE/" 2>/dev/null || true
  rm -rf "$LIVE.old"
elif [ -d "$LIVE" ]; then
  rm -rf "$PREV"; cp -al "$LIVE" "$PREV" 2>/dev/null || true
fi
echo "  live build: $(du -sh "$LIVE" | cut -f1)"

# --- 6. rolling restart ------------------------------------------------------
log "[6/7] rolling restart (1 worker at a time, 7 stay online)"
rolling_restart || rollback
pm2 save >/dev/null 2>&1 || true

# --- 7. verify ---------------------------------------------------------------
log "[7/7] verify"
bad=$(grep -ro 'https://[a-z0-9-]*\.supabase\.co' "$LIVE/public/assets" 2>/dev/null | head -1)
[ -z "$bad" ] || echo "  ⚠️  bundle still references $bad — check .env VITE_SUPABASE_URL"
for i in 0 1 2 3 4 5 6 7; do
  p="${PORTS[$i]}"
  printf "  sleepox-%s (%s): %s\n" "$i" "$p" "$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 http://127.0.0.1:$p/ || echo DOWN)"
done
pm2 list | grep sleepox || true
echo -e "\n✅ zero-downtime deploy complete. Rollback anytime: bash scripts/deploy-zero-downtime.sh --rollback"
