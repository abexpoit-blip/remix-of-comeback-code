-- ============================================================
-- Performance fix: dashboard + analytics cache load
-- 1) Cut refresh batch: 800 → 150 (stops DB overload)
-- 2) Rewrite get_dashboard_stats to use daily_stats + sampled clicks
-- ============================================================

-- 1) LOWER CACHE REFRESH BATCH CAP (from 800 to 150)
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
  v_cap int := GREATEST(1, LEAST(COALESCE(_limit, 20), 150));  -- HARD CAP 150
  v_budget_ms int := 45000;  -- stop after 45s to leave headroom for next cron
BEGIN
  PERFORM set_config('statement_timeout', '60s', true);
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
      AND l.last_clicked_at > now() - interval '2 hours'  -- ONLY refresh recently-active users
    GROUP BY l.user_id
    HAVING MIN(ac.updated_at) IS NULL OR MIN(ac.updated_at) < now() - interval '60 seconds'
    ORDER BY (MIN(ac.updated_at) IS NULL) DESC, MAX(l.last_clicked_at) DESC NULLS LAST
    LIMIT v_cap
  LOOP
    -- Time budget guard: stop if we've spent too long
    EXIT WHEN EXTRACT(EPOCH FROM (clock_timestamp() - v_started)) * 1000 > v_budget_ms;

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

-- 2) FAST DASHBOARD STATS
-- Old version scans 30 days of raw clicks + COUNT DISTINCT ip = 30M+ rows/call.
-- New version: aggregate from daily_stats (pre-aggregated) + sample for mobile%.
CREATE OR REPLACE FUNCTION public.get_dashboard_stats(_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '10s'
AS $function$
DECLARE
  v_link_ids uuid[];
  v_since30 timestamptz := now() - interval '30 days';
  v_since7  timestamptz := now() - interval '7 days';
  v_clicks_by_day jsonb;
  v_country_stats jsonb;
  v_mobile_pct int := 0;
  v_unique_visitors bigint := 0;
  v_per_link_daily jsonb;
  v_mobile_total bigint;
  v_mobile_count bigint;
BEGIN
  SELECT array_agg(id) INTO v_link_ids FROM public.links WHERE user_id = _user_id;

  IF v_link_ids IS NULL OR array_length(v_link_ids, 1) IS NULL THEN
    RETURN jsonb_build_object(
      'clicksByDay', '{}'::jsonb,
      'countryStats', '{}'::jsonb,
      'mobilePct', 0,
      'uniqueVisitors', 0,
      'perLinkDaily', '{}'::jsonb
    );
  END IF;

  -- 30-day daily series: use daily_stats for old days + clicks only for TODAY
  WITH days AS (
    SELECT (now()::date - i) AS d FROM generate_series(0, 29) i
  ),
  today_clicks AS (
    SELECT (created_at AT TIME ZONE 'UTC')::date AS d, COUNT(*)::bigint AS cnt
    FROM public.clicks
    WHERE link_id = ANY(v_link_ids) AND NOT is_bot
      AND created_at >= (now()::date)::timestamptz
    GROUP BY 1
  ),
  ds_agg AS (
    SELECT day AS d, SUM(human_clicks)::bigint AS cnt
    FROM public.daily_stats
    WHERE link_id = ANY(v_link_ids)
      AND day >= v_since30::date AND day < now()::date
    GROUP BY 1
  ),
  combined AS (
    SELECT d, cnt FROM today_clicks
    UNION ALL
    SELECT d, cnt FROM ds_agg
  )
  SELECT jsonb_object_agg(to_char(d.d, 'YYYY-MM-DD'), COALESCE(a.cnt, 0))
    INTO v_clicks_by_day
  FROM days d LEFT JOIN (SELECT d, SUM(cnt) AS cnt FROM combined GROUP BY 1) a ON a.d = d.d;

  -- Country counts: use daily_stats only (skip today for speed)
  WITH ds_cty AS (
    SELECT key AS country, SUM(value::int)::bigint AS cnt
    FROM public.daily_stats, jsonb_each_text(country_breakdown)
    WHERE link_id = ANY(v_link_ids) AND day >= v_since30::date
    GROUP BY 1
  )
  SELECT jsonb_object_agg(COALESCE(country, 'Unknown'), cnt)
    INTO v_country_stats
  FROM ds_cty;

  -- Mobile percentage: 24h SAMPLED clicks (max 5000 rows)
  WITH sample AS (
    SELECT ua FROM public.clicks
    WHERE link_id = ANY(v_link_ids) AND NOT is_bot
      AND created_at >= now() - interval '24 hours'
    LIMIT 5000
  )
  SELECT COUNT(*), COUNT(*) FILTER (WHERE ua_device(ua) = 'Mobile')
    INTO v_mobile_total, v_mobile_count
  FROM sample;

  IF v_mobile_total > 0 THEN
    v_mobile_pct := ROUND((v_mobile_count::numeric / v_mobile_total::numeric) * 100)::int;
  END IF;

  -- Unique visitors: LAST 7 DAYS ONLY (not 30d), skip COUNT DISTINCT ip scan
  BEGIN
    SELECT COUNT(DISTINCT ip) INTO v_unique_visitors
    FROM public.clicks
    WHERE link_id = ANY(v_link_ids)
      AND NOT is_bot AND ip IS NOT NULL
      AND created_at >= v_since7;
  EXCEPTION WHEN OTHERS THEN
    v_unique_visitors := 0;
  END;

  -- Per-link 7-day sparkline
  WITH days AS (
    SELECT (now()::date - i) AS d, (6 - i) AS idx FROM generate_series(0, 6) i
  ),
  agg AS (
    SELECT link_id, (created_at AT TIME ZONE 'UTC')::date AS d, COUNT(*)::bigint AS cnt
    FROM public.clicks
    WHERE link_id = ANY(v_link_ids) AND NOT is_bot
      AND created_at >= v_since7
    GROUP BY 1, 2
  ),
  per_link AS (
    SELECT l_id, jsonb_agg(COALESCE(a.cnt, 0) ORDER BY d.idx) AS arr
    FROM unnest(v_link_ids) l_id
    CROSS JOIN days d
    LEFT JOIN agg a ON a.link_id = l_id AND a.d = d.d
    GROUP BY l_id
  )
  SELECT jsonb_object_agg(l_id::text, arr) INTO v_per_link_daily FROM per_link;

  RETURN jsonb_build_object(
    'clicksByDay',    COALESCE(v_clicks_by_day, '{}'::jsonb),
    'countryStats',   COALESCE(v_country_stats, '{}'::jsonb),
    'mobilePct',      v_mobile_pct,
    'uniqueVisitors', v_unique_visitors,
    'perLinkDaily',   COALESCE(v_per_link_daily, '{}'::jsonb)
  );
END $function$;