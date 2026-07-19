-- 1) Lower staleness threshold from 2 min to 45s in refresher
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
  v_cap int := GREATEST(1, LEAST(COALESCE(_limit, 20), 800));
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
    HAVING MIN(ac.updated_at) IS NULL OR MIN(ac.updated_at) < now() - interval '45 seconds'
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

-- 2) Bump cron job to process 500 users per minute (covers ~all active users each pass)
SELECT cron.unschedule('refresh-analytics-cache');
SELECT cron.schedule(
  'refresh-analytics-cache',
  '* * * * *',
  $$ SELECT public.refresh_active_analytics_cache(500); $$
);