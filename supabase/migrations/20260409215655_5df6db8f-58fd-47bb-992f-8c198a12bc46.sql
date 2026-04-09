
-- Update trigger function to handle both finished and non-finished states
CREATE OR REPLACE FUNCTION public.recalculate_match_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'finished' AND NEW.home_score IS NOT NULL AND NEW.away_score IS NOT NULL THEN
    UPDATE public.predictions
    SET points = public.calculate_prediction_points(
      predictions.home_score, predictions.away_score,
      NEW.home_score, NEW.away_score
    ),
    updated_at = now()
    WHERE match_id = NEW.id;
  ELSE
    -- Reset points when match is not finished
    UPDATE public.predictions
    SET points = NULL, updated_at = now()
    WHERE match_id = NEW.id AND points IS NOT NULL;
  END IF;
  RETURN NEW;
END;
$function$;

-- Drop existing trigger if it has a WHEN clause
DROP TRIGGER IF EXISTS on_match_result_updated ON public.matches;

-- Recreate trigger without WHEN clause
CREATE TRIGGER on_match_result_updated
  AFTER UPDATE ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION public.recalculate_match_points();

-- Reset orphan points now
UPDATE predictions SET points = NULL
WHERE match_id IN (SELECT id FROM matches WHERE status != 'finished');
