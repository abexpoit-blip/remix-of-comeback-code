ALTER TABLE public.links ADD COLUMN IF NOT EXISTS short_domain text;
CREATE INDEX IF NOT EXISTS idx_links_short_domain ON public.links (short_domain);