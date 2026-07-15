ALTER TABLE public.bot_fingerprints
  ADD COLUMN IF NOT EXISTS is_bot_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_human_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS auto_blocked BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_bot_fingerprints_auto_blocked
  ON public.bot_fingerprints (auto_blocked)
  WHERE auto_blocked = true;

CREATE INDEX IF NOT EXISTS idx_bot_fingerprints_bot_human_counts
  ON public.bot_fingerprints (is_bot_count DESC, is_human_count DESC);

NOTIFY pgrst, 'reload schema';