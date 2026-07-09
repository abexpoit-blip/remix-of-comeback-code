-- Production fix: redirect click batch RPC was timing out under high traffic.
-- This replaces per-row processing with set-based INSERT/UPDATE statements.

CREATE OR REPLACE FUNCTION public.record_redirect_clicks_batch(_events jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF _events IS NULL OR jsonb_typeof(_events) <> 'array' OR jsonb_array_length(_events) = 0 THEN
    RETURN;
  END IF;

  CREATE TEMP TABLE IF NOT EXISTS pg_temp.redirect_click_batch_events (
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
    link_id, user_id, ip, country, ua, is_bot, bot_reason, routed_to,
    utm_source, utm_medium, utm_campaign, utm_term, utm_content,
    referer_host, bot_score, signals, challenge_passed
  )
  SELECT
    e.link_id,
    e.user_id,
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
  )
  WHERE e.link_id IS NOT NULL;

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

NOTIFY pgrst, 'reload schema';

SELECT 'record_redirect_clicks_batch fast RPC ready' AS status;