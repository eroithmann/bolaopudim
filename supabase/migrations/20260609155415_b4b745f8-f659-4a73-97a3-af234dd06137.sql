
CREATE OR REPLACE FUNCTION public.calculate_prediction_points(p_home_score integer, p_away_score integer, r_home_score integer, r_away_score integer)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  p_result INTEGER;
  r_result INTEGER;
BEGIN
  -- Exact score
  IF p_home_score = r_home_score AND p_away_score = r_away_score THEN
    RETURN 3;
  END IF;
  p_result := SIGN(p_home_score - p_away_score);
  r_result := SIGN(r_home_score - r_away_score);
  -- Correct result + correct goal difference (not draw)
  IF p_result = r_result AND p_result <> 0 AND (p_home_score - p_away_score) = (r_home_score - r_away_score) THEN
    RETURN 2;
  END IF;
  -- Correct result only
  IF p_result = r_result THEN
    RETURN 1;
  END IF;
  RETURN 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.phase_multiplier(_phase text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE _phase
    WHEN 'groups' THEN 1
    WHEN 'round_of_32' THEN 2
    WHEN 'round_of_16' THEN 3
    WHEN 'quarterfinals' THEN 4
    WHEN 'semifinals' THEN 5
    WHEN 'third_place' THEN 2
    WHEN 'final' THEN 6
    ELSE 1
  END
$$;

CREATE OR REPLACE FUNCTION public.recalculate_match_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'finished' AND NEW.home_score IS NOT NULL AND NEW.away_score IS NOT NULL THEN
    UPDATE public.predictions
    SET points = public.calculate_prediction_points(
      predictions.home_score, predictions.away_score,
      NEW.home_score, NEW.away_score
    ) * public.phase_multiplier(NEW.phase),
    updated_at = now()
    WHERE match_id = NEW.id;
  ELSE
    UPDATE public.predictions
    SET points = NULL, updated_at = now()
    WHERE match_id = NEW.id AND points IS NOT NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- Recalculate any existing finished match predictions
UPDATE public.predictions p
SET points = public.calculate_prediction_points(p.home_score, p.away_score, m.home_score, m.away_score) * public.phase_multiplier(m.phase),
    updated_at = now()
FROM public.matches m
WHERE p.match_id = m.id
  AND m.status = 'finished'
  AND m.home_score IS NOT NULL
  AND m.away_score IS NOT NULL;
