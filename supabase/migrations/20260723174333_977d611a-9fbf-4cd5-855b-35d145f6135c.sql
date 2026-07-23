CREATE INDEX IF NOT EXISTS idx_clicks_recent_cover
  ON public.clicks (created_at DESC)
  INCLUDE (is_bot, routed_to, country, bot_reason);

CREATE INDEX IF NOT EXISTS idx_clicks_bot_reason_created
  ON public.clicks (created_at DESC, bot_reason)
  WHERE is_bot = true;

CREATE OR REPLACE FUNCTION public.get_admin_overview_stats()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '30s'
AS $function$
  WITH traffic AS MATERIALIZED (
    SELECT
      COUNT(*) FILTER (WHERE is_bot = false)::bigint AS humans,
      COUNT(*) FILTER (WHERE is_bot = true)::bigint AS bots,
      COUNT(*) FILTER (WHERE is_bot = false AND routed_to = 'ours')::bigint AS ours,
      COUNT(*) FILTER (WHERE is_bot = false AND routed_to = 'offer')::bigint AS offer,
      COUNT(*) FILTER (WHERE is_bot = false AND created_at >= CURRENT_DATE)::bigint AS today
    FROM public.clicks
    WHERE created_at >= now() - interval '24 hours'
  ), link_totals AS MATERIALIZED (
    SELECT
      COUNT(*)::bigint AS total,
      COUNT(*) FILTER (WHERE is_active = true)::bigint AS active
    FROM public.links
  )
  SELECT jsonb_build_object(
    'total_clicks', traffic.humans,
    'total_bots', traffic.bots,
    'total_ours', traffic.ours,
    'total_offer', traffic.offer,
    'today_clicks', traffic.today,
    'total_links', link_totals.total,
    'active_links', link_totals.active,
    'window', '24h'
  )
  FROM traffic CROSS JOIN link_totals;
$function$;

CREATE OR REPLACE FUNCTION public.admin_bot_reasons(_hours integer DEFAULT 24, _limit integer DEFAULT 6)
RETURNS TABLE(key text, count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '30s'
AS $function$
  SELECT split_part(COALESCE(bot_reason, 'unknown'), ':', 1) AS key,
         COUNT(*)::bigint AS count
  FROM public.clicks
  WHERE is_bot = true
    AND created_at >= now() - make_interval(hours => GREATEST(1, LEAST(COALESCE(_hours, 24), 168)))
  GROUP BY 1
  ORDER BY count DESC
  LIMIT GREATEST(1, LEAST(COALESCE(_limit, 6), 50));
$function$;

CREATE OR REPLACE FUNCTION public.admin_fb_blocked_count(_hours integer DEFAULT 24)
RETURNS bigint
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '30s'
AS $function$
  SELECT COUNT(*)::bigint
  FROM public.clicks
  WHERE is_bot = true
    AND created_at >= now() - make_interval(hours => GREATEST(1, LEAST(COALESCE(_hours, 24), 168)))
    AND COALESCE(bot_reason, '') LIKE 'fb-%';
$function$;

CREATE OR REPLACE FUNCTION public.admin_top_countries(_days integer DEFAULT 7, _limit integer DEFAULT 12)
RETURNS TABLE(country text, count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '30s'
AS $function$
  SELECT COALESCE(NULLIF(country, ''), '??') AS country,
         COUNT(*)::bigint AS count
  FROM public.clicks
  WHERE created_at >= now() - make_interval(days => GREATEST(1, LEAST(COALESCE(_days, 7), 31)))
  GROUP BY 1
  ORDER BY count DESC
  LIMIT GREATEST(1, LEAST(COALESCE(_limit, 12), 50));
$function$;

GRANT EXECUTE ON FUNCTION public.get_admin_overview_stats() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_bot_reasons(integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_fb_blocked_count(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_top_countries(integer, integer) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';