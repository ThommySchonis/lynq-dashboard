-- ============================================================
-- Data retention cleanup — audit log voor workspace verwijderingen.
--
-- Voegt toe:
--   1. workspace_deletion_log tabel — append-only audit van het 60+7
--      retentie-proces (scheduled, deleted, cancelled, error)
--   2. RLS — alleen super-admin (info@lynqagency.com) kan lezen
--   3. Indexes — query op workspace_id + recent events
--
-- Idempotent: CREATE TABLE / INDEX IF NOT EXISTS, DO-blocks voor RLS.
-- Single transaction.
--
-- Run handmatig in Supabase SQL editor (project cvrzvhnsltjubmfkcxql).
-- ============================================================

begin;

-- ============================================================
-- 1. workspace_deletion_log
-- ============================================================

create table if not exists public.workspace_deletion_log (
  id              uuid        primary key default gen_random_uuid(),
  workspace_id    uuid        not null,           -- geen FK: workspace bestaat niet meer na 'deleted'
  workspace_name  text,                           -- snapshot voor audit (workspace is weg na deletion)
  owner_email     text,                           -- snapshot
  event           text        not null,
  trial_ends_at   timestamptz,                    -- snapshot van workspace state
  scheduled_for_deletion_at timestamptz,          -- snapshot
  details         jsonb       not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  constraint workspace_deletion_log_event_check
    check (event in ('scheduled', 'deleted', 'cancelled', 'error'))
);

-- ============================================================
-- 2. Indexes
-- ============================================================

create index if not exists idx_workspace_deletion_log_workspace_id
  on public.workspace_deletion_log (workspace_id);

create index if not exists idx_workspace_deletion_log_created_at
  on public.workspace_deletion_log (created_at desc);

create index if not exists idx_workspace_deletion_log_event
  on public.workspace_deletion_log (event, created_at desc);

-- ============================================================
-- 3. RLS — super-admin only
-- ============================================================

alter table public.workspace_deletion_log enable row level security;

-- Drop & recreate (idempotent) — 1 SELECT policy voor super-admin email,
-- 0 INSERT/UPDATE/DELETE policies (alleen service_role mag schrijven).
drop policy if exists workspace_deletion_log_super_admin_select
  on public.workspace_deletion_log;

create policy workspace_deletion_log_super_admin_select
  on public.workspace_deletion_log
  for select
  to authenticated
  using ((auth.jwt() ->> 'email') = 'info@lynqagency.com');

-- ============================================================
-- Verification
-- ============================================================

do $$
declare
  v_table_exists  bool;
  v_index_count   int;
  v_rls_enabled   bool;
  v_policy_count  int;
  v_check_exists  bool;
begin
  select exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'workspace_deletion_log'
  ) into v_table_exists;
  if not v_table_exists then
    raise exception 'workspace_deletion_log table missing';
  end if;

  select count(*) into v_index_count
  from pg_indexes
  where schemaname = 'public'
    and indexname in (
      'idx_workspace_deletion_log_workspace_id',
      'idx_workspace_deletion_log_created_at',
      'idx_workspace_deletion_log_event'
    );
  if v_index_count <> 3 then
    raise exception 'Expected 3 indexes on workspace_deletion_log, found %', v_index_count;
  end if;

  select relrowsecurity into v_rls_enabled
  from pg_class
  where oid = 'public.workspace_deletion_log'::regclass;
  if not v_rls_enabled then
    raise exception 'RLS not enabled on workspace_deletion_log';
  end if;

  select count(*) into v_policy_count
  from pg_policies
  where schemaname = 'public' and tablename = 'workspace_deletion_log';
  if v_policy_count <> 1 then
    raise exception 'Expected 1 RLS policy on workspace_deletion_log, found %', v_policy_count;
  end if;

  select exists (
    select 1 from pg_constraint
    where conname  = 'workspace_deletion_log_event_check'
      and conrelid = 'public.workspace_deletion_log'::regclass
  ) into v_check_exists;
  if not v_check_exists then
    raise exception 'event CHECK constraint missing';
  end if;

  raise notice 'OK — workspace_deletion_log table ready (3 indexes, RLS on, 1 policy, event CHECK)';
end $$;

commit;

notify pgrst, 'reload schema';
