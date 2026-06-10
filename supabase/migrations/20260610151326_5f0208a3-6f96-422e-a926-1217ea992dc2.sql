
-- Revoke EXECUTE from public (anon + authenticated inherit from public) on all internal functions
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalculate_match_points() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.calculate_prediction_points(integer, integer, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.phase_multiplier(text) FROM PUBLIC, anon, authenticated;

-- has_role is called from RLS policies by signed-in users (e.g. admin checks)
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
