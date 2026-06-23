-- ============================================================
-- Schedule parcelpanel-backfill Edge Function to run daily.
--
-- Safety net for any ParcelPanel webhooks missed while a store
-- was disconnected. Invoked with no query params, so the function
-- takes its cron path and backfills ALL connected stores.
--
-- Uses pg_cron + pg_net to invoke the deployed Edge Function,
-- mirroring the migrations-tick / webhook-retry cron schedules.
-- ============================================================

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- Remove existing schedule if any (idempotent)
select cron.unschedule('parcelpanel-backfill-daily')
where exists (
  select 1 from cron.job where jobname = 'parcelpanel-backfill-daily'
);

-- Schedule: daily at 03:00 UTC
select cron.schedule(
  'parcelpanel-backfill-daily',
  '0 3 * * *',
  $$
  select net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/parcelpanel-backfill',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
