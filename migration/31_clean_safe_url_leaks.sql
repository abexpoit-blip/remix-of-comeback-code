-- 2026-08-15 — remove safe_url values that expose the operation to reviewers.
-- 1351 links pointed their "safe page" at our own SaaS (sleepox.com) and 92 at
-- the offer / ad-network host itself. NULL means "use the rotating article
-- pool", which is always the safe behaviour.

UPDATE public.links
SET safe_url = NULL
WHERE safe_url IS NOT NULL
  AND (
    safe_url ILIKE '%sleepox.com%'
    OR safe_url ILIKE '%localhost%'
    OR safe_url = destination_url
    OR safe_url = adsterra_url
    OR split_part(split_part(safe_url, '//', 2), '/', 1)
       = split_part(split_part(coalesce(adsterra_url, ''), '//', 2), '/', 1)
    OR split_part(split_part(safe_url, '//', 2), '/', 1)
       = split_part(split_part(coalesce(destination_url, ''), '//', 2), '/', 1)
  );

-- Guard: block the same mistake at write time.
CREATE OR REPLACE FUNCTION public.sanitize_link_safe_url()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.safe_url IS NOT NULL AND (
       NEW.safe_url ILIKE '%sleepox.com%'
    OR NEW.safe_url = NEW.destination_url
    OR NEW.safe_url = NEW.adsterra_url
    OR split_part(split_part(NEW.safe_url, '//', 2), '/', 1)
       = split_part(split_part(coalesce(NEW.adsterra_url, ''), '//', 2), '/', 1)
    OR split_part(split_part(NEW.safe_url, '//', 2), '/', 1)
       = split_part(split_part(coalesce(NEW.destination_url, ''), '//', 2), '/', 1)
  ) THEN
    NEW.safe_url := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sanitize_link_safe_url ON public.links;
CREATE TRIGGER trg_sanitize_link_safe_url
BEFORE INSERT OR UPDATE OF safe_url, destination_url, adsterra_url ON public.links
FOR EACH ROW EXECUTE FUNCTION public.sanitize_link_safe_url();
