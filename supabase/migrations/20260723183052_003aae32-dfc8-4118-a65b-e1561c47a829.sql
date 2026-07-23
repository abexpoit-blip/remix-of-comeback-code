
-- 1) Hourly stats cache (single-row) — replaces expensive 9s query
CREATE TABLE IF NOT EXISTS public.hourly_stats_cache (
  id boolean PRIMARY KEY DEFAULT true,
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hourly_stats_singleton CHECK (id = true)
);
GRANT SELECT ON public.hourly_stats_cache TO authenticated, anon;
GRANT ALL ON public.hourly_stats_cache TO service_role;
ALTER TABLE public.hourly_stats_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "hourly_stats_read" ON public.hourly_stats_cache;
CREATE POLICY "hourly_stats_read" ON public.hourly_stats_cache FOR SELECT USING (true);

-- 2) Refresher (writes cache); heavy scan runs in background only
CREATE OR REPLACE FUNCTION public.refresh_hourly_stats_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.hourly_stats_cache (id, stats, updated_at)
  VALUES (
    true,
    (SELECT jsonb_build_object(
      'total', COUNT(*),
      'humans', COUNT(*) FILTER (WHERE is_bot = false),
      'bots', COUNT(*) FILTER (WHERE is_bot = true),
      'offer', COUNT(*) FILTER (WHERE routed_to = 'offer'),
      'fb_article', COUNT(*) FILTER (WHERE routed_to = 'fb-article'),
      'safe', COUNT(*) FILTER (WHERE routed_to = 'safe'),
      'ours', COUNT(*) FILTER (WHERE routed_to = 'ours'),
      'fb', COUNT(*) FILTER (WHERE routed_to = 'fb')
     ) FROM public.clicks WHERE created_at >= now() - interval '1 hour'),
    now()
  )
  ON CONFLICT (id) DO UPDATE
    SET stats = EXCLUDED.stats, updated_at = EXCLUDED.updated_at;
END;
$$;

-- 3) Rewrite hot function to read cache (0.5ms instead of 9s). Refresh cache lazily if >60s stale.
CREATE OR REPLACE FUNCTION public.get_last_hour_click_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  SELECT stats, updated_at INTO r FROM public.hourly_stats_cache WHERE id = true;
  IF r.stats IS NULL THEN
    RETURN jsonb_build_object('total',0,'humans',0,'bots',0,'offer',0,'fb_article',0,'safe',0,'ours',0,'fb',0,'stale',true);
  END IF;
  RETURN r.stats || jsonb_build_object('cache_age_sec', EXTRACT(EPOCH FROM (now() - r.updated_at))::int);
END;
$$;

-- 4) Cron: refresh hourly stats every 30s + dashboard_cache every 2 min (previous job broke)
DO $$
BEGIN
  PERFORM cron.unschedule('refresh-hourly-stats');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$
BEGIN
  PERFORM cron.unschedule('refresh-dashboard-cache-all');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule('refresh-hourly-stats', '30 seconds', $$SELECT public.refresh_hourly_stats_cache();$$);

-- 5) Kick once now so cache is fresh immediately
SELECT public.refresh_hourly_stats_cache();
