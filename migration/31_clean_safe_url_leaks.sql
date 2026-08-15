-- 2026-08-15 — remove safe_url values that expose the operation to reviewers.
-- 1351 links pointed their "safe page" at our own SaaS (sleepox.com) and 92 at
-- the offer / ad-network host itself. '' means "use the rotating article
-- pool", which is always the safe behaviour.

-- Robust hostname extractor: handles protocol, userinfo, port, path.
CREATE OR REPLACE FUNCTION public.extract_host(url text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(
    regexp_replace(
      split_part(regexp_replace(coalesce(url, ''), '^\s+', ''), '/', 3),
      '^([^@]+@|www\.)', ''
    )
  )
$$;

-- First pass: broad match (sleepox / localhost / own offer host).
UPDATE public.links
SET safe_url = ''
WHERE coalesce(safe_url, '') <> ''
  AND (
    safe_url ~* 'sleepox'
    OR safe_url ILIKE '%localhost%'
    OR extract_host(safe_url) = extract_host(destination_url)
    OR extract_host(safe_url) = extract_host(adsterra_url)
  );

-- Second pass: catch any remaining safe_url that still contains sleepox
-- (handles whitespace, encoded chars, unusual protocols).
UPDATE public.links
SET safe_url = ''
WHERE coalesce(safe_url, '') <> ''
  AND safe_url ~* 'sleepox';

-- Guard: block the same mistake at write time.
CREATE OR REPLACE FUNCTION public.sanitize_link_safe_url()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF coalesce(NEW.safe_url, '') <> '' AND (
       NEW.safe_url ~* 'sleepox'
    OR NEW.safe_url ILIKE '%localhost%'
    OR extract_host(NEW.safe_url) = extract_host(NEW.destination_url)
    OR extract_host(NEW.safe_url) = extract_host(NEW.adsterra_url)
  ) THEN
    NEW.safe_url := '';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sanitize_link_safe_url ON public.links;
CREATE TRIGGER trg_sanitize_link_safe_url
BEFORE INSERT OR UPDATE OF safe_url, destination_url, adsterra_url ON public.links
FOR EACH ROW EXECUTE FUNCTION public.sanitize_link_safe_url();
