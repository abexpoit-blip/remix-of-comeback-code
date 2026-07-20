
CREATE TABLE IF NOT EXISTS public.dashboard_cache (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.dashboard_cache TO authenticated;
GRANT ALL ON public.dashboard_cache TO service_role;

ALTER TABLE public.dashboard_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own dashboard cache"
  ON public.dashboard_cache FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_dashboard_cache_updated_at
  ON public.dashboard_cache(updated_at);
