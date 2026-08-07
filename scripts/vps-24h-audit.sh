#!/usr/bin/env bash
# 24-hour full audit: traffic, routing, bot detection, domains, errors, PM2
set +e
cd /opt/sleepox-app-new 2>/dev/null || true

DB_CONTAINER="${DB_CONTAINER:-$(docker ps --filter name=supabase-db --format '{{.Names}}' | head -n 1)}"

if [ -n "$DB_CONTAINER" ]; then
  PSQL="docker exec -i $DB_CONTAINER psql -U postgres -d postgres -A -F$'\t' -P pager=off"
else
  PSQL=""
fi

if [ -z "$PSQL" ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
  URL="${SUPABASE_URL:-${VITE_SUPABASE_URL:-}}"
  KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"

  if [ -z "$URL" ] || [ -z "$KEY" ]; then
    echo "❌ Database container and REST credentials are both unavailable."
    exit 1
  fi

  rpc() {
    local function_name="$1"
    local body="${2:-{}}"
    curl --silent --show-error --fail-with-body \
      "$URL/rest/v1/rpc/$function_name" \
      -H "apikey: $KEY" \
      -H "Authorization: Bearer $KEY" \
      -H "Content-Type: application/json" \
      --data-raw "$body"
    echo
  }

  echo "════════════════════════════════════════════════════════"
  echo "REST FALLBACK — FAST 24H TRAFFIC AUDIT"
  echo "════════════════════════════════════════════════════════"
  echo "=== last-hour click stats ==="
  rpc get_last_hour_click_stats '{}'
  echo "=== admin overview (exact 24h) ==="
  rpc get_admin_overview_stats '{}'
  echo "=== bot reasons 24h ==="
  rpc admin_bot_reasons '{"_hours":24,"_limit":15}'
  echo "=== fb blocked 24h ==="
  rpc admin_fb_blocked_count '{"_hours":24}'
  echo "=== top countries 24h ==="
  rpc admin_top_countries '{"_days":1,"_limit":10}'
  exit 0
fi

echo "════════════════════════════════════════════════════════"
echo "1) LAST 24H TRAFFIC OVERVIEW"
echo "════════════════════════════════════════════════════════"
$PSQL <<'SQL'
SELECT
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE is_bot)                                AS bots,
  COUNT(*) FILTER (WHERE NOT is_bot)                            AS humans,
  COUNT(*) FILTER (WHERE NOT is_bot AND routed_to='ours')       AS ours,
  COUNT(*) FILTER (WHERE NOT is_bot AND routed_to='offer')      AS offer,
  COUNT(*) FILTER (WHERE routed_to='safe')                      AS safe,
  COUNT(*) FILTER (WHERE routed_to='fb-article')                AS fb_article,
  COUNT(*) FILTER (WHERE routed_to='fb')                        AS fb,
  ROUND(100.0*COUNT(*) FILTER (WHERE is_bot)/NULLIF(COUNT(*),0),2) AS bot_pct,
  ROUND(100.0*COUNT(*) FILTER (WHERE NOT is_bot AND routed_to='ours')
        /NULLIF(COUNT(*) FILTER (WHERE NOT is_bot),0),2)            AS ours_pct
FROM clicks WHERE created_at > now() - interval '24 hours';
SQL

echo ""
echo "════════════════════════════════════════════════════════"
echo "2) ROUTING BREAKDOWN"
echo "════════════════════════════════════════════════════════"
$PSQL -c "SELECT routed_to, COUNT(*) FILTER (WHERE NOT is_bot) humans, COUNT(*) FILTER (WHERE is_bot) bots FROM clicks WHERE created_at > now() - interval '24 hours' GROUP BY 1 ORDER BY humans DESC;"

echo ""
echo "════════════════════════════════════════════════════════"
echo "3) BOT DETECTION REASONS (top 15)"
echo "════════════════════════════════════════════════════════"
$PSQL -c "SELECT split_part(COALESCE(bot_reason,'unknown'),':',1) reason, COUNT(*) FROM clicks WHERE is_bot AND created_at > now() - interval '24 hours' GROUP BY 1 ORDER BY 2 DESC LIMIT 15;"

echo ""
echo "════════════════════════════════════════════════════════"
echo "4) SOCIAL REFERRER ROUTING — 'ours' is intentional injection, not crawler leak"
echo "════════════════════════════════════════════════════════"
$PSQL <<'SQL'
SELECT
  CASE
    WHEN referer_host ILIKE '%facebook%' OR referer_host ILIKE '%fb.%' OR referer_host ILIKE '%fbcdn%' THEN 'facebook'
    WHEN referer_host ILIKE '%instagram%' THEN 'instagram'
    WHEN referer_host ILIKE '%tiktok%' THEN 'tiktok'
    WHEN referer_host ILIKE '%google%' THEN 'google'
    ELSE 'other'
  END AS source,
  COUNT(*) FILTER (WHERE routed_to='ours' AND NOT is_bot)   AS ours_injection,
  COUNT(*) FILTER (WHERE routed_to='offer' AND NOT is_bot)  AS offer_ok,
  COUNT(*) FILTER (WHERE routed_to='safe')                  AS safe_ok,
  COUNT(*) FILTER (WHERE is_bot)                            AS bots_blocked
FROM clicks
WHERE created_at > now() - interval '24 hours'
  AND (referer_host ILIKE '%facebook%' OR referer_host ILIKE '%fb.%' OR referer_host ILIKE '%fbcdn%'
       OR referer_host ILIKE '%instagram%' OR referer_host ILIKE '%tiktok%' OR referer_host ILIKE '%google%')
GROUP BY 1 ORDER BY ours_injection DESC;
SQL

echo ""
echo "════════════════════════════════════════════════════════"
echo "5) 🚨 FB CRAWLER SANITY — should be 100% served as article (HTTP 200)"
echo "════════════════════════════════════════════════════════"
$PSQL <<'SQL'
SELECT
  COUNT(*)                                              AS fb_crawler_hits,
  COUNT(*) FILTER (WHERE is_bot)                        AS blocked,
  COUNT(*) FILTER (WHERE NOT is_bot)                    AS LEAKED_TO_HUMAN,
  COUNT(*) FILTER (WHERE routed_to='fb-article')         AS article_200_good,
  COUNT(*) FILTER (WHERE routed_to='safe')              AS safe_legacy,
  COUNT(*) FILTER (WHERE routed_to='offer')             AS routed_offer_BAD,
  COUNT(*) FILTER (WHERE routed_to='ours')              AS routed_ours_BAD
FROM clicks
WHERE created_at > now() - interval '24 hours'
  AND (ua ILIKE '%facebookexternalhit%' OR ua ILIKE '%meta-externalagent%'
       OR ua ILIKE '%facebot%' OR ua ILIKE '%facebookcatalog%');
SQL

echo ""
echo "════════════════════════════════════════════════════════"
echo "6) TOP COUNTRIES (24h)"
echo "════════════════════════════════════════════════════════"
$PSQL -c "SELECT country, COUNT(*) FILTER (WHERE NOT is_bot) humans, COUNT(*) FILTER (WHERE is_bot) bots FROM clicks WHERE created_at > now() - interval '24 hours' GROUP BY 1 ORDER BY humans DESC LIMIT 15;"

echo ""
echo "════════════════════════════════════════════════════════"
echo "7) ERROR LOGS (24h)"
echo "════════════════════════════════════════════════════════"
$PSQL -c "SELECT source, level, COUNT(*), MAX(created_at) latest FROM error_logs WHERE created_at > now() - interval '24 hours' GROUP BY 1,2 ORDER BY 3 DESC LIMIT 20;"
echo "--- latest 10 error messages ---"
$PSQL -c "SELECT created_at, source, level, LEFT(message,120) FROM error_logs WHERE created_at > now() - interval '24 hours' ORDER BY created_at DESC LIMIT 10;"

echo ""
echo "════════════════════════════════════════════════════════"
echo "8) DOMAIN HEALTH"
echo "════════════════════════════════════════════════════════"
$PSQL -c "SELECT domain, status, last_checked_at FROM monitored_domains WHERE is_active ORDER BY status, domain;"

echo ""
echo "════════════════════════════════════════════════════════"
echo "9) HOURLY TRAFFIC PATTERN (last 24h)"
echo "════════════════════════════════════════════════════════"
$PSQL <<'SQL'
SELECT date_trunc('hour', created_at) hr,
       COUNT(*) FILTER (WHERE NOT is_bot) humans,
       COUNT(*) FILTER (WHERE is_bot)     bots,
       COUNT(*) FILTER (WHERE NOT is_bot AND routed_to='ours') ours,
       COUNT(*) FILTER (WHERE NOT is_bot AND routed_to='offer') offer,
       ROUND(100.0 * COUNT(*) FILTER (WHERE NOT is_bot AND routed_to='ours')
             / NULLIF(COUNT(*) FILTER (WHERE NOT is_bot), 0), 2) ours_pct
FROM clicks WHERE created_at > now() - interval '24 hours'
GROUP BY 1 ORDER BY 1 DESC;
SQL

echo ""
echo "════════════════════════════════════════════════════════"
echo "10) INJECTION RATIO CHECK (target ~5%)"
echo "════════════════════════════════════════════════════════"
$PSQL -c "SELECT injection_threshold, injection_count, ROUND(100.0*injection_count/NULLIF(injection_threshold+injection_count,0),2) configured_ours_pct FROM app_settings LIMIT 1;" 2>/dev/null

echo ""
echo "════════════════════════════════════════════════════════"
echo "11) PM2 STATUS + RECENT ERRORS"
echo "════════════════════════════════════════════════════════"
pm2 jlist 2>/dev/null | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const a=JSON.parse(d);a.forEach(p=>console.log(p.name,'| status:',p.pm2_env.status,'| restarts:',p.pm2_env.restart_time,'| mem:',Math.round(p.monit.memory/1024/1024)+'MB','| cpu:',p.monit.cpu+'%'))})" 2>/dev/null || pm2 status

echo ""
echo "--- PM2 error log tail (last 40 lines) ---"
pm2 logs --err --lines 40 --nostream 2>/dev/null | tail -50

echo ""
echo "════════════════════════════════════════════════════════"
echo "12) NGINX ERROR LOG (last 20)"
echo "════════════════════════════════════════════════════════"
sudo tail -20 /var/log/nginx/error.log 2>/dev/null || tail -20 /var/log/nginx/error.log

echo ""
echo "✅ AUDIT COMPLETE — copy full output back"
