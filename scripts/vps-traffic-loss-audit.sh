#!/usr/bin/env bash
# Traffic-loss focused audit: where are user clicks going / being lost?
# Run on VPS:  bash scripts/vps-traffic-loss-audit.sh
set -u
DB=$(docker ps --filter name=supabase-db --format '{{.Names}}' | head -n1)
psql() { docker exec -i "$DB" psql -U postgres -d postgres -q -c "$1"; }

echo "════ 1) LAST 24H ROUTING SPLIT ════"
psql "SELECT routed_to,
        COUNT(*) FILTER (WHERE NOT is_bot) humans,
        COUNT(*) FILTER (WHERE is_bot) bots,
        ROUND(100.0*COUNT(*) FILTER (WHERE NOT is_bot)/NULLIF(SUM(COUNT(*) FILTER (WHERE NOT is_bot)) OVER (),0),2) pct
      FROM clicks WHERE created_at > now() - interval '24 hours'
      GROUP BY 1 ORDER BY 2 DESC;"

echo "════ 2) OVER-QUOTA USERS (100% traffic goes to OURS = user sees total loss) ════"
psql "SELECT p.email, p.plan_slug, p.clicks_used, p.click_quota, p.plan_expires_at
      FROM profiles p
      WHERE p.click_quota IS NOT NULL AND COALESCE(p.clicks_used,0) >= p.click_quota
      ORDER BY p.clicks_used DESC LIMIT 25;"

echo "════ 3) EXPIRED PLANS STILL SENDING TRAFFIC ════"
psql "SELECT p.email, p.plan_slug, p.plan_expires_at, COUNT(c.*) clicks_24h
      FROM profiles p JOIN links l ON l.user_id=p.id
      JOIN clicks c ON c.link_id=l.id AND c.created_at > now() - interval '24 hours'
      WHERE p.plan_expires_at IS NOT NULL AND p.plan_expires_at < now()
      GROUP BY 1,2,3 ORDER BY 4 DESC LIMIT 20;"

echo "════ 4) PER-USER OURS RATIO (>10% = user losing traffic) ════"
psql "SELECT p.email,
        COUNT(*) FILTER (WHERE NOT c.is_bot) humans,
        COUNT(*) FILTER (WHERE NOT c.is_bot AND c.routed_to='ours') ours,
        ROUND(100.0*COUNT(*) FILTER (WHERE NOT c.is_bot AND c.routed_to='ours')
              /NULLIF(COUNT(*) FILTER (WHERE NOT c.is_bot),0),2) ours_pct
      FROM clicks c JOIN links l ON l.id=c.link_id JOIN profiles p ON p.id=l.user_id
      WHERE c.created_at > now() - interval '24 hours'
      GROUP BY 1 HAVING COUNT(*) FILTER (WHERE NOT c.is_bot) > 500
      ORDER BY ours_pct DESC LIMIT 20;"

echo "════ 5) BOT / BLOCK REASONS (false positives = human traffic lost) ════"
psql "SELECT COALESCE(bot_reason,'(none)') reason, COUNT(*) FROM clicks
      WHERE created_at > now() - interval '24 hours' AND is_bot
      GROUP BY 1 ORDER BY 2 DESC LIMIT 20;"

echo "════ 6) APP ERRORS 24H ════"
psql "SELECT source, level, COUNT(*), MAX(created_at) last_seen FROM error_logs
      WHERE created_at > now() - interval '24 hours'
      GROUP BY 1,2 ORDER BY 3 DESC LIMIT 20;"

echo "════ 7) CLICK-BATCH DROPS / RETRIES (lost click records) ════"
pm2 logs --lines 2000 --nostream 2>/dev/null | grep -Ec '\[click-batch\]\[DROP\]' | xargs echo "DROP lines:"
pm2 logs --lines 2000 --nostream 2>/dev/null | grep -Ec '\[click-batch\]\[FAIL\]' | xargs echo "FAIL lines:"
pm2 logs --lines 2000 --nostream 2>/dev/null | grep -E '\[click-batch\]\[(DROP|FAIL|RETRY)\]' | tail -5

echo "════ 8) NGINX 5xx / 499 (real dropped visitors) ════"
awk '{print $9}' /var/log/nginx/access.log 2>/dev/null | sort | uniq -c | sort -rn | head -10
echo "-- upstream errors --"
grep -Ec 'upstream|timed out|no live upstreams' /var/log/nginx/error.log 2>/dev/null || echo 0

echo "════ 9) PM2 STATUS ════"
pm2 list
