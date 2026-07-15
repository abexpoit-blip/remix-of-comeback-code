ALTER TABLE public.bot_fingerprints
  ADD COLUMN IF NOT EXISTS is_bot_count BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_human_count BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS auto_blocked BOOLEAN NOT NULL DEFAULT false;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bot_fingerprints TO authenticated;
GRANT ALL ON public.bot_fingerprints TO service_role;