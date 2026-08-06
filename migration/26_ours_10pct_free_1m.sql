-- 26_ours_10pct_free_1m.sql
-- 1) Ours injection 5% -> 10%   (100 / (900 + 100) = 10%)
-- 2) Free plan click quota 10,000 -> 1,000,000
-- Safe to re-run (idempotent).

BEGIN;

-- ---------- 1. injection rate ----------
ALTER TABLE public.app_settings
  ALTER COLUMN injection_threshold SET DEFAULT 900,
  ALTER COLUMN injection_count     SET DEFAULT 100;

UPDATE public.app_settings
SET injection_threshold = 900,
    injection_count     = 100,
    updated_at          = now()
WHERE id = true;

-- ---------- 2. free plan quota ----------
UPDATE public.packages
SET click_quota = 1000000
WHERE slug = 'free';

-- push new quota to existing free users (keep unlimited/lifetime untouched)
UPDATE public.profiles
SET click_quota = 1000000,
    updated_at  = now()
WHERE plan_slug = 'free'
  AND click_quota IS NOT NULL
  AND click_quota < 1000000;

COMMIT;

-- verify
SELECT injection_threshold,
       injection_count,
       ROUND(100.0 * injection_count / NULLIF(injection_threshold + injection_count, 0), 2) AS ours_pct
FROM public.app_settings;

SELECT slug, click_quota, link_limit FROM public.packages ORDER BY sort_order;

SELECT plan_slug, count(*), min(click_quota), max(click_quota)
FROM public.profiles GROUP BY 1;
