REVOKE EXECUTE ON FUNCTION public.get_live_analytics_summary(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_live_analytics_summary(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_live_analytics_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_live_analytics_summary(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_live_analytics_summary(uuid) TO sandbox_exec;
NOTIFY pgrst, 'reload schema';
SELECT pg_notify('pgrst', 'reload schema');