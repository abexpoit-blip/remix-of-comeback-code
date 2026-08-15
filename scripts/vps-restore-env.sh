#!/usr/bin/env bash
# Restore + protect the self-hosted production .env on the VPS.
#
# Why this exists: the repository still TRACKS .env (it carries the hosted
# cloud backend values used by the Lovable preview). Any manual
# `git reset --hard origin/main` on the VPS therefore overwrites the
# self-hosted production .env, which makes the app point at supabase.co and
# drops SUPABASE_SERVICE_ROLE_KEY.
#
# Running this once restores the production file from the verified backup and
# marks .env as skip-worktree, so future git resets can no longer clobber it.
#
# Usage: bash scripts/vps-restore-env.sh
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"
BACKUP="/root/sleepox-production.env"
LEGACY="/root/sleepox.env.GOOD"

ok()  { echo "   ✅ $*"; }
bad() { echo "   ❌ $*"; }

valid() {
  [ -f "$1" ] || return 1
  grep -q '^SUPABASE_SERVICE_ROLE_KEY=.\+' "$1" || return 1
  grep -qE '^(VITE_)?SUPABASE_URL=.+' "$1" || return 1
  ! grep -qE '^(VITE_)?SUPABASE_URL=.*supabase\.co' "$1" || return 1
  return 0
}

SRC=""
if valid "$BACKUP"; then SRC="$BACKUP"
elif valid "$LEGACY"; then SRC="$LEGACY"
fi

if valid .env; then
  ok "current .env is already the self-hosted production config"
  cp .env "$BACKUP"; chmod 600 "$BACKUP"
  ok "backup refreshed at $BACKUP"
elif [ -n "$SRC" ]; then
  cp "$SRC" .env; chmod 600 .env
  cp .env "$BACKUP"; chmod 600 "$BACKUP"
  ok "restored self-hosted production .env from $SRC"
else
  bad "no valid self-hosted .env backup found ($BACKUP / $LEGACY)"
  bad "recreate it with: bash scripts/vps-fix-selfhost-env.sh"
  exit 1
fi

# Stop git from ever replacing it again.
if git ls-files --error-unmatch .env >/dev/null 2>&1; then
  git update-index --skip-worktree .env 2>/dev/null \
    && ok "git skip-worktree set on .env (git reset can no longer overwrite it)" \
    || bad "could not set skip-worktree on .env"
fi

echo
echo "   summary:"
grep -cE '=' .env | sed 's/^/      vars: /'
grep -E '^(VITE_)?SUPABASE_URL=' .env | sed 's/=.*/=<local self-hosted>/' | sed 's/^/      /'
grep -q '^SUPABASE_SERVICE_ROLE_KEY=.\+' .env && echo "      SUPABASE_SERVICE_ROLE_KEY: present"
echo
echo "   next: bash scripts/deploy-zero-downtime.sh"
