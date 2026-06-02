-- ============================================================
-- Webhook retry system: schema changes + cron schedule
--
-- 1. Update CHECK constraint to allow dead_letter + dismissed
-- 2. Add metadata column for retry context
-- 3. Update/add indexes for retry processor queries
-- 4. Schedule webhook-retry Edge Function via pg_cron
--
-- Idempotent. Single transaction.
-- ============================================================

begin;

-- 1. Replace status CHECK constraint
alter table public.webhook_events
  drop constraint if exists chk_webhook_event_status;

alter table public.webhook_events
  add constraint chk_webhook_event_status
  check (status in ('processing', 'completed', 'failed', 'dead_letter', 'dismissed'));

-- 2. Add metadata column
alter table public.webhook_events
  add column if not exists metadata jsonb default null;

-- 3. Replace partial index on status (old filter was: status != 'completed')
drop index if exists idx_webhook_events_status;

create index if not exists idx_webhook_events_status
  on public.webhook_events (status)
  where status not in ('completed', 'dismissed');

-- 4. Add composite index for retry processor queries
create index if not exists idx_webhook_events_retry
  on public.webhook_events (status, next_retry_at)
  where status not in ('completed', 'dismissed');

-- 5. Schedule webhook-retry Edge Function (every 5 minutes)
select cron.unschedule('webhook-retry-5min')
where exists (
  select 1 from cron.job where jobname = 'webhook-retry-5min'
);

select cron.schedule(
  'webhook-retry-5min',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/webhook-retry',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Verification
do $$
declare
  v_has_metadata bool;
  v_constraint_ok bool;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'webhook_events'
      and column_name = 'metadata'
  ) into v_has_metadata;
  if not v_has_metadata then
    raise exception 'metadata column missing from webhook_events';
  end if;

  -- Verify the new CHECK allows dead_letter
  begin
    insert into public.webhook_events (event_id, source, event_type, payload, status)
    values ('__verify_check__', 'shopify', 'test', '{}', 'dead_letter');
    delete from public.webhook_events where event_id = '__verify_check__';
  exception when check_violation then
    raise exception 'CHECK constraint does not allow dead_letter status';
  end;

  raise notice 'OK — webhook_retry migration verified';
end $$;

commit;

notify pgrst, 'reload schema';
