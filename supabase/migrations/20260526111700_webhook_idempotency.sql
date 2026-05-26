-- ============================================================
-- Unified webhook_events table — replaces whop_webhook_events
--
-- Provides idempotent deduplication for all webhook sources
-- (Shopify, Whop, Email, ParcelPanel). Full payload audit log
-- with 90-day retention. Retry-ready schema (attempt_count,
-- next_retry_at) for future use.
--
-- Idempotent. Single transaction.
-- ============================================================

begin;

-- ============================================================
-- 1. Create webhook_events
-- ============================================================

create table if not exists public.webhook_events (
  id                      uuid         primary key default gen_random_uuid(),
  event_id                text         not null,
  source                  text         not null,
  event_type              text         not null,
  payload                 jsonb        not null,
  status                  text         not null default 'processing',
  error_message           text,
  processing_duration_ms  integer,
  attempt_count           integer      not null default 1,
  next_retry_at           timestamptz,
  workspace_id            uuid         references public.workspaces(id),
  created_at              timestamptz  not null default now(),
  completed_at            timestamptz,

  constraint uq_webhook_event unique (source, event_id),
  constraint chk_webhook_event_status check (status in ('processing', 'completed', 'failed')),
  constraint chk_webhook_event_source check (source in ('shopify', 'whop', 'email', 'parcelpanel'))
);

create index if not exists idx_webhook_events_status
  on public.webhook_events (status) where status != 'completed';

create index if not exists idx_webhook_events_created_at
  on public.webhook_events (created_at);

create index if not exists idx_webhook_events_source_type
  on public.webhook_events (source, event_type);

create index if not exists idx_webhook_events_workspace
  on public.webhook_events (workspace_id) where workspace_id is not null;

-- ─── RLS ────────────────────────────────────────────────────────
alter table public.webhook_events enable row level security;

drop policy if exists webhook_events_super_admin_select
  on public.webhook_events;

create policy webhook_events_super_admin_select
  on public.webhook_events
  for select
  to authenticated
  using (public.is_current_user_lynq_admin());

-- ============================================================
-- 2. Drop legacy whop_webhook_events
-- ============================================================

drop table if exists public.whop_webhook_events;

-- ============================================================
-- Verification
-- ============================================================

do $$
declare
  v_table_exists  bool;
  v_old_dropped   bool;
  v_policy_count  int;
begin
  select exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'webhook_events'
  ) into v_table_exists;
  if not v_table_exists then
    raise exception 'webhook_events table missing';
  end if;

  select not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'whop_webhook_events'
  ) into v_old_dropped;
  if not v_old_dropped then
    raise exception 'whop_webhook_events should have been dropped';
  end if;

  select count(*) into v_policy_count
  from pg_policies
  where schemaname = 'public' and tablename = 'webhook_events';
  if v_policy_count <> 1 then
    raise exception 'Expected 1 RLS policy on webhook_events, found %', v_policy_count;
  end if;

  raise notice 'OK — webhook_events table created, whop_webhook_events dropped, RLS policy in place';
end $$;

commit;

notify pgrst, 'reload schema';
