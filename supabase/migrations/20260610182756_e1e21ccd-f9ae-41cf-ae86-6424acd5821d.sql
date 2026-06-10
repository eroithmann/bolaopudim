CREATE TABLE public.odds_cache (
  match_id UUID PRIMARY KEY REFERENCES public.matches(id) ON DELETE CASCADE,
  home_odds NUMERIC,
  draw_odds NUMERIC,
  away_odds NUMERIC,
  bookmaker TEXT,
  source TEXT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.odds_cache TO anon, authenticated;
GRANT ALL ON public.odds_cache TO service_role;

ALTER TABLE public.odds_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read odds cache"
ON public.odds_cache FOR SELECT
USING (true);

CREATE TRIGGER update_odds_cache_updated_at
BEFORE UPDATE ON public.odds_cache
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();