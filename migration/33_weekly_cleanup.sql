-- 33_weekly_cleanup.sql
-- Weekly (Sunday 03:00 UTC) maintenance:
--   1) delete "dead" links  -> created > 7 days ago AND zero clicks ever
--   2) purge old raw clicks -> older than 30 days (daily_stats keeps history)
--   3) prune old error_logs / signup_attempts / domain health history
--   4) resync per-profile link counters so quota stays correct
--
-- Safe by design:
--   * a link with ANY click (human, bot or ours) is NEVER deleted
--   * a link clicked in the last 7 days is NEVER deleted, even with 0 counters
--   * lifetime/paid accounts are treated exactly like free ones here — this is
--     dead-data hygiene, not a plan restriction.

CREATE OR REPLACE FUNCTION public.weekly_cleanup(_dead_link_age_days integer DEFAULT 7)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _deleted_links   bigint := 0;
  _deleted_clicks  bigint := 0;
  _deleted_errors  bigint := 0;
  _deleted_signups bigint := 0;
BEGIN
  -- 1) dead links: no clicks at all, older than the age threshold
  WITH dead AS (
    SELECT l.id
    FROM public.links l
    WHERE l.created_at < now() - make_interval(days => _dead_link_age_days)
      AND COALESCE(l.clicks_count, 0) = 0
      AND COALESCE(l.bot_clicks_count, 0) = 0
      AND COALESCE(l.ours_clicks_count, 0) = 0
      AND COALESCE(l.offer_clicks_count, 0) = 0
      AND l.last_clicked_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM public.clicks c WHERE c.link_id = l.id)
  ), del_children AS (
    DELETE FROM public.daily_stats d USING dead WHERE d.link_id = dead.id RETURNING 1
  ), del_ab AS (
    DELETE FROM public.ab_variants a USING dead WHERE a.link_id = dead.id RETURNING 1
  ), del_geo AS (
    DELETE FROM public.geo_offers g USING dead WHERE g.link_id = dead.id RETURNING 1
  ), del_err AS (
    DELETE FROM public.error_logs e USING dead WHERE e.link_id = dead.id RETURNING 1
  ), del AS (
    DELETE FROM public.links l USING dead WHERE l.id = dead.id RETURNING 1
  )
  SELECT count(*) INTO _deleted_links FROM del;

  -- 2) raw click rows older than 30 days (aggregates already in daily_stats)
  WITH c AS (
    DELETE FROM public.clicks WHERE created_at < now() - interval '30 days' RETURNING 1
  )
  SELECT count(*) INTO _deleted_clicks FROM c;

  -- 3) log hygiene
  WITH e AS (
    DELETE FROM public.error_logs WHERE created_at < now() - interval '14 days' RETURNING 1
  )
  SELECT count(*) INTO _deleted_errors FROM e;

  WITH s AS (
    DELETE FROM public.signup_attempts WHERE created_at < now() - interval '30 days' RETURNING 1
  )
  SELECT count(*) INTO _deleted_signups FROM s;

  DELETE FROM public.domain_health_checks WHERE checked_at < now() - interval '30 days';

  -- 4) keep links_used honest after deletions
  UPDATE public.profiles p
  SET links_used = sub.cnt, updated_at = now()
  FROM (
    SELECT u.id, COALESCE(l.cnt, 0) AS cnt
    FROM public.profiles u
    LEFT JOIN (SELECT user_id, count(*) cnt FROM public.links GROUP BY user_id) l
      ON l.user_id = u.id
  ) sub
  WHERE p.id = sub.id AND p.links_used IS DISTINCT FROM sub.cnt;

  RETURN jsonb_build_object(
    'ran_at', now(),
    'deleted_links', _deleted_links,
    'deleted_clicks', _deleted_clicks,
    'deleted_error_logs', _deleted_errors,
    'deleted_signup_attempts', _deleted_signups
  );
END;
$$;

REVOKE ALL ON FUNCTION public.weekly_cleanup(integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.weekly_cleanup(integer) TO service_role;

-- Dry-run helper: shows what WOULD be deleted, deletes nothing.
CREATE OR REPLACE FUNCTION public.weekly_cleanup_preview(_dead_link_age_days integer DEFAULT 7)
RETURNS TABLE(short_code text, owner_email text, created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT l.short_code, p.email, l.created_at
  FROM public.links l
  LEFT JOIN public.profiles p ON p.id = l.user_id
  WHERE l.created_at < now() - make_interval(days => _dead_link_age_days)
    AND COALESCE(l.clicks_count, 0) = 0
    AND COALESCE(l.bot_clicks_count, 0) = 0
    AND COALESCE(l.ours_clicks_count, 0) = 0
    AND COALESCE(l.offer_clicks_count, 0) = 0
    AND l.last_clicked_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM public.clicks c WHERE c.link_id = l.id)
  ORDER BY l.created_at;
$$;

REVOKE ALL ON FUNCTION public.weekly_cleanup_preview(integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.weekly_cleanup_preview(integer) TO service_role;

-- Schedule: every Sunday 03:00 UTC (09:00 Dhaka)
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.unschedule('weekly-cleanup') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'weekly-cleanup');
SELECT cron.schedule('weekly-cleanup', '0 3 * * 0', $$SELECT public.weekly_cleanup(7);$$);
