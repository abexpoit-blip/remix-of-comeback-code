-- 27_monthly_10m_price_10.sql
-- Monthly package: click_quota 1,000,000 -> 10,000,000 and price $5 -> $10.
-- IMPORTANT: existing monthly users keep their current quota/price.
-- Only NEW monthly upgrades (from now on) get 10M, via the plan-quota sync trigger.
-- Handles both possible slugs ('monthly' / 'pro_monthly'). Safe to re-run.

BEGIN;

UPDATE public.packages
SET click_quota = 10000000,
    price_usd   = 10
WHERE slug IN ('monthly', 'pro_monthly');

-- legacy columns on the self-hosted schema (ignore if they don't exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='packages' AND column_name='price_monthly') THEN
    EXECUTE $q$UPDATE public.packages SET price_monthly = 10 WHERE slug IN ('monthly','pro_monthly')$q$;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='packages' AND column_name='click_limit') THEN
    EXECUTE $q$UPDATE public.packages SET click_limit = 10000000 WHERE slug IN ('monthly','pro_monthly')$q$;
  END IF;
END $$;

-- keep the marketing feature bullets in sync
UPDATE public.packages
SET features = REPLACE(features::text, '1,000,000 clicks / month', '10,000,000 clicks / month')::jsonb
WHERE slug IN ('monthly', 'pro_monthly')
  AND features::text LIKE '%1,000,000 clicks / month%';

UPDATE public.packages
SET features = REPLACE(features::text, '10,000 clicks / month', '1,000,000 clicks / month')::jsonb
WHERE slug = 'free'
  AND features::text LIKE '%"10,000 clicks / month"%';

COMMIT;

-- verify
SELECT slug, price_usd, click_quota, link_limit FROM public.packages ORDER BY sort_order;

-- existing monthly users must be UNCHANGED (expect their old quota, e.g. 1000000)
SELECT plan_slug, count(*), min(click_quota), max(click_quota)
FROM public.profiles GROUP BY 1;
