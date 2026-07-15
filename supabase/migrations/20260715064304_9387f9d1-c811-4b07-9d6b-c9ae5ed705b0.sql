-- Restore missing columns on bot_fingerprints (production drift)
ALTER TABLE public.bot_fingerprints
  ADD COLUMN IF NOT EXISTS is_bot_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.bot_fingerprints
  ADD COLUMN IF NOT EXISTS is_human_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.bot_fingerprints
  ADD COLUMN IF NOT EXISTS auto_blocked boolean NOT NULL DEFAULT false;

ALTER TABLE public.bot_fingerprints
  ADD COLUMN IF NOT EXISTS last_ip text;

ALTER TABLE public.bot_fingerprints
  ADD COLUMN IF NOT EXISTS last_ua text;

ALTER TABLE public.bot_fingerprints
  ADD COLUMN IF NOT EXISTS last_country text;

ALTER TABLE public.bot_fingerprints
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Speed up auto-block lookups
CREATE INDEX IF NOT EXISTS idx_bot_fingerprints_auto_blocked
  ON public.bot_fingerprints (auto_blocked)
  WHERE auto_blocked = true;

CREATE INDEX IF NOT EXISTS idx_bot_fingerprints_updated_at
  ON public.bot_fingerprints (updated_at DESC);

-- Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';