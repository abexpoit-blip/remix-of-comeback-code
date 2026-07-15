-- Raise refresh cap + make fast fallback truly fast (drop expensive COUNT DISTINCT ip)
-- and bump pg_cron batch to 200/min so all active users stay hot.

CREATE OR REPLACE FUNCTION public._fast_analytics_summary(_user_id uuid, _days integer DEFAULT 7)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '4s'
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
  FROM public.links WHERE user_id = _user_id;

  IF v_links = '[]'::jsonb THEN
    RETURN jsonb_build_object('empty', true, '_fallback', true);
  END IF;

  v_total := v_humans + v_bots;

  SELECT COALESCE(jsonb_agg(t ORDER BY t.humans DESC), '[]'::jsonb) INTO v_top_links
  FROM (
    SELECT id AS link_id,
           COALESCE(clicks_count, 0)::bigint AS humans,
           COALESCE(bot_clicks_count, 0)::bigint AS bots,
           (COALESCE(clicks_count, 0) + COALESCE(bot_clicks_count, 0))::bigint AS total
    FROM public.links WHERE user_id = _user_id
    ORDER BY COALESCE(clicks_count, 0) DESC LIMIT 6
  ) t;

  BEGIN
    SELECT
      COUNT(*) FILTER (WHERE created_at > now() - interval '24 hours'),
      COUNT(*) FILTER (WHERE created_at > now() - interval '24 hours' AND NOT is_bot),
      COUNT(*) FILTER (WHERE created_at > now() - interval '60 seconds')
    INTO v_last24, v_last24_humans, v_last60s
    FROM public.clicks
    WHERE link_id = ANY(v_link_ids) AND created_at > now() - interval '24 hours';
  EXCEPTION WHEN OTHERS THEN
    v_last24 := 0; v_last24_humans := 0; v_last60s := 0;
  END;

  BEGIN
    WITH buckets AS (SELECT generate_series(0, 23) AS bucket),
    counts AS (
      SELECT FLOOR(EXTRACT(EPOCH FROM (now() - created_at)) / 3600)::int AS hours_ago, COUNT(*) AS cnt
      FROM public.clicks
      WHERE link_id = ANY(v_link_ids) AND NOT is_bot AND created_at > now() - interval '24 hours'
      GROUP BY 1
    )
    SELECT jsonb_agg(COALESCE(c.cnt, 0) ORDER BY b.bucket) INTO v_hourly
    FROM buckets b LEFT JOIN counts c ON c.hours_ago = (23 - b.bucket);
  EXCEPTION WHEN OTHERS THEN v_hourly := NULL; END;

  BEGIN
    SELECT COALESCE(jsonb_agg(t ORDER BY t.created_at DESC), '[]'::jsonb) INTO v_live
    FROM (
      SELECT id, link_id, country, ua, is_bot, routed_to, created_at
      FROM public.clicks
      WHERE link_id = ANY(v_link_ids)
      ORDER BY created_at DESC LIMIT 20
    ) t;
  EXCEPTION WHEN OTHERS THEN v_live := '[]'::jsonb; END;

  RETURN jsonb_build_object(
    'links', v_links, 'total', v_total, 'humans', v_humans, 'bots', v_bots,
    'unique', 0, 'uniqueVisitors', 0, 'unique_ips', 0,
    'last24h', v_last24, 'last24hHumans', v_last24_humans, 'last60s', v_last60s,
    'offers', v_offers, 'oursClicks', v_ours,
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
    'countries', '[]'::jsonb, 'devices', '[]'::jsonb, 'browsers', '[]'::jsonb,
    'operatingSystems', '[]'::jsonb, 'botReasons', '[]'::jsonb, 'trafficSources', '[]'::jsonb,
    'topLinks', v_top_links, 'liveEvents', COALESCE(v_live, '[]'::jsonb),
    '_fallback', true
  );
END $function$;

-- Raise refresh cap from 100 -> 500 per invocation
CREATE OR REPLACE FUNCTION public.refresh_active_analytics_cache(_limit integer DEFAULT 20)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user record;
  v_count int := 0;
  v_failed int := 0;
  v_started timestamptz := clock_timestamp();
  v_data jsonb;
  v_unique bigint := 0;
  v_locked boolean;
  v_errors jsonb := '[]'::jsonb;
  v_cap int := GREATEST(1, LEAST(COALESCE(_limit, 20), 500));
BEGIN
  PERFORM set_config('statement_timeout', '120s', true);
  PERFORM set_config('lock_timeout', '2s', true);

  v_locked := pg_try_advisory_lock(hashtext('refresh_active_analytics_cache'));
  IF NOT v_locked THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'already_running');
  END IF;

  FOR v_user IN
    SELECT l.user_id, MIN(ac.updated_at) AS cache_at, MAX(l.last_clicked_at) AS last_clicked
    FROM public.links l
    LEFT JOIN public.analytics_cache ac ON ac.user_id = l.user_id AND ac.days = 7
    WHERE l.user_id IS NOT NULL
    GROUP BY l.user_id
    HAVING MIN(ac.updated_at) IS NULL OR MIN(ac.updated_at) < now() - interval '2 minutes'
    ORDER BY (MIN(ac.updated_at) IS NULL) DESC, MAX(l.last_clicked_at) DESC NULLS LAST
    LIMIT v_cap
  LOOP
    BEGIN
      BEGIN
        v_data := public._compute_analytics_summary(v_user.user_id, 7);
      EXCEPTION WHEN OTHERS THEN
        v_data := public._fast_analytics_summary(v_user.user_id, 7)
          || jsonb_build_object('_refreshFallbackReason', SQLERRM);
      END;

      v_unique := COALESCE(
        CASE WHEN COALESCE(v_data->>'unique', '') ~ '^\d+$' THEN (v_data->>'unique')::bigint END,
        CASE WHEN COALESCE(v_data->>'uniqueVisitors', '') ~ '^\d+$' THEN (v_data->>'uniqueVisitors')::bigint END,
        0
      );
      v_data := v_data || jsonb_build_object('unique', v_unique, 'uniqueVisitors', v_unique, 'unique_ips', v_unique);

      UPDATE public.analytics_cache SET data = v_data, updated_at = now()
      WHERE user_id = v_user.user_id AND days = 7;

      IF NOT FOUND THEN
        BEGIN
          INSERT INTO public.analytics_cache (user_id, days, data, updated_at)
          VALUES (v_user.user_id, 7, v_data, now());
        EXCEPTION WHEN unique_violation THEN
          UPDATE public.analytics_cache SET data = v_data, updated_at = now()
          WHERE user_id = v_user.user_id AND days = 7;
        END;
      END IF;

      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      IF jsonb_array_length(v_errors) < 5 THEN
        v_errors := v_errors || jsonb_build_array(jsonb_build_object(
          'user_id', v_user.user_id, 'state', SQLSTATE, 'error', SQLERRM
        ));
      END IF;
    END;
  END LOOP;

  PERFORM pg_advisory_unlock(hashtext('refresh_active_analytics_cache'));

  RETURN jsonb_build_object(
    'ok', true, 'refreshed', v_count, 'failed', v_failed,
    'errors', v_errors, 'limit', v_cap,
    'tookMs', ROUND(EXTRACT(EPOCH FROM (clock_timestamp() - v_started)) * 1000)::int
  );
EXCEPTION WHEN OTHERS THEN
  IF v_locked THEN
    PERFORM pg_advisory_unlock(hashtext('refresh_active_analytics_cache'));
  END IF;
  RAISE;
END $function$;

GRANT EXECUTE ON FUNCTION public._fast_analytics_summary(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.refresh_active_analytics_cache(integer) TO authenticated, service_role;

-- Bump pg_cron analytics refresh to 200 users/min
DO $$
BEGIN
  PERFORM cron.unschedule(jobname) FROM cron.job WHERE jobname = 'refresh-analytics-cache';
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'refresh-analytics-cache',
  '* * * * *',
  $$ SELECT public.refresh_active_analytics_cache(200); $$
);

NOTIFY pgrst, 'reload schema';