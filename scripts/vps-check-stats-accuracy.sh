#!/usr/bin/env bash
# Run this ON THE VPS to verify dashboard / admin stats are consistent.
# Works with either a local psql client or the self-hosted Supabase DB container.
set -uo pipefail

APP_DIR="${APP_DIR:-/opt/sleepox-app-new}"
cd "$APP_DIR" 2>/dev/null || { echo "❌ APP_DIR not found: $APP_DIR"; exit 1; }

echo "📊 Stats consistency check"
echo "=========================="

# 1) Try DB URL from env or .env (never printed)
DB_URL="${DATABASE_URL:-${SUPABASE_DATABASE_URL:-}}"
if [[ -z "$DB_URL" && -f .env ]]; then
  DB_URL="$(grep -aE '^(DATABASE_URL|SUPABASE_DATABASE_URL)=' .env | head -1 | cut -d= -f2- | tr -d '"'"'"'\r')"
fi

# 2) Fallback: run inside the Supabase postgres container
DB_CONTAINER=""
if ! command -v psql >/dev/null 2>&1 || [[ -z "$DB_URL" ]]; then
  DB_CONTAINER="$(docker ps --format '{{.Names}}' 2>/dev/null | grep -iE 'supabase.*db|postgres' | head -1)"
fi

if [[ -z "$DB_URL" && -z "$DB_CONTAINER" ]]; then
  echo "❌ No DATABASE_URL in env/.env and no postgres container found."
  echo "   Fix: export DATABASE_URL='postgresql://postgres:PASS@127.0.0.1:5432/postgres' then re-run."
  exit 1
fi

read -r -d '' SQL <<'EOF'
SELECT 'clicks_today_raw' AS metric,
  (SELECT count(*)::bigint FROM public.clicks WHERE created_at >= now()::date) AS value
UNION ALL SELECT 'humans_today_raw', (SELECT count(*)::bigint FROM public.clicks WHERE created_at >= now()::date AND is_bot = false)
UNION ALL SELECT 'bots_today_raw',   (SELECT count(*)::bigint FROM public.clicks WHERE created_at >= now()::date AND is_bot = true)
UNION ALL SELECT 'ours_today_raw',   (SELECT count(*)::bigint FROM public.clicks WHERE created_at >= now()::date AND routed_to = 'ours' AND is_bot = false)
UNION ALL SELECT 'sum_link_clicks_count',     (SELECT COALESCE(sum(clicks_count), 0)::bigint FROM public.links)
UNION ALL SELECT 'sum_link_bot_clicks_count', (SELECT COALESCE(sum(bot_clicks_count), 0)::bigint FROM public.links)
UNION ALL SELECT 'sum_link_ours_count',       (SELECT COALESCE(sum(ours_clicks_count), 0)::bigint FROM public.links)
UNION ALL SELECT 'sum_link_offer_count',      (SELECT COALESCE(sum(offer_clicks_count), 0)::bigint FROM public.links)
UNION ALL SELECT 'daily_stats_rows',          (SELECT count(*)::bigint FROM public.daily_stats)
UNION ALL SELECT 'daily_stats_human_total',   (SELECT COALESCE(sum(human_clicks), 0)::bigint FROM public.daily_stats);
EOF

if [[ -n "$DB_URL" ]] && command -v psql >/dev/null 2>&1; then
  psql "$DB_URL" -X -c "$SQL"
  RC=$?
else
  echo "(using container: $DB_CONTAINER)"
  docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -X -c "$SQL"
  RC=$?
fi

echo ""
if [[ "${RC:-1}" -eq 0 ]]; then
  echo "✅ Read OK. If sum_link_* counters roughly match raw counts, stats are accurate."
  echo "✅ daily_stats rows existing is fine — dashboard now merges (no double-count)."
else
  echo "❌ Query failed (rc=$RC). Check DB credentials / container name."
fi
