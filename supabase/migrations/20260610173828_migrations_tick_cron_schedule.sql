-- ============================================================
-- Schedule migrations-tick Edge Function to run every minute.
--
-- Uses pg_cron + pg_net to invoke the deployed Edge Function.
-- ============================================================

-- Enable extensions if not already enabled
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- Remove existing schedule if any (idempotent)
select cron.unschedule('migrations-tick-every-minute')
where exists (
  select 1 from cron.job where jobname = 'migrations-tick-every-minute'
);

-- Schedule: every minute
select cron.schedule(
  'migrations-tick-every-minute',
  '* * * * *',
  $$
  select net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/migrations-tick',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
