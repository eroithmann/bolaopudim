CREATE OR REPLACE FUNCTION public.rebuild_ranking_snapshots(_from_date timestamp with time zone)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  m RECORD;
  _cutoff CONSTANT timestamptz := '2026-06-13 01:00:00+00';
  _effective_from timestamptz;
BEGIN
  _effective_from := GREATEST(_from_date, _cutoff);

  DELETE FROM public.ranking_snapshots
  WHERE match_date >= _effective_from
     OR match_date < _cutoff;

  FOR m IN
    SELECT id, match_date
    FROM public.matches
    WHERE status = 'finished'
      AND home_score IS NOT NULL
      AND away_score IS NOT NULL
      AND match_date >= _effective_from
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
        COALESCE(SUM(
          CASE WHEN mm.id IS NOT NULL THEN p.points ELSE 0 END
        ), 0)::int AS total_points
      FROM public.profiles pr
      LEFT JOIN public.predictions p ON p.user_id = pr.user_id
      LEFT JOIN public.matches mm ON mm.id = p.match_id
        AND mm.status = 'finished'
        AND mm.home_score IS NOT NULL
        AND mm.away_score IS NOT NULL
        AND mm.match_date <= m.match_date
      GROUP BY pr.user_id
    ) t;
  END LOOP;
END;
$function$;

SELECT public.rebuild_ranking_snapshots('1970-01-01'::timestamptz);