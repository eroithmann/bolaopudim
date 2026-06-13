
REVOKE EXECUTE ON FUNCTION public.rebuild_ranking_snapshots(timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_rebuild_ranking_snapshots() FROM PUBLIC, anon, authenticated;
