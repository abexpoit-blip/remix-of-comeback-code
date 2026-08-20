-- 37_bridge_delivery_stats.sql
-- MEASURE ACTUAL DELIVERY TO THE AD NETWORK
--
-- `clicks` is written at redirect time — the moment we DECIDE a destination.
-- It does not prove the browser actually completed the hand-off to the offer /
-- our Adsterra URL. When Adsterra reports far fewer visits than our click log
-- (48k ours clicks vs $6), we currently cannot tell whether the visitors never
-- arrived or whether the CPM is simply tier-3 low.
--
-- This adds an hourly counter that the bridge page pings right before it
-- navigates. delivered / decided = the real hand-off rate.

CREATE TABLE IF NOT EXISTS public.bridge_delivery_stats (
  hour  timestamptz NOT NULL,
  route text        NOT NULL,
  count bigint      NOT NULL DEFAULT 0,
  PRIMARY KEY (hour, route)
);

GRANT SELECT ON public.bridge_delivery_stats TO authenticated;
GRANT ALL    ON public.bridge_delivery_stats TO service_role;

ALTER TABLE public.bridge_delivery_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins read delivery stats" ON public.bridge_delivery_stats;
CREATE POLICY "admins read delivery stats"
  ON public.bridge_delivery_stats FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.record_bridge_delivery(_route text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.bridge_delivery_stats (hour, route, count)
  VALUES (date_trunc('hour', now()), COALESCE(NULLIF(_route,''), 'offer'), 1)
  ON CONFLICT (hour, route) DO UPDATE
    SET count = public.bridge_delivery_stats.count + 1;
$$;

GRANT EXECUTE ON FUNCTION public.record_bridge_delivery(text) TO service_role;

-- keep it tiny
DELETE FROM public.bridge_delivery_stats WHERE hour < now() - interval '30 days';
