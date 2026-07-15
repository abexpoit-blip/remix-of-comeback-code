REVOKE EXECUTE ON FUNCTION public.get_live_analytics_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_live_analytics_summary(uuid) TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';