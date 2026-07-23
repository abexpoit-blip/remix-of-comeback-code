REVOKE ALL ON FUNCTION public.get_admin_overview_stats() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_bot_reasons(integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_fb_blocked_count(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_top_countries(integer, integer) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_admin_overview_stats() TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_bot_reasons(integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_fb_blocked_count(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_top_countries(integer, integer) TO service_role;

NOTIFY pgrst, 'reload schema';