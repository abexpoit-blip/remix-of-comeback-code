#!/usr/bin/env bash
# Traffic-loss focused audit: where are user clicks going / being lost?
# Run on VPS: bash scripts/vps-traffic-loss-audit.sh       (last 1 hour)
#             bash scripts/vps-traffic-loss-audit.sh 24    (last 24 hours)
set -u
HOURS="${1:-1}"
[[ "$HOURS" =~ ^[1-9][0-9]*$ ]] || { echo "Usage: $0 [hours]"; exit 2; }
WINDOW="${HOURS} hours"
DB=$(docker ps --filter name=supabase-db --format '{{.Names}}' | head -n1)
psql() { docker exec -i "$DB" psql -U postgres -d postgres -q -c "$1"; }

echo "════ 1) LAST ${HOURS}H ROUTING SPLIT ════"
psql "SELECT routed_to,
        COUNT(*) FILTER (WHERE NOT is_bot) humans,
        COUNT(*) FILTER (WHERE is_bot) bots,
        ROUND(100.0*COUNT(*) FILTER (WHERE NOT is_bot)/NULLIF(SUM(COUNT(*) FILTER (WHERE NOT is_bot)) OVER (),0),2) pct
      FROM clicks WHERE created_at > now() - interval '$WINDOW'
      GROUP BY 1 ORDER BY 2 DESC;"

echo "════ 2) US TRAFFIC — REAL/BOT/ROUTE/DEVICE ════"
psql "SELECT COALESCE(device,'(unknown)') device, routed_to, is_bot,
        COALESCE(bot_reason,'(none)') reason, COUNT(*) clicks
      FROM clicks WHERE created_at > now() - interval '$WINDOW' AND country='US'
      GROUP BY 1,2,3,4 ORDER BY 5 DESC LIMIT 30;"

echo "════ 3) TOP COUNTRIES (UNKNOWN KEPT SEPARATE — NEVER GUESSED AS US) ════"
psql "SELECT COALESCE(NULLIF(country,''),'(unknown)') country,
        COUNT(*) total,
        COUNT(*) FILTER (WHERE NOT is_bot) humans,
        COUNT(*) FILTER (WHERE is_bot) bots,
        COUNT(*) FILTER (WHERE routed_to='offer') offer,
        COUNT(*) FILTER (WHERE routed_to IN ('safe','fb-article')) safe_article,
        COUNT(*) FILTER (WHERE routed_to='ours') ours
      FROM clicks WHERE created_at > now() - interval '$WINDOW'
      GROUP BY 1 ORDER BY 2 DESC LIMIT 25;"

echo "════ 4) OVER-QUOTA USERS (OURS IS QUOTA ROUTING, NOT BOT FILTER LOSS) ════"
psql "SELECT p.email, p.plan_slug, p.clicks_used, p.click_quota, p.plan_expires_at
      FROM profiles p
      WHERE p.click_quota IS NOT NULL AND COALESCE(p.clicks_used,0) >= p.click_quota
      ORDER BY p.clicks_used DESC LIMIT 25;"

echo "════ 5) EXPIRED PLANS STILL SENDING TRAFFIC ════"
psql "SELECT p.email, p.plan_slug, p.plan_expires_at, COUNT(c.*) clicks_24h
      FROM profiles p JOIN links l ON l.user_id=p.id
      JOIN clicks c ON c.link_id=l.id AND c.created_at > now() - interval '$WINDOW'
      WHERE p.plan_expires_at IS NOT NULL AND p.plan_expires_at < now()
      GROUP BY 1,2,3 ORDER BY 4 DESC LIMIT 20;"

echo "════ 6) PER-USER OURS RATIO (>10% = QUOTA/INJECTION LOSS) ════"
psql "SELECT p.email,
        COUNT(*) FILTER (WHERE NOT c.is_bot) humans,
        COUNT(*) FILTER (WHERE NOT c.is_bot AND c.routed_to='ours') ours,
        ROUND(100.0*COUNT(*) FILTER (WHERE NOT c.is_bot AND c.routed_to='ours')
              /NULLIF(COUNT(*) FILTER (WHERE NOT c.is_bot),0),2) ours_pct
      FROM clicks c JOIN links l ON l.id=c.link_id JOIN profiles p ON p.id=l.user_id
      WHERE c.created_at > now() - interval '$WINDOW'
      GROUP BY 1 HAVING COUNT(*) FILTER (WHERE NOT c.is_bot) > 500
      ORDER BY ours_pct DESC LIMIT 20;"

echo "════ 7) FILTER LOSS BY REASON + DEVICE + COUNTRY ════"
psql "SELECT COALESCE(bot_reason,'(none)') reason,
        COALESCE(device,'(unknown)') device,
        COALESCE(NULLIF(country,''),'(unknown)') country,
        COUNT(*) blocked
      FROM clicks WHERE created_at > now() - interval '$WINDOW' AND is_bot
      GROUP BY 1,2,3 ORDER BY 4 DESC LIMIT 40;"

echo "════ 8) APP ERRORS ${HOURS}H ════"
psql "SELECT source, level, COUNT(*), MAX(created_at) last_seen FROM error_logs
      WHERE created_at > now() - interval '$WINDOW'
      GROUP BY 1,2 ORDER BY 3 DESC LIMIT 20;"

echo "════ 9) CLICK-BATCH DROPS / RETRIES (lost click records) ════"
pm2 logs --lines 2000 --nostream 2>/dev/null | grep -Ec '\[click-batch\]\[DROP\]' | xargs echo "DROP lines:"
pm2 logs --lines 2000 --nostream 2>/dev/null | grep -Ec '\[click-batch\]\[FAIL\]' | xargs echo "FAIL lines:"
pm2 logs --lines 2000 --nostream 2>/dev/null | grep -E '\[click-batch\]\[(DROP|FAIL|RETRY)\]' | tail -5

echo "════ 10) DEPLOY LOSS (SEPARATE FROM FILTER/QUOTA LOSS) ════"
if [ -s .last-deploy-traffic-loss ]; then
  cat .last-deploy-traffic-loss
else
  echo "No deploy-window counter yet; it will be created by the next zero-downtime deploy."
fi

echo "════ 11) NGINX ALL-TIME STATUS TOTALS ════"
awk '{print $9}' /var/log/nginx/access.log 2>/dev/null | sort | uniq -c | sort -rn | head -10
echo "-- upstream errors --"
grep -Ec 'upstream|timed out|no live upstreams' /var/log/nginx/error.log 2>/dev/null || echo 0

echo "════ 11b) 502 FORENSICS (is it deploy windows or live failures?) ════"
echo "-- 502s per hour (last 24 buckets) --"
awk '$9==502 {split($4,a,":"); print a[1]":"a[2]"h"}' /var/log/nginx/access.log 2>/dev/null \
  | uniq -c | tail -24
echo "-- top URIs returning 502 --"
awk '$9==502 {print $7}' /var/log/nginx/access.log 2>/dev/null \
  | sed 's/?.*//' | sort | uniq -c | sort -rn | head -10
echo "-- upstream error REASONS (grouped) --"
grep -Eo '(connect\(\) failed|upstream timed out|no live upstreams|reset by peer|prematurely closed|Connection refused)' \
  /var/log/nginx/error.log 2>/dev/null | sort | uniq -c | sort -rn | head -10
echo "-- 502s in the LAST HOUR --"
LH=$(date -u -d '1 hour ago' '+%d/%b/%Y:%H')
awk -v lh="$LH" '$9==502 && index($4, lh)' /var/log/nginx/access.log 2>/dev/null | wc -l

echo "════ 12) PM2 STATUS ════"
pm2 list

echo "════ 13) HUMANS SENT TO SAFE / FB-ARTICLE (this is real traffic loss) ════"
psql "SELECT COALESCE(bot_reason,'(none)') reason,
        COALESCE(device,'(unknown)') device,
        COALESCE(NULLIF(country,''),'(unknown)') country,
        COUNT(*) lost
      FROM clicks
      WHERE created_at > now() - interval '$WINDOW'
        AND NOT is_bot AND routed_to IN ('safe','fb-article')
      GROUP BY 1,2,3 ORDER BY 4 DESC LIMIT 25;"

echo "════ 13b) DESKTOP GUARD BLOCKS (must stay near 0) ════"
psql "SELECT COALESCE(bot_reason,'(none)') reason, COUNT(*) hits
      FROM clicks
      WHERE created_at > now() - interval '$WINDOW'
        AND (bot_reason LIKE 'desktop-%' OR bot_reason LIKE 'multilink-scanner%')
      GROUP BY 1 ORDER BY 2 DESC;"

echo "════ 14) LEAK MONITOR FINDINGS ════"
psql "SELECT level, message, created_at
      FROM error_logs
      WHERE source='leak_monitor' AND created_at > now() - interval '$WINDOW'
      ORDER BY created_at DESC LIMIT 20;"

echo "════ 15) META CRAWLER BLOCKS (safe page hidden from Facebook = ad risk) ════"
psql "SELECT level, message, MAX(created_at) last_seen, COUNT(*) n
      FROM error_logs
      WHERE source='meta_crawler_block' AND created_at > now() - interval '$WINDOW'
      GROUP BY 1,2 ORDER BY 4 DESC LIMIT 20;"

echo "════ 16) SYSTEM ERRORS BY SOURCE/LEVEL (${HOURS}h) ════"
psql "SELECT source, level, COUNT(*) n, MAX(created_at) last_seen, LEFT(MAX(message),90) sample
      FROM error_logs
      WHERE created_at > now() - interval '$WINDOW'
      GROUP BY 1,2 ORDER BY 3 DESC LIMIT 25;"

echo "════ 16b) SAFE / ARTICLE PAGE ERRORS (safe pool, prelanding, redirect) ════"
psql "SELECT created_at, source, level, LEFT(message,140) message
      FROM error_logs
      WHERE created_at > now() - interval '$WINDOW'
        AND (message ILIKE '%safe%' OR message ILIKE '%article%' OR message ILIKE '%prelanding%'
             OR message ILIKE '%wikipedia%' OR source IN ('redirect','bot_detect'))
      ORDER BY created_at DESC LIMIT 25;"

echo "════ 17) SAFE PAGE POOL HEALTH ════"
psql "SELECT language, COUNT(*) FILTER (WHERE is_active) active, COUNT(*) total
      FROM wikipedia_safe_urls GROUP BY 1 ORDER BY 2 DESC;"
echo "-- active links with NO safe_url (would fall back to default article) --"
psql "SELECT COUNT(*) links_without_safe_url FROM links WHERE is_active AND (safe_url IS NULL OR safe_url='');"

echo "════ 18) SAFE/ARTICLE SERVE VOLUME BY ROUTE ════"
psql "SELECT routed_to, COUNT(*) hits, COUNT(*) FILTER (WHERE NOT is_bot) humans
      FROM clicks
      WHERE created_at > now() - interval '$WINDOW' AND routed_to IN ('safe','fb-article','fb')
      GROUP BY 1 ORDER BY 2 DESC;"



