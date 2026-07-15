-- Aggressive PostgREST schema cache bust for get_live_analytics_summary
-- DROP + CREATE forces PostgREST to fully re-discover the function

DROP FUNCTION IF EXISTS public.get_live_analytics_summary(uuid);

CREATE OR REPLACE FUNCTION public.get_live_analytics_summary(_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '5s'
AS $function$
DECLARE
  v_link_ids uuid[];
  v_links jsonb := '[]'::jsonb;
  v_now timestamptz := now();
  v_last60s bigint := 0;
  v_last5m bigint := 0;
  v_humans1h bigint := 0;
  v_bots1h bigint := 0;
  v_last24h bigint := 0;
  v_last24h_humans bigint := 0;
  v_last24h_bots bigint := 0;
  v_events jsonb := '[]'::jsonb;
  v_countries jsonb := '[]'::jsonb;
  v_cohorts jsonb := '[]'::jsonb;
BEGIN
  IF auth.role() = 'authenticated' AND auth.uid() IS DISTINCT FROM _user_id THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT array_agg(id),
         COALESCE(jsonb_agg(jsonb_build_object('id', id, 'short_code', short_code, 'title', title)), '[]'::jsonb)
  INTO v_link_ids, v_links
  FROM public.links WHERE user_id = _user_id;

  IF v_link_ids IS NULL OR array_length(v_link_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('last60s',0,'cps5m',0,'humans1h',0,'bots1h',0,'last24h',0,'last24hHumans',0,'last24hBots',0,'links','[]'::jsonb,'events','[]'::jsonb,'countries','[]'::jsonb,'cohorts','[]'::jsonb);
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE created_at >= v_now - interval '60 seconds'),
    COUNT(*) FILTER (WHERE created_at >= v_now - interval '5 minutes'),
    COUNT(*) FILTER (WHERE created_at >= v_now - interval '1 hour' AND is_bot = false),
    COUNT(*) FILTER (WHERE created_at >= v_now - interval '1 hour' AND is_bot = true),
    COUNT(*),
    COUNT(*) FILTER (WHERE is_bot = false),
    COUNT(*) FILTER (WHERE is_bot = true)
  INTO v_last60s, v_last5m, v_humans1h, v_bots1h, v_last24h, v_last24h_humans, v_last24h_bots
  FROM public.clicks
  WHERE link_id = ANY(v_link_ids) AND created_at >= v_now - interval '24 hours';

  SELECT COALESCE(jsonb_agg(t ORDER BY t.created_at DESC), '[]'::jsonb)
  INTO v_events
  FROM (
    SELECT c.id, c.link_id, l.short_code, l.title, c.country, c.ua, c.is_bot,
           c.routed_to, c.referer_host, c.bot_reason, c.created_at
    FROM public.clicks c JOIN public.links l ON l.id = c.link_id
    WHERE c.link_id = ANY(v_link_ids) AND c.created_at >= v_now - interval '24 hours'
    ORDER BY c.created_at DESC LIMIT 50
  ) t;

  SELECT COALESCE(jsonb_agg(t ORDER BY t.count DESC), '[]'::jsonb)
  INTO v_countries
  FROM (
    SELECT UPPER(COALESCE(NULLIF(country, ''), '??')) AS code,
           COUNT(*)::bigint AS count,
           COUNT(*) FILTER (WHERE is_bot = false)::bigint AS humans,
           COUNT(*) FILTER (WHERE is_bot = true)::bigint AS bots
    FROM public.clicks
    WHERE link_id = ANY(v_link_ids) AND created_at >= v_now - interval '24 hours'
    GROUP BY 1 ORDER BY count DESC LIMIT 12
  ) t;

  SELECT COALESCE(jsonb_agg(t ORDER BY t.total DESC), '[]'::jsonb)
  INTO v_cohorts
  FROM (
    SELECT source, COUNT(*)::bigint AS total,
           COUNT(*) FILTER (WHERE is_bot = false)::bigint AS humans,
           COUNT(*) FILTER (WHERE is_bot = true)::bigint AS bots
    FROM (
      SELECT is_bot,
        CASE
          WHEN referer_host IS NULL OR referer_host = '' THEN 'direct'
          WHEN lower(referer_host) LIKE '%facebook%' OR lower(referer_host) LIKE '%fb.%' THEN 'facebook'
          WHEN lower(referer_host) LIKE '%instagram%' THEN 'instagram'
          WHEN lower(referer_host) LIKE '%tiktok%' THEN 'tiktok'
          WHEN lower(referer_host) LIKE '%twitter%' OR lower(referer_host) LIKE '%x.com%' THEN 'twitter'
          WHEN lower(referer_host) LIKE '%youtube%' THEN 'youtube'
          WHEN lower(referer_host) LIKE '%google%' THEN 'google'
          WHEN lower(referer_host) LIKE '%bing%' THEN 'bing'
          WHEN lower(referer_host) LIKE '%reddit%' THEN 'reddit'
          WHEN lower(referer_host) LIKE '%telegram%' OR lower(referer_host) LIKE '%t.me%' THEN 'telegram'
          WHEN lower(referer_host) LIKE '%whatsapp%' THEN 'whatsapp'
          ELSE 'other'
        END AS source
      FROM public.clicks
      WHERE link_id = ANY(v_link_ids) AND created_at >= v_now - interval '24 hours'
    ) s GROUP BY source ORDER BY total DESC LIMIT 8
  ) t;

  RETURN jsonb_build_object(
    'last60s', COALESCE(v_last60s, 0),
    'cps5m', COALESCE(v_last5m, 0),
    'humans1h', COALESCE(v_humans1h, 0),
    'bots1h', COALESCE(v_bots1h, 0),
    'last24h', COALESCE(v_last24h, 0),
    'last24hHumans', COALESCE(v_last24h_humans, 0),
    'last24hBots', COALESCE(v_last24h_bots, 0),
    'links', v_links, 'events', v_events,
    'countries', v_countries, 'cohorts', v_cohorts
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_live_analytics_summary(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_live_analytics_summary(uuid) FROM anon, public;

COMMENT ON FUNCTION public.get_live_analytics_summary(uuid) IS 'Live analytics summary v2 - schema cache bust';

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';