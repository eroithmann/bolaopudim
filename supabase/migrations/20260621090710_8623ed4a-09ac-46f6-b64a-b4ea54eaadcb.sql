-- Remove duplicate audit trigger on predictions (keep trg_predictions_audit)
DROP TRIGGER IF EXISTS trg_log_prediction_change ON public.predictions;

-- Remove duplicate ranking snapshot trigger on matches (keep trg_rebuild_ranking_snapshots)
DROP TRIGGER IF EXISTS matches_rebuild_snapshots ON public.matches;

-- Remove duplicate recalculate trigger on matches (keep trg_recalculate_match_points which is more specific - only fires on score/status updates)
DROP TRIGGER IF EXISTS on_match_result_updated ON public.matches;