#!/usr/bin/env bash
# Permanent fix for "one or more domains still present the wrong certificate".
#
# Root cause: every public domain lives inside ONE nginx server block
# (/etc/nginx/sites-enabled/sleepox). `certbot --nginx --cert-name X` rewrites
# the ssl_certificate lines of that shared block, so the LAST domain processed
# wins and every other domain presents that cert (TLS mismatch -> curl 000).
#
# This script gives every content domain its own server block + own cert.
# Idempotent: safe to run as many times as you like.
set -euo pipefail

DOMAINS=(${SITE_DOMAINS:-breezysocial.com mefok.com skypq.com})
UPSTREAM="${UPSTREAM:-sleepox_app}"
PORTS_START="${PORTS_START:-4000}"
PORTS_COUNT="${PORTS_COUNT:-8}"
AVAIL=/etc/nginx/sites-available
ENABLED=/etc/nginx/sites-enabled
STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP=/root/nginx-backup-$STAMP

[ "$(id -u)" -eq 0 ] || { echo "run as root"; exit 1; }

mkdir -p "$BACKUP"
cp -a /etc/nginx/sites-available "$BACKUP/" 2>/dev/null || true
echo "🗄  nginx backup: $BACKUP"

# ---------------------------------------------------------------- upstream
if ! nginx -T 2>/dev/null | grep -q "upstream $UPSTREAM"; then
  {
    echo "upstream $UPSTREAM {"
    echo "    least_conn;"
    for i in $(seq 0 $((PORTS_COUNT - 1))); do
      echo "    server 127.0.0.1:$((PORTS_START + i)) max_fails=3 fail_timeout=10s;"
    done
    echo "    keepalive 64;"
    echo "}"
  } > "$AVAIL/00-upstream-$UPSTREAM"
  ln -sf "$AVAIL/00-upstream-$UPSTREAM" "$ENABLED/00-upstream-$UPSTREAM"
  echo "➕ created upstream $UPSTREAM"
fi

# --------------------------------- strip the domains from any shared vhost
for f in "$AVAIL"/*; do
  [ -f "$f" ] || continue
  case "$(basename "$f")" in dom-*|00-upstream-*) continue;; esac
  for d in "${DOMAINS[@]}"; do
    # remove `domain` and `www.domain` tokens from every server_name line
    sed -i -E "s/([[:space:]])(www\.)?${d//./\\.}([[:space:];])/\1\3/g" "$f"
  done
  # drop server blocks whose server_name became empty
  sed -i -E 's/^([[:space:]]*)server_name[[:space:]]+;/\1server_name _;/' "$f"
done

# ----------------------------------------------- per-domain http vhost file
for d in "${DOMAINS[@]}"; do
  cat > "$AVAIL/dom-$d" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $d www.$d;

    location /.well-known/acme-challenge/ { root /var/www/html; }

    location / {
        proxy_pass http://$UPSTREAM;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-Host \$host;
        proxy_set_header Connection "";
        proxy_read_timeout 60s;
    }
}
EOF
  ln -sf "$AVAIL/dom-$d" "$ENABLED/dom-$d"
done

mkdir -p /var/www/html
nginx -t
systemctl reload nginx

# ------------------------------------------------------- one cert per domain
command -v certbot >/dev/null || { apt-get update; apt-get install -y certbot python3-certbot-nginx; }

for d in "${DOMAINS[@]}"; do
  echo "===== $d ====="
  args=(-d "$d")
  # only include www when it actually resolves, otherwise certbot fails the whole cert
  if getent ahostsv4 "www.$d" >/dev/null 2>&1; then args+=(-d "www.$d"); fi
  certbot --nginx --cert-name "$d" "${args[@]}" \
    --non-interactive --agree-tos --register-unsafely-without-email --redirect || {
      echo "⚠️  certbot failed for $d (continuing)"; }
done

nginx -t
systemctl reload nginx

# ------------------------------------------------------------------- verify
failed=0
for d in "${DOMAINS[@]}"; do
  san=$(echo | openssl s_client -servername "$d" -connect "$d:443" 2>/dev/null \
    | openssl x509 -noout -ext subjectAltName 2>/dev/null | tail -1 | tr -d ' ')
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "https://$d/" || echo 000)
  echo "$d -> ${san:-<no cert>} | GET / = $code"
  printf '%s' "$san" | grep -q "DNS:$d" || failed=1
  # a cert that also covers a *different* content domain is an ownership proof
  for other in "${DOMAINS[@]}"; do
    [ "$other" = "$d" ] && continue
    printf '%s' "$san" | grep -q "DNS:$other" && { echo "   ❌ SAN overlap with $other"; failed=1; }
  done
done

if [ "$failed" -eq 0 ]; then
  echo "✅ every domain has its own isolated certificate and vhost"
else
  echo "❌ still wrong — restore with: cp -a $BACKUP/sites-available/* $AVAIL/ && systemctl reload nginx"
  exit 1
fi
