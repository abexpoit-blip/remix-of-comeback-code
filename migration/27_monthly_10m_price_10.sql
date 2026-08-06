-- 27_monthly_10m_price_10.sql
-- Monthly package: click_quota 1,000,000 -> 10,000,000 and price $5 -> $10.
-- IMPORTANT: existing monthly users keep their current quota/price.
-- Only NEW monthly upgrades (from now on) get 10M, via the plan-quota sync trigger.
-- Safe to re-run (idempotent).

BEGIN;

UPDATE public.packages
SET click_quota  = 10000000,
    price_usd    = 10,
    price_monthly = 10
WHERE slug = 'monthly';

-- Free package stays at 1,000,000 (set in migration 26).

COMMIT;

-- verify
SELECT slug, price_usd, price_monthly, click_quota, link_limit
FROM public.packages ORDER BY sort_order;

-- existing monthly users must be UNCHANGED (expect 1000000)
SELECT plan_slug, count(*), min(click_quota), max(click_quota)
FROM public.profiles GROUP BY 1;
