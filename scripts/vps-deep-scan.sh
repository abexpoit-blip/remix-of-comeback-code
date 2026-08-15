#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════
# SLEEPOX FULL-SYSTEM DEEP SCAN
# Run on VPS:  bash scripts/vps-deep-scan.sh [hours]
# Finds: code breaks, runtime crashes, config leaks, DB leaks,
#        routing failures, filter over-blocking, deploy drift.
# Read-only. Changes nothing.
# ════════════════════════════════════════════════════════════════════
set -u
HOURS="${1:-6}"
W="${HOURS} hours"
APP_DIR="/opt/sleepox-app-new"
cd "$APP_DIR" 2>/dev/null || { echo "❌ $APP_DIR not found"; exit 1; }

DB=$(docker ps --filter name=supabase-db --format '{{.Names}}' | head -n1)
q() { [ -n "$DB" ] && docker exec -i "$DB" psql -U postgres -d postgres -q -c "$1" 2>&1 | sed 's/^/   /'; }
hdr() { echo ""; echo "════════ $* ════════"; }
FAILS=0
bad() { echo "   ❌ $*"; FAILS=$((FAILS+1)); }
ok()  { echo "   ✅ $*"; }

# ── 1. DEPLOY / BUILD INTEGRITY ─────────────────────────────────────
hdr "1) DEPLOY & BUILD INTEGRITY"
echo "   HEAD:        $(git rev-parse --short HEAD 2>/dev/null)"
echo "   Branch:      $(git rev-parse --abbrev-ref HEAD 2>/dev/null)"
echo "   Build stamp: $(cat .sleepox-build 2>/dev/null || echo 'MISSING')"
git fetch origin -q 2>/dev/null
BEHIND=$(git rev-list --count HEAD..origin/main 2>/dev/null || echo "?")
[ "$BEHIND" = "0" ] && ok "code up to date with GitHub" || bad "VPS is $BEHIND commits BEHIND origin/main — deploy needed"
if git status --porcelain 2>/dev/null | grep -q .; then
  bad "uncommitted local changes on VPS (will be stashed on next deploy):"
  git status --porcelain | head -10 | sed 's/^/      /'
else ok "working tree clean"; fi
[ -f ".output/server/index.mjs" ] && ok "server bundle present ($(du -sh .output 2>/dev/null | cut -f1))" || bad ".output/server/index.mjs MISSING — app is running old/none build"
CHUNKS=$(ls .output/public/assets/*.js .output/public/_build/assets/*.js 2>/dev/null | wc -l)
echo "   client chunks: $CHUNKS"
[ "$CHUNKS" -lt 5 ] && bad "suspiciously few client chunks — build may be truncated"
[ -f ".output/public/favicon.ico" ] && ok "favicon.ico present" || bad "favicon.ico missing in build output (log spam ENOENT)"
STALE=$(pm2 logs --lines 500 --nostream 2>/dev/null | grep -c 'ERR_MODULE_NOT_FOUND')
[ "${STALE:-0}" -gt 0 ] && bad "stale _ssr chunk imports in recent logs — workers need a full restart after deploy"


# ── 2. PROCESS HEALTH ───────────────────────────────────────────────
hdr "2) PM2 WORKER HEALTH"
pm2 jlist 2>/dev/null | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
 let a=[];try{a=JSON.parse(s)}catch(e){console.log("   pm2 jlist unreadable");return}
 let bad=0;
 for(const p of a){const e=p.pm2_env||{};const m=p.monit||{};
  const line=`   ${p.name.padEnd(12)} ${String(e.status).padEnd(10)} restarts=${String(e.restart_time).padEnd(5)} mem=${Math.round((m.memory||0)/1048576)}MB cpu=${m.cpu}%`;
  console.log(line);
  if(e.status!=="online"||e.restart_time>10)bad++;}
 console.log(bad?`   ❌ ${bad} worker(s) unhealthy (offline or restart-looping)`:"   ✅ all workers online, restart counts sane");
});'

hdr "3) PORT LISTENERS (expect 4000-4007)"
for p in 4000 4001 4002 4003 4004 4005 4006 4007; do
  ss -tlnp 2>/dev/null | grep -q ":$p " && echo -n "" || bad "port $p NOT listening"
done
ss -tlnp 2>/dev/null | grep -cE ":40(0[0-7]) " | xargs -I{} echo "   listening workers: {}/8"

# ── 4. RUNTIME CRASHES IN LOGS ──────────────────────────────────────
hdr "4) RUNTIME ERRORS IN PM2 LOGS (last 4000 lines)"
LOGS=$(pm2 logs --lines 4000 --nostream 2>/dev/null)
for pat in "MODULE_NOT_FOUND" "ENOENT" "is not a function" "Cannot read properties" "ReferenceError" "TypeError" "URIError" "ECONNREFUSED" "ETIMEDOUT" "Unhandled" "uncaughtException" "FATAL" "out of memory"; do
  n=$(printf '%s' "$LOGS" | grep -ci "$pat")
  [ "$n" -gt 0 ] && { bad "$pat  ×$n"; printf '%s' "$LOGS" | grep -i "$pat" | tail -2 | cut -c1-160 | sed 's/^/         /'; }
done
DROP=$(printf '%s' "$LOGS" | grep -c '\[click-batch\]\[DROP\]')
FAIL=$(printf '%s' "$LOGS" | grep -c '\[click-batch\]\[FAIL\]')
echo "   click-batch DROP=$DROP FAIL=$FAIL"
[ "$DROP" -gt 0 ] && bad "clicks are being DROPPED (data loss)"
[ "$FAILS" -eq 0 ] && ok "no fatal runtime patterns found"

# ── 5. ENV / SECRET SANITY ──────────────────────────────────────────
hdr "5) ENV SANITY (values never printed)"
for k in VITE_SUPABASE_URL VITE_SUPABASE_PUBLISHABLE_KEY SUPABASE_SERVICE_ROLE_KEY; do
  grep -q "^$k=" .env 2>/dev/null && echo "   ✅ $k set" || bad "$k MISSING in .env"
done
grep -q "^DATABASE_URL=" .env 2>/dev/null && echo "   ✅ DATABASE_URL set" \
  || echo "   ℹ️  DATABASE_URL not set (optional — app uses the Supabase REST/service key)"
if grep -qE '^(VITE_)?SUPABASE_URL=.*supabase\.co' .env 2>/dev/null; then
  bad "self-host .env still points at CLOUD supabase.co — local DB is bypassed"
fi
# Only a REAL hosted project ref (20 lowercase alphanumerics) is a leak, and only
# in chunks the CURRENT app shell actually loads. The asset attic intentionally
# keeps chunks from older deploys so draining tabs keep working; scanning those
# reports long-dead builds as if they were live.
CUR_ASSETS=$(curl -s --max-time 5 -H 'Accept-Encoding: identity' \
  -H 'Host: sleepox.com' -H 'X-Forwarded-Host: sleepox.com' \
  "http://127.0.0.1:4000/login" 2>/dev/null | grep -aoE '/assets/[^"'"'"' ]+\.js' | sort -u)
LEAK=""
while IFS= read -r a; do
  [ -n "$a" ] || continue
  f=".output/public$a"
  [ -f "$f" ] || continue
  hit=$(grep -haoE 'https://[a-z0-9]{20}\.supabase\.co' "$f" 2>/dev/null | sort -u | head -1)
  [ -n "$hit" ] && LEAK="$hit"
done <<< "$CUR_ASSETS"
[ -n "$LEAK" ] && bad "cloud project URL in LIVE client bundle: $LEAK" || ok "no hosted Supabase URL in live client bundle"


# ── 6. HTTP SURFACE PROBES ──────────────────────────────────────────
hdr "6) HTTP SURFACE (SaaS vs ad domains)"
probe() { curl -s -o /dev/null -w '%{http_code}' -m 12 ${3:+-A "$3"} "$1$2" 2>/dev/null || echo ERR; }
for d in https://sleepox.com; do
  echo "   SaaS $d      /=$(probe $d /)  /dashboard=$(probe $d /dashboard)  /login=$(probe $d /login)   (expect 200/200|302/200)"
done
for d in https://mefok.com https://skypq.com https://breezysocial.com; do
  R=$(probe $d /); DASH=$(probe $d /dashboard); LOG=$(probe $d /login)
  echo "   AD   $d  /=$R  /dashboard=$DASH  /login=$LOG   (expect 200/404/404)"
  [ "$DASH" = "404" ] || bad "$d/dashboard = $DASH — SaaS LEAK to ad reviewers!"
  [ "$LOG" = "404" ]  || bad "$d/login = $LOG — SaaS LEAK!"
done

hdr "7) REDIRECT BEHAVIOUR (real link, 3 personas)"
CODE=$(q "SELECT short_code FROM links WHERE is_active LIMIT 1;" | sed -n '3p' | tr -d ' ')
if [ -n "$CODE" ]; then
  echo "   test code: $CODE"
  FBUA='Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/450.0.0.0.0;]'
  echo "   human(FB mobile): $(curl -s -o /dev/null -w '%{http_code}' -m 15 -A "$FBUA" -e 'https://l.facebook.com/' -H 'Accept: text/html,application/xhtml+xml' "https://mefok.com/$CODE?fbclid=t" ) (expect 200 = content bridge)"
  echo "   meta crawler:     $(curl -s -o /dev/null -w '%{http_code}' -m 15 -A 'facebookexternalhit/1.1' "https://mefok.com/$CODE") (expect 200 = safe article)"
  echo "   bare curl:        $(curl -s -o /dev/null -w '%{http_code}' -m 15 "https://mefok.com/$CODE") (expect 200 safe)"
  echo "   -- OG tags served to crawler --"
  curl -s -m 15 -A 'facebookexternalhit/1.1' "https://mefok.com/$CODE" | grep -oE '<meta[^>]*og:(title|image|url|description)[^>]*>' | head -4 | cut -c1-140 | sed 's/^/      /'
else bad "could not read a test short_code from DB"; fi

# ── 8. DB LEAK AUDIT ────────────────────────────────────────────────
hdr "8) DB CONFIG LEAKS"
echo "-- links whose safe_url points at our SaaS or an ad host (must be 0) --"
q "SELECT
     count(*) FILTER (WHERE safe_url ILIKE '%sleepox.com%') AS safe_is_saas,
     count(*) FILTER (WHERE safe_url IS NOT NULL AND safe_url NOT ILIKE '%sleepox.com%'
                       AND (safe_url ILIKE '%cpm%' OR safe_url ILIKE '%adsterra%'
                            OR safe_url = adsterra_url OR safe_url = destination_url)) AS safe_is_offer,
     count(*) FILTER (WHERE safe_url IS NULL OR safe_url='') AS uses_pool,
     count(*) AS total
   FROM links WHERE is_active;"
echo "-- distinct offer hosts in use --"
q "SELECT split_part(split_part(coalesce(adsterra_url,destination_url),'//',2),'/',1) host, count(*)
   FROM links WHERE is_active GROUP BY 1 ORDER BY 2 DESC LIMIT 12;"

hdr "9) TRAFFIC & FILTER (${HOURS}h)"
q "SELECT count(*) total, count(*) FILTER (WHERE NOT is_bot) humans,
     count(*) FILTER (WHERE is_bot) bots,
     round(100.0*count(*) FILTER (WHERE is_bot)/nullif(count(*),0),2) bot_pct
   FROM clicks WHERE created_at > now() - interval '$W';"
echo "-- routing split --"
q "SELECT routed_to, count(*) FILTER (WHERE NOT is_bot) humans, count(*) FILTER (WHERE is_bot) bots
   FROM clicks WHERE created_at > now() - interval '$W' GROUP BY 1 ORDER BY 2 DESC;"
echo "-- REAL LOSS: humans sent to safe (must be ~0) --"
q "SELECT coalesce(bot_reason,'(none)') reason, coalesce(nullif(country,''),'(unknown)') c, count(*)
   FROM clicks WHERE created_at > now() - interval '$W'
     AND NOT is_bot AND routed_to IN ('safe','fb-article')
   GROUP BY 1,2 ORDER BY 3 DESC LIMIT 15;"
echo "-- top block reasons --"
q "SELECT split_part(coalesce(bot_reason,'(none)'),':',1) reason, count(*)
   FROM clicks WHERE created_at > now() - interval '$W' AND is_bot GROUP BY 1 ORDER BY 2 DESC LIMIT 15;"
echo "-- ours injection (target ~10%) --"
q "SELECT round(100.0*count(*) FILTER (WHERE NOT is_bot AND routed_to='ours')
     /nullif(count(*) FILTER (WHERE NOT is_bot),0),2) AS ours_pct
   FROM clicks WHERE created_at > now() - interval '$W';"
echo "-- hourly gaps = downtime --"
q "SELECT date_trunc('hour',created_at) h, count(*) FROM clicks
   WHERE created_at > now() - interval '$W' GROUP BY 1 ORDER BY 1;"

hdr "10) APP ERROR LOG TABLE (${HOURS}h)"
q "SELECT source, level, count(*) n, left(max(message),100) sample
   FROM error_logs WHERE created_at > now() - interval '$W'
   GROUP BY 1,2 ORDER BY 3 DESC LIMIT 15;"

hdr "11) NGINX"
awk '{print $9}' /var/log/nginx/access.log 2>/dev/null | sort | uniq -c | sort -rn | head -6 | sed 's/^/   /'
grep -Eo '(connect\(\) failed|upstream timed out|no live upstreams|Connection refused|reset by peer)' /var/log/nginx/error.log 2>/dev/null | sort | uniq -c | sort -rn | head -6 | sed 's/^/   /'
nginx -t 2>&1 | sed 's/^/   /'

hdr "12) SYSTEM RESOURCES"
free -m | sed 's/^/   /'
df -h / | sed 's/^/   /'
echo "   load: $(cat /proc/loadavg)"

hdr "13) DATABASE HEALTH"
q "SELECT count(*) connections, count(*) FILTER (WHERE state='active') active FROM pg_stat_activity;"
q "SELECT pg_size_pretty(pg_database_size('postgres')) db_size;"
q "SELECT schemaname||'.'||relname t, n_live_tup rows FROM pg_stat_user_tables ORDER BY n_live_tup DESC LIMIT 8;"

hdr "SUMMARY"
[ "$FAILS" -eq 0 ] && echo "   ✅ NO CRITICAL PROBLEMS DETECTED" || echo "   ❌ $FAILS critical problem(s) flagged above — search for ❌"
echo ""
