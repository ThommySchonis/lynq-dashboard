-- ============================================================
-- Onboarding flow — schema-aanpassingen.
--
-- Voegt toe:
--   1. workspaces        — 8 nieuwe kolommen (trial state, plan,
--                          demo cleanup, scheduled deletion, Whop link)
--   2. 5 helpdesk tabellen — is_demo boolean voor demo-data filtering
--                            (email_conversations, email_messages,
--                            macros, tags, analytics_actions)
--   3. user_profiles      — 2 nieuwe kolommen (welcome dismissal,
--                            setup checklist dismissal)
--   4. 4 indexes         — subscription/trial filtering + is_demo
--                          composite indexes
--   5. Backfill          — bestaande workspace (founder) op 'paying'
--                          + 'enterprise' plan
--
-- Idempotent: ADD COLUMN IF NOT EXISTS, CREATE INDEX IF NOT EXISTS,
-- DO-blocks voor constraints. Single transaction.
--
-- Run handmatig in Supabase SQL editor (project cvrzvhnsltjubmfkcxql).
-- ============================================================

begin;

-- ============================================================
-- 1. workspaces — onboarding/billing state
-- ============================================================

alter table public.workspaces
  add column if not exists trial_ends_at            timestamptz,
  add column if not exists subscription_status      text not null default 'trial',
  add column if not exists plan                     text,
  add column if not exists subscription_started_at  timestamptz,
  add column if not exists demo_data_removed_at     timestamptz,
  add column if not exists scheduled_for_deletion_at timestamptz,
  add column if not exists whop_membership_id       text,
  add column if not exists whop_user_id             text;

-- CHECK constraint op subscription_status (PG heeft geen
-- ADD CONSTRAINT IF NOT EXISTS, dus DO-block).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname  = 'workspaces_subscription_status_check'
      and conrelid = 'public.workspaces'::regclass
  ) then
    alter table public.workspaces
      add constraint workspaces_subscription_status_check
      check (subscription_status in ('trial', 'paying', 'expired'));
  end if;
end $$;

-- ============================================================
-- 2. is_demo boolean op 5 helpdesk-tabellen
-- ============================================================

alter table public.email_conversations
  add column if not exists is_demo boolean not null default false;

alter table public.email_messages
  add column if not exists is_demo boolean not null default false;

alter table public.macros
  add column if not exists is_demo boolean not null default false;

alter table public.tags
  add column if not exists is_demo boolean not null default false;

alter table public.analytics_actions
  add column if not exists is_demo boolean not null default false;

-- ============================================================
-- 3. user_profiles — onboarding UI state per gebruiker
-- ============================================================

alter table public.user_profiles
  add column if not exists welcome_dismissed_at        timestamptz,
  add column if not exists setup_checklist_dismissed_at timestamptz;

-- ============================================================
-- 4. Indexes
-- ============================================================

-- Volledige index op subscription_status — voor "list all paying
-- workspaces" / "find expired" queries
create index if not exists idx_workspaces_subscription_status
  on public.workspaces (subscription_status);

-- Partial index op trial_ends_at — alleen relevant voor trial workspaces.
-- Gebruikt door de cron die expired trials moet vinden.
create index if not exists idx_workspaces_trial_ends_at
  on public.workspaces (trial_ends_at)
  where subscription_status = 'trial';

-- Composite indexes voor "demo data ophalen / verbergen per workspace".
-- (workspace_id, is_demo) ondersteunt zowel "alleen demo" als
-- "alleen echt" filters binnen een workspace.
create index if not exists idx_email_conversations_is_demo
  on public.email_conversations (workspace_id, is_demo);

create index if not exists idx_macros_is_demo
  on public.macros (workspace_id, is_demo);

-- ============================================================
-- 5. Backfill — bestaande workspace (founder, niet-trial)
--
-- Idempotent via `where plan is null`: na eerste run zit plan op
-- 'enterprise', re-run is een no-op.
-- ============================================================

update public.workspaces
   set subscription_status = 'paying',
       plan                = 'enterprise',
       trial_ends_at       = null
 where plan is null;

-- ============================================================
-- Verification
-- ============================================================

do $$
declare
  v_workspace_cols int;
  v_is_demo_cols   int;
  v_profile_cols   int;
  v_index_count    int;
  v_check_exists   bool;
begin
  -- workspaces — 8 nieuwe kolommen
  select count(*) into v_workspace_cols
  from information_schema.columns
  where table_schema = 'public'
    and table_name   = 'workspaces'
    and column_name in (
      'trial_ends_at', 'subscription_status', 'plan',
      'subscription_started_at', 'demo_data_removed_at',
      'scheduled_for_deletion_at', 'whop_membership_id', 'whop_user_id'
    );
  if v_workspace_cols <> 8 then
    raise exception 'Expected 8 new workspaces columns, found %', v_workspace_cols;
  end if;

  -- is_demo op 5 tabellen
  select count(*) into v_is_demo_cols
  from information_schema.columns
  where table_schema = 'public'
    and column_name  = 'is_demo'
    and table_name in (
      'email_conversations', 'email_messages', 'macros',
      'tags', 'analytics_actions'
    );
  if v_is_demo_cols <> 5 then
    raise exception 'Expected 5 is_demo columns, found %', v_is_demo_cols;
  end if;

  -- user_profiles — 2 nieuwe kolommen
  select count(*) into v_profile_cols
  from information_schema.columns
  where table_schema = 'public'
    and table_name   = 'user_profiles'
    and column_name in ('welcome_dismissed_at', 'setup_checklist_dismissed_at');
  if v_profile_cols <> 2 then
    raise exception 'Expected 2 user_profiles columns, found %', v_profile_cols;
  end if;

  -- 4 indexes
  select count(*) into v_index_count
  from pg_indexes
  where schemaname = 'public'
    and indexname in (
      'idx_workspaces_subscription_status',
      'idx_workspaces_trial_ends_at',
      'idx_email_conversations_is_demo',
      'idx_macros_is_demo'
    );
  if v_index_count <> 4 then
    raise exception 'Expected 4 indexes, found %', v_index_count;
  end if;

  -- CHECK constraint
  select exists (
    select 1 from pg_constraint
    where conname  = 'workspaces_subscription_status_check'
      and conrelid = 'public.workspaces'::regclass
  ) into v_check_exists;
  if not v_check_exists then
    raise exception 'subscription_status CHECK constraint missing';
  end if;

  raise notice 'OK — onboarding schema additions complete (8 workspace cols, 5 is_demo cols, 2 user_profiles cols, 4 indexes, 1 CHECK)';
end $$;

commit;

notify pgrst, 'reload schema';
