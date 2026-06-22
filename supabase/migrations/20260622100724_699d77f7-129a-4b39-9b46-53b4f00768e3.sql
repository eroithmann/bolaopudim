DROP TRIGGER IF EXISTS trg_rebuild_ranking_snapshots ON public.matches;
DROP TRIGGER IF EXISTS trg_recalculate_match_points ON public.matches;
DROP TRIGGER IF EXISTS trg_10_recalculate_match_points ON public.matches;
DROP TRIGGER IF EXISTS trg_20_rebuild_ranking_snapshots ON public.matches;

CREATE TRIGGER trg_10_recalculate_match_points
AFTER UPDATE OF status, home_score, away_score, phase
ON public.matches
FOR EACH ROW
EXECUTE FUNCTION public.recalculate_match_points();

CREATE TRIGGER trg_20_rebuild_ranking_snapshots
AFTER INSERT OR UPDATE OR DELETE
ON public.matches
FOR EACH ROW
EXECUTE FUNCTION public.trg_rebuild_ranking_snapshots();

DO $$
BEGIN
  PERFORM public.rebuild_ranking_snapshots('1970-01-01'::timestamptz);
END $$;