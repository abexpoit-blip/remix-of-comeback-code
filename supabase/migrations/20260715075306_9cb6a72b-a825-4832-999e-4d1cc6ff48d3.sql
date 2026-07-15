-- Replace named jsonb fallback with an unnamed jsonb fallback so PostgREST can match the existing VPS body directly.

DROP FUNCTION IF EXISTS public.get_live_analytics_summary(_payload jsonb);
DROP FUNCTION IF EXISTS public.get_live_analytics_summary(jsonb);

CREATE OR REPLACE FUNCTION public.get_live_analytics_summary(jsonb)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '15s'
AS $function$
  SELECT public.get_live_analytics_summary(($1->>'_user_id')::uuid);
$function$;

REVOKE ALL ON FUNCTION public.get_live_analytics_summary(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_live_analytics_summary(jsonb) TO authenticated, service_role;
COMMENT ON FUNCTION public.get_live_analytics_summary(jsonb) IS 'Unnamed JSON fallback for API schema-cache body matching.';

NOTIFY pgrst, 'reload schema';