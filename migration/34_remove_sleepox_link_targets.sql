-- Sleepox is the SaaS/control host and must never be stored as either an offer
-- target or a reviewer-safe destination. Pause affected links until their
-- owners provide a real external offer URL.
UPDATE public.links
SET
  adsterra_url = NULL,
  adsterra_direct_link = NULL,
  destination_url = '',
  safe_url = '',
  is_active = false,
  status = 'paused',
  updated_at = now()
WHERE
  COALESCE(adsterra_url, '') ~* '^https?://(www\.)?sleepox\.com([/:?#]|$)'
  OR COALESCE(adsterra_direct_link, '') ~* '^https?://(www\.)?sleepox\.com([/:?#]|$)'
  OR COALESCE(destination_url, '') ~* '^https?://(www\.)?sleepox\.com([/:?#]|$)'
  OR COALESCE(safe_url, '') ~* '^https?://(www\.)?sleepox\.com([/:?#]|$)';