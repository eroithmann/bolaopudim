GRANT SELECT ON public.ranking_snapshots TO anon;

CREATE POLICY "Anyone can read ranking snapshots"
ON public.ranking_snapshots
FOR SELECT
TO anon
USING (true);