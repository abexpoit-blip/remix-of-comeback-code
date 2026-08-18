-- 36) Per-link sticky short domain + one-off purge of links older than 1 week.
-- Safe to re-run.

BEGIN;

-- 1) Sticky domain per link. NULL = created before this feature (dashboard
--    then shows the account's currently selected domain). Changing the domain
--    picker NEVER rewrites this value, so existing links keep their URL.
ALTER TABLE public.links ADD COLUMN IF NOT EXISTS short_domain text;
CREATE INDEX IF NOT EXISTS idx_links_short_domain ON public.links (short_domain);

-- 2) One-off cleanup: delete every link created more than 7 days ago.
DELETE FROM public.clicks
WHERE link_id IN (SELECT id FROM public.links WHERE created_at < now() - interval '7 days');

DELETE FROM public.daily_stats
WHERE link_id IN (SELECT id FROM public.links WHERE created_at < now() - interval '7 days');

DELETE FROM public.geo_offers
WHERE link_id IN (SELECT id FROM public.links WHERE created_at < now() - interval '7 days');

DELETE FROM public.ab_variants
WHERE link_id IN (SELECT id FROM public.links WHERE created_at < now() - interval '7 days');

DELETE FROM public.error_logs
WHERE link_id IN (SELECT id FROM public.links WHERE created_at < now() - interval '7 days');

DELETE FROM public.links WHERE created_at < now() - interval '7 days';

-- 3) Keep per-user link counters honest after the purge.
UPDATE public.profiles p
SET links_used = COALESCE(c.n, 0)
FROM (
  SELECT u.id, (SELECT count(*) FROM public.links l WHERE l.user_id = u.id) AS n
  FROM public.profiles u
) c
WHERE p.id = c.id;

COMMIT;
