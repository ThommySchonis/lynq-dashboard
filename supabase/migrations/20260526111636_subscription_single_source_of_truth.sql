-- ============================================================
-- Migration 1: Subscription single source of truth
--
-- 1. Backfill workspace_subscriptions for workspaces that don't have one
-- 2. Update provision_workspace() to create workspace_subscriptions row
--    and stop writing legacy columns
-- ============================================================

-- ============================================================
-- 1. Backfill missing workspace_subscriptions rows
-- ============================================================

insert into public.workspace_subscriptions (
  workspace_id,
  plan_id,
  status,
  trial_ends_at,
  current_period_start,
  current_period_end
)
select
  w.id,
  coalesce(nullif(w.plan, ''), 'starter'),
  case w.subscription_status
    when 'paying'  then 'active'
    when 'expired' then 'past_due'
    when 'trial'   then 'trial'
    else 'trial'
  end,
  w.trial_ends_at,
  coalesce(w.subscription_started_at, w.created_at),
  coalesce(w.trial_ends_at, w.subscription_started_at, w.created_at)
from public.workspaces w
where not exists (
  select 1 from public.workspace_subscriptions ws
  where ws.workspace_id = w.id
);

-- ============================================================
-- 2. Update provision_workspace() — stop writing legacy columns,
--    create workspace_subscriptions row instead
-- ============================================================

create or replace function public.provision_workspace(
  p_user_id        uuid,
  p_workspace_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_workspace_id uuid;
  v_member_id    uuid;
begin
  -- Create workspace (no longer sets subscription_status or trial_ends_at)
  insert into public.workspaces (
    name,
    owner_id
  )
  values (
    p_workspace_name,
    p_user_id
  )
  returning id into v_workspace_id;

  -- Create subscription row — single source of truth for billing state
  insert into public.workspace_subscriptions (
    workspace_id,
    plan_id,
    status,
    trial_ends_at,
    current_period_start,
    current_period_end
  )
  values (
    v_workspace_id,
    'starter',
    'trial',
    now() + interval '7 days',
    now(),
    now() + interval '7 days'
  );

  -- Owner workspace_member
  insert into public.workspace_members (
    workspace_id,
    user_id,
    role
  )
  values (
    v_workspace_id,
    p_user_id,
    'owner'
  )
  returning id into v_member_id;

  -- user_profile (idempotent — UPSERT in case it exists from elsewhere)
  insert into public.user_profiles (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  return jsonb_build_object(
    'workspace_id', v_workspace_id,
    'member_id',    v_member_id
  );
end;
$$;

-- Verification
do $$
begin
  if not exists (
    select 1 from pg_proc
    where proname = 'provision_workspace'
      and pronamespace = 'public'::regnamespace
  ) then
    raise exception 'provision_workspace function missing';
  end if;

  -- Verify all workspaces have a subscription row
  if exists (
    select 1 from public.workspaces w
    where not exists (
      select 1 from public.workspace_subscriptions ws
      where ws.workspace_id = w.id
    )
  ) then
    raise exception 'backfill incomplete — some workspaces lack a workspace_subscriptions row';
  end if;

  raise notice 'OK — backfill complete, provision_workspace updated';
end $$;

notify pgrst, 'reload schema';
