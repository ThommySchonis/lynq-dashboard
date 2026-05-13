-- ============================================================
-- Whop integration — idempotency table + plan-ID backfill
--
-- Adds:
--   1. whop_webhook_events     — append-only log keyed by Whop's
--                                webhook-id header. Used for dedup so
--                                a retried webhook delivery is a no-op.
--   2. plans.whop_plan_id      — backfilled with the 4 production
--                                plan IDs from the Whop dashboard
--                                (Elite stays null — handled manually).
--
-- RLS: super-admin SELECT on whop_webhook_events for audit access via
-- the existing public.is_current_user_lynq_admin() helper.
--
-- Idempotent. Single transaction.
-- ============================================================

begin;

-- ============================================================
-- 1. whop_webhook_events — idempotency dedup
-- ============================================================

create table if not exists public.whop_webhook_events (
  id              uuid        primary key default gen_random_uuid(),
  whop_event_id   text        not null unique,
  event_type      text        not null,
  payload         jsonb       not null,
  processed_at    timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

create index if not exists idx_whop_webhook_events_type
  on public.whop_webhook_events (event_type, created_at desc);

create index if not exists idx_whop_webhook_events_created_at
  on public.whop_webhook_events (created_at desc);

-- ─── RLS ────────────────────────────────────────────────────────
alter table public.whop_webhook_events enable row level security;

drop policy if exists whop_webhook_events_super_admin_select
  on public.whop_webhook_events;

create policy whop_webhook_events_super_admin_select
  on public.whop_webhook_events
  for select
  to authenticated
  using (public.is_current_user_lynq_admin());

-- ============================================================
-- 2. Backfill plans.whop_plan_id with production plan IDs
-- ============================================================

update public.plans set whop_plan_id = 'plan_XLJJjXDcYJ2X1' where id = 'starter';
update public.plans set whop_plan_id = 'plan_ZET4jsmeKtDCw' where id = 'growth';
update public.plans set whop_plan_id = 'plan_1PPgI0pBMljtL' where id = 'scale';
update public.plans set whop_plan_id = 'plan_p4G6bFsaY6JzK' where id = 'enterprise';
-- elite stays null — custom, sales-handled

-- ============================================================
-- Verification
-- ============================================================

do $$
declare
  v_table_exists    bool;
  v_plan_id_count   int;
  v_policy_count    int;
  v_helper_exists   bool;
begin
  -- Helper must exist (from 20260509_is_lynq_admin_tighten.sql)
  select exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'is_current_user_lynq_admin'
  ) into v_helper_exists;
  if not v_helper_exists then
    raise exception 'is_current_user_lynq_admin() missing — run 20260509_is_lynq_admin_tighten.sql first';
  end if;

  select exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'whop_webhook_events'
  ) into v_table_exists;
  if not v_table_exists then
    raise exception 'whop_webhook_events table missing';
  end if;

  select count(*) into v_plan_id_count
  from public.plans
  where id in ('starter', 'growth', 'scale', 'enterprise')
    and whop_plan_id is not null;
  if v_plan_id_count <> 4 then
    raise exception 'Expected 4 plans with whop_plan_id set, found %', v_plan_id_count;
  end if;

  select count(*) into v_policy_count
  from pg_policies
  where schemaname = 'public' and tablename = 'whop_webhook_events';
  if v_policy_count <> 1 then
    raise exception 'Expected 1 RLS policy on whop_webhook_events, found %', v_policy_count;
  end if;

  raise notice 'OK — Whop integration schema ready (idempotency table + 4 plan IDs backfilled, super-admin SELECT policy)';
end $$;

commit;

notify pgrst, 'reload schema';
