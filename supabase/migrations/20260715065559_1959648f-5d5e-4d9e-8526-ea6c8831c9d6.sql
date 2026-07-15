REVOKE ALL ON FUNCTION public.get_live_analytics_summary(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_live_analytics_summary(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.get_live_analytics_summary(uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public.get_live_analytics_summary(uuid) FROM service_role;
GRANT EXECUTE ON FUNCTION public.get_live_analytics_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_live_analytics_summary(uuid) TO service_role;