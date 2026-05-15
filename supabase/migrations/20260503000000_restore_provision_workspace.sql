-- ============================================================
-- Restore: provision_workspace + accept_workspace_invite
--
-- These were created in 20260502 but are missing from the schema
-- cache (likely dropped by a `drop ... cascade` or similar).
--
-- lib/auth.js calls provision_workspace on every cold-start where
-- the user has no workspace yet — its absence causes getAuthContext
-- to return null → API responds 401 Unauthorized.
--
-- Run this in Supabase SQL Editor: Database → SQL Editor → New query
-- ============================================================

-- ---- provision_workspace ----------------------------------------
create or replace function public.provision_workspace(
  p_user_id        uuid,
  p_workspace_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace_id uuid;
  v_member_id    uuid;
begin
  insert into workspaces (name, owner_id)
    values (p_workspace_name, p_user_id)
    returning id into v_workspace_id;

  insert into workspace_members (workspace_id, user_id, role)
    values (v_workspace_id, p_user_id, 'owner')
    returning id into v_member_id;

  return jsonb_build_object(
    'workspace_id', v_workspace_id,
    'member_id',    v_member_id
  );
end;
$$;

-- ---- accept_workspace_invite (defensive recreate) ---------------
create or replace function public.accept_workspace_invite(
  p_token   text,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite    record;
  v_member_id uuid;
begin
  select * into v_invite
    from workspace_invites
    where token = p_token
    for update;

  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;

  if v_invite.accepted_at is not null then
    return jsonb_build_object('ok', true, 'workspace_id', v_invite.workspace_id);
  end if;

  if v_invite.expires_at < now() then
    return jsonb_build_object('error', 'expired');
  end if;

  begin
    insert into workspace_members (workspace_id, user_id, role)
      values (v_invite.workspace_id, p_user_id, v_invite.role)
      returning id into v_member_id;
  exception when unique_violation then
    null;  -- already a member; still OK
  end;

  update workspace_invites
    set accepted_at = now()
    where id = v_invite.id;

  return jsonb_build_object(
    'ok',           true,
    'workspace_id', v_invite.workspace_id,
    'member_id',    v_member_id
  );
end;
$$;

-- ---- Grants ----------------------------------------------------
-- service_role (used by supabaseAdmin) needs EXECUTE explicitly,
-- because security-definer functions don't grant to it by default.
grant execute on function public.provision_workspace(uuid, text)         to authenticated, service_role;
grant execute on function public.accept_workspace_invite(text, uuid)     to authenticated, service_role;

-- ---- Force PostgREST to reload the schema cache ----------------
-- Without this, the Supabase API client (and supabaseAdmin.rpc())
-- continues to return "function not found" until the next pgrst
-- restart, which can take minutes.
notify pgrst, 'reload schema';
