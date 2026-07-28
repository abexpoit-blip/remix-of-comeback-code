CREATE OR REPLACE FUNCTION public.aggregate_daily_stats(_days integer DEFAULT 3)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_from date := (now()::date - GREATEST(0, LEAST(COALESCE(_days, 3), 30)));
  v_rows int := 0;
  v_locked boolean;
BEGIN
  PERFORM set_config('statement_timeout', '120s', true);
  PERFORM set_config('lock_timeout', '5s', true);

  v_locked := pg_try_advisory_lock(hashtext('aggregate_daily_stats'));
  IF NOT v_locked THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'already_running');
  END IF;

  WITH src AS (
    SELECT
      c.link_id,
      (c.created_at AT TIME ZONE 'UTC')::date AS day,
      COUNT(*) FILTER (WHERE NOT c.is_bot) AS humans,
      COUNT(*) FILTER (WHERE c.is_bot) AS bots
    FROM public.clicks c
    WHERE c.created_at >= v_from::timestamptz
    GROUP BY 1, 2
  ),
  cty AS (
    SELECT
      c.link_id,
      (c.created_at AT TIME ZONE 'UTC')::date AS day,
      jsonb_object_agg(c.country, n) AS breakdown
    FROM (
      SELECT link_id, created_at, country, COUNT(*) AS n
      FROM public.clicks
      WHERE created_at >= v_from::timestamptz
        AND country IS NOT NULL AND country <> ''
      GROUP BY link_id, created_at, country
    ) c
    GROUP BY 1, 2
  ),
  merged AS (
    SELECT s.link_id, s.day, s.humans, s.bots,
           COALESCE(x.breakdown, '{}'::jsonb) AS breakdown
    FROM src s
    LEFT JOIN (
      SELECT link_id, day,
             (SELECT jsonb_object_agg(k, v) FROM (
                SELECT key AS k, SUM(value::bigint) AS v
                FROM jsonb_each_text(jsonb_agg_strip.b)
                GROUP BY key
             ) z) AS breakdown
      FROM (
        SELECT link_id, day, jsonb_object_agg(country, n) AS b
        FROM (
          SELECT link_id,
                 (created_at AT TIME ZONE 'UTC')::date AS day,
                 country,
                 COUNT(*) AS n
          FROM public.clicks
          WHERE created_at >= v_from::timestamptz
            AND country IS NOT NULL AND country <> ''
          GROUP BY 1, 2, 3
        ) q
        GROUP BY link_id, day
      ) jsonb_agg_strip
    ) x ON x.link_id = s.link_id AND x.day = s.day
  ),
  ups AS (
    INSERT INTO public.daily_stats (link_id, day, human_clicks, bot_clicks, country_breakdown, device_breakdown)
    SELECT link_id, day, humans, bots, breakdown, '{}'::jsonb
    FROM merged
    ON CONFLICT (link_id, day) DO UPDATE SET
      human_clicks = EXCLUDED.human_clicks,
      bot_clicks = EXCLUDED.bot_clicks,
      country_breakdown = EXCLUDED.country_breakdown
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_rows FROM ups;

  PERFORM pg_advisory_unlock(hashtext('aggregate_daily_stats'));

  RETURN jsonb_build_object('ok', true, 'rows', v_rows, 'from', v_from, 'at', now());
EXCEPTION WHEN OTHERS THEN
  IF v_locked THEN
    PERFORM pg_advisory_unlock(hashtext('aggregate_daily_stats'));
  END IF;
  RAISE;
END
$function$;

GRANT EXECUTE ON FUNCTION public.aggregate_daily_stats(integer) TO service_role;

SELECT cron.unschedule('daily-click-aggregate')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-click-aggregate');

SELECT cron.schedule(
  'daily-click-aggregate',
  '7 * * * *',
  $$SELECT public.aggregate_daily_stats(3);$$
);

SELECT public.aggregate_daily_stats(7);