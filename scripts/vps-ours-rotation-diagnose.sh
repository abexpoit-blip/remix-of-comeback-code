#!/usr/bin/env bash
# Why is "ours" (10% platform injection) low / not growing?
# Run on the VPS:  bash scripts/vps-ours-rotation-diagnose.sh
set +e
cd /opt/sleepox-app-new 2>/dev/null || true

DB_CONTAINER="${DB_CONTAINER:-$(docker ps --filter name=supabase-db --format '{{.Names}}' | head -n 1)}"
if [ -z "$DB_CONTAINER" ]; then echo "❌ supabase-db container not found"; exit 1; fi
PSQL="docker exec -i $DB_CONTAINER psql -U postgres -d postgres -P pager=off"

echo "════════════════════════════════════════════"
echo "1) INJECTION SETTINGS (threshold=offer share, count=ours share)"
echo "════════════════════════════════════════════"
$PSQL -c "SELECT injection_threshold, injection_count,
  ROUND(100.0*injection_count/NULLIF(injection_threshold+injection_count,0),2) AS configured_ours_pct,
  COALESCE(NULLIF(our_adsterra_url,''),'(EMPTY → ours can NEVER fire)') AS our_url
FROM app_settings LIMIT 1;"

echo ""
echo "════════════════════════════════════════════"
echo "2) ACTUAL ROUTING (24h + 7d)"
echo "════════════════════════════════════════════"
$PSQL <<'SQL'
SELECT '24h' win, routed_to, COUNT(*) clicks,
  ROUND(100.0*COUNT(*)/SUM(COUNT(*)) OVER (),2) pct
FROM clicks WHERE created_at > now()-interval '24 hours' AND NOT is_bot
GROUP BY 2
UNION ALL
SELECT '7d', routed_to, COUNT(*),
  ROUND(100.0*COUNT(*)/SUM(COUNT(*)) OVER (),2)
FROM clicks WHERE created_at > now()-interval '7 days' AND NOT is_bot
GROUP BY 2 ORDER BY 1,3 DESC;
SQL

echo ""
echo "════════════════════════════════════════════"
echo "3) OURS REASON SPLIT (injection vs sticky vs quota)"
echo "════════════════════════════════════════════"
$PSQL -c "SELECT COALESCE(bot_reason,'(none)') reason, COUNT(*) FROM clicks
WHERE routed_to='ours' AND created_at > now()-interval '24 hours'
GROUP BY 1 ORDER BY 2 DESC LIMIT 10;"

echo ""
echo "════════════════════════════════════════════"
echo "4) HOURLY OURS % — is it flat / dropping?"
echo "════════════════════════════════════════════"
$PSQL <<'SQL'
SELECT date_trunc('hour',created_at) hr,
  COUNT(*) FILTER (WHERE NOT is_bot) humans,
  COUNT(*) FILTER (WHERE NOT is_bot AND routed_to='ours') ours,
  ROUND(100.0*COUNT(*) FILTER (WHERE NOT is_bot AND routed_to='ours')
        /NULLIF(COUNT(*) FILTER (WHERE NOT is_bot),0),2) ours_pct
FROM clicks WHERE created_at > now()-interval '24 hours'
GROUP BY 1 ORDER BY 1 DESC LIMIT 24;
SQL

echo ""
echo "════════════════════════════════════════════"
echo "5) TOP LINKS — which links get 0% ours (bucket skew / few fingerprints)"
echo "════════════════════════════════════════════"
$PSQL <<'SQL'
SELECT l.short_code,
  COUNT(*) FILTER (WHERE NOT c.is_bot) humans,
  COUNT(DISTINCT c.ip_address) uniq_ips,
  COUNT(*) FILTER (WHERE c.routed_to='ours') ours,
  ROUND(100.0*COUNT(*) FILTER (WHERE c.routed_to='ours')
        /NULLIF(COUNT(*) FILTER (WHERE NOT c.is_bot),0),2) ours_pct
FROM clicks c JOIN links l ON l.id=c.link_id
WHERE c.created_at > now()-interval '24 hours'
GROUP BY 1 HAVING COUNT(*) FILTER (WHERE NOT c.is_bot) > 100
ORDER BY humans DESC LIMIT 20;
SQL

echo ""
echo "════════════════════════════════════════════"
echo "6) REPEAT-VISITOR EFFECT (sticky lock dilutes ours%)"
echo "   clicks per unique IP — high value = ours% falls below configured"
echo "════════════════════════════════════════════"
$PSQL -c "SELECT COUNT(*) humans, COUNT(DISTINCT ip_address) uniq_ips,
ROUND(COUNT(*)::numeric/NULLIF(COUNT(DISTINCT ip_address),0),2) clicks_per_ip
FROM clicks WHERE NOT is_bot AND created_at > now()-interval '24 hours';"

echo ""
echo "════════════════════════════════════════════"
echo "7) IS THE OURS URL REACHABLE? (dead URL = no revenue even at 10%)"
echo "════════════════════════════════════════════"
OURS=$($PSQL -tAc "SELECT our_adsterra_url FROM app_settings LIMIT 1;" | tr -d '\r')
echo "our_adsterra_url = ${OURS:-EMPTY}"
if [ -n "$OURS" ]; then
  curl -s -o /dev/null -w "HTTP %{http_code} → %{redirect_url}\n" -A 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' "$OURS"
fi

echo ""
echo "✅ DONE — copy full output back"
