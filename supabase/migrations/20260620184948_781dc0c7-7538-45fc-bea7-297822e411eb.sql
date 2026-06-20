
create or replace function public.get_newsletter_cron_secret()
returns text
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v text;
begin
  select decrypted_secret into v from vault.decrypted_secrets where name = 'NEWSLETTER_CRON_SECRET' limit 1;
  return v;
end;
$$;

revoke all on function public.get_newsletter_cron_secret() from public, anon, authenticated;
grant execute on function public.get_newsletter_cron_secret() to service_role;
