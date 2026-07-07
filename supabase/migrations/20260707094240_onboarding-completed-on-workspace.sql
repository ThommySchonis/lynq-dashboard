-- ============================================================
-- Move the onboarding gate from the user to the workspace.
--
-- Onboarding is the owner signup funnel (connect store, team volume,
-- pricing plan) — it configures the WORKSPACE, once. It was stored as
-- profiles.onboarding_completed (per-user, default false), so invited
-- members joining an existing workspace never had it set and were
-- bounced to /onboarding on every login. It also broke ownership
-- transfer: a promoted member (flag false) would be dragged through
-- onboarding of an already-set-up workspace.
--
-- Fix: track completion on the workspace, gated to its owner.
--   * non-owner member (invited)     => always complete (skip wizard)
--   * owner                          => workspace.onboarding_completed
--   * no membership yet (mid-signup) => not complete (show wizard)
--
-- "Owner" is workspace_members.role = 'owner' (authoritative — ownership
-- transfer updates the role, NOT workspaces.owner_id, which goes stale).
-- profiles.onboarding_completed is now dead but left in place; dropping
-- it is a separate cleanup.
-- ============================================================

begin;

alter table public.workspaces
  add column if not exists onboarding_completed boolean not null default false;

-- Backfill: a workspace is onboarded if its current owner had completed
-- onboarding under the old per-user flag.
update public.workspaces w
set onboarding_completed = true
from public.workspace_members m
join public.profiles p on p.id = m.user_id
where m.workspace_id = w.id
  and m.role = 'owner'
  and p.onboarding_completed = true;

-- Read side: workspace-scoped, owner-gated.
create or replace function public.api_onboarding_status()
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  select case
    -- No membership yet (mid-signup): needs onboarding.
    when not exists (
      select 1 from public.workspace_members where user_id = auth.uid()
    ) then false
    -- Owner of a workspace: gate on that workspace's flag.
    when exists (
      select 1 from public.workspace_members
      where user_id = auth.uid() and role = 'owner'
    ) then coalesce((
      select w.onboarding_completed
      from public.workspaces w
      join public.workspace_members m on m.workspace_id = w.id
      where m.user_id = auth.uid() and m.role = 'owner'
      limit 1
    ), false)
    -- Member but not owner (invited): never onboard.
    else true
  end;
$$;

revoke all on function public.api_onboarding_status() from public;
grant execute on function public.api_onboarding_status() to authenticated;

-- Write side: owner finishing the wizard marks their workspace complete.
create or replace function public.api_complete_onboarding()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.workspaces w
  set onboarding_completed = true
  from public.workspace_members m
  where m.workspace_id = w.id
    and m.user_id = auth.uid()
    and m.role = 'owner';
end;
$$;

revoke all on function public.api_complete_onboarding() from public;
grant execute on function public.api_complete_onboarding() to authenticated;

commit;

notify pgrst, 'reload schema';
