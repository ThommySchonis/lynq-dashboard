-- ============================================================
-- Schedule webhook-cleanup Edge Function to run daily at 3 AM UTC
--
-- Uses pg_cron + pg_net to invoke the deployed Edge Function.
-- ============================================================

-- Enable extensions if not already enabled
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- Remove existing schedule if any (idempotent)
select cron.unschedule('webhook-cleanup-daily')
where exists (
  select 1 from cron.job where jobname = 'webhook-cleanup-daily'
);

-- Schedule: daily at 3 AM UTC
select cron.schedule(
  'webhook-cleanup-daily',
  '0 3 * * *',
  $$
  select net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/webhook-cleanup',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
