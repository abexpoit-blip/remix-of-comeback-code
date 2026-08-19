#!/usr/bin/env bash
# Per-link fingerprint forensics — why did Facebook reject this link?
# Run on the VPS:  bash scripts/vps-link-fingerprint-forensics.sh 7fvt9s
#
# Dumps, for ONE short code:
#   1. link row + owner plan/quota
#   2. click totals: human vs bot vs blocked, routed_to split (offer/ours/safe)
#   3. bot_reason histogram  (which filter ate traffic)
#   4. country / device / referer split of HUMAN clicks
#   5. Meta crawler hits (facebookexternalhit / meta-externalagent) and what they got
#   6. fingerprint hashes seen repeatedly (possible FB review fingerprints)
#   7. live view: FB crawler, FB in-app mobile, cold desktop  -> status + leak scan
#   8. offer redirect chain (final landing host)

set -uo pipefail
CODE="${1:-7fvt9s}"
DOMAIN="${DOMAIN:-mefok.com}"
DB_CONT="${DB_CONT:-supabase-db}"; DB_USER="${DB_USER:-postgres}"; DB_NAME="${DB_NAME:-postgres}"
HOURS="${HOURS:-72}"

UA_FBC='facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'
UA_META='meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)'
UA_FB_IAB='Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/450.0.0.0.0;]'
UA_DESK='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

psqlx() { docker exec -i "$DB_CONT" psql -U "$DB_USER" -d "$DB_NAME" "$@"; }

echo "=== FINGERPRINT FORENSICS  /$CODE  on $DOMAIN  (last ${HOURS}h) — $(date -u +%FT%TZ) ==="

echo; echo "--- [1] link row ---"
psqlx -x -c "SELECT short_code, is_active, short_domain, adsterra_url, destination_url, safe_url,
  blocked_countries, clicks_count, bot_clicks_count, created_at
  FROM links WHERE short_code='$CODE';"

echo "--- [1b] owner plan/quota ---"
psqlx -x -c "SELECT p.email, p.plan_slug, p.plan_expires_at, p.click_quota, p.clicks_used
  FROM links l JOIN profiles p ON p.id = l.user_id WHERE l.short_code='$CODE';"

echo "--- [2] traffic split ---"
psqlx -c "WITH c AS (SELECT * FROM clicks WHERE link_id=(SELECT id FROM links WHERE short_code='$CODE')
   AND created_at > now() - interval '$HOURS hours')
 SELECT count(*) total,
        count(*) FILTER (WHERE NOT is_bot) humans,
        count(*) FILTER (WHERE is_bot) bots,
        count(*) FILTER (WHERE routed_to='offer') to_offer,
        count(*) FILTER (WHERE routed_to='ours')  to_ours,
        count(*) FILTER (WHERE routed_to='safe')  to_safe,
        round(100.0*count(*) FILTER (WHERE routed_to='ours')
              / NULLIF(count(*) FILTER (WHERE routed_to IN ('offer','ours')),0),2) AS ours_pct
 FROM c;"

echo "--- [3] bot_reason histogram (traffic loss reasons) ---"
psqlx -c "SELECT COALESCE(bot_reason,'(none)') reason, routed_to, count(*)
 FROM clicks WHERE link_id=(SELECT id FROM links WHERE short_code='$CODE')
   AND created_at > now() - interval '$HOURS hours'
 GROUP BY 1,2 ORDER BY 3 DESC LIMIT 25;"

echo "--- [4] human clicks by country / device / referer ---"
psqlx -c "SELECT COALESCE(country,'??') cc, COALESCE(device,'?') dev, COALESCE(referer_host,'(direct)') ref, count(*)
 FROM clicks WHERE link_id=(SELECT id FROM links WHERE short_code='$CODE')
   AND NOT is_bot AND created_at > now() - interval '$HOURS hours'
 GROUP BY 1,2,3 ORDER BY 4 DESC LIMIT 25;"

echo "--- [5] Meta / Facebook crawler hits and what they were routed to ---"
psqlx -c "SELECT date_trunc('hour',created_at) hr, country, routed_to, bot_reason, count(*)
 FROM clicks WHERE link_id=(SELECT id FROM links WHERE short_code='$CODE')
   AND created_at > now() - interval '$HOURS hours'
   AND (ua ILIKE '%facebookexternalhit%' OR ua ILIKE '%meta-externalagent%'
        OR ua ILIKE '%facebookcatalog%' OR ua ILIKE '%WhatsApp%')
 GROUP BY 1,2,3,4 ORDER BY 1 DESC LIMIT 30;"

echo "--- [5b] non-crawler US/EU desktop hits (Meta reviewer signature) ---"
psqlx -c "SELECT created_at, country, device, routed_to, bot_reason, left(ua,90) ua
 FROM clicks WHERE link_id=(SELECT id FROM links WHERE short_code='$CODE')
   AND created_at > now() - interval '$HOURS hours'
   AND country IN ('US','FR','GB','CA','IE','DE','NL','SG')
 ORDER BY created_at DESC LIMIT 25;"

echo "--- [6] repeated IP fingerprints (review infra reuse) ---"
psqlx -c "SELECT COALESCE(ip_address::text,ip,'?') ipx, country, count(*) hits,
   count(DISTINCT routed_to) routes, string_agg(DISTINCT routed_to,',') AS routes_seen
 FROM clicks WHERE link_id=(SELECT id FROM links WHERE short_code='$CODE')
   AND created_at > now() - interval '$HOURS hours'
 GROUP BY 1,2 HAVING count(*) > 3 ORDER BY 3 DESC LIMIT 20;"

live() { # $1 label, $2 UA
  printf '\n  > %s\n' "$1"
  code=$(curl -s --compressed -o /tmp/ff.html -w '%{http_code}' -A "$2" "https://$DOMAIN/$CODE")
  echo "    status:$code size:$(wc -c </tmp/ff.html)"
  echo "    title: $(grep -oiE '<title>[^<]*' /tmp/ff.html | head -1 | cut -c8-100)"
  echo "    og:    $(grep -oiE 'property=.og:title.[^>]*' /tmp/ff.html | head -1 | cut -c1-110)"
  echo "    text:  $(sed 's/<[^>]*>/ /g' /tmp/ff.html | tr -s ' \n' ' ' | cut -c1-160)"
  leaks=$(grep -ioE 'sleepox|adsterra|cloak|shortcode|short_code|prelanding|safe.?page|dashboard' /tmp/ff.html | sort -u | tr '\n' ' ')
  echo "    LEAKS: ${leaks:-none}"
}

echo; echo "--- [7] live fingerprint views ---"
live "facebookexternalhit" "$UA_FBC"
live "meta-externalagent"  "$UA_META"
live "FB in-app mobile"    "$UA_FB_IAB"
live "cold desktop chrome" "$UA_DESK"

echo; echo "--- [8] offer redirect chain ---"
OFFER=$(psqlx -tAc "SELECT COALESCE(NULLIF(adsterra_url,''),destination_url) FROM links WHERE short_code='$CODE';")
echo "  offer: $OFFER"
[ -n "$OFFER" ] && curl -s -o /dev/null -L -w "  chain -> %{url_effective}  status:%{http_code} redirects:%{num_redirects}\n" -A "$UA_FB_IAB" "$OFFER"

echo; echo "=== DONE ==="
