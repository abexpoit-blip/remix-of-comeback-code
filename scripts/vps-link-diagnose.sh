#!/usr/bin/env bash
# Diagnose why a specific short code sends humans to the safe article.
# Run on VPS: bash scripts/vps-link-diagnose.sh s6h7sy [more codes...]
set -u
DB=$(docker ps --filter name=supabase-db --format '{{.Names}}' | head -n1)
psql() { docker exec -i "$DB" psql -U postgres -d postgres -q -c "$1"; }
CODES=("$@")
[ ${#CODES[@]} -gt 0 ] || CODES=(s6h7sy)
LIST=$(printf "'%s'," "${CODES[@]}"); LIST="${LIST%,}"

echo "════ LINK ROWS ════"
psql "SELECT short_code, is_active, status, expires_at, clicks_count,
             COALESCE(NULLIF(destination_url,''),'(EMPTY!)') AS destination,
             COALESCE(NULLIF(safe_url,''),'(pool)') AS safe_url,
             COALESCE(blocked_countries,'{}') AS blocked
      FROM links WHERE short_code IN ($LIST);"

echo "════ OWNER QUOTA ════"
psql "SELECT l.short_code, p.email, p.plan_slug, p.clicks_used, p.click_quota,
             (p.click_quota IS NOT NULL AND COALESCE(p.clicks_used,0) >= p.click_quota) AS quota_exhausted,
             p.plan_expires_at
      FROM links l JOIN profiles p ON p.id = l.user_id WHERE l.short_code IN ($LIST);"

echo "════ LAST 30 CLICKS (why routed) ════"
psql "SELECT c.created_at, l.short_code, c.routed_to, c.is_bot,
             COALESCE(c.bot_reason,'(none)') reason, COALESCE(c.country,'?') country,
             COALESCE(c.device,'?') device
      FROM clicks c JOIN links l ON l.id = c.link_id
      WHERE l.short_code IN ($LIST)
      ORDER BY c.created_at DESC LIMIT 30;"

echo "════ ROUTING SPLIT LAST 24H ════"
psql "SELECT l.short_code, c.routed_to, c.is_bot, COUNT(*) hits
      FROM clicks c JOIN links l ON l.id = c.link_id
      WHERE l.short_code IN ($LIST) AND c.created_at > now() - interval '24 hours'
      GROUP BY 1,2,3 ORDER BY 1,4 DESC;"
