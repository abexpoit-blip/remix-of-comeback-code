CREATE OR REPLACE FUNCTION public.record_redirect_clicks_batch(_events jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '20s'
AS $function$
DECLARE
  v_inserted_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  IF _events IS NULL OR jsonb_typeof(_events) <> 'array' THEN
    RETURN;
  END IF;

  WITH parsed AS (
    SELECT
      CASE
        WHEN COALESCE(e->>'id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          THEN (e->>'id')::uuid
        ELSE gen_random_uuid()
      END AS event_id,
      (e->>'link_id')::uuid AS link_id,
      NULLIF(e->>'ip', '') AS ip,
      NULLIF(e->>'country', '') AS country,
      NULLIF(e->>'ua', '') AS ua,
      COALESCE((e->>'is_bot')::boolean, false) AS is_bot,
      NULLIF(e->>'bot_reason', '') AS bot_reason,
      COALESCE(NULLIF(e->>'routed_to', ''), 'offer') AS routed_to,
      NULLIF(e->>'utm_source', '') AS utm_source,
      NULLIF(e->>'utm_medium', '') AS utm_medium,
      NULLIF(e->>'utm_campaign', '') AS utm_campaign,
      NULLIF(e->>'utm_term', '') AS utm_term,
      NULLIF(e->>'utm_content', '') AS utm_content,
      NULLIF(e->>'referer_host', '') AS referer_host,
      CASE WHEN COALESCE(e->>'bot_score', '') ~ '^-?\d+$' THEN (e->>'bot_score')::integer ELSE 0 END AS bot_score,
      COALESCE(e->'signals', '{}'::jsonb) AS signals,
      COALESCE((e->>'challenge_passed')::boolean, false) AS challenge_passed
    FROM jsonb_array_elements(_events) AS e
    WHERE COALESCE(e->>'link_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    LIMIT 250
  ), valid AS (
    SELECT p.*
    FROM parsed p
    JOIN public.links l ON l.id = p.link_id
  ), inserted AS (
    INSERT INTO public.clicks (
      id, link_id, ip, country, ua, is_bot, bot_reason, routed_to,
      utm_source, utm_medium, utm_campaign, utm_term, utm_content,
      referer_host, bot_score, signals, challenge_passed
    )
    SELECT
      event_id, link_id, ip, country, ua, is_bot, bot_reason, routed_to,
      utm_source, utm_medium, utm_campaign, utm_term, utm_content,
      referer_host, bot_score, signals, challenge_passed
    FROM valid
    ON CONFLICT (id) DO NOTHING
    RETURNING id
  )
  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[])
  INTO v_inserted_ids
  FROM inserted;

  IF COALESCE(cardinality(v_inserted_ids), 0) = 0 THEN
    RETURN;
  END IF;

  UPDATE public.links l
  SET bot_clicks_count = COALESCE(l.bot_clicks_count, 0) + s.n
  FROM (
    SELECT link_id, COUNT(*)::integer AS n
    FROM public.clicks
    WHERE id = ANY(v_inserted_ids) AND is_bot = true
    GROUP BY link_id
  ) AS s
  WHERE l.id = s.link_id;

  UPDATE public.links l
  SET clicks_count = COALESCE(l.clicks_count, 0) + s.n,
      ours_clicks_count = COALESCE(l.ours_clicks_count, 0) + s.ours_n,
      offer_clicks_count = COALESCE(l.offer_clicks_count, 0) + s.offer_n,
      last_clicked_at = now()
  FROM (
    SELECT
      link_id,
      COUNT(*)::integer AS n,
      COUNT(*) FILTER (WHERE routed_to = 'ours')::integer AS ours_n,
      COUNT(*) FILTER (WHERE routed_to = 'offer')::integer AS offer_n
    FROM public.clicks
    WHERE id = ANY(v_inserted_ids) AND is_bot = false
    GROUP BY link_id
  ) AS s
  WHERE l.id = s.link_id;

  UPDATE public.profiles p
  SET clicks_used = COALESCE(p.clicks_used, 0) + s.n,
      ours_clicks = COALESCE(p.ours_clicks, 0) + s.ours_n
  FROM (
    SELECT
      l.user_id,
      COUNT(*)::integer AS n,
      COUNT(*) FILTER (WHERE c.routed_to = 'ours')::integer AS ours_n
    FROM public.clicks c
    JOIN public.links l ON l.id = c.link_id
    WHERE c.id = ANY(v_inserted_ids)
      AND c.is_bot = false
      AND l.user_id IS NOT NULL
    GROUP BY l.user_id
  ) AS s
  WHERE p.id = s.user_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.record_redirect_clicks_batch(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_redirect_clicks_batch(jsonb) TO service_role;