#!/usr/bin/env bash
# Did the "ours" clicks actually REACH Adsterra?
# clicks table = decision. bridge_delivery_stats = arrival.
set +e
cd /opt/sleepox-app-new 2>/dev/null || true
DB="${DB_CONTAINER:-$(docker ps --filter name=supabase-db --format '{{.Names}}' | head -n 1)}"
[ -z "$DB" ] && { echo "❌ supabase-db not found"; exit 1; }
PSQL="docker exec -i $DB psql -U postgres -d postgres -P pager=off"

echo "════ 1) LAST 10H — decided clicks by route ════"
$PSQL -c "SELECT routed_to, COUNT(*) FROM clicks WHERE NOT is_bot AND created_at > now()-interval '10 hours' GROUP BY 1 ORDER BY 2 DESC;"

echo ""
echo "════ 2) DELIVERED (bridge beacon) vs DECIDED — needs migration 37 + deploy ════"
$PSQL <<'SQL'
WITH d AS (
  SELECT date_trunc('hour',created_at) hr, routed_to route, COUNT(*) decided
  FROM clicks WHERE NOT is_bot AND created_at > now()-interval '10 hours'
    AND routed_to IN ('offer','ours') GROUP BY 1,2
), b AS (
  SELECT hour hr, route, count delivered
  FROM bridge_delivery_stats WHERE hour > now()-interval '10 hours'
)
SELECT d.hr, d.route, d.decided, COALESCE(b.delivered,0) delivered,
  ROUND(100.0*COALESCE(b.delivered,0)/NULLIF(d.decided,0),1) delivery_pct
FROM d LEFT JOIN b ON b.hr=d.hr AND b.route=d.route
ORDER BY d.hr DESC, d.route;
SQL

echo ""
echo "════ 3) OURS CLICKS BY COUNTRY + DEVICE (CPM context) ════"
$PSQL -c "SELECT country, device, COUNT(*) FROM clicks WHERE routed_to='ours' AND created_at > now()-interval '10 hours' GROUP BY 1,2 ORDER BY 3 DESC LIMIT 20;"

echo ""
echo "════ 4) UNIQUE IPs BEHIND OURS (Adsterra pays on unique visits) ════"
$PSQL -c "SELECT COUNT(*) ours_clicks, COUNT(DISTINCT ip) uniq_ips,
ROUND(COUNT(*)::numeric/NULLIF(COUNT(DISTINCT ip),0),2) clicks_per_ip
FROM clicks WHERE routed_to='ours' AND created_at > now()-interval '10 hours';"

echo ""
echo "════ 5) OURS URL LIVE CHECK (mobile UA, follow redirects) ════"
OURS=$($PSQL -tAc "SELECT our_adsterra_url FROM app_settings LIMIT 1;" | tr -d '\r')
curl -sL -o /dev/null -w "final HTTP %{http_code}  hops=%{num_redirects}  url=%{url_effective}\n" \
  -A 'Mozilla/5.0 (Linux; Android 13; SM-A536B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Mobile Safari/537.36' \
  -H 'Referer: https://mefok.com/' "$OURS"

echo ""
echo "✅ DONE"
