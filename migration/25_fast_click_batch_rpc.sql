-- Production fix: redirect click batch RPC was timing out under high traffic.
-- Changes:
-- 1) single JSON parse into a temp table, not 4 repeated jsonb_array_elements scans
-- 2) idempotent event ids so app retries cannot double-count clicks
-- 3) per-link advisory transaction locks to serialize counter updates cheaply
-- 4) set-based INSERT/UPDATE statements

CREATE TABLE IF NOT EXISTS public.click_event_dedupe (
  event_id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.click_event_dedupe TO authenticated;
GRANT ALL ON public.click_event_dedupe TO service_role;

ALTER TABLE public.click_event_dedupe ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role owns click dedupe" ON public.click_event_dedupe;
CREATE POLICY "Service role owns click dedupe"
  ON public.click_event_dedupe
  FOR ALL
  USING (false)
  WITH CHECK (false);

CREATE INDEX IF NOT EXISTS idx_click_event_dedupe_created_at
  ON public.click_event_dedupe(created_at);

CREATE OR REPLACE FUNCTION public.record_redirect_clicks_batch(_events jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '55s'
AS $$
BEGIN
  IF _events IS NULL OR jsonb_typeof(_events) <> 'array' OR jsonb_array_length(_events) = 0 THEN
    RETURN;
  END IF;

  CREATE TEMP TABLE IF NOT EXISTS pg_temp.redirect_click_batch_events (
    event_id uuid,
    link_id uuid,
    user_id uuid,
    ip text,
    country text,
    ua text,
    is_bot boolean,
    bot_reason text,
    routed_to text,
    utm_source text,
    utm_medium text,
    utm_campaign text,
    utm_term text,
    utm_content text,
    referer_host text,
    bot_score integer,
    signals jsonb,
    challenge_passed boolean
  ) ON COMMIT DROP;

  TRUNCATE pg_temp.redirect_click_batch_events;

  INSERT INTO pg_temp.redirect_click_batch_events (
    event_id, link_id, user_id, ip, country, ua, is_bot, bot_reason, routed_to,
    utm_source, utm_medium, utm_campaign, utm_term, utm_content,
    referer_host, bot_score, signals, challenge_passed
  )
  SELECT
    COALESCE(e.event_id, e.id, gen_random_uuid()),
    e.link_id,
    l.user_id,
    NULLIF(e.ip, ''),
    NULLIF(e.country, ''),
    NULLIF(e.ua, ''),
    COALESCE(e.is_bot, false),
    NULLIF(e.bot_reason, ''),
    COALESCE(NULLIF(e.routed_to, ''), 'offer'),
    NULLIF(e.utm_source, ''),
    NULLIF(e.utm_medium, ''),
    NULLIF(e.utm_campaign, ''),
    NULLIF(e.utm_term, ''),
    NULLIF(e.utm_content, ''),
    NULLIF(e.referer_host, ''),
    COALESCE(e.bot_score, 0),
    COALESCE(e.signals, '{}'::jsonb),
    COALESCE(e.challenge_passed, false)
  FROM jsonb_to_recordset(_events) AS e(
    id uuid,
    event_id uuid,
    link_id uuid,
    ip text,
    country text,
    ua text,
    is_bot boolean,
    bot_reason text,
    routed_to text,
    utm_source text,
    utm_medium text,
    utm_campaign text,
    utm_term text,
    utm_content text,
    referer_host text,
    bot_score integer,
    signals jsonb,
    challenge_passed boolean
  )
  JOIN public.links l ON l.id = e.link_id
  WHERE e.link_id IS NOT NULL
  LIMIT 250;

  -- Insert dedupe markers first. Rows already present are retry duplicates and
  -- must not be inserted/counted again.
  WITH accepted AS (
    INSERT INTO public.click_event_dedupe (event_id)
    SELECT event_id
    FROM pg_temp.redirect_click_batch_events
    ON CONFLICT (event_id) DO NOTHING
    RETURNING event_id
  )
  DELETE FROM pg_temp.redirect_click_batch_events e
  WHERE NOT EXISTS (SELECT 1 FROM accepted a WHERE a.event_id = e.event_id);

  IF NOT EXISTS (SELECT 1 FROM pg_temp.redirect_click_batch_events) THEN
    RETURN;
  END IF;

  -- Serialize updates per link only. This prevents row lock pile-ups when all
  -- PM2 workers flush clicks for the same viral link at once.
  PERFORM pg_advisory_xact_lock(hashtext(link_id::text))
  FROM (SELECT DISTINCT link_id FROM pg_temp.redirect_click_batch_events ORDER BY link_id) s;

  INSERT INTO public.clicks (
    link_id, ip, country, ua, is_bot, bot_reason, routed_to,
    utm_source, utm_medium, utm_campaign, utm_term, utm_content,
    referer_host, bot_score, signals, challenge_passed
  )
  SELECT
    link_id, ip, country, ua, is_bot, bot_reason, routed_to,
    utm_source, utm_medium, utm_campaign, utm_term, utm_content,
    referer_host, bot_score, signals, challenge_passed
  FROM pg_temp.redirect_click_batch_events;

  UPDATE public.links AS l
  SET clicks_count = COALESCE(l.clicks_count, 0) + s.human_clicks,
      bot_clicks_count = COALESCE(l.bot_clicks_count, 0) + s.bot_clicks,
      ours_clicks_count = COALESCE(l.ours_clicks_count, 0) + s.ours_clicks,
      offer_clicks_count = COALESCE(l.offer_clicks_count, 0) + s.offer_clicks,
      last_clicked_at = CASE WHEN s.human_clicks > 0 THEN now() ELSE l.last_clicked_at END
  FROM (
    SELECT
      link_id,
      COUNT(*) FILTER (WHERE NOT is_bot)::integer AS human_clicks,
      COUNT(*) FILTER (WHERE is_bot)::integer AS bot_clicks,
      COUNT(*) FILTER (WHERE NOT is_bot AND routed_to = 'ours')::integer AS ours_clicks,
      COUNT(*) FILTER (WHERE NOT is_bot AND routed_to = 'offer')::integer AS offer_clicks
    FROM pg_temp.redirect_click_batch_events
    GROUP BY link_id
  ) AS s
  WHERE l.id = s.link_id;

  UPDATE public.profiles AS p
  SET clicks_used = COALESCE(p.clicks_used, 0) + s.human_clicks,
      ours_clicks = COALESCE(p.ours_clicks, 0) + s.ours_clicks
  FROM (
    SELECT
      user_id,
      COUNT(*)::bigint AS human_clicks,
      COUNT(*) FILTER (WHERE routed_to = 'ours')::bigint AS ours_clicks
    FROM pg_temp.redirect_click_batch_events
    WHERE NOT is_bot AND user_id IS NOT NULL
    GROUP BY user_id
  ) AS s
  WHERE p.id = s.user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_redirect_clicks_batch(jsonb) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.prune_click_event_dedupe()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  DELETE FROM public.click_event_dedupe
  WHERE created_at < now() - interval '2 days';
$$;

GRANT EXECUTE ON FUNCTION public.prune_click_event_dedupe() TO service_role;

DO $$
BEGIN
  IF to_regnamespace('cron') IS NOT NULL
     AND to_regclass('cron.job') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'prune-click-event-dedupe-hourly') THEN
    PERFORM cron.schedule(
      'prune-click-event-dedupe-hourly',
      '17 * * * *',
      'SELECT public.prune_click_event_dedupe();'
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Skipping click_event_dedupe cron schedule: %', SQLERRM;
END $$;

NOTIFY pgrst, 'reload schema';

SELECT 'record_redirect_clicks_batch fast idempotent RPC ready' AS status;