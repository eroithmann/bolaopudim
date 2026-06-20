
-- A) Trigger que bloqueia palpites após o deadline (1h antes do jogo)
CREATE OR REPLACE FUNCTION public.enforce_prediction_deadline()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  md timestamptz;
BEGIN
  SELECT match_date INTO md FROM public.matches WHERE id = NEW.match_id;
  IF md IS NULL THEN
    RAISE EXCEPTION 'Jogo não encontrado';
  END IF;
  -- Admins (e chamadas via service_role sem auth.uid) podem ignorar
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  IF md - now() < interval '1 hour' THEN
    RAISE EXCEPTION 'Palpites bloqueados: faltam menos de 1 hora para o jogo começar';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_prediction_deadline ON public.predictions;
CREATE TRIGGER trg_enforce_prediction_deadline
BEFORE INSERT OR UPDATE OF home_score, away_score, match_id
ON public.predictions
FOR EACH ROW EXECUTE FUNCTION public.enforce_prediction_deadline();

-- B) RPC do ranking completo agregado no servidor
CREATE OR REPLACE FUNCTION public.get_full_ranking()
RETURNS TABLE (
  user_id uuid,
  name text,
  total_points int,
  exact_scores int,
  goal_diff int,
  one_side_goals int,
  results_only int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    pr.user_id,
    pr.name,
    COALESCE(SUM(p.points), 0)::int AS total_points,
    COUNT(*) FILTER (
      WHERE m.id IS NOT NULL
        AND p.home_score = m.home_score AND p.away_score = m.away_score
    )::int AS exact_scores,
    COUNT(*) FILTER (
      WHERE m.id IS NOT NULL
        AND NOT (p.home_score = m.home_score AND p.away_score = m.away_score)
        AND SIGN(p.home_score - p.away_score) = SIGN(m.home_score - m.away_score)
        AND (p.home_score - p.away_score) = (m.home_score - m.away_score)
        AND (p.home_score - p.away_score) <> 0
    )::int AS goal_diff,
    COUNT(*) FILTER (
      WHERE m.id IS NOT NULL
        AND NOT (p.home_score = m.home_score AND p.away_score = m.away_score)
        AND SIGN(p.home_score - p.away_score) = SIGN(m.home_score - m.away_score)
        AND (
          (p.home_score = m.home_score AND p.away_score <> m.away_score)
          OR (p.away_score = m.away_score AND p.home_score <> m.home_score)
        )
    )::int AS one_side_goals,
    COUNT(*) FILTER (
      WHERE m.id IS NOT NULL
        AND NOT (p.home_score = m.home_score AND p.away_score = m.away_score)
        AND SIGN(p.home_score - p.away_score) = SIGN(m.home_score - m.away_score)
        AND (p.home_score - p.away_score) <> (m.home_score - m.away_score)
        AND NOT (
          (p.home_score = m.home_score AND p.away_score <> m.away_score)
          OR (p.away_score = m.away_score AND p.home_score <> m.home_score)
        )
    )::int AS results_only
  FROM public.profiles pr
  LEFT JOIN public.predictions p ON p.user_id = pr.user_id
  LEFT JOIN public.matches m
    ON m.id = p.match_id
   AND m.status = 'finished'
   AND m.home_score IS NOT NULL
   AND m.away_score IS NOT NULL
  GROUP BY pr.user_id, pr.name
  ORDER BY total_points DESC, pr.name;
$$;

GRANT EXECUTE ON FUNCTION public.get_full_ranking() TO anon, authenticated, service_role;
