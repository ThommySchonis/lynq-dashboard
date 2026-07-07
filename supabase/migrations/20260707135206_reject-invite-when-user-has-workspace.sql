-- Reject accepting a workspace invite when the user already belongs to a
-- workspace (their own or another).
--
-- The app has no workspace switcher: a user only ever sees the single workspace
-- their identity resolves to (see pickPrimaryMembership / get_user_workspace_id).
-- So a second membership is unreachable dead state and was the source of the
-- "store connected but stores tab empty" divergence. Invites are therefore only
-- valid for users WITHOUT an existing workspace.
--
-- This guard is the authoritative backstop (atomic, can't be bypassed). A
-- send-time check in routes/workspace-actions.ts gives the admin earlier
-- feedback, but this is what actually prevents the bad state.
--
-- The public signup-via-invite path (routes/invites.ts `/signup`) creates a
-- brand-new user with ZERO memberships and then calls this RPC, so that flow
-- passes the guard and still works — it is how legitimately-invited users get
-- their (single) workspace.

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

  -- Guard: the accepting user must not already belong to any workspace.
  if exists (select 1 from workspace_members where user_id = p_user_id) then
    return jsonb_build_object('error', 'already_member');
  end if;

  begin
    insert into workspace_members (workspace_id, user_id, role)
      values (v_invite.workspace_id, p_user_id, v_invite.role)
      returning id into v_member_id;
  exception when unique_violation then
    null;  -- already a member of this workspace; still OK
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

grant execute on function public.accept_workspace_invite(text, uuid) to authenticated, service_role;

-- Force PostgREST to reload the schema cache so supabaseAdmin.rpc() sees the
-- new definition immediately instead of after the next pgrst restart.
notify pgrst, 'reload schema';
