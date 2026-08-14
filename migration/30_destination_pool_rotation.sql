-- 30_destination_pool_rotation.sql
-- Per-link destination rotation.
--
-- Until now every link on the platform resolved to ONE monetisation URL
-- (app_settings.our_adsterra_url). Two different short codes landed on the
-- identical destination, so a single flagged URL took down every link we own.
--
-- destination_pool holds N destinations. The app hashes the short code onto the
-- pool, so each link owns its own destination permanently (stable per code =
-- consistent for reviewers, varied across codes = no single point of failure).
--
-- Format (jsonb array), either form is accepted by the app:
--   ["https://a.example/x", "https://b.example/y"]
--   [{"url":"https://a.example/x","weight":3},{"url":"https://b.example/y","weight":1}]
--
-- Empty array [] → previous single-URL behaviour (our_adsterra_url).

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS destination_pool jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.app_settings.destination_pool IS
  'Weighted pool of monetisation destinations. Hashed per short_code so each link gets its own stable destination. Empty = fall back to our_adsterra_url.';

-- Seed the pool with the current single destination so behaviour is unchanged
-- until more URLs are added from the control panel.
UPDATE public.app_settings
SET destination_pool = jsonb_build_array(our_adsterra_url)
WHERE id = true
  AND destination_pool = '[]'::jsonb
  AND our_adsterra_url IS NOT NULL
  AND our_adsterra_url <> '';
