#!/bin/bash
# ============================================================================
# ZERO-DOWNTIME DEPLOY — Sleepox (8-process PM2 fork cluster behind nginx)
# ============================================================================
# Why the old deploy broke live Facebook ads:
#
#   `bun run build` wipes .output and writes NEW hashed chunk files. The 8 old
#   processes are still serving traffic from the OLD chunk names, and browsers
#   that already loaded a page keep requesting the old asset URLs. Between the
#   wipe and the restart every one of those requests 404s / throws
#   ERR_MODULE_NOT_FOUND. Meta's ad crawler re-checks landing pages constantly,
#   sees broken responses, and disapproves the running ads.
#
# This script removes that window:
#   1. snapshot the current build (instant, hardlinks — costs no disk)
#   2. build the new one
#   3. merge the OLD chunk files back in without overwriting new ones, so every
#      old asset URL still resolves while old processes drain
#   4. restart the 8 workers ONE AT A TIME, waiting for health between each,
#      so nginx always has 7 healthy backends
#
# Usage:  cd /opt/sleepox-app-new && bash scripts/deploy-zero-downtime.sh
# ============================================================================

set -e
cd /opt/sleepox-app-new

PORTS=(4000 4001 4002 4003 4004 4005 4006 4007)

echo "===== [1/6] git pull ====="
git pull

echo "===== [2/6] bun install ====="
bun install

echo "===== [3/6] snapshot current build (old chunks kept alive) ====="
rm -rf .output.prev
if [ -d .output ]; then
  # -l = hardlinks: instant and uses no extra disk space
  cp -al .output .output.prev
  echo "  snapshot ready"
else
  echo "  no previous build (first deploy)"
fi

echo "===== [4/6] bun run build (old processes still serving) ====="
bun run build

echo "===== [5/6] merge old chunks back (no overwrite of new files) ====="
if [ -d .output.prev ]; then
  cp -rn .output.prev/. .output/ 2>/dev/null || true
  echo "  old asset URLs still resolve during drain"
fi

echo "===== [6/6] rolling restart — 1 worker at a time ====="
for i in 0 1 2 3 4 5 6 7; do
  port=${PORTS[$i]}
  echo "--- restarting sleepox-$i (port $port) ---"
  pm2 restart "sleepox-$i" --update-env
  healthy=0
  for try in $(seq 1 20); do
    sleep 1
    if curl -sf -o /dev/null --max-time 3 "http://127.0.0.1:$port/favicon.ico" 2>/dev/null \
       || curl -sf -o /dev/null --max-time 3 "http://127.0.0.1:$port/" 2>/dev/null; then
      echo "  ✅ sleepox-$i healthy after ${try}s"
      healthy=1
      break
    fi
  done
  if [ "$healthy" -ne 1 ]; then
    echo "  ❌ sleepox-$i did NOT come back — ABORTING, remaining workers keep old code"
    pm2 logs "sleepox-$i" --lines 40 --nostream
    exit 1
  fi
  sleep 1
done

echo "===== cleanup ====="
# Keep the snapshot for 1 deploy cycle so any straggler request still resolves.
# It is hardlinked, so it costs almost nothing.
find .output.prev -type f -mmin +120 -delete 2>/dev/null || true

echo "===== ✅ zero-downtime deploy complete ====="
pm2 status
pm2 logs --lines 30 --nostream
