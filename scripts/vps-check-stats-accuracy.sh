#!/usr/bin/env bash
set -euo pipefail

# Run this ON THE VPS to verify dashboard / admin stats are consistent.
# It compares live clicks with the counters stored on links/profiles.

APP_DIR="${APP_DIR:-/opt/sleepox-app-new}"
cd "$APP_DIR"

# Load DB URL from the running environment (do not print it)
DB_URL="${DATABASE_URL:-${SUPABASE_DATABASE_URL:-}}"
if [[ -z "$DB_URL" && -f .env ]]; then
  DB_URL="$(grep -E '^(DATABASE_URL|SUPABASE_DATABASE_URL)=' .env | head -1 | cut -d= -f2-)"
fi
if [[ -z "$DB_URL" ]]; then
  echo "❌ DATABASE_URL / SUPABASE_DATABASE_URL not found in env or .env"
  exit 1
fi

SQL=$(cat <<'EOF'
SELECT
  'clicks_today_raw' AS metric,
  (SELECT count(*)::bigint FROM public.clicks WHERE created_at >= now()::date) AS value
UNION ALL SELECT 'humans_today_raw', (SELECT count(*)::bigint FROM public.clicks WHERE created_at >= now()::date AND is_bot = false)
UNION ALL SELECT 'bots_today_raw',   (SELECT count(*)::bigint FROM public.clicks WHERE created_at >= now()::date AND is_bot = true)
UNION ALL SELECT 'ours_today_raw',  (SELECT count(*)::bigint FROM public.clicks WHERE created_at >= now()::date AND routed_to = 'ours' AND is_bot = false)
UNION ALL SELECT 'sum_link_clicks_count',  (SELECT COALESCE(sum(clicks_count), 0)::bigint FROM public.links)
UNION ALL SELECT 'sum_link_bot_clicks_count', (SELECT COALESCE(sum(bot_clicks_count), 0)::bigint FROM public.links)
UNION ALL SELECT 'sum_link_ours_count',      (SELECT COALESCE(sum(ours_clicks_count), 0)::bigint FROM public.links)
UNION ALL SELECT 'sum_link_offer_count',     (SELECT COALESCE(sum(offer_clicks_count), 0)::bigint FROM public.links)
UNION ALL SELECT 'daily_stats_rows',         (SELECT count(*)::bigint FROM public.daily_stats)
UNION ALL SELECT 'daily_stats_human_total',  (SELECT COALESCE(sum(human_clicks), 0)::bigint FROM public.daily_stats);
EOF
)

echo "📊 Stats consistency check"
echo "=========================="
psql "$DB_URL" -c "$SQL"

echo ""
echo "✅ If 'sum_link_*' counters roughly match the raw counts, counters are accurate."
echo "✅ If daily_stats rows exist, the dashboard chart should now use the RPC merge and avoid double-counting."
