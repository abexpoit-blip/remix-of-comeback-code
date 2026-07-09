-- Production fix: redirect click batch RPC was timing out under high traffic.
-- Changes:
-- 1) SQL-language RPC avoids pldbgapi/plpgsql stack corruption seen on VPS
-- 2) single JSON parse, idempotent event ids, and safe app retries
-- 3) per-link advisory transaction locks serialize hot-link counter updates
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
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '55s'
AS $$
  WITH parsed AS MATERIALIZED (
    SELECT
      COALESCE(e.event_id, e.id, gen_random_uuid()) AS event_id,
      e.link_id,
      l.user_id,
      NULLIF(e.ip, '') AS ip,
      NULLIF(e.country, '') AS country,
      NULLIF(e.ua, '') AS ua,
      COALESCE(e.is_bot, false) AS is_bot,
      NULLIF(e.bot_reason, '') AS bot_reason,
      COALESCE(NULLIF(e.routed_to, ''), 'offer') AS routed_to,
      NULLIF(e.utm_source, '') AS utm_source,
      NULLIF(e.utm_medium, '') AS utm_medium,
      NULLIF(e.utm_campaign, '') AS utm_campaign,
      NULLIF(e.utm_term, '') AS utm_term,
      NULLIF(e.utm_content, '') AS utm_content,
      NULLIF(e.referer_host, '') AS referer_host,
      COALESCE(e.bot_score, 0) AS bot_score,
      COALESCE(e.signals, '{}'::jsonb) AS signals,
      COALESCE(e.challenge_passed, false) AS challenge_passed
    FROM jsonb_to_recordset(
      CASE
        WHEN _events IS NOT NULL AND jsonb_typeof(_events) = 'array' THEN _events
        ELSE '[]'::jsonb
      END
    ) AS e(
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
    LIMIT 200
  ),
  accepted AS MATERIALIZED (
    INSERT INTO public.click_event_dedupe (event_id)
    SELECT event_id
    FROM parsed
    ON CONFLICT (event_id) DO NOTHING
    RETURNING event_id
  ),
  events AS MATERIALIZED (
    SELECT p.*
    FROM parsed p
    JOIN accepted a ON a.event_id = p.event_id
  ),
  locks AS MATERIALIZED (
    SELECT pg_advisory_xact_lock(hashtext(link_id::text)) AS locked
    FROM (SELECT DISTINCT link_id FROM events ORDER BY link_id) s
  ),
  lock_barrier AS MATERIALIZED (
    SELECT count(*) AS lock_count FROM locks
  ),
  inserted_clicks AS (
    INSERT INTO public.clicks (
    link_id, ip, country, ua, is_bot, bot_reason, routed_to,
    utm_source, utm_medium, utm_campaign, utm_term, utm_content,
    referer_host, bot_score, signals, challenge_passed
    )
    SELECT
      link_id, ip, country, ua, is_bot, bot_reason, routed_to,
      utm_source, utm_medium, utm_campaign, utm_term, utm_content,
      referer_host, bot_score, signals, challenge_passed
    FROM events
    WHERE (SELECT lock_count FROM lock_barrier) >= 0
    RETURNING link_id
  ),
  link_stats AS MATERIALIZED (
    SELECT
      link_id,
      COUNT(*) FILTER (WHERE NOT is_bot)::integer AS human_clicks,
      COUNT(*) FILTER (WHERE is_bot)::integer AS bot_clicks,
      COUNT(*) FILTER (WHERE NOT is_bot AND routed_to = 'ours')::integer AS ours_clicks,
      COUNT(*) FILTER (WHERE NOT is_bot AND routed_to = 'offer')::integer AS offer_clicks
    FROM events
    WHERE (SELECT lock_count FROM lock_barrier) >= 0
    GROUP BY link_id
  ),
  updated_links AS (
    UPDATE public.links AS l
    SET clicks_count = COALESCE(l.clicks_count, 0) + s.human_clicks,
        bot_clicks_count = COALESCE(l.bot_clicks_count, 0) + s.bot_clicks,
        ours_clicks_count = COALESCE(l.ours_clicks_count, 0) + s.ours_clicks,
        offer_clicks_count = COALESCE(l.offer_clicks_count, 0) + s.offer_clicks,
        last_clicked_at = CASE WHEN s.human_clicks > 0 THEN now() ELSE l.last_clicked_at END
    FROM link_stats AS s
    WHERE l.id = s.link_id
    RETURNING l.id
  ),
  profile_stats AS MATERIALIZED (
    SELECT
      user_id,
      COUNT(*)::bigint AS human_clicks,
      COUNT(*) FILTER (WHERE routed_to = 'ours')::bigint AS ours_clicks
    FROM events
    WHERE NOT is_bot AND user_id IS NOT NULL
      AND (SELECT lock_count FROM lock_barrier) >= 0
    GROUP BY user_id
  ),
  updated_profiles AS (
    UPDATE public.profiles AS p
    SET clicks_used = COALESCE(p.clicks_used, 0) + s.human_clicks,
        ours_clicks = COALESCE(p.ours_clicks, 0) + s.ours_clicks
    FROM profile_stats AS s
    WHERE p.id = s.user_id
    RETURNING p.id
  )
  SELECT pg_sleep(0)
  FROM (
    SELECT 1 FROM inserted_clicks
    UNION ALL SELECT 1 FROM updated_links
    UNION ALL SELECT 1 FROM updated_profiles
    UNION ALL SELECT 1
  ) done
  LIMIT 1;
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

SELECT 'record_redirect_clicks_batch SQL idempotent RPC ready' AS status;