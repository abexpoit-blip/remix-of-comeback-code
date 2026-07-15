GRANT EXECUTE ON FUNCTION public.get_live_analytics_summary(uuid) TO sandbox_exec;
NOTIFY pgrst, 'reload schema';