-- Force API schema visibility for live analytics RPC and add a robust JSON fallback overload.

CREATE OR REPLACE FUNCTION public.get_live_analytics_summary(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '15s'
AS $function$
DECLARE
  v_link_ids uuid[];
  v_last60s bigint := 0;
  v_cps5m numeric := 0;
  v_humans1h bigint := 0;
  v_bots1h bigint := 0;
  v_last24h bigint := 0;
  v_last24h_humans bigint := 0;
  v_last24h_bots bigint := 0;
  v_links jsonb := '[]'::jsonb;
  v_events jsonb := '[]'::jsonb;
  v_countries jsonb := '[]'::jsonb;
  v_cohorts jsonb := '[]'::jsonb;
BEGIN
  SELECT array_agg(id) INTO v_link_ids
  FROM public.links
  WHERE user_id = _user_id;

  IF v_link_ids IS NULL OR array_length(v_link_ids, 1) IS NULL THEN
    RETURN jsonb_build_object(
      'last60s', 0,
      'cps5m', 0,
      'humans1h', 0,
      'bots1h', 0,
      'last24h', 0,
      'last24hHumans', 0,
      'last24hBots', 0,
      'links', '[]'::jsonb,
      'events', '[]'::jsonb,
      'countries', '[]'::jsonb,
      'cohorts', '[]'::jsonb
    );
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'short_code', short_code, 'title', title) ORDER BY created_at DESC), '[]'::jsonb)
    INTO v_links
  FROM (
    SELECT id, short_code, title, created_at
    FROM public.links
    WHERE user_id = _user_id
    ORDER BY created_at DESC
    LIMIT 200
  ) l;

  SELECT COUNT(*) INTO v_last60s
  FROM public.clicks
  WHERE link_id = ANY(v_link_ids)
    AND created_at >= now() - interval '60 seconds';

  SELECT COUNT(*)::numeric / 300.0 INTO v_cps5m
  FROM public.clicks
  WHERE link_id = ANY(v_link_ids)
    AND created_at >= now() - interval '5 minutes';

  SELECT
    COUNT(*) FILTER (WHERE is_bot = false),
    COUNT(*) FILTER (WHERE is_bot = true)
  INTO v_humans1h, v_bots1h
  FROM public.clicks
  WHERE link_id = ANY(v_link_ids)
    AND created_at >= now() - interval '1 hour';

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE is_bot = false),
    COUNT(*) FILTER (WHERE is_bot = true)
  INTO v_last24h, v_last24h_humans, v_last24h_bots
  FROM public.clicks
  WHERE link_id = ANY(v_link_ids)
    AND created_at >= now() - interval '24 hours';

  SELECT COALESCE(jsonb_agg(row_to_json(e) ORDER BY e.created_at DESC), '[]'::jsonb)
    INTO v_events
  FROM (
    SELECT c.id, c.link_id, l.short_code, l.title, c.country, c.ua, c.is_bot,
           c.routed_to, c.referer_host, c.bot_reason, c.created_at
    FROM public.clicks c
    LEFT JOIN public.links l ON l.id = c.link_id
    WHERE c.link_id = ANY(v_link_ids)
    ORDER BY c.created_at DESC
    LIMIT 50
  ) e;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'code', COALESCE(country, '??'),
    'count', cnt,
    'humans', humans,
    'bots', bots
  ) ORDER BY cnt DESC), '[]'::jsonb)
    INTO v_countries
  FROM (
    SELECT country,
           COUNT(*) AS cnt,
           COUNT(*) FILTER (WHERE is_bot = false) AS humans,
           COUNT(*) FILTER (WHERE is_bot = true) AS bots
    FROM public.clicks
    WHERE link_id = ANY(v_link_ids)
      AND created_at >= now() - interval '24 hours'
    GROUP BY country
    ORDER BY cnt DESC
    LIMIT 12
  ) t;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'source', src,
    'total', total,
    'humans', humans,
    'bots', bots
  ) ORDER BY total DESC), '[]'::jsonb)
    INTO v_cohorts
  FROM (
    SELECT
      CASE
        WHEN referer_host IS NULL OR referer_host = '' THEN 'direct'
        WHEN referer_host ILIKE '%facebook%' OR referer_host ILIKE '%fb.%' THEN 'facebook'
        WHEN referer_host ILIKE '%instagram%' THEN 'instagram'
        WHEN referer_host ILIKE '%tiktok%' THEN 'tiktok'
        WHEN referer_host ILIKE '%google%' THEN 'google'
        WHEN referer_host ILIKE '%youtube%' THEN 'youtube'
        WHEN referer_host ILIKE '%twitter%' OR referer_host ILIKE '%x.com%' THEN 'twitter'
        ELSE 'other'
      END AS src,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE is_bot = false) AS humans,
      COUNT(*) FILTER (WHERE is_bot = true) AS bots
    FROM public.clicks
    WHERE link_id = ANY(v_link_ids)
      AND created_at >= now() - interval '24 hours'
    GROUP BY 1
    ORDER BY total DESC
    LIMIT 8
  ) t;

  RETURN jsonb_build_object(
    'last60s', v_last60s,
    'cps5m', v_cps5m,
    'humans1h', v_humans1h,
    'bots1h', v_bots1h,
    'last24h', v_last24h,
    'last24hHumans', v_last24h_humans,
    'last24hBots', v_last24h_bots,
    'links', v_links,
    'events', v_events,
    'countries', v_countries,
    'cohorts', v_cohorts
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_live_analytics_summary(_payload jsonb)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '15s'
AS $function$
  SELECT public.get_live_analytics_summary((_payload->>'_user_id')::uuid);
$function$;

REVOKE ALL ON FUNCTION public.get_live_analytics_summary(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_live_analytics_summary(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_live_analytics_summary(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_live_analytics_summary(jsonb) TO authenticated, service_role;

COMMENT ON FUNCTION public.get_live_analytics_summary(uuid) IS 'Live analytics summary RPC; refreshed 2026-07-15 to force API schema cache reload.';
COMMENT ON FUNCTION public.get_live_analytics_summary(jsonb) IS 'Fallback JSON overload for API schema parameter matching.';

NOTIFY pgrst, 'reload schema';