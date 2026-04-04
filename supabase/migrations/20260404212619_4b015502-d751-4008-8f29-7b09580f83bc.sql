
CREATE OR REPLACE FUNCTION public.calculate_prediction_points(
  p_home_score INTEGER, p_away_score INTEGER,
  r_home_score INTEGER, r_away_score INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  p_result INTEGER;
  r_result INTEGER;
BEGIN
  IF p_home_score = r_home_score AND p_away_score = r_away_score THEN
    RETURN 5;
  END IF;
  IF p_home_score = r_home_score OR p_away_score = r_away_score THEN
    RETURN 3;
  END IF;
  p_result := SIGN(p_home_score - p_away_score);
  r_result := SIGN(r_home_score - r_away_score);
  IF p_result = r_result THEN
    RETURN 1;
  END IF;
  RETURN 0;
END;
$$;
