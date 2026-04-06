-- Allow admins to delete matches (needed for seed function cleanup)
CREATE POLICY "Admins can delete matches" ON public.matches FOR DELETE TO public USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to insert/update teams (needed for seed function)
CREATE POLICY "Admins can insert teams" ON public.teams FOR INSERT TO public WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update teams" ON public.teams FOR UPDATE TO public USING (has_role(auth.uid(), 'admin'::app_role));