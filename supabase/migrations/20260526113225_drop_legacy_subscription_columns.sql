-- ============================================================
-- Migration 2: Drop legacy subscription columns from workspaces
--
-- Prerequisites:
--   - Migration 1 (backfill + provision_workspace update) is applied
--   - All application code reads from workspace_subscriptions
--
-- Drops: subscription_status, trial_ends_at, plan,
--        subscription_started_at, whop_membership_id, whop_user_id
-- Drops: related indexes and CHECK constraint
-- ============================================================

-- Drop indexes first
drop index if exists public.idx_workspaces_subscription_status;
drop index if exists public.idx_workspaces_trial_ends_at;

-- Drop CHECK constraint
alter table public.workspaces
  drop constraint if exists workspaces_subscription_status_check;

-- Drop columns
alter table public.workspaces
  drop column if exists subscription_status,
  drop column if exists trial_ends_at,
  drop column if exists plan,
  drop column if exists subscription_started_at,
  drop column if exists whop_membership_id,
  drop column if exists whop_user_id;

-- Verification
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'workspaces'
      and column_name  = 'subscription_status'
  ) then
    raise exception 'subscription_status column still exists';
  end if;
  raise notice 'OK — legacy subscription columns dropped from workspaces';
end $$;

notify pgrst, 'reload schema';
