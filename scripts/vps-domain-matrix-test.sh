#!/usr/bin/env bash
# Side-by-side domain matrix test — runs FROM the VPS.
#
# Fires the SAME short code at all 3 shortener domains with the exact agents
# that decide ad approval / rejection:
#
#   meta-externalagent   Meta's new AI/ads crawler   -> MUST be 200 article
#   facebookexternalhit  classic FB link scraper     -> MUST be 200 article
#   FBAN/FBAV iOS        real user inside FB app     -> MUST reach offer
#   FBAV Android         real user inside FB app     -> MUST reach offer
#   Instagram in-app     real user                   -> MUST reach offer
#   Messenger in-app     real user                   -> MUST reach offer
#   real Chrome desktop  real user                   -> offer / bridge
#   Googlebot            -> safe page
#
# It also prints, per domain, whether the block came from Cloudflare (edge)
# or from our app, plus the resolved ASN path so we can compare a proxied
# domain against a direct one.
#
# Usage: bash scripts/vps-domain-matrix-test.sh [code1 code2 ...]
set -uo pipefail

DOMAINS=(${MATRIX_DOMAINS:-mefok.com skypq.com breezysocial.com})

CODES=("$@")
if [ ${#CODES[@]} -eq 0 ]; then
  mapfile -t CODES < <(docker exec supabase-db psql -U postgres -d postgres -tAc \
    "SELECT short_code FROM links WHERE is_active ORDER BY random() LIMIT 2" 2>/dev/null)
fi
[ ${#CODES[@]} -eq 0 ] && { echo "no codes to test"; exit 1; }

UA_META='meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)'
UA_FBEXT='facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'
UA_FBAN_IOS='Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBDV/iPhone14,3;FBMD/iPhone;FBSN/iOS;FBSV/17.6;FBSS/3;FBID/phone;FBLC/en_US;FBOP/5]'
UA_FBAV_AND='Mozilla/5.0 (Linux; Android 14; SM-A155F Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/139.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/470.0.0.36.109;]'
UA_IG='Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 340.0.0.19.107 (iPhone14,3; iOS 17_6; en_US; en; scale=3.00; 1170x2532; 600000000)'
UA_MSGR='Mozilla/5.0 (Linux; Android 14; SM-A155F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36 [FB_IAB/MESSENGER;FBAV/470.0.0.20.111;]'
UA_DESKTOP='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36'
UA_GOOGLE='Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'

ACCEPT_HUMAN='text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
ACCEPT_BOT='text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'

TMPB=/tmp/dmx-body.html
TMPH=/tmp/dmx-hdr.txt

classify() {
  local status="$1" loc="$2"
  if [ "$status" = "200" ]; then
    if grep -q 'href="[^"]*"[^>]*data-sx' "$TMPB" 2>/dev/null || grep -qE 'id="sx-go"|data-go=' "$TMPB"; then
      echo "bridge(offer)"
    elif grep -qiE 'location\.(href|replace|assign)|http-equiv="?refresh' "$TMPB"; then
      echo "bounce(offer)"
    elif grep -qiE '<article|<h1' "$TMPB"; then
      echo "article"
    else
      echo "200-unknown"
    fi
  elif [ "$status" = "301" ] || [ "$status" = "302" ]; then
    case "$loc" in
      */blog*|*/faq*|*/about*|*/contact*|*/shop*|*/returns*|*/shipping*|*/size-guide*) echo "safe" ;;
      *) echo "offer" ;;
    esac
  else
    echo "http-$status"
  fi
}

# who blocked it: cloudflare edge or our app?
blocked_by() {
  local status="$1"
  [ "$status" = "403" ] || [ "$status" = "429" ] || [ "$status" = "503" ] || return 0
  if grep -qi '^cf-mitigated:\|^server: *cloudflare' "$TMPH" && ! grep -qi '^x-sx-route:' "$TMPH"; then
    echo -n "  <= BLOCKED BY CLOUDFLARE EDGE"
  else
    echo -n "  <= blocked by app"
  fi
}

probe() {
  local label="$1" url="$2" ua="$3" accept="$4" want="$5"
  local status loc route got mark cf
  status=$(curl -sS -o "$TMPB" -D "$TMPH" -A "$ua" -H "Accept: $accept" \
           -H "Accept-Language: en-US,en;q=0.9" --max-time 20 -w '%{http_code}' "$url" 2>/dev/null)
  loc=$(grep -i '^location:' "$TMPH" | tail -1 | tr -d '\r' | sed 's/^[Ll]ocation: *//')
  route=$(grep -i '^x-sx-route:' "$TMPH" | tail -1 | tr -d '\r' | sed 's/.*: *//')
  cf=$(grep -i '^cf-ray:' "$TMPH" | tail -1 | tr -d '\r' | sed 's/.*: *//' | cut -d- -f2)
  got=$(classify "$status" "$loc")

  case "$want" in
    article) [[ "$got" == "article" ]] && mark="OK" || mark="FAIL" ;;
    offer)   if [[ "$got" == offer || "$got" == bridge* || "$got" == bounce* ]]; then mark="OK"
             elif [[ "$SHIELDED" == "1" && "$got" == "article" ]]; then mark="OK"   # global country shield
             else mark="FAIL"; fi ;;
    safe)    [[ "$got" == "safe" || "$got" == "article" ]] && mark="OK" || mark="FAIL" ;;
    *)       mark="--" ;;
  esac
  [ "$mark" = "OK" ] && ok=$((ok+1)) || { [ "$mark" = "FAIL" ] && bad=$((bad+1)); }

  printf '   %-4s %-22s want=%-8s got=%-14s http=%-3s route=%-12s %s%s\n' \
    "$([ "$mark" = OK ] && echo '[+]' || { [ "$mark" = FAIL ] && echo '[!]' || echo '[.]'; })" \
    "$label" "$want" "$got" "$status" "${route:--}" "${cf:+cf=$cf}" "$(blocked_by "$status")"
}

ok=0; bad=0

VPS_CC=$(curl -s --max-time 8 https://ipinfo.io/country 2>/dev/null | tr -d '\r\n ')
[ -z "$VPS_CC" ] && VPS_CC="??"
GLOBAL_SHIELD="${SLEEPOX_GLOBAL_BLOCK_COUNTRIES:-US,FR}"
SHIELDED=0
case ",${GLOBAL_SHIELD}," in *",$VPS_CC,"*) SHIELDED=1 ;; esac

echo "==================================================================="
echo " DOMAIN MATRIX TEST  —  $(date -u '+%F %T UTC')"
echo " domains: ${DOMAINS[*]}"
echo " codes:   ${CODES[*]}"
echo " origin:  $VPS_CC  (global shield: $GLOBAL_SHIELD, shielded=$SHIELDED)"
echo "==================================================================="

for code in "${CODES[@]}"; do
  echo
  echo "###################  code = $code  ###################"
  for d in "${DOMAINS[@]}"; do
    url="https://$d/$code"
    proxied=$(curl -sSI --max-time 10 "https://$d/" 2>/dev/null | grep -qi '^server: *cloudflare' && echo "cloudflare-proxied" || echo "direct-origin")
    echo
    echo " -- $d  ($proxied) --"
    probe "meta-externalagent"  "$url" "$UA_META"     "$ACCEPT_BOT"   article
    probe "facebookexternalhit" "$url" "$UA_FBEXT"    "$ACCEPT_BOT"   article
    probe "FBAN/FBIOS (in-app)" "$url" "$UA_FBAN_IOS" "$ACCEPT_HUMAN" offer
    probe "FBAV/FB4A android"   "$url" "$UA_FBAV_AND" "$ACCEPT_HUMAN" offer
    probe "Instagram in-app"    "$url" "$UA_IG"       "$ACCEPT_HUMAN" offer
    probe "Messenger in-app"    "$url" "$UA_MSGR"     "$ACCEPT_HUMAN" offer
    probe "real chrome desktop" "$url" "$UA_DESKTOP"  "$ACCEPT_HUMAN" offer
    probe "googlebot"           "$url" "$UA_GOOGLE"   "$ACCEPT_BOT"   safe
  done
done

echo
echo "==================================================================="
echo " ROOT / HOMEPAGE CHECK (Meta scrapes the domain root too)"
echo "==================================================================="
for d in "${DOMAINS[@]}"; do
  echo
  echo " -- $d root --"
  probe "meta-externalagent"  "https://$d/" "$UA_META"  "$ACCEPT_BOT" article
  probe "facebookexternalhit" "https://$d/" "$UA_FBEXT" "$ACCEPT_BOT" article
done

echo
echo "==================================================================="
echo " TLS / HEADER ISOLATION (shared cert or shared fingerprint = risk)"
echo "==================================================================="
for d in "${DOMAINS[@]}"; do
  san=$(echo | openssl s_client -servername "$d" -connect "$d":443 2>/dev/null \
        | openssl x509 -noout -ext subjectAltName 2>/dev/null | tr -d ' \n' | sed 's/^X509v3SubjectAlternativeName://;s/^critical//')
  issuer=$(echo | openssl s_client -servername "$d" -connect "$d":443 2>/dev/null \
        | openssl x509 -noout -issuer 2>/dev/null | sed 's/^issuer=//')
  ip=$(dig +short A "$d" | head -2 | tr '\n' ' ')
  printf ' %-20s ip=%-32s\n   SAN: %s\n   CA : %s\n' "$d" "$ip" "${san:-?}" "${issuer:-?}"
done

echo
echo "==================================================================="
echo " RESULT: pass=$ok  fail=$bad"
echo "==================================================================="
[ "$bad" -gt 0 ] && echo "FAIL rows above are the ad-reject causes. 403 + 'BLOCKED BY CLOUDFLARE EDGE' = fix in Cloudflare (Bots -> allow crawlers, Bot Fight Mode off, Browser Integrity Check off)."
exit 0
