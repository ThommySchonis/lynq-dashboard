-- ============================================================
-- Schedule the shopify-sync Edge Function to run hourly.
--
-- shopify-sync does two jobs on each run:
--   1. refreshExpiringTokens() — pre-refreshes Shopify OAuth tokens that are
--      within 10 min of expiry, keeping the single-use refresh token rotating
--      well inside its 90-day window (the background safety net that the
--      on-demand getStoreCredentials path alone did not provide).
--   2. Re-syncs ~90 days of orders per active integration, backfilling any
--      order events that real-time webhooks may have missed.
--
-- Mirrors the existing pg_cron + pg_net pattern (see webhook-cleanup-daily).
-- Runs at minute 15 to stagger away from the other hourly job (usage-warnings
-- at minute 0). Access tokens live ~1h, so an hourly cadence keeps tokens fresh.
-- ============================================================

-- Enable extensions if not already enabled
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- Remove existing schedule if any (idempotent)
select cron.unschedule('shopify-sync-hourly')
where exists (
  select 1 from cron.job where jobname = 'shopify-sync-hourly'
);

-- Schedule: hourly at minute 15 UTC
select cron.schedule(
  'shopify-sync-hourly',
  '15 * * * *',
  $$
  select net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/shopify-sync',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
