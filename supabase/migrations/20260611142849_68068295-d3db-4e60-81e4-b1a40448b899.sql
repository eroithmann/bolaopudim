
CREATE OR REPLACE FUNCTION public.calculate_prediction_points(
  p_home_score integer, p_away_score integer,
  r_home_score integer, r_away_score integer
)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
DECLARE
  p_result INTEGER;
  r_result INTEGER;
BEGIN
  -- 5: placar exato
  IF p_home_score = r_home_score AND p_away_score = r_away_score THEN
    RETURN 5;
  END IF;

  p_result := SIGN(p_home_score - p_away_score);
  r_result := SIGN(r_home_score - r_away_score);

  -- Resultado errado: 0
  IF p_result <> r_result THEN
    RETURN 0;
  END IF;

  -- Empate acertado (sem ser exato): 3
  IF r_result = 0 THEN
    RETURN 3;
  END IF;

  -- Vitória/derrota com diferença de gols certa: 3
  IF (p_home_score - p_away_score) = (r_home_score - r_away_score) THEN
    RETURN 3;
  END IF;

  -- Resultado certo e acertou os gols de um dos lados: 2
  IF p_home_score = r_home_score OR p_away_score = r_away_score THEN
    RETURN 2;
  END IF;

  -- Apenas resultado certo: 1
  RETURN 1;
END;
$function$;

-- Recalcula pontos para todos os jogos já finalizados
UPDATE public.predictions pr
SET points = public.calculate_prediction_points(
      pr.home_score, pr.away_score, m.home_score, m.away_score
    ) * public.phase_multiplier(m.phase),
    updated_at = now()
FROM public.matches m
WHERE pr.match_id = m.id
  AND m.status = 'finished'
  AND m.home_score IS NOT NULL
  AND m.away_score IS NOT NULL;
