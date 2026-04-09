UPDATE public.matches 
SET home_score = NULL, away_score = NULL, status = 'scheduled', result_source = NULL
WHERE phase = 'test';