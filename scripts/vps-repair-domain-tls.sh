#!/usr/bin/env bash
# Issue one independent certificate per public content domain and verify that
# nginx presents the right certificate. Safe to run repeatedly.
set -euo pipefail

DOMAINS=(${AD_DOMAINS:-mefok.com skypq.com})

command -v certbot >/dev/null || {
  apt-get update
  apt-get install -y certbot python3-certbot-nginx
}

nginx -t
for domain in "${DOMAINS[@]}"; do
  echo "===== $domain ====="
  getent ahostsv4 "$domain" | head -1 || { echo "❌ DNS missing for $domain"; exit 1; }
  nginx -T 2>/dev/null | grep -Eq "server_name[^;]*([[:space:]]|^)$domain([[:space:]]|;|$)" || {
    echo "❌ nginx has no exact server_name for $domain; certificate was not changed"
    exit 1
  }
  certbot --nginx --cert-name "$domain" -d "$domain" \
    --non-interactive --agree-tos --register-unsafely-without-email --redirect
done

nginx -t
systemctl reload nginx

failed=0
for domain in "${DOMAINS[@]}"; do
  san=$(echo | openssl s_client -servername "$domain" -connect "$domain:443" 2>/dev/null \
    | openssl x509 -noout -ext subjectAltName 2>/dev/null | tail -1 | tr -d ' ')
  echo "$domain -> $san"
  printf '%s' "$san" | grep -q "DNS:$domain" || failed=1
done
[ "$failed" -eq 0 ] || { echo "❌ one or more domains still present the wrong certificate"; exit 1; }
echo "✅ every ad domain now presents its own valid certificate"