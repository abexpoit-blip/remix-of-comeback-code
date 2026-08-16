#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# AD-REJECT LEAK SCAN — crawler-eye view of every ad domain.
# Run on VPS:  bash scripts/vps-reject-leak-scan.sh
# Read-only. Finds anything a Facebook/Google reviewer could use
# to link an ad domain back to the SaaS, or to call it cloaking.
# ═══════════════════════════════════════════════════════════════
set -u
AD_DOMAINS=(${AD_DOMAINS:-mefok.com skypq.com})
STORE_DOMAIN="${STORE_DOMAIN:-breezysocial.com}"
SAAS_DOMAIN="${SAAS_DOMAIN:-sleepox.com}"
APP_DIR="/opt/sleepox-app-new"
cd "$APP_DIR" 2>/dev/null || true

UA_FBC='facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'
UA_GBOT='Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
UA_DESK='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
UA_FBIAB='Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/450.0.0.0.0;]'

F=0; bad(){ echo "   ❌ $*"; F=$((F+1)); }; ok(){ echo "   ✅ $*"; }
hdr(){ echo; echo "════════ $* ════════"; }
code(){ curl -s -o /dev/null -w '%{http_code}' -m 15 -A "${2:-$UA_DESK}" "$1"; }

# ── 1. SaaS surface must not exist on ad domains ────────────────
hdr "1) SaaS SURFACE ON AD DOMAINS (expect 404)"
for d in "${AD_DOMAINS[@]}" "$STORE_DOMAIN"; do
  for p in /dashboard /login /signup /control-panel /analytics /upgrade /pricing /domains /live /support; do
    c=$(code "https://$d$p")
    [ "$c" = "404" ] || bad "$d$p = $c (SaaS leak to reviewer)"
  done
  # internal/ops endpoints
  for p in /api/public/health /api/public/hooks/leak-scan /api/public/hooks/meta-crawler-probe /api/public/safe-pool-refresh; do
    c=$(code "https://$d$p")
    [ "$c" = "404" ] || bad "$d$p = $c (ops endpoint exposed)"
  done
done
[ "$F" -eq 0 ] && ok "no SaaS/ops paths reachable on ad domains"

# ── 2. Cross-brand string leaks in rendered HTML ────────────────
hdr "2) BRAND / FOOTPRINT LEAKS IN HTML"
for d in "${AD_DOMAINS[@]}"; do
  for p in / /about /contact /privacy /terms /faq /shop /blog; do
    H=$(curl -s -m 15 -A "$UA_FBC" "https://$d$p?cb=$RANDOM")
    for word in breezysocial sleepox adsterra cloak short_code shortener "redirect_to" "safe page" prelanding "1280 Market" "415 555"; do
      n=$(printf '%s' "$H" | grep -oic "$word")
      [ "${n:-0}" -gt 0 ] && bad "$d$p leaks '$word' ×$n"
    done
    # analytics / verification tags must not be shared
    printf '%s' "$H" | grep -oiE 'G-[A-Z0-9]{8,}|google-site-verification[^>]*' | sort -u | sed "s|^|   ℹ️  $d$p tag: |"
  done
done

# ── 3. Shared asset fingerprints (same file = same owner) ───────
hdr "3) ASSET FINGERPRINTS (hashes must differ per brand)"
for a in /favicon.ico /favicon.svg /manifest.json /robots.txt; do
  echo "   $a"
  for d in "${AD_DOMAINS[@]}" "$STORE_DOMAIN" "$SAAS_DOMAIN"; do
    h=$(curl -s -m 10 "https://$d$a" | md5sum | cut -c1-12)
    printf "      %-22s %s\n" "$d" "$h"
  done
done
echo "   (identical hashes across an ad domain and $SAAS_DOMAIN = footprint)"

# ── 4. Crawler vs human on real links (cloaking exposure) ───────
hdr "4) PERSONA TEST ON LIVE SHORT LINKS"
DB=$(docker ps --filter name=supabase-db --format '{{.Names}}' | head -n1)
CODES=$(docker exec -i "$DB" psql -U postgres -d postgres -tAc \
  "SELECT short_code FROM links WHERE is_active ORDER BY click_count DESC LIMIT 3;" 2>/dev/null)
for c in $CODES; do
  d="${AD_DOMAINS[0]}"
  echo "   /$c on $d"
  echo "      fb-crawler : $(code "https://$d/$c" "$UA_FBC")   (expect 200 article)"
  echo "      googlebot  : $(code "https://$d/$c" "$UA_GBOT")  (expect 200 article)"
  echo "      fb in-app  : $(curl -s -o /dev/null -w '%{http_code}' -m 15 -A "$UA_FBIAB" -e 'https://l.facebook.com/' "https://$d/$c?fbclid=t") (expect 200 bridge)"
  echo "      cold desk  : $(code "https://$d/$c")             (expect 200)"
  echo "      -- OG served to crawler --"
  curl -s -m 15 -A "$UA_FBC" "https://$d/$c" \
    | grep -oiE '<meta[^>]+(og:(title|description|image|url|type)|twitter:card)[^>]*>' \
    | head -6 | cut -c1-150 | sed 's/^/         /'
  T=$(curl -s -m 15 -A "$UA_FBC" "https://$d/$c" | sed 's/<[^>]*>/ /g' | tr -s ' \n' ' ' | wc -c)
  [ "$T" -lt 800 ] && bad "/$c safe article is thin (${T} chars) — reviewers call this a doorway page"
  # instant-redirect detection: crawler must NOT get a 3xx
  R=$(curl -s -o /dev/null -D- -m 15 -A "$UA_FBC" "https://$d/$c" | grep -ci '^location:')
  [ "$R" -gt 0 ] && bad "/$c redirects the crawler — classic cloaking flag"
done

# ── 5. DNS / TLS / WHOIS overlap ────────────────────────────────
hdr "5) NETWORK-LEVEL LINKAGE"
for d in "${AD_DOMAINS[@]}" "$STORE_DOMAIN" "$SAAS_DOMAIN"; do
  ip=$(dig +short "$d" A | tail -1)
  printf "   %-22s A=%s\n" "$d" "${ip:-none}"
done
echo "   (all ad domains sharing one IP with $SAAS_DOMAIN is a known linkage signal)"
echo "   -- TLS SAN overlap (a cert covering both = hard proof of same owner) --"
for d in "${AD_DOMAINS[@]}"; do
  san=$(echo | openssl s_client -servername "$d" -connect "$d":443 2>/dev/null \
    | openssl x509 -noout -text 2>/dev/null | grep -A1 "Subject Alternative Name" | tail -1 | tr -d ' ')
  echo "      $d -> $san"
  printf '%s' "$san" | grep -qi "$SAAS_DOMAIN" && bad "$d cert also covers $SAAS_DOMAIN — same-owner proof"
done

# ── 6. robots / sitemap consistency ─────────────────────────────
hdr "6) ROBOTS & SITEMAP"
for d in "${AD_DOMAINS[@]}"; do
  echo "   -- $d/robots.txt --"; curl -s -m 10 "https://$d/robots.txt" | head -8 | sed 's/^/      /'
  s=$(code "https://$d/sitemap.xml"); echo "      sitemap.xml=$s"
  curl -s -m 10 "https://$d/sitemap.xml" | grep -oiE 'sleepox|breezysocial' | sort -u | sed 's/^/      ❌ sitemap leaks /'
done

# ── 7. Safe-page pool health ────────────────────────────────────
hdr "7) SAFE PAGE POOL (must be real, varied, same-origin)"
for d in "${AD_DOMAINS[@]}"; do
  echo "   $d article samples:"
  for i in 1 2 3; do
    U=$(curl -s -o /dev/null -w '%{url_effective}' -L -m 15 -A "$UA_FBC" "https://$d/?probe=$RANDOM")
    echo "      $U"
  done
done

hdr "RESULT"
[ "$F" -eq 0 ] && echo "   ✅ no reject-triggering leaks found" || echo "   ❌ $F issue(s) — fix before scaling spend"
