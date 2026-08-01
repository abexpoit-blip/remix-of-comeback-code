#!/usr/bin/env bash
# ============================================================================
# ZERO-DOWNTIME DEPLOY — Sleepox (8 PM2 fork workers, ports 4000..4007, nginx)
# ============================================================================
# Guarantees:
#   * Divergent git branches are detected BEFORE anything is built.
#   * A hardlink snapshot of the live build is taken before the build starts,
#     so a failed build is restored instantly (no downtime, no traffic loss).
#   * Old hashed asset chunks stay resolvable while old tabs drain.
#   * Workers restart ONE at a time; nginx always keeps >= 7 healthy backends.
#   * Any worker that fails to come back => automatic rollback.
#
# Usage:
#   bash scripts/deploy-zero-downtime.sh                 # interactive
#   bash scripts/deploy-zero-downtime.sh --auto-reset    # divergence -> hard reset to origin/main
#   bash scripts/deploy-zero-downtime.sh --merge         # divergence -> merge origin/main
#   bash scripts/deploy-zero-downtime.sh --no-pull       # deploy current code
#   bash scripts/deploy-zero-downtime.sh --rollback      # undo last deploy
# ============================================================================
set -uo pipefail

APP_DIR="/opt/sleepox-app-new"
cd "$APP_DIR" 2>/dev/null || cd "$(dirname "$0")/.." || { echo "❌ app dir not found"; exit 1; }
APP_DIR="$PWD"

PORTS=(4000 4001 4002 4003 4004 4005 4006 4007)
BRANCH="${DEPLOY_BRANCH:-main}"
PREV="$APP_DIR/.output.previous"
LIVE="$APP_DIR/.output"
ENV_BACKUP="/root/sleepox-production.env"
DO_PULL=1
DIVERGE_MODE="ask"   # ask | reset | merge
DO_ROLLBACK=0
DEPLOY_STARTED_AT="$(date -u +%FT%TZ)"

nginx_status_count() {
  local status="$1"
  awk -v s="$status" '$9 == s { n++ } END { print n+0 }' /var/log/nginx/access.log 2>/dev/null
}

for arg in "$@"; do
  case "$arg" in
    --no-pull)    DO_PULL=0 ;;
    --rollback)   DO_ROLLBACK=1 ;;
    --auto-reset) DIVERGE_MODE="reset" ;;
    --merge)      DIVERGE_MODE="merge" ;;
    *) echo "unknown flag: $arg"; exit 2 ;;
  esac
done

log()  { echo -e "\n===== $* ====="; }
fail() { echo -e "\n❌ $*"; exit 1; }

# --- health probe: ANY HTTP response means the worker is up -------------------
worker_up() {
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "http://127.0.0.1:${1}/" 2>/dev/null)
  [[ "$code" =~ ^[1-5][0-9][0-9]$ ]]
}

wait_for_worker() {
  for _ in $(seq 1 30); do
    sleep 1
    if worker_up "$1"; then echo "  ✅ $2 healthy (port $1)"; return 0; fi
  done
  return 1
}

rolling_restart() {
  local failed=""
  for i in 0 1 2 3 4 5 6 7; do
    local name="sleepox-$i" port="${PORTS[$i]}"
    echo "--- restarting $name (port $port) ---"
    if pm2 describe "$name" >/dev/null 2>&1; then
      pm2 restart "$name" --update-env >/dev/null 2>&1
    else
      pm2 start ecosystem.config.cjs --only "$name" --update-env >/dev/null 2>&1
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

snapshot_live() {
  [ -d "$LIVE" ] || return 0
  rm -rf "$PREV"
  cp -al "$LIVE" "$PREV" 2>/dev/null || cp -a "$LIVE" "$PREV"
}

restore_prev() {
  [ -d "$PREV" ] || return 1
  rm -rf "$LIVE.broken"
  [ -d "$LIVE" ] && mv "$LIVE" "$LIVE.broken"
  cp -al "$PREV" "$LIVE" 2>/dev/null || cp -a "$PREV" "$LIVE"
}

rollback() {
  log "ROLLBACK — restoring previous build"
  restore_prev || fail "no $PREV snapshot to roll back to (site still serving current code)"
  rolling_restart && { echo "✅ rolled back to previous build"; exit 1; }
  fail "rollback restart failed — run: pm2 restart all --update-env"
}

[ "$DO_ROLLBACK" = "1" ] && rollback

# --- 1. preflight ------------------------------------------------------------
log "[1/8] preflight"
env_count() { [ -f "$1" ] && grep -c '=' "$1" || echo 0; }
backup_count=$(env_count "$ENV_BACKUP")
env_vars=$(env_count .env)

# a git reset can replace prod .env with the repo placeholder — self-heal from backup
if [ "$env_vars" -lt 10 ] && [ "$backup_count" -ge 10 ]; then
  cp "$ENV_BACKUP" .env
  env_vars=$(env_count .env)
  echo "  ♻️  .env looked like the repo placeholder — restored from $ENV_BACKUP"
fi
echo "  .env vars: $env_vars"
[ "$env_vars" -ge 10 ] || fail ".env only has $env_vars vars and backup $ENV_BACKUP has $backup_count — restore production .env manually before deploying"
grep -q 'supabase\.co' .env && fail ".env points at a *.supabase.co URL. Production must use https://supabase.sleepox.com"
[ -f ecosystem.config.cjs ] || fail "ecosystem.config.cjs missing"
avail_mb=$(free -m | awk '/^Mem:/{print $7}')
echo "  available RAM: ${avail_mb}MB"
[ "${avail_mb:-0}" -ge 700 ] || echo "  ⚠️  low RAM — build may be slow or OOM"

# .env must never be tracked by git, otherwise every reset wipes prod values
if git ls-files --error-unmatch .env >/dev/null 2>&1; then
  echo "  🔒 .env is tracked by git — untracking it so resets can't wipe it"
  git rm --cached .env >/dev/null 2>&1 || true
  grep -qx '.env' .gitignore 2>/dev/null || echo '.env' >> .gitignore
fi
# keep a fresh backup of the known-good env
cp .env "$ENV_BACKUP" 2>/dev/null || true

# --- 2. git sync (divergence handling) ---------------------------------------
if [ "$DO_PULL" = "1" ]; then
  log "[2/8] git sync"
  git checkout -- src/routeTree.gen.ts 2>/dev/null || true
  git fetch origin "$BRANCH" || fail "git fetch failed"

  LOCAL=$(git rev-parse HEAD)
  REMOTE=$(git rev-parse "origin/$BRANCH")
  BASE=$(git merge-base HEAD "origin/$BRANCH")
  AHEAD=$(git rev-list --count "origin/$BRANCH..HEAD")
  BEHIND=$(git rev-list --count "HEAD..origin/$BRANCH")
  echo "  local ahead: $AHEAD | behind: $BEHIND"

  if [ "$LOCAL" = "$REMOTE" ]; then
    echo "  ✅ already up to date with origin/$BRANCH"
  elif [ "$LOCAL" = "$BASE" ]; then
    echo "  ⏩ fast-forward"
    git merge --ff-only "origin/$BRANCH" || fail "fast-forward failed"
  elif [ "$REMOTE" = "$BASE" ]; then
    echo "  ⚠️  local is $AHEAD commit(s) ahead of origin/$BRANCH (VPS-only commits, nothing to pull)"
  else
    echo "  ⚠️  DIVERGED: $AHEAD local commit(s) vs $BEHIND remote commit(s)"
    mode="$DIVERGE_MODE"
    if [ "$mode" = "ask" ]; then
      if [ -t 0 ]; then
        echo "     [r] hard reset to origin/$BRANCH (discard local commits — recommended, repo is source of truth)"
        echo "     [m] merge origin/$BRANCH into local"
        echo "     [a] abort"
        read -r -p "  choose [r/m/a]: " ans
        case "$ans" in r|R) mode="reset" ;; m|M) mode="merge" ;; *) fail "aborted by user — nothing changed" ;; esac
      else
        fail "branches diverged and no TTY — re-run with --auto-reset or --merge"
      fi
    fi
    # stash any dirty tracked files so the reset/merge can't fail
    git stash push -u -m "auto-stash before deploy $(date -u +%FT%TZ)" >/dev/null 2>&1 || true
    if [ "$mode" = "reset" ]; then
      echo "  🔄 hard reset to origin/$BRANCH"
      git reset --hard "origin/$BRANCH" || fail "reset failed"
    else
      echo "  🔀 merging origin/$BRANCH"
      git merge --no-edit "origin/$BRANCH" || {
        git merge --abort 2>/dev/null || true
        fail "merge conflict — resolve manually or re-run with --auto-reset"
      }
    fi
    # .env is gitignored in the repo, but a reset can still wipe it if tracked
    [ -f .env ] || { cp "$ENV_BACKUP" .env; echo "  restored .env after git operation"; }
    [ "$(grep -c '=' .env)" -ge 10 ] || { cp "$ENV_BACKUP" .env; echo "  restored full prod .env"; }
  fi
else
  log "[2/8] git sync skipped (--no-pull)"
fi
echo "  HEAD: $(git rev-parse --short HEAD) — $(git log -1 --pretty=%s)"

# --- 3. deps -----------------------------------------------------------------
log "[3/8] bun install"
bun install --frozen-lockfile || bun install || fail "bun install failed"

# --- 4. snapshot live build (instant hardlink rollback point) -----------------
log "[4/8] snapshot current live build"
snapshot_live
[ -d "$PREV" ] && echo "  snapshot: $(du -sh "$PREV" | cut -f1)" || echo "  (no previous build to snapshot)"

# --- 5. build ----------------------------------------------------------------
log "[5/8] build"
if ! bun run build; then
  echo "  build failed — restoring previous build"
  restore_prev && echo "  ✅ previous build restored (workers untouched, site still live)"
  fail "build failed — nothing deployed"
fi
if [ ! -f "$LIVE/server/index.mjs" ]; then
  echo "  incomplete build (no server/index.mjs) — restoring previous build"
  restore_prev && echo "  ✅ previous build restored"
  fail "incomplete build — nothing deployed"
fi

# --- 6. keep old hashed chunks resolvable for draining tabs -------------------
log "[6/8] merge old asset chunks (no overwrite)"
[ -d "$PREV" ] && cp -rn "$PREV/." "$LIVE/" 2>/dev/null || true
echo "  live build: $(du -sh "$LIVE" | cut -f1)"

# --- 7. rolling restart ------------------------------------------------------
log "[7/8] rolling restart (1 worker at a time, 7 stay online)"
before_499=$(nginx_status_count 499)
before_502=$(nginx_status_count 502)
before_503=$(nginx_status_count 503)
before_504=$(nginx_status_count 504)
rolling_restart || rollback
pm2 save >/dev/null 2>&1 || true

# --- 8. verify ---------------------------------------------------------------
log "[8/8] verify"
bad=$(grep -ro 'https://[a-z0-9-]*\.supabase\.co' "$LIVE/public/assets" 2>/dev/null | head -1)
[ -z "$bad" ] || echo "  ⚠️  bundle still references $bad — check .env VITE_SUPABASE_URL"
for i in 0 1 2 3 4 5 6 7; do
  p="${PORTS[$i]}"
  printf "  sleepox-%s (%s): %s\n" "$i" "$p" "$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "http://127.0.0.1:$p/" || echo DOWN)"
done

# Regression guard: the proxy may rewrite /dashboard to /r/dashboard. Every
# worker must still return the app shell on the SaaS host, never a safe article.
for p in "${PORTS[@]}"; do
  if curl -s --max-time 5 -H 'Accept-Encoding: identity' -H 'Host: sleepox.com' -H 'X-Forwarded-Host: sleepox.com' "http://127.0.0.1:$p/r/dashboard" | grep -aEq 'The Weekly Note|Short Weekend Getaways'; then
    echo "  ❌ port $p still serves a safe article for the dashboard rewrite"
    rollback
  fi
done
echo "  ✅ dashboard rewrite verified on all workers"
after_499=$(nginx_status_count 499)
after_502=$(nginx_status_count 502)
after_503=$(nginx_status_count 503)
after_504=$(nginx_status_count 504)
deploy_ended_at="$(date -u +%FT%TZ)"
deploy_499=$((after_499 - before_499))
deploy_502=$((after_502 - before_502))
deploy_503=$((after_503 - before_503))
deploy_504=$((after_504 - before_504))
printf '%s\t%s\t499=%s\t502=%s\t503=%s\t504=%s\n' \
  "$DEPLOY_STARTED_AT" "$deploy_ended_at" "$deploy_499" "$deploy_502" "$deploy_503" "$deploy_504" \
  > "$APP_DIR/.last-deploy-traffic-loss"
echo "  deploy-window loss: 499=$deploy_499 502=$deploy_502 503=$deploy_503 504=$deploy_504"
pm2 list | grep sleepox || true
echo -e "\n✅ zero-downtime deploy complete. Rollback anytime: bash scripts/deploy-zero-downtime.sh --rollback"
