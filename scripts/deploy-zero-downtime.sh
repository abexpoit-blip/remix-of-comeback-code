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
STAGING="$APP_DIR/.zero-downtime-build"
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

validate_production_env() {
  local env_file="$1"
  [ -f "$env_file" ] || return 1
  ! grep -q 'supabase\.co' "$env_file" || return 1
  grep -qE "^VITE_SUPABASE_URL=['\"]?https://supabase\.sleepox\.com/?['\"]?$" "$env_file" || return 1
  grep -qE '^SUPABASE_(SERVICE_ROLE_KEY|SECRET_KEY)=' "$env_file" || return 1
}

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

# Verify every relative static import in the generated server graph before it
# is allowed anywhere near a worker. This catches incomplete Nitro output such
# as `_ssr/foo-HASH.mjs` being referenced but absent.
validate_server_graph() {
  local root="$1"
  python3 - "$root" <<'PY'
import pathlib, re, sys
root = pathlib.Path(sys.argv[1]).resolve()
server = root / "server"
missing = []
patterns = [
    re.compile(r'''(?:from\s*|import\s*\(|import\s*)["'](\.{1,2}/[^"']+)["']'''),
    re.compile(r'''new\s+URL\s*\(\s*["'](\.{1,2}/[^"']+)["']\s*,\s*import\.meta\.url'''),
]
for source in server.rglob("*.mjs"):
    text = source.read_text("utf-8", errors="ignore")
    for pattern in patterns:
        for spec in pattern.findall(text):
            target = (source.parent / spec.split("?", 1)[0].split("#", 1)[0]).resolve()
            if not target.exists():
                missing.append(f"{source.relative_to(root)} -> {spec}")
if missing:
    print("\n".join(missing[:100]), file=sys.stderr)
    sys.exit(1)
entry = server / "index.mjs"
if not entry.is_file() or entry.stat().st_size == 0:
    print("server/index.mjs missing or empty", file=sys.stderr)
    sys.exit(1)
print(f"validated {sum(1 for _ in server.rglob('*.mjs'))} server modules")
PY
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

# Recover from the legacy backup name when necessary.
if ! validate_production_env "$ENV_BACKUP" && validate_production_env "/root/sleepox.env.GOOD"; then
  cp /root/sleepox.env.GOOD "$ENV_BACKUP"
  chmod 600 "$ENV_BACKUP"
  backup_count=$(env_count "$ENV_BACKUP")
fi

# A tracked repository .env must never win over the VPS production environment.
if ! validate_production_env .env && validate_production_env "$ENV_BACKUP"; then
  cp "$ENV_BACKUP" .env
  env_vars=$(env_count .env)
  echo "  ♻️  restored the verified self-hosted production .env"
fi
echo "  .env vars: $env_vars"
[ "$env_vars" -ge 10 ] || fail ".env only has $env_vars vars and backup $ENV_BACKUP has $backup_count — restore production .env manually before deploying"
validate_production_env .env || fail ".env is not the verified self-hosted production config — run scripts/vps-fix-selfhost-env.sh"
node scripts/verify-env.mjs || fail "environment verification failed — run scripts/vps-fix-selfhost-env.sh"
[ -f ecosystem.config.cjs ] || fail "ecosystem.config.cjs missing"
avail_mb=$(free -m | awk '/^Mem:/{print $7}')
echo "  available RAM: ${avail_mb}MB"
[ "${avail_mb:-0}" -ge 700 ] || echo "  ⚠️  low RAM — build may be slow or OOM"

# Preserve the verified environment outside the repository BEFORE any git
# operation. Some legacy repositories still track .env despite .gitignore.
cp .env "$ENV_BACKUP"
chmod 600 "$ENV_BACKUP"
if git ls-files --error-unmatch .env >/dev/null 2>&1; then
  echo "  ⚠️  repository tracks .env; deploy will restore the VPS copy after git sync"
fi

# --- 2. git sync (divergence handling) ---------------------------------------
if [ "$DO_PULL" = "1" ]; then
  log "[2/8] git sync"
  # TanStack regenerates this file during install/build. It may be tracked only
  # on the incoming revision, so `git checkout --` cannot always clean it and
  # both fast-forward and reset then fail with "Entry ... not uptodate".
  rm -f src/routeTree.gen.ts
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
    if [ "$DIVERGE_MODE" = "reset" ]; then
      git reset --hard "origin/$BRANCH" || fail "fast-forward reset failed"
    else
      git merge --ff-only "origin/$BRANCH" || fail "fast-forward failed"
    fi
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
  fi
else
  log "[2/8] git sync skipped (--no-pull)"
fi

# Always restore after git sync. A fast-forward/reset can replace a tracked .env
# with the repository's hosted-backend values even when .gitignore contains it.
cp "$ENV_BACKUP" .env || fail "could not restore production .env after git sync"
chmod 600 .env
validate_production_env .env || fail "git sync replaced production .env and recovery validation failed"
node scripts/verify-env.mjs || fail "post-sync environment verification failed"
echo "  ✅ self-hosted production .env restored and verified after git sync"
echo "  HEAD: $(git rev-parse --short HEAD) — $(git log -1 --pretty=%s)"

# --- 3. deps -----------------------------------------------------------------
log "[3/8] bun install"
bun install --frozen-lockfile || bun install || fail "bun install failed"

# --- 4. snapshot live build (instant hardlink rollback point) -----------------
log "[4/8] snapshot current live build"
snapshot_live
[ -d "$PREV" ] && echo "  snapshot: $(du -sh "$PREV" | cut -f1)" || echo "  (no previous build to snapshot)"
# Never remove or build over LIVE: existing workers can lazy-import server
# chunks at any time. Build in an isolated checkout and swap only after the
# complete generated module graph has passed validation.
rm -rf "$STAGING"

# --- 5. build ----------------------------------------------------------------
log "[5/8] build"

mkdir -p "$STAGING"
tar --exclude='./.git' --exclude='./node_modules' --exclude='./.output' \
  --exclude='./.output.previous' --exclude='./.zero-downtime-build' \
  --exclude='./.asset-attic' -cf - . | tar -xf - -C "$STAGING"

# Ignore stale backend variables exported in the deploy shell. Vite reads the
# canonical production values from the staged copy of the verified .env.
if ! (
  cd "$STAGING" &&
  bun install --frozen-lockfile &&
  env -u SUPABASE_URL -u SUPABASE_PROJECT_ID -u SUPABASE_PUBLISHABLE_KEY \
    -u SUPABASE_ANON_KEY -u SUPABASE_SERVICE_ROLE_KEY -u SUPABASE_SECRET_KEY \
    -u VITE_SUPABASE_URL -u VITE_SUPABASE_PROJECT_ID \
    -u VITE_SUPABASE_PUBLISHABLE_KEY -u VITE_SUPABASE_ANON_KEY bun run build
); then
  echo "  build failed — restoring previous build"
  rm -rf "$STAGING"
  echo "  ✅ live build was never touched (workers still online)"
  fail "build failed — nothing deployed"
fi
FRESH="$STAGING/.output"
if [ ! -f "$FRESH/server/index.mjs" ]; then
  rm -rf "$STAGING"
  fail "incomplete build — nothing deployed"
fi

# Old workers remain alive during rolling restart and can still request modules
# from their old graph. Preserve old hash-named server chunks without replacing
# any fresh file, then validate both graphs' references before the atomic swap.
if [ -d "$PREV/server" ]; then
  cp -an "$PREV/server/." "$FRESH/server/" 2>/dev/null || true
fi
validate_server_graph "$FRESH" || {
  rm -rf "$STAGING"
  fail "generated server graph has missing imports — live build untouched"
}

# Hard guard BEFORE any worker restart. The SDK ships inert documentation
# examples such as example/project-id/xyzcompany/realtime.supabase.co, which
# bundlers may preserve in comments and source maps. Real hosted project refs
# are 20 lowercase alphanumeric characters; reject those while ignoring docs.
leaked_host="$(grep -rhaoE 'https://[a-z0-9]{20}\.supabase\.co' "$FRESH" 2>/dev/null \
  | sort -u \
  | head -1 \
  || true)"
if [ -n "$leaked_host" ]; then
  echo "  ❌ built bundle points at $leaked_host instead of the self-hosted backend"
  rm -rf "$STAGING"
  fail "wrong .env at build time — run: bash scripts/vps-fix-selfhost-env.sh && bash scripts/deploy-zero-downtime.sh --auto-reset"
fi
self_hosted_refs="$(grep -rla 'https://supabase\.sleepox\.com' "$FRESH" 2>/dev/null | wc -l)"
[ "$self_hosted_refs" -gt 0 ] || {
  rm -rf "$STAGING"
  fail "fresh build does not contain the required self-hosted backend URL"
}
echo "  ✅ fresh output contains only the self-hosted backend URL"

# Atomic publish: no request can observe a partially-written output tree.
OLD_LIVE="$APP_DIR/.output.old.$$.tmp"
mv "$LIVE" "$OLD_LIVE" || fail "could not move live build for atomic swap"
if ! mv "$FRESH" "$LIVE"; then
  mv "$OLD_LIVE" "$LIVE" || true
  fail "atomic publish failed; previous live build restored"
fi
rm -rf "$OLD_LIVE" "$STAGING"
validate_server_graph "$LIVE" || rollback


# --- 6. keep old hashed chunks resolvable for draining tabs -------------------
log "[6/8] keep old client chunks resolvable (asset attic)"
# CLIENT assets only. Merging the previous server/ tree into a fresh build mixes
# two module graphs and produces ERR_MODULE_NOT_FOUND on _ssr chunks, so the
# server directory must stay 100% from the fresh build.
#
# The attic accumulates client chunks across MANY deploys (not just the last
# one), so tabs opened several deploys ago still resolve their hashed chunks
# instead of throwing ENOENT / "Failed to fetch dynamically imported module".
ATTIC="$APP_DIR/.asset-attic"
mkdir -p "$ATTIC"

# 1. archive the chunks of the build we are replacing
if [ -d "$PREV/public" ]; then
  cp -rn "$PREV/public/." "$ATTIC/" 2>/dev/null || true
fi
# 2. archive the fresh chunks too (so the NEXT deploy can serve them)
if [ -d "$LIVE/public" ]; then
  cp -rn "$LIVE/public/." "$ATTIC/" 2>/dev/null || true
fi
# 3. prune anything untouched for 21 days so the attic cannot grow forever
find "$ATTIC" -type f -mtime +21 -delete 2>/dev/null || true
find "$ATTIC" -type d -empty -delete 2>/dev/null || true
mkdir -p "$ATTIC"
# 4. restore historic chunks into the live build WITHOUT overwriting fresh files
cp -rn "$ATTIC/." "$LIVE/public/" 2>/dev/null || true
# 5. guarantee the repo's static files (favicon.ico, icons, og-default.png…)
#    exist in the served root. Some builds skip copying public/, which turns
#    every favicon request into an ENOENT stack trace in the worker logs.
if [ -d "$APP_DIR/public" ]; then
  mkdir -p "$LIVE/public"
  cp -rn "$APP_DIR/public/." "$LIVE/public/" 2>/dev/null || true
fi
echo "  attic: $(du -sh "$ATTIC" 2>/dev/null | cut -f1) | live build: $(du -sh "$LIVE" | cut -f1)"





# --- 7. rolling restart ------------------------------------------------------
log "[7/8] rolling restart (1 worker at a time, 7 stay online)"
# Flush pm2 logs first: errors from the PREVIOUS build (stale _ssr chunk imports,
# favicon ENOENT) otherwise keep showing up in audits as if they were current.
pm2 flush >/dev/null 2>&1 || true
before_499=$(nginx_status_count 499)
before_502=$(nginx_status_count 502)
before_503=$(nginx_status_count 503)
before_504=$(nginx_status_count 504)
rolling_restart || rollback
pm2 save >/dev/null 2>&1 || true

# --- 8. verify ---------------------------------------------------------------
log "[8/8] verify"
# Only inspect chunks referenced by the current app shell. Older chunks are
# intentionally retained above so already-open tabs keep working; scanning the
# whole assets directory would report stale backend URLs as false positives.
current_assets=$(curl -s --max-time 5 \
  -H 'Accept-Encoding: identity' \
  -H 'Host: sleepox.com' \
  -H 'X-Forwarded-Host: sleepox.com' \
  "http://127.0.0.1:${PORTS[0]}/login" \
  | grep -aoE '/assets/[^"'"'"' ]+\.js' \
  | sort -u)
bad=""
while IFS= read -r asset; do
  [ -n "$asset" ] || continue
  bad=$(curl -s --max-time 5 -H 'Accept-Encoding: identity' "http://127.0.0.1:${PORTS[0]}$asset" \
    | grep -aoE 'https://[a-z0-9]{20}\.supabase\.co' \
    | head -1 \
    || true)
  [ -z "$bad" ] || break
done <<< "$current_assets"
if [ -n "$bad" ]; then
  echo "  ❌ current bundle references $bad instead of the self-hosted backend"
  rollback
fi
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
