#!/usr/bin/env bash
# Persona click test — runs FROM the VPS against the live public domains.
#
# For every short domain we fire the exact same short link with several
# personas and assert what each one MUST get:
#
#   real human (desktop / mobile / referred)  -> offer   (NOT safe/article)
#   Meta/FB crawler                           -> 200 HTML article (no 302)
#   Google/Bing crawler                       -> safe page, same origin
#   naked scraper (curl, no Accept header)    -> safe page
#
# Usage: bash scripts/vps-persona-click-test.sh [code1 code2 ...]
set -uo pipefail

DOMAINS=(mefok.com skypq.com)
CODES=("$@")
if [ ${#CODES[@]} -eq 0 ]; then
  # pull 3 random active codes straight from the DB
  mapfile -t CODES < <(docker exec supabase-db psql -U postgres -d postgres -tAc \
    "SELECT short_code FROM links WHERE is_active ORDER BY random() LIMIT 3" 2>/dev/null)
fi
[ ${#CODES[@]} -eq 0 ] && { echo "no codes to test"; exit 1; }

UA_DESKTOP='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36'
UA_MOBILE='Mozilla/5.0 (Linux; Android 14; SM-A155F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36'
UA_IPHONE='Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1'
UA_FB='facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'
UA_GOOGLE='Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
UA_BING='Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)'
UA_CURL='curl/8.5.0'

ACCEPT_HUMAN='text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'

pass=0; fail=0

# hit <label> <url> <ua> <expect: offer|article|safe> [extra curl args...]
hit() {
  local label="$1" url="$2" ua="$3" expect="$4"; shift 4
  local out status loc routed
  out=$(curl -sS -o /tmp/pct-body.html -D /tmp/pct-hdr.txt -A "$ua" \
        --max-time 20 "$@" -w '%{http_code}' "$url" 2>/dev/null)
  status="$out"
  loc=$(grep -i '^location:' /tmp/pct-hdr.txt | tail -1 | tr -d '\r' | sed 's/^[Ll]ocation: *//')
  routed=$(grep -i '^x-sx-route:' /tmp/pct-hdr.txt | tail -1 | tr -d '\r' | sed 's/.*: *//')
  local got="?" hop=""
  if [ "$status" = "200" ]; then
    if grep -q 'id="sx-go"' /tmp/pct-body.html; then
      # content bridge: real article + CTA that forwards to the offer.
      # This IS the offer path for ad-click traffic, not traffic loss.
      got="bridge(offer)"
      hop=$(grep -o 'id="sx-go" href="[^"]*"' /tmp/pct-body.html | head -1 | sed 's/.*href="//;s/"$//')
    elif grep -qiE 'location\.(href|replace|assign)|http-equiv="?refresh' /tmp/pct-body.html; then
      got="bounce(offer)"
      hop=$(grep -oE 'location\.(replace|assign)\("[^"]*"\)|location\.href *= *"[^"]*"' /tmp/pct-body.html | head -1 | grep -oE '"[^"]*"' | head -1 | tr -d '"')

    elif grep -qiE '<article|<h1' /tmp/pct-body.html; then
      got="article"
    else
      got="200-unknown"
    fi
  elif [ "$status" = "301" ] || [ "$status" = "302" ]; then
    case "$loc" in
      *"$SAFE_HOST"/blog*|*/faq*|*/about*|*/size-guide*|*/shipping*|*/returns*|*/contact*|*/shop*) got="safe" ;;
      *) got="offer" ;;
    esac
  else
    got="http-$status"
  fi
  [ -n "$hop" ] && loc="$hop"

  local ok="❌"
  case "$expect|$got" in
    "article|article") ok="✅" ;;
    "safe|safe"|"safe|article") ok="✅" ;;
    "offer|offer"|"offer|bridge(offer)"|"offer|bounce(offer)") ok="✅" ;;
  esac
  # A human landing on a pure safe/article page with no way forward = real loss.
  if [ "$expect" = "offer" ] && [ "$got" = "article" ]; then got="article(LOSS)"; fi
  [ "$ok" = "✅" ] && pass=$((pass+1)) || fail=$((fail+1))

  printf '   %s %-22s want=%-7s got=%-14s http=%s route=%s\n' \
    "$ok" "$label" "$expect" "$got" "$status" "${routed:-–}"
  [ -n "$loc" ] && printf '        -> %s\n' "${loc:0:110}"
}

for d in "${DOMAINS[@]}"; do
  SAFE_HOST="$d"
  echo ""
  echo "════════ $d ════════"
  for c in "${CODES[@]}"; do
    [ -z "$c" ] && continue
    U="https://$d/$c"
    dbstat=$(docker exec supabase-db psql -U postgres -d postgres -tAc \
      "SELECT is_active||' safe_url='||COALESCE(NULLIF(safe_url,''),'(pool)') FROM links WHERE short_code='$c' LIMIT 1" 2>/dev/null | tr -d '\r')
    echo " -- /$c -- ${dbstat:-not-in-db(=> article by design)}"
    hit "human desktop"   "$U" "$UA_DESKTOP" offer   -H "Accept: $ACCEPT_HUMAN" -H 'Accept-Language: en-US,en;q=0.9' -H 'Sec-Fetch-Mode: navigate' -H 'Sec-Fetch-Dest: document' -H 'Sec-Fetch-Site: none' -H 'Upgrade-Insecure-Requests: 1'
    hit "human android"   "$U" "$UA_MOBILE"  offer   -H "Accept: $ACCEPT_HUMAN" -H 'Accept-Language: en-US,en;q=0.9' -H 'Sec-Fetch-Mode: navigate' -H 'Sec-Fetch-Dest: document' -H 'Referer: https://l.facebook.com/'
    hit "human iphone"    "$U" "$UA_IPHONE"  offer   -H "Accept: $ACCEPT_HUMAN" -H 'Accept-Language: en-US,en;q=0.9' -H 'Sec-Fetch-Mode: navigate' -H 'Sec-Fetch-Dest: document'
    hit "meta crawler"    "$U" "$UA_FB"      article -H 'Accept: */*'
    hit "googlebot"       "$U" "$UA_GOOGLE"  safe    -H 'Accept: */*'
    hit "bingbot"         "$U" "$UA_BING"    safe    -H 'Accept: */*'
    hit "naked curl"      "$U" "$UA_CURL"    safe
  done
done

echo ""
echo "════════ RESULT ════════"
echo "   pass=$pass  fail=$fail"
[ "$fail" -gt 0 ] && echo "   ⚠️  investigate the ❌ rows above (human->safe = traffic loss, crawler->offer = reject risk)"
exit 0
