-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remover job anterior se existir
SELECT cron.unschedule('fetch-match-results-every-5min')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'fetch-match-results-every-5min');

-- Agendar fetch-match-results a cada 5 minutos
SELECT cron.schedule(
  'fetch-match-results-every-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url:='https://jwbqgjvwcwctijtzmdof.supabase.co/functions/v1/fetch-match-results',
    headers:='{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3YnFnanZ3Y3djdGlqdHptZG9mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzM0MDAsImV4cCI6MjA5MDkwOTQwMH0.SNpQi1dtjicVPKpoyMZGaxSjUOU76wGdkL6qc7v1VoY"}'::jsonb,
    body:='{"trigger":"cron"}'::jsonb
  ) AS request_id;
  $$
);