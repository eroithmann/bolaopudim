
-- Trigger: recalc points when match result changes
DROP TRIGGER IF EXISTS trg_recalculate_match_points ON public.matches;
CREATE TRIGGER trg_recalculate_match_points
AFTER UPDATE OF home_score, away_score, status ON public.matches
FOR EACH ROW
EXECUTE FUNCTION public.recalculate_match_points();

-- Trigger: rebuild ranking snapshots when match changes
DROP TRIGGER IF EXISTS trg_rebuild_ranking_snapshots ON public.matches;
CREATE TRIGGER trg_rebuild_ranking_snapshots
AFTER INSERT OR UPDATE OR DELETE ON public.matches
FOR EACH ROW
EXECUTE FUNCTION public.trg_rebuild_ranking_snapshots();

-- Trigger: audit prediction changes
DROP TRIGGER IF EXISTS trg_log_prediction_change ON public.predictions;
CREATE TRIGGER trg_log_prediction_change
AFTER INSERT OR UPDATE OR DELETE ON public.predictions
FOR EACH ROW
EXECUTE FUNCTION public.log_prediction_change();

-- One-off rebuild to fix stale snapshots
SELECT public.rebuild_ranking_snapshots('1970-01-01'::timestamptz);
