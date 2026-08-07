#!/usr/bin/env bash
# Repair HTTPS + Nginx reverse proxy for the self-hosted Supabase API.

set -euo pipefail

DOMAIN="supabase.sleepox.com"
EMAIL="support@sleepox.com"
KONG_PORT="${KONG_PORT:-8000}"
SUPABASE_DIR="${SUPABASE_DIR:-/opt/supabase-docker}"
NGINX_CONF="/etc/nginx/sites-available/$DOMAIN"
NGINX_ENABLED="/etc/nginx/sites-enabled/$DOMAIN"
DEFAULT_CONF="/etc/nginx/sites-available/default"
CERT_DIR="/etc/letsencrypt/live/$DOMAIN"
BACKUP_DIR="/root/sleepox-nginx-backups"

backup_nginx_conf() {
  local conf="$1"
  mkdir -p "$BACKUP_DIR"
  cp "$conf" "$BACKUP_DIR/$(basename "$conf").$(date +%Y%m%d%H%M%S)"
}

find_compose_dir() {
  for dir in "$SUPABASE_DIR" /opt/supabase-docker /opt/supabase/docker /opt/supabase; do
    if [ -f "$dir/docker-compose.yml" ] || [ -f "$dir/docker-compose.yaml" ] || [ -f "$dir/compose.yml" ] || [ -f "$dir/compose.yaml" ]; then
      printf '%s\n' "$dir"
      return 0
    fi
  done
  return 1
}

find_kong_config() {
  local dir="$1"
  for file in "$dir/volumes/api/kong.yml" "$dir/volumes/api/kong.yaml" "$dir/kong.yml" "$dir/kong.yaml"; do
    if [ -f "$file" ]; then
      printf '%s\n' "$file"
      return 0
    fi
  done
  find "$dir" -maxdepth 5 -type f \( -name 'kong.yml' -o -name 'kong.yaml' \) 2>/dev/null | head -n 1
}

detect_kong_container() {
  docker ps --format '{{.Names}}' 2>/dev/null | grep -Ei '(^|[-_])kong($|[-_])|supabase.*kong|kong' | head -n 1 || true
}

detect_kong_upstream() {
  local container="$1"
  local mapped_port container_ip
  mapped_port="$(docker port "$container" 8000/tcp 2>/dev/null | sed -nE 's/.*:([0-9]+)$/\1/p' | head -n 1 || true)"
  if [ -n "$mapped_port" ]; then
    printf '127.0.0.1:%s\n' "$mapped_port"
    return 0
  fi
  container_ip="$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$container" 2>/dev/null | head -n 1 || true)"
  if [ -n "$container_ip" ]; then
    printf '%s:8000\n' "$container_ip"
    return 0
  fi
  printf '127.0.0.1:%s\n' "$KONG_PORT"
}

curl_status() {
  curl -sS -o /dev/null -w '%{http_code}' --max-time 5 "http://$1/auth/v1/health" 2>/dev/null || true
}

is_bad_gateway_status() {
  case "$1" in
    ""|000|502|503|504) return 0 ;;
    *) return 1 ;;
  esac
}

print_backend_diagnostics() {
  echo ""
  echo "🧰 Backend diagnostics"
  docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -Ei "supabase|kong|auth|rest|postgrest|gotrue" || true
  if [ -n "${kong_container:-}" ]; then
    echo ""
    echo "Recent Kong logs:"
    docker logs --tail 80 "$kong_container" 2>&1 || true
  fi
}

clean_nginx_conf() {
  local conf="$1"
  [ -f "$conf" ] || return 0
  backup_nginx_conf "$conf"
  sed -i -E "s/[[:space:]]+$DOMAIN//g; s/$DOMAIN[[:space:]]+//g; s/server_name[[:space:]]*;/server_name _;/g" "$conf"
  python3 - "$conf" <<'PYEOF'
import re, sys
p = sys.argv[1]
s = open(p).read()
s = re.sub(r"\n\s*if\s*\(\s*\$host\s*=\s*\)\s*\{[^{}]*\}\s*(#[^\n]*)?", "\n", s)
s = re.sub(r"\n\s*if\s*\(\s*\)\s*\{[^{}]*\}\s*(#[^\n]*)?", "\n", s)
open(p, "w").write(s)
PYEOF
}

echo "🔍 Repairing HTTPS + proxy for $DOMAIN..."

if ! command -v certbot >/dev/null 2>&1; then
  echo "📦 Installing Certbot..."
  apt-get update
  apt-get install -y certbot python3-certbot-nginx
fi

if [ ! -f "$CERT_DIR/fullchain.pem" ] || [ ! -f "$CERT_DIR/privkey.pem" ]; then
  echo "🔐 Requesting Let's Encrypt certificate for $DOMAIN..."
  certbot certonly --nginx -d "$DOMAIN" --non-interactive --agree-tos --email "$EMAIL"
else
  echo "✅ Existing certificate found for $DOMAIN."
fi

echo "🧹 Disabling accidental Nginx backup files from sites-enabled..."
find /etc/nginx/sites-enabled -maxdepth 1 -type l -name '*.sleepox-backup-*' -delete 2>/dev/null || true
find /etc/nginx/sites-enabled -maxdepth 1 -type f -name '*.sleepox-backup-*' -exec mv {} "$BACKUP_DIR/" \; 2>/dev/null || true

echo "🧹 Cleaning $DOMAIN references from the generic Nginx default site (and any broken certbot blocks)..."
clean_nginx_conf "$DEFAULT_CONF"
for conf in /etc/nginx/sites-available/* /etc/nginx/sites-enabled/*; do
  [ -f "$conf" ] || continue
  case "$conf" in *.sleepox-backup-*) continue ;; esac
  [ "$conf" = "$NGINX_CONF" ] || [ "$conf" = "$NGINX_ENABLED" ] || clean_nginx_conf "$conf"
done
for conf in /etc/nginx/conf.d/*.conf; do
  [ -f "$conf" ] || continue
  clean_nginx_conf "$conf"
done

compose_dir="$(find_compose_dir || true)"
kong_conf=""
if [ -n "$compose_dir" ]; then
  kong_conf="$(find_kong_config "$compose_dir" || true)"
fi

if [ -n "$kong_conf" ]; then
  echo "🧭 Ensuring Kong strips Supabase API prefixes before proxying to services..."
  cp "$kong_conf" "$kong_conf.sleepox-backup-$(date +%Y%m%d%H%M%S)"
  python3 - "$kong_conf" <<'PYEOF'
import re, sys
p = sys.argv[1]
s = open(p).read()
for name in ("auth-v1", "auth-v1-open", "auth-v1-open-callback", "rest-v1", "realtime-v1", "storage-v1", "functions-v1"):
    pattern = rf"(name:\s*{re.escape(name)}[\s\S]*?\n\s*strip_path:\s*)false"
    s = re.sub(pattern, r"\1true", s, count=1)
open(p, "w").write(s)
PYEOF
  echo "♻️  Restarting Supabase API gateway so route changes take effect..."
  (cd "$compose_dir" && (docker compose restart kong || docker-compose restart kong || true))
elif [ -n "$compose_dir" ]; then
  echo "⚠️  Kong config file was not found, but compose directory exists. Ensuring backend containers are up..."
  (cd "$compose_dir" && (docker compose up -d || docker-compose up -d || true))
fi

kong_container="$(detect_kong_container)"
upstream="127.0.0.1:$KONG_PORT"
if [ -n "$kong_container" ]; then
  default_upstream="$(detect_kong_upstream "$kong_container")"
  container_ip="$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$kong_container" 2>/dev/null | head -n 1 || true)"
  candidates=("$default_upstream" "127.0.0.1:$KONG_PORT")
  if [ -n "$container_ip" ]; then
    candidates+=("$container_ip:8000")
  fi

  echo "✅ Detected Kong container '$kong_container'. Testing reachable upstreams..."
  for candidate in "${candidates[@]}"; do
    [ -n "$candidate" ] || continue
    status="$(curl_status "$candidate")"
    echo "   - http://$candidate/auth/v1/health => HTTP ${status:-000}"
    if ! is_bad_gateway_status "$status"; then
      upstream="$candidate"
      break
    fi
  done
  echo "✅ Nginx upstream will be $upstream"
else
  echo "⚠️  Could not auto-detect a Kong container; Nginx upstream will be $upstream"
fi

if [ -n "$compose_dir" ]; then
  echo "⏳ Waiting for backend API containers to become healthy..."
  for i in $(seq 1 30); do
    kong_container="$(detect_kong_container)"
    status=""
    if [ -n "$kong_container" ]; then
      status="$(curl_status "$upstream")"
    fi
    if ! is_bad_gateway_status "$status"; then
      echo "✅ Backend API gateway is responding with HTTP $status"
      break
    fi
    if [ "$i" -eq 30 ]; then
      echo "⚠️  Backend API gateway is still not responding after waiting. Continuing to write Nginx config, diagnostics will show details if verification fails."
      break
    fi
    sleep 2
  done
fi

echo "📄 Writing dedicated Nginx reverse-proxy config for $DOMAIN -> $upstream..."
cat > "$NGINX_CONF" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        return 301 https://\$host\$request_uri;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name $DOMAIN;

    ssl_certificate $CERT_DIR/fullchain.pem;
    ssl_certificate_key $CERT_DIR/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    client_max_body_size 100m;
    proxy_read_timeout 300s;
    proxy_connect_timeout 60s;
    proxy_send_timeout 300s;

    location / {
        proxy_pass http://$upstream;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-Host \$host;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF

ln -sf "$NGINX_CONF" "$NGINX_ENABLED"

echo "🧪 Checking Nginx config..."
nginx -t

echo "♻️  Reloading Nginx..."
systemctl reload nginx

echo "🔎 Verifying that HTTPS no longer returns the generic Nginx 404 page..."
tmp_body="$(mktemp)"
http_code="$(curl -ksS -o "$tmp_body" -w "%{http_code}" "https://$DOMAIN/auth/v1/health" || true)"
if grep -qi "<center><h1>404 Not Found</h1></center>" "$tmp_body"; then
  echo "❌ $DOMAIN is still being served by the generic Nginx site instead of Supabase Kong."
  echo "   Check for duplicate server_name entries with: grep -R '$DOMAIN' /etc/nginx/sites-enabled /etc/nginx/sites-available"
  rm -f "$tmp_body"
  exit 1
fi
if is_bad_gateway_status "$http_code"; then
  echo "❌ $DOMAIN is reaching Nginx, but Nginx cannot reach the backend API gateway (HTTP ${http_code:-000})."
  print_backend_diagnostics
  rm -f "$tmp_body"
  exit 1
fi
rm -f "$tmp_body"

echo "✅ SSL + proxy repair complete. Auth health HTTP status: $http_code"
echo "Now run: ./scripts/vps-smoke-test.sh"
