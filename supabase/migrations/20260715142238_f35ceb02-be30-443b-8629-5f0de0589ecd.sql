
-- 1) Bump analytics cache refresh throughput: 10 -> 60 users/minute
SELECT cron.unschedule('refresh-analytics-cache');
SELECT cron.schedule(
  'refresh-analytics-cache',
  '* * * * *',
  $$ SELECT public.refresh_active_analytics_cache(60); $$
);

-- 2) Improve _fast_analytics_summary: include real live counts (last24h, last60s, hourly, liveEvents)
-- so cache-miss users no longer see zeros for Live Traffic Snapshot.
CREATE OR REPLACE FUNCTION public._fast_analytics_summary(_user_id uuid, _days integer DEFAULT 7)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '6s'
AS $function$
DECLARE
  v_link_ids uuid[];
  v_links jsonb;
  v_total bigint := 0;
  v_humans bigint := 0;
  v_bots bigint := 0;
  v_offers bigint := 0;
  v_ours bigint := 0;
  v_top_links jsonb;
  v_unique bigint := 0;
  v_last24 bigint := 0;
  v_last24_humans bigint := 0;
  v_last60s bigint := 0;
  v_hourly jsonb;
  v_live jsonb;
BEGIN
  SELECT
    COALESCE(array_agg(id), ARRAY[]::uuid[]),
    COALESCE(jsonb_agg(jsonb_build_object('id', id, 'short_code', short_code, 'title', title) ORDER BY created_at DESC), '[]'::jsonb),
    COALESCE(SUM(clicks_count), 0),
    COALESCE(SUM(bot_clicks_count), 0),
    COALESCE(SUM(ours_clicks_count), 0),
    COALESCE(SUM(offer_clicks_count), 0)
  INTO v_link_ids, v_links, v_humans, v_bots, v_ours, v_offers
  FROM public.links
  WHERE user_id = _user_id;

  IF v_links = '[]'::jsonb THEN
    RETURN jsonb_build_object('empty', true, '_fallback', true);
  END IF;

  v_total := v_humans + v_bots;

  SELECT COALESCE(jsonb_agg(t ORDER BY t.humans DESC), '[]'::jsonb)
  INTO v_top_links
  FROM (
    SELECT id AS link_id,
           COALESCE(clicks_count, 0)::bigint AS humans,
           COALESCE(bot_clicks_count, 0)::bigint AS bots,
           (COALESCE(clicks_count, 0) + COALESCE(bot_clicks_count, 0))::bigint AS total
    FROM public.links
    WHERE user_id = _user_id
    ORDER BY COALESCE(clicks_count, 0) DESC
    LIMIT 6
  ) t;

  -- Real live counts (indexed, fast)
  BEGIN
    SELECT
      COUNT(*) FILTER (WHERE created_at > now() - interval '24 hours'),
      COUNT(*) FILTER (WHERE created_at > now() - interval '24 hours' AND NOT is_bot),
      COUNT(*) FILTER (WHERE created_at > now() - interval '60 seconds')
    INTO v_last24, v_last24_humans, v_last60s
    FROM public.clicks
    WHERE link_id = ANY(v_link_ids)
      AND created_at > now() - interval '24 hours';
  EXCEPTION WHEN OTHERS THEN
    v_last24 := 0; v_last24_humans := 0; v_last60s := 0;
  END;

  -- 24h hourly series (human clicks)
  BEGIN
    WITH buckets AS (SELECT generate_series(0, 23) AS bucket),
    counts AS (
      SELECT FLOOR(EXTRACT(EPOCH FROM (now() - created_at)) / 3600)::int AS hours_ago,
             COUNT(*) AS cnt
      FROM public.clicks
      WHERE link_id = ANY(v_link_ids)
        AND NOT is_bot
        AND created_at > now() - interval '24 hours'
      GROUP BY 1
    )
    SELECT jsonb_agg(COALESCE(c.cnt, 0) ORDER BY b.bucket)
      INTO v_hourly
    FROM buckets b
    LEFT JOIN counts c ON c.hours_ago = (23 - b.bucket);
  EXCEPTION WHEN OTHERS THEN
    v_hourly := NULL;
  END;

  -- Live events: latest 20
  BEGIN
    SELECT COALESCE(jsonb_agg(t ORDER BY t.created_at DESC), '[]'::jsonb)
      INTO v_live
    FROM (
      SELECT id, link_id, country, ua, is_bot, routed_to, created_at
      FROM public.clicks
      WHERE link_id = ANY(v_link_ids)
      ORDER BY created_at DESC
      LIMIT 20
    ) t;
  EXCEPTION WHEN OTHERS THEN
    v_live := '[]'::jsonb;
  END;

  BEGIN
    SELECT COUNT(DISTINCT ip) INTO v_unique
    FROM public.clicks
    WHERE link_id = ANY(v_link_ids)
      AND created_at >= (now() - (_days || ' days')::interval)
      AND is_bot = false
      AND ip IS NOT NULL;
  EXCEPTION WHEN OTHERS THEN
    v_unique := 0;
  END;

  RETURN jsonb_build_object(
    'links', v_links,
    'total', v_total,
    'humans', v_humans,
    'bots', v_bots,
    'unique', v_unique,
    'uniqueVisitors', v_unique,
    'unique_ips', v_unique,
    'last24h', v_last24,
    'last24hHumans', v_last24_humans,
    'last60s', v_last60s,
    'offers', v_offers,
    'oursClicks', v_ours,
    'hourly', COALESCE(v_hourly, jsonb_build_array(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0)),
    'heatmap', jsonb_build_array(
      jsonb_build_array(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0),
      jsonb_build_array(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0),
      jsonb_build_array(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0),
      jsonb_build_array(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0),
      jsonb_build_array(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0),
      jsonb_build_array(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0),
      jsonb_build_array(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0)
    ),
    'heatMax', 1,
    'countries', '[]'::jsonb,
    'devices', '[]'::jsonb,
    'browsers', '[]'::jsonb,
    'operatingSystems', '[]'::jsonb,
    'botReasons', '[]'::jsonb,
    'trafficSources', '[]'::jsonb,
    'topLinks', v_top_links,
    'liveEvents', COALESCE(v_live, '[]'::jsonb),
    '_fallback', true
  );
END
$function$;

GRANT EXECUTE ON FUNCTION public._fast_analytics_summary(uuid, integer) TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';
