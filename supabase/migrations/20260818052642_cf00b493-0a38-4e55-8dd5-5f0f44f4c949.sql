-- Every active short link must route only to its own saved offer URL.
-- Keep the legacy offer column synchronized and pause invalid historical rows.

UPDATE public.links
SET
  adsterra_url = CASE
    WHEN COALESCE(adsterra_url, '') ~* '^https?://'
      AND COALESCE(adsterra_url, '') !~* '^https?://(www\.)?sleepox\.com([/:?#]|$)'
      THEN adsterra_url
    WHEN COALESCE(adsterra_direct_link, '') ~* '^https?://'
      AND COALESCE(adsterra_direct_link, '') !~* '^https?://(www\.)?sleepox\.com([/:?#]|$)'
      THEN adsterra_direct_link
    ELSE ''
  END,
  adsterra_direct_link = CASE
    WHEN COALESCE(adsterra_url, '') ~* '^https?://'
      AND COALESCE(adsterra_url, '') !~* '^https?://(www\.)?sleepox\.com([/:?#]|$)'
      THEN adsterra_url
    WHEN COALESCE(adsterra_direct_link, '') ~* '^https?://'
      AND COALESCE(adsterra_direct_link, '') !~* '^https?://(www\.)?sleepox\.com([/:?#]|$)'
      THEN adsterra_direct_link
    ELSE NULL
  END,
  is_active = CASE
    WHEN (
      COALESCE(adsterra_url, '') ~* '^https?://'
      AND COALESCE(adsterra_url, '') !~* '^https?://(www\.)?sleepox\.com([/:?#]|$)'
    ) OR (
      COALESCE(adsterra_direct_link, '') ~* '^https?://'
      AND COALESCE(adsterra_direct_link, '') !~* '^https?://(www\.)?sleepox\.com([/:?#]|$)'
    ) THEN is_active
    ELSE false
  END,
  status = CASE
    WHEN (
      COALESCE(adsterra_url, '') ~* '^https?://'
      AND COALESCE(adsterra_url, '') !~* '^https?://(www\.)?sleepox\.com([/:?#]|$)'
    ) OR (
      COALESCE(adsterra_direct_link, '') ~* '^https?://'
      AND COALESCE(adsterra_direct_link, '') !~* '^https?://(www\.)?sleepox\.com([/:?#]|$)'
    ) THEN status
    ELSE 'paused'::public.link_status
  END,
  updated_at = now();

CREATE OR REPLACE FUNCTION public.enforce_per_link_offer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.adsterra_url := btrim(COALESCE(NEW.adsterra_url, ''));

  IF NEW.adsterra_url !~* '^https?://' THEN
    RAISE EXCEPTION 'A valid offer URL is required for every short link';
  END IF;

  IF NEW.adsterra_url ~* '^https?://(www\.)?sleepox\.com([/:?#]|$)' THEN
    RAISE EXCEPTION 'Sleepox cannot be used as a link offer URL';
  END IF;

  -- One canonical offer per row. Old redirect workers read this legacy column.
  NEW.adsterra_direct_link := NEW.adsterra_url;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_per_link_offer ON public.links;
CREATE TRIGGER trg_enforce_per_link_offer
BEFORE INSERT OR UPDATE OF adsterra_url, adsterra_direct_link ON public.links
FOR EACH ROW EXECUTE FUNCTION public.enforce_per_link_offer();