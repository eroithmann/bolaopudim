
CREATE TABLE public.match_broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL UNIQUE REFERENCES public.matches(id) ON DELETE CASCADE,
  channels text[] NOT NULL DEFAULT '{}',
  source text NOT NULL DEFAULT 'sofascore',
  sofascore_event_id bigint,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.match_broadcasts TO anon, authenticated;
GRANT ALL ON public.match_broadcasts TO service_role;

ALTER TABLE public.match_broadcasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view broadcasts"
ON public.match_broadcasts FOR SELECT
USING (true);

CREATE TRIGGER update_match_broadcasts_updated_at
BEFORE UPDATE ON public.match_broadcasts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_match_broadcasts_match_id ON public.match_broadcasts(match_id);
