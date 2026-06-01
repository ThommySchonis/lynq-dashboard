-- ============================================================
-- provision_workspace — uitgebreid voor trial onboarding flow.
--
-- Voegt toe aan de RPC:
--   - workspaces.subscription_status = 'trial' (was niet expliciet)
--   - workspaces.trial_ends_at       = now() + 7 days
--   - user_profiles row (idempotent UPSERT)
--
-- Behoudt het bestaande jsonb-return contract { workspace_id, member_id }
-- zodat lib/auth.js Path C ongewijzigd blijft consumeren.
--
-- Deviation van de drafted spec: spec had `returns uuid`, maar dat
-- breekt de bestaande lib/auth.js consumer (verwacht result.workspace_id
-- en result.member_id) en vereist DROP FUNCTION + re-GRANT (PostgreSQL
-- staat geen return-type wijziging via CREATE OR REPLACE toe). Behoud
-- van jsonb is volledig backwards-compatible.
--
-- Idempotent + transactional. Run handmatig in Supabase SQL editor
-- (project cvrzvhnsltjubmfkcxql).
-- ============================================================

begin;

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
  -- Workspace met 7-day trial. subscription_status default is al 'trial'
  -- (Phase 4 schema check), maar we zetten 'm expliciet voor duidelijkheid
  -- en defensieve robuustheid mocht de default ooit veranderen.
  insert into public.workspaces (
    name,
    owner_id,
    subscription_status,
    trial_ends_at
  )
  values (
    p_workspace_name,
    p_user_id,
    'trial',
    now() + interval '7 days'
  )
  returning id into v_workspace_id;

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
    where proname     = 'provision_workspace'
      and pronamespace = 'public'::regnamespace
  ) then
    raise exception 'provision_workspace function missing';
  end if;
  raise notice 'OK — provision_workspace updated with trial_ends_at + user_profile creation';
end $$;

commit;

notify pgrst, 'reload schema';
