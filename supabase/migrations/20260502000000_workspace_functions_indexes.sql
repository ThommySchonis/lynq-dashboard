-- ============================================================
-- provision_workspace: atomically create workspace + owner row
-- ============================================================
create or replace function provision_workspace(p_user_id uuid, p_workspace_name text)
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

-- ============================================================
-- accept_workspace_invite: atomic accept with row-level lock
-- ============================================================
create or replace function accept_workspace_invite(p_token text, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite   workspace_invites;
  v_member_id uuid;
begin
  -- Lock the invite row to prevent concurrent double-accepts
  select * into v_invite
    from workspace_invites
    where token = p_token
    for update;

  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;

  -- Already accepted → idempotent OK
  if v_invite.accepted_at is not null then
    return jsonb_build_object('ok', true, 'workspace_id', v_invite.workspace_id);
  end if;

  if v_invite.expires_at < now() then
    return jsonb_build_object('error', 'expired');
  end if;

  -- Insert membership, ignore unique violation (user already a member)
  begin
    insert into workspace_members (workspace_id, user_id, role)
      values (v_invite.workspace_id, p_user_id, v_invite.role)
      returning id into v_member_id;
  exception when unique_violation then
    -- User is already a member; still mark invite accepted and return OK
    null;
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

-- ============================================================
-- workspace_member_details: public view joining auth.users
-- (auth schema not accessible via PostgREST; view bridges it)
-- ============================================================
create or replace view public.workspace_member_details as
select
  wm.id,
  wm.workspace_id,
  wm.user_id,
  wm.role,
  wm.joined_at,
  u.email,
  coalesce(
    u.raw_user_meta_data->>'name',
    split_part(u.email, '@', 1)
  ) as display_name,
  u.raw_user_meta_data->>'avatar_url' as avatar_url,
  (u.raw_user_meta_data->>'two_factor_enabled')::boolean as two_factor_enabled
from workspace_members wm
join auth.users u on u.id = wm.user_id;

-- Lock down the view — service role only (anon/authenticated must not read it)
revoke all on public.workspace_member_details from anon, authenticated;

-- ============================================================
-- Indexes for scale (100+ members, search, cursor pagination)
-- ============================================================
create index if not exists workspace_members_ws_role_idx
  on workspace_members (workspace_id, role);

create index if not exists workspace_members_ws_joined_id_idx
  on workspace_members (workspace_id, joined_at, id);
