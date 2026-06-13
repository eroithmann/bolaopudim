
-- 1) Table
CREATE TABLE public.ranking_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  match_date timestamptz NOT NULL,
  user_id uuid NOT NULL,
  position integer NOT NULL,
  total_points integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (match_id, user_id)
);

CREATE INDEX idx_ranking_snapshots_match_date ON public.ranking_snapshots(match_date);
CREATE INDEX idx_ranking_snapshots_user ON public.ranking_snapshots(user_id);

GRANT SELECT ON public.ranking_snapshots TO authenticated;
GRANT ALL ON public.ranking_snapshots TO service_role;

ALTER TABLE public.ranking_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read snapshots"
  ON public.ranking_snapshots FOR SELECT
  TO authenticated
  USING (true);

-- 2) Function: rebuild snapshots for a given match_date onward
CREATE OR REPLACE FUNCTION public.rebuild_ranking_snapshots(_from_date timestamptz)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m RECORD;
BEGIN
  -- Remove snapshots from this date onward (will recompute)
  DELETE FROM public.ranking_snapshots
  WHERE match_date >= _from_date;

  -- For each finished match from _from_date onward, in chronological order,
  -- compute cumulative ranking up to (and including) that match.
  FOR m IN
    SELECT id, match_date
    FROM public.matches
    WHERE status = 'finished'
      AND home_score IS NOT NULL
      AND away_score IS NOT NULL
      AND match_date >= _from_date
    ORDER BY match_date ASC, id ASC
  LOOP
    INSERT INTO public.ranking_snapshots (match_id, match_date, user_id, position, total_points)
    SELECT
      m.id,
      m.match_date,
      t.user_id,
      RANK() OVER (ORDER BY t.total_points DESC) AS position,
      t.total_points
    FROM (
      SELECT
        pr.user_id,
        COALESCE(SUM(p.points), 0)::int AS total_points
      FROM public.profiles pr
      LEFT JOIN public.predictions p ON p.user_id = pr.user_id
      LEFT JOIN public.matches mm ON mm.id = p.match_id
        AND mm.status = 'finished'
        AND mm.match_date <= m.match_date
      GROUP BY pr.user_id
    ) t;
  END LOOP;
END;
$$;

-- 3) Trigger function on matches
CREATE OR REPLACE FUNCTION public.trg_rebuild_ranking_snapshots()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _from timestamptz;
BEGIN
  -- Earliest affected date
  IF TG_OP = 'DELETE' THEN
    _from := OLD.match_date;
  ELSIF TG_OP = 'INSERT' THEN
    _from := NEW.match_date;
  ELSE
    _from := LEAST(OLD.match_date, NEW.match_date);
  END IF;

  -- Only rebuild if something relevant changed
  IF TG_OP = 'UPDATE'
     AND OLD.status IS NOT DISTINCT FROM NEW.status
     AND OLD.home_score IS NOT DISTINCT FROM NEW.home_score
     AND OLD.away_score IS NOT DISTINCT FROM NEW.away_score
     AND OLD.match_date IS NOT DISTINCT FROM NEW.match_date THEN
    RETURN NEW;
  END IF;

  PERFORM public.rebuild_ranking_snapshots(_from);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER matches_rebuild_snapshots
AFTER INSERT OR UPDATE OR DELETE ON public.matches
FOR EACH ROW
EXECUTE FUNCTION public.trg_rebuild_ranking_snapshots();

-- 4) Initial backfill from the earliest finished match
DO $$
DECLARE
  _start timestamptz;
BEGIN
  SELECT MIN(match_date) INTO _start
  FROM public.matches
  WHERE status = 'finished'
    AND home_score IS NOT NULL
    AND away_score IS NOT NULL;

  IF _start IS NOT NULL THEN
    PERFORM public.rebuild_ranking_snapshots(_start);
  END IF;
END $$;
