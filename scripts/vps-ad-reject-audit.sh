#!/usr/bin/env bash
# Deep ad-rejection audit for specific short links.
# Run on the VPS:  bash scripts/vps-ad-reject-audit.sh a2b2qi jxex55
#
# Checks, per link:
#   1. DB row: destination_url, adsterra_url, status, blocked countries
#   2. What a Facebook crawler sees (status, OG tags, page text sample)
#   3. What a real mobile FB in-app user gets (routed_to + redirect target)
#   4. Safe-article page health (200? real content? no cloaking words?)
#   5. Destination/offer host reachability + redirect chain (final landing host)
#   6. Recent click classification split for the code
#   7. Domain-level hygiene: robots.txt, SSL SAN list, http status of ad domain

set -uo pipefail

CODES=("${@:-a2b2qi}")
[ $# -gt 0 ] && CODES=("$@")
DOMAIN="${DOMAIN:-mefok.com}"
APP_URL="${APP_URL:-http://localhost:3000}"
DB_CONT="${DB_CONT:-supabase-db}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-postgres}"

UA_FBC='facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'
UA_FB_IAB='Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/450.0.0.0.0;]'
UA_DESK='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

q() { docker exec -i "$DB_CONT" psql -U "$DB_USER" -d "$DB_NAME" -tAc "$1" 2>/dev/null; }

echo "=== AD REJECT AUDIT — $(date -u +%FT%TZ) — domain: $DOMAIN ==="

for CODE in "${CODES[@]}"; do
  echo
  echo "################ /$CODE ################"

  echo "--- [1] DB link row ---"
  LCOLS=$(q "SELECT string_agg(column_name,', ' ORDER BY ordinal_position)
    FROM information_schema.columns WHERE table_schema='public' AND table_name='links'
      AND column_name IN ('short_code','is_active','destination_url','safe_url','adsterra_url',
                          'blocked_countries','click_count','created_at')")
  if [ -n "${LCOLS:-}" ]; then
    docker exec -i "$DB_CONT" psql -U "$DB_USER" -d "$DB_NAME" -x -c \
      "SELECT $LCOLS FROM links WHERE short_code='$CODE';" || echo "  (db query failed)"
  else
    echo "  (links table not reachable)"
  fi

  echo "--- [2] Facebook crawler view (must be a real article, 200) ---"
  curl -s --compressed -o /tmp/fbc.html -w "  status:%{http_code} size:%{size_download} final:%{url_effective}\n" \
    -A "$UA_FBC" -L "https://$DOMAIN/$CODE"
  echo "  OG tags:"
  grep -oiE '<meta[^>]+(og:(title|description|image|url|type)|twitter:card)[^>]*>' /tmp/fbc.html | head -8 | sed 's/^/    /'
  echo "  <title>: $(grep -oiE '<title>[^<]*' /tmp/fbc.html | head -1 | cut -c8-120)"
  echo "  text sample: $(sed 's/<[^>]*>/ /g' /tmp/fbc.html | tr -s ' \n' ' ' | cut -c1-220)"
  echo "  leak scan (must be empty):"
  grep -ioE 'cloak|adsterra|sleepox|short.?code|redirect_to|dashboard|safe.?page|prelanding' /tmp/fbc.html \
    | sort -u | sed 's/^/    !! /' || true

  echo "--- [3] Real FB in-app mobile user (should reach offer) ---"
  curl -s -o /dev/null -D /tmp/h1.txt -w "  status:%{http_code} redirect:%{redirect_url}\n" \
    -A "$UA_FB_IAB" -e "https://l.facebook.com/" \
    -H 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' \
    -H 'Accept-Language: en-US,en;q=0.9' -H 'Accept-Encoding: gzip, deflate, br' \
    "https://$DOMAIN/$CODE"

  echo "--- [3b] Cold desktop (reviewer-like) ---"
  curl -s -o /dev/null -w "  status:%{http_code} redirect:%{redirect_url}\n" \
    -A "$UA_DESK" -H 'Accept: text/html,application/xhtml+xml' \
    "https://$DOMAIN/$CODE"

  echo "--- [4] Recent routing split (24h) ---"
  docker exec -i "$DB_CONT" psql -U "$DB_USER" -d "$DB_NAME" -c "
    SELECT routed_to, is_bot, count(*), (array_agg(DISTINCT bot_reason))[1:4] reasons
    FROM clicks c JOIN links l ON l.id=c.link_id
    WHERE l.short_code='$CODE' AND c.created_at > now() - interval '24 hours'
    GROUP BY 1,2 ORDER BY 3 DESC;" 2>/dev/null || true

  echo "--- [5] Destination reachability + final landing host ---"
  DEST=$(q "SELECT destination_url FROM links WHERE short_code='$CODE'")
  echo "  destination: ${DEST:-<none>}"
  if [ -n "${DEST:-}" ]; then
    curl -s --compressed -o /tmp/dest.html -w "  status:%{http_code} final:%{url_effective} size:%{size_download}\n" \
      -A "$UA_FB_IAB" -L --max-redirs 10 --max-time 20 "$DEST"
    echo "  landing title: $(grep -oiE '<title>[^<]*' /tmp/dest.html | head -1 | cut -c8-120)"
  fi
done

echo
echo "=== DOMAIN HYGIENE: $DOMAIN ==="
echo "--- robots.txt ---"; curl -s --max-time 10 "https://$DOMAIN/robots.txt" | head -15
echo "--- homepage (crawler UA) ---"
curl -s --compressed -o /tmp/home.html -w "  status:%{http_code} size:%{size_download}\n" -A "$UA_FBC" "https://$DOMAIN/"
echo "  title: $(grep -oiE '<title>[^<]*' /tmp/home.html | head -1 | cut -c8-120)"
echo "--- SSL SAN list ---"
echo | openssl s_client -servername "$DOMAIN" -connect "$DOMAIN":443 2>/dev/null \
  | openssl x509 -noout -text 2>/dev/null | grep -A1 "Subject Alternative Name" | tail -1
echo "--- SaaS path must NOT exist on ad domain (expect 404/redirect) ---"
for p in /dashboard /login /signup /control-panel; do
  printf "  %-15s %s\n" "$p" "$(curl -s -o /dev/null -w '%{http_code}' -A "$UA_DESK" "https://$DOMAIN$p")"
done
echo
echo "=== DONE ==="
