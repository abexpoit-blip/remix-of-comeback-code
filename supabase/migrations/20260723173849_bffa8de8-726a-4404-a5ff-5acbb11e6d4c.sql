CREATE INDEX IF NOT EXISTS idx_clicks_created_at_brin
  ON public.clicks USING brin (created_at);

CREATE OR REPLACE FUNCTION public.get_admin_overview_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '8s'
AS $function$
DECLARE
  v_since timestamptz := now() - interval '24 hours';
  v_today timestamptz := CURRENT_DATE;
  v_24h_total bigint := 0;
  v_24h_bots bigint := 0;
  v_24h_ours bigint := 0;
  v_24h_offer bigint := 0;
  v_today_clicks bigint := 0;
  v_total_links bigint := 0;
  v_active_links bigint := 0;
BEGIN
  SELECT
    COUNT(*) FILTER (WHERE is_bot = false),
    COUNT(*) FILTER (WHERE is_bot = true),
    COUNT(*) FILTER (WHERE is_bot = false AND routed_to = 'ours'),
    COUNT(*) FILTER (WHERE is_bot = false AND routed_to = 'offer'),
    COUNT(*) FILTER (WHERE is_bot = false AND created_at >= v_today)
  INTO v_24h_total, v_24h_bots, v_24h_ours, v_24h_offer, v_today_clicks
  FROM public.clicks
  WHERE created_at >= v_since;

  SELECT COUNT(*), COUNT(*) FILTER (WHERE is_active = true)
  INTO v_total_links, v_active_links
  FROM public.links;

  RETURN jsonb_build_object(
    'total_clicks', v_24h_total,
    'total_bots',   v_24h_bots,
    'total_ours',   v_24h_ours,
    'total_offer',  v_24h_offer,
    'today_clicks', v_today_clicks,
    'total_links',  v_total_links,
    'active_links', v_active_links,
    'window',       '24h'
  );
END;
$function$;