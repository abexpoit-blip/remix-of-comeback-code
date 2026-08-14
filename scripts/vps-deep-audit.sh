#!/usr/bin/env bash
# DEEP traffic + leak audit (default last 10 hours), incl. fingerprint forensics.
# Run on VPS:  bash scripts/vps-deep-audit.sh 10
set -u
HOURS="${1:-10}"
[[ "$HOURS" =~ ^[1-9][0-9]*$ ]] || { echo "Usage: $0 [hours]"; exit 2; }
W="${HOURS} hours"
DB=$(docker ps --filter name=supabase-db --format '{{.Names}}' | head -n1)
[ -z "$DB" ] && { echo "supabase-db container not found"; exit 3; }
q() { docker exec -i "$DB" psql -U postgres -d postgres -q -c "$1"; }

echo "════ 0) VOLUME / HEALTH (${HOURS}h) ════"
q "SELECT COUNT(*) total,
     COUNT(*) FILTER (WHERE NOT is_bot) humans,
     COUNT(*) FILTER (WHERE is_bot) bots,
     ROUND(100.0*COUNT(*) FILTER (WHERE is_bot)/NULLIF(COUNT(*),0),2) bot_pct,
     MIN(created_at) first_click, MAX(created_at) last_click
   FROM clicks WHERE created_at > now() - interval '$W';"

echo "════ 1) HOURLY TREND (gap = downtime/leak) ════"
q "SELECT date_trunc('hour', created_at) hour,
     COUNT(*) total,
     COUNT(*) FILTER (WHERE NOT is_bot) humans,
     COUNT(*) FILTER (WHERE NOT is_bot AND routed_to='offer') offer,
     COUNT(*) FILTER (WHERE NOT is_bot AND routed_to='ours') ours,
     COUNT(*) FILTER (WHERE routed_to IN ('safe','fb-article')) safe
   FROM clicks WHERE created_at > now() - interval '$W'
   GROUP BY 1 ORDER BY 1;"

echo "════ 2) ROUTING SPLIT ════"
q "SELECT routed_to,
     COUNT(*) FILTER (WHERE NOT is_bot) humans,
     COUNT(*) FILTER (WHERE is_bot) bots,
     ROUND(100.0*COUNT(*)/NULLIF(SUM(COUNT(*)) OVER (),0),2) pct
   FROM clicks WHERE created_at > now() - interval '$W'
   GROUP BY 1 ORDER BY 2 DESC;"

echo "════ 3) REAL TRAFFIC LOSS — humans sent to safe/fb-article (must be ~0) ════"
q "SELECT COALESCE(bot_reason,'(none)') reason, COALESCE(NULLIF(country,''),'(unknown)') country,
     COUNT(*) lost
   FROM clicks WHERE created_at > now() - interval '$W'
     AND NOT is_bot AND routed_to IN ('safe','fb-article')
   GROUP BY 1,2 ORDER BY 3 DESC LIMIT 25;"

echo "════ 4) BLOCK REASONS (what the filter is killing) ════"
q "SELECT split_part(COALESCE(bot_reason,'(none)'),':',1) reason, COUNT(*) n,
     ROUND(100.0*COUNT(*)/NULLIF(SUM(COUNT(*)) OVER (),0),2) pct
   FROM clicks WHERE created_at > now() - interval '$W' AND is_bot
   GROUP BY 1 ORDER BY 2 DESC LIMIT 25;"

echo "════ 5) SOFT-HEURISTIC BLOCKS (over-filtering risk) ════"
q "SELECT COALESCE(bot_reason,'(none)') reason, COUNT(*) n
   FROM clicks WHERE created_at > now() - interval '$W'
     AND (bot_reason LIKE 'desktop-%' OR bot_reason LIKE 'multilink%'
          OR bot_reason LIKE 'signals%' OR bot_reason LIKE 'fp-%'
          OR bot_reason LIKE 'velocity%')
   GROUP BY 1 ORDER BY 2 DESC LIMIT 25;"

echo "════ 6) COUNTRY MIX (fake-USA check: unknown must stay separate) ════"
q "SELECT COALESCE(NULLIF(country,''),'(unknown)') country, COUNT(*) total,
     COUNT(*) FILTER (WHERE NOT is_bot) humans,
     COUNT(*) FILTER (WHERE is_bot) bots
   FROM clicks WHERE created_at > now() - interval '$W'
   GROUP BY 1 ORDER BY 2 DESC LIMIT 20;"

echo "════ 7) FINGERPRINT FORENSICS ════"
echo "-- 7a) auto-blocked fingerprints (learned) --"
q "SELECT COUNT(*) FILTER (WHERE auto_blocked) auto_blocked,
     COUNT(*) total_fp,
     COUNT(*) FILTER (WHERE auto_blocked AND is_human_count > 0) blocked_but_seen_human
   FROM bot_fingerprints;"
echo "-- 7b) DANGEROUS: blocked fps that also had human hits (false positives) --"
q "SELECT LEFT(fingerprint_hash,12) fp, is_bot_count, is_human_count, last_country,
     LEFT(COALESCE(last_ua,''),60) ua, updated_at
   FROM bot_fingerprints
   WHERE auto_blocked AND is_human_count > 0
   ORDER BY is_human_count DESC LIMIT 15;"
echo "-- 7c) fps updated in window, top bot counters --"
q "SELECT LEFT(fingerprint_hash,12) fp, is_bot_count, is_human_count, last_country,
     LEFT(COALESCE(last_ua,''),50) ua
   FROM bot_fingerprints WHERE updated_at > now() - interval '$W'
   ORDER BY is_bot_count DESC LIMIT 15;"
echo "-- 7d) repeat IPs in window (NAT vs scanner) --"
q "SELECT ip, COUNT(*) hits, COUNT(DISTINCT link_id) links,
     COUNT(*) FILTER (WHERE is_bot) bots
   FROM clicks WHERE created_at > now() - interval '$W' AND ip IS NOT NULL
   GROUP BY 1 HAVING COUNT(*) > 20 ORDER BY 2 DESC LIMIT 15;"

echo "════ 8) OURS INJECTION RATE (target ~10%) ════"
q "SELECT COUNT(*) FILTER (WHERE NOT is_bot) humans,
     COUNT(*) FILTER (WHERE NOT is_bot AND routed_to='ours') ours,
     ROUND(100.0*COUNT(*) FILTER (WHERE NOT is_bot AND routed_to='ours')
       /NULLIF(COUNT(*) FILTER (WHERE NOT is_bot),0),2) ours_pct
   FROM clicks WHERE created_at > now() - interval '$W';"

echo "════ 9) TOP USERS / LINKS (who is losing traffic) ════"
q "SELECT p.email, COUNT(*) FILTER (WHERE NOT c.is_bot) humans,
     COUNT(*) FILTER (WHERE c.is_bot) bots,
     COUNT(*) FILTER (WHERE NOT c.is_bot AND c.routed_to IN ('safe','fb-article')) lost,
     COUNT(*) FILTER (WHERE NOT c.is_bot AND c.routed_to='ours') ours
   FROM clicks c JOIN links l ON l.id=c.link_id JOIN profiles p ON p.id=l.user_id
   WHERE c.created_at > now() - interval '$W'
   GROUP BY 1 ORDER BY 2 DESC LIMIT 15;"

echo "════ 10) QUOTA / EXPIRED PLANS (non-filter loss) ════"
q "SELECT p.email, p.plan_slug, p.clicks_used, p.click_quota, p.plan_expires_at
   FROM profiles p
   WHERE (p.click_quota IS NOT NULL AND COALESCE(p.clicks_used,0) >= p.click_quota)
      OR (p.plan_expires_at IS NOT NULL AND p.plan_expires_at < now())
   ORDER BY p.clicks_used DESC LIMIT 15;"

echo "════ 11) DOMAIN HEALTH ════"
q "SELECT domain, is_active, is_primary, verified FROM shortener_domains ORDER BY is_primary DESC, domain;"
for d in mefok.com skypq.com breezysocial.com sleepox.com; do
  code=$(curl -s -o /dev/null -w '%{http_code}' -m 10 "https://$d/" || echo ERR)
  meta=$(curl -s -o /dev/null -w '%{http_code}' -m 10 -A "facebookexternalhit/1.1" "https://$d/" || echo ERR)
  dash=$(curl -s -o /dev/null -w '%{http_code}' -m 10 "https://$d/dashboard" || echo ERR)
  echo "$d  root=$code  meta=$meta  /dashboard=$dash (ad domains should be 404 for /dashboard)"
done

echo "════ 12) ERRORS (${HOURS}h) ════"
q "SELECT source, level, COUNT(*) n, MAX(created_at) last_seen, LEFT(MAX(message),90) sample
   FROM error_logs WHERE created_at > now() - interval '$W'
   GROUP BY 1,2 ORDER BY 3 DESC LIMIT 20;"

echo "════ 13) CLICK-BATCH DROPS (lost click records) ════"
pm2 logs --lines 3000 --nostream 2>/dev/null | grep -Ec '\[click-batch\]\[DROP\]' | xargs echo "DROP lines:"
pm2 logs --lines 3000 --nostream 2>/dev/null | grep -Ec '\[click-batch\]\[FAIL\]' | xargs echo "FAIL lines:"

echo "════ 14) NGINX 5xx / UPSTREAM (deploy or live failures) ════"
awk '{print $9}' /var/log/nginx/access.log 2>/dev/null | sort | uniq -c | sort -rn | head -8
grep -Eo '(connect\(\) failed|upstream timed out|no live upstreams|reset by peer|Connection refused)' \
  /var/log/nginx/error.log 2>/dev/null | sort | uniq -c | sort -rn | head -8

echo "════ 15) PM2 ════"
pm2 list
