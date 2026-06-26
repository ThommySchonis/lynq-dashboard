-- Fix: provision_workspace() inserted workspaces.owner_id, but that column was
-- dropped in 20260522000001_drop_owner_id.sql. A later migration
-- (20260526111636_subscription_single_source_of_truth.sql) re-introduced the
-- stale INSERT from an older copy of the function, so every brand-new-user
-- provisioning (Path B in getAuthContext) failed with:
--   column "owner_id" of relation "workspaces" does not exist
--
-- Ownership is tracked solely via workspace_members.role = 'owner' (which this
-- function already creates), and owner_id is referenced nowhere in app code.
-- This re-creates the function identically except for removing the owner_id
-- column + value from the workspaces INSERT.

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
  -- Create workspace (ownership is recorded via workspace_members below).
  insert into public.workspaces (
    name
  )
  values (
    p_workspace_name
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
