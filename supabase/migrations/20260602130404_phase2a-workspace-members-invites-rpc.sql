-- Phase 2a: Workspace, Members, Invites, Transfer — RPC functions

------------------------------------------------------------------------
-- 1) api_get_workspace
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api_get_workspace()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws   uuid := get_user_workspace_id();
  v_role text := get_user_workspace_role();
  v_result json;
BEGIN
  SELECT json_build_object(
    'workspace', row_to_json(w),
    'role', v_role
  ) INTO v_result
  FROM (
    SELECT id, name, slug, logo_url, timezone, locale, date_format,
           time_format, first_day_of_week, show_order_data, auto_translate,
           allow_deletion, created_at, updated_at
    FROM workspaces WHERE id = v_ws
  ) w;

  RETURN v_result;
END;
$$;

------------------------------------------------------------------------
-- 2) api_update_workspace
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api_update_workspace(
  p_name              text    DEFAULT NULL,
  p_slug              text    DEFAULT NULL,
  p_logo_url          text    DEFAULT NULL,
  p_timezone          text    DEFAULT NULL,
  p_locale            text    DEFAULT NULL,
  p_date_format       text    DEFAULT NULL,
  p_time_format       text    DEFAULT NULL,
  p_first_day_of_week text    DEFAULT NULL,
  p_show_order_data   boolean DEFAULT NULL,
  p_auto_translate    boolean DEFAULT NULL,
  p_allow_deletion    boolean DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws   uuid := get_user_workspace_id();
  v_role text := get_user_workspace_role();
  v_dup  uuid;
  v_result record;
BEGIN
  IF v_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'FORBIDDEN' USING HINT = 'Only owners and admins can update workspace settings.';
  END IF;

  PERFORM check_write_access(v_ws);

  IF p_slug IS NOT NULL THEN
    SELECT id INTO v_dup FROM workspaces WHERE slug = p_slug AND id <> v_ws;
    IF v_dup IS NOT NULL THEN
      RAISE EXCEPTION 'Slug already taken' USING HINT = 'slug_taken';
    END IF;
  END IF;

  UPDATE workspaces SET
    name              = COALESCE(p_name, name),
    slug              = COALESCE(p_slug, slug),
    logo_url          = COALESCE(p_logo_url, logo_url),
    timezone          = COALESCE(p_timezone, timezone),
    locale            = COALESCE(p_locale, locale),
    date_format       = COALESCE(p_date_format, date_format),
    time_format       = COALESCE(p_time_format, time_format),
    first_day_of_week = COALESCE(p_first_day_of_week, first_day_of_week),
    show_order_data   = COALESCE(p_show_order_data, show_order_data),
    auto_translate    = COALESCE(p_auto_translate, auto_translate),
    allow_deletion    = COALESCE(p_allow_deletion, allow_deletion)
  WHERE id = v_ws
  RETURNING * INTO v_result;

  RETURN json_build_object('workspace', row_to_json(v_result));
END;
$$;

------------------------------------------------------------------------
-- 3) api_list_workspace_members — members + invites + meta
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api_list_workspace_members(
  p_search text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws         uuid := get_user_workspace_id();
  v_role       text := get_user_workspace_role();
  v_uid        uuid := auth.uid();
  v_members    json;
  v_invites    json;
  v_ws_name    text;
  v_seats_used int;
  v_is_owner   boolean;
BEGIN
  SELECT name INTO v_ws_name FROM workspaces WHERE id = v_ws;

  IF p_search IS NOT NULL AND p_search <> '' THEN
    SELECT COALESCE(json_agg(m ORDER BY m.joined_at DESC), '[]'::json) INTO v_members
    FROM (
      SELECT wmd.id, wmd.user_id, wmd.role, wmd.joined_at, wmd.email,
             wmd.display_name, wmd.avatar_url, wmd.two_factor_enabled
      FROM workspace_member_details wmd
      WHERE wmd.workspace_id = v_ws
        AND (wmd.email ILIKE '%' || p_search || '%'
             OR wmd.display_name ILIKE '%' || p_search || '%')
    ) m;
  ELSE
    SELECT COALESCE(json_agg(m ORDER BY m.joined_at DESC), '[]'::json) INTO v_members
    FROM (
      SELECT wmd.id, wmd.user_id, wmd.role, wmd.joined_at, wmd.email,
             wmd.display_name, wmd.avatar_url, wmd.two_factor_enabled
      FROM workspace_member_details wmd
      WHERE wmd.workspace_id = v_ws
    ) m;
  END IF;

  SELECT COALESCE(json_agg(i ORDER BY i.created_at DESC), '[]'::json) INTO v_invites
  FROM (
    SELECT wid.id, wid.email, wid.role, wid.token, wid.created_at, wid.sent_at,
           wid.expires_at, wid.invited_by, wid.inviter_email, wid.inviter_name
    FROM workspace_invite_details wid
    WHERE wid.workspace_id = v_ws AND wid.accepted_at IS NULL
  ) i;

  SELECT count(*)::int INTO v_seats_used
  FROM workspace_members WHERE workspace_id = v_ws;

  v_is_owner := (v_role = 'owner');

  RETURN json_build_object(
    'members', v_members,
    'invites', v_invites,
    'currentUserRole', v_role,
    'isOwner', v_is_owner,
    'workspaceName', v_ws_name,
    'seatsUsed', v_seats_used,
    'seatLimit', NULL
  );
END;
$$;

------------------------------------------------------------------------
-- 4) api_update_member_role
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api_update_member_role(
  p_member_id uuid,
  p_role      text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws     uuid := get_user_workspace_id();
  v_role   text := get_user_workspace_role();
  v_uid    uuid := auth.uid();
  v_target record;
  v_other_owners int;
BEGIN
  IF v_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'FORBIDDEN' USING HINT = 'Only owners and admins can change roles.';
  END IF;

  PERFORM check_write_access(v_ws);

  SELECT id, user_id, role INTO v_target
  FROM workspace_members
  WHERE id = p_member_id AND workspace_id = v_ws;

  IF v_target.id IS NULL THEN
    RAISE EXCEPTION 'Member not found' USING HINT = 'not_found';
  END IF;

  IF v_target.user_id = v_uid THEN
    RAISE EXCEPTION 'Cannot change your own role' USING HINT = 'self_change';
  END IF;

  IF p_role = 'owner' AND v_role <> 'owner' THEN
    RAISE EXCEPTION 'Only owners can promote to owner' USING HINT = 'forbidden';
  END IF;

  IF v_target.role = 'owner' AND v_role <> 'owner' THEN
    RAISE EXCEPTION 'Only owners can demote an owner' USING HINT = 'forbidden';
  END IF;

  IF v_target.role = 'owner' AND p_role <> 'owner' THEN
    SELECT count(*) INTO v_other_owners
    FROM workspace_members
    WHERE workspace_id = v_ws AND role = 'owner' AND id <> v_target.id;

    IF v_other_owners < 1 THEN
      RAISE EXCEPTION 'Cannot demote the last owner' USING HINT = 'last_owner';
    END IF;
  END IF;

  IF v_target.role = p_role THEN
    RETURN json_build_object('ok', true, 'noop', true);
  END IF;

  UPDATE workspace_members SET role = p_role
  WHERE id = p_member_id AND workspace_id = v_ws;

  RETURN json_build_object('ok', true);
END;
$$;

------------------------------------------------------------------------
-- 5) api_remove_member
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api_remove_member(p_member_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws     uuid := get_user_workspace_id();
  v_role   text := get_user_workspace_role();
  v_uid    uuid := auth.uid();
  v_target record;
  v_other_owners int;
BEGIN
  IF v_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'FORBIDDEN' USING HINT = 'Only owners and admins can remove members.';
  END IF;

  PERFORM check_write_access(v_ws);

  SELECT id, user_id, role INTO v_target
  FROM workspace_members
  WHERE id = p_member_id AND workspace_id = v_ws;

  IF v_target.id IS NULL THEN
    RAISE EXCEPTION 'Member not found' USING HINT = 'not_found';
  END IF;

  IF v_target.user_id = v_uid THEN
    RAISE EXCEPTION 'Cannot remove yourself' USING HINT = 'self_remove';
  END IF;

  IF v_role = 'admin' AND v_target.role IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Admins cannot remove owners or other admins' USING HINT = 'forbidden';
  END IF;

  IF v_target.role = 'owner' THEN
    SELECT count(*) INTO v_other_owners
    FROM workspace_members
    WHERE workspace_id = v_ws AND role = 'owner' AND id <> v_target.id;

    IF v_other_owners < 1 THEN
      RAISE EXCEPTION 'Cannot remove the last owner' USING HINT = 'last_owner';
    END IF;
  END IF;

  DELETE FROM workspace_members
  WHERE id = p_member_id AND workspace_id = v_ws;

  RETURN json_build_object('ok', true, 'removed_id', p_member_id);
END;
$$;

------------------------------------------------------------------------
-- 6) api_revoke_invite
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api_revoke_invite(p_invite_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws    uuid := get_user_workspace_id();
  v_role  text := get_user_workspace_role();
  v_email text;
BEGIN
  IF v_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'FORBIDDEN' USING HINT = 'Only owners and admins can revoke invites.';
  END IF;

  PERFORM check_write_access(v_ws);

  SELECT email INTO v_email
  FROM workspace_invites
  WHERE id = p_invite_id AND workspace_id = v_ws;

  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Invite not found' USING HINT = 'not_found';
  END IF;

  DELETE FROM workspace_invites
  WHERE id = p_invite_id AND workspace_id = v_ws;

  RETURN json_build_object('ok', true, 'email', v_email);
END;
$$;

------------------------------------------------------------------------
-- 7) api_get_pending_transfer
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api_get_pending_transfer()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws       uuid := get_user_workspace_id();
  v_transfer record;
  v_target   uuid;
BEGIN
  SELECT * INTO v_transfer
  FROM ownership_transfers
  WHERE workspace_id = v_ws AND status = 'pending'
  LIMIT 1;

  IF v_transfer.id IS NULL THEN
    RETURN json_build_object('transfer', NULL);
  END IF;

  -- Lazy expiration
  IF v_transfer.expires_at <= now() THEN
    UPDATE ownership_transfers
    SET status = 'expired', resolved_at = now()
    WHERE id = v_transfer.id;
    RETURN json_build_object('transfer', NULL);
  END IF;

  -- Check target still in workspace
  SELECT id INTO v_target
  FROM workspace_members
  WHERE workspace_id = v_ws AND user_id = v_transfer.to_user_id;

  IF v_target IS NULL THEN
    UPDATE ownership_transfers
    SET status = 'cancelled', resolved_at = now()
    WHERE id = v_transfer.id;
    RETURN json_build_object('transfer', NULL);
  END IF;

  RETURN json_build_object('transfer', row_to_json(v_transfer));
END;
$$;

------------------------------------------------------------------------
-- 8) api_cancel_transfer
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api_cancel_transfer()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws       uuid := get_user_workspace_id();
  v_uid      uuid := auth.uid();
  v_transfer record;
BEGIN
  SELECT * INTO v_transfer
  FROM ownership_transfers
  WHERE workspace_id = v_ws AND status = 'pending'
  LIMIT 1;

  IF v_transfer.id IS NULL THEN
    RAISE EXCEPTION 'No pending transfer found' USING HINT = 'not_found';
  END IF;

  IF v_transfer.from_user_id <> v_uid THEN
    RAISE EXCEPTION 'Only the initiator can cancel the transfer' USING HINT = 'forbidden';
  END IF;

  UPDATE ownership_transfers
  SET status = 'cancelled', resolved_at = now()
  WHERE id = v_transfer.id;

  RETURN json_build_object('ok', true);
END;
$$;

------------------------------------------------------------------------
-- 9) api_decline_transfer
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api_decline_transfer()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws       uuid := get_user_workspace_id();
  v_uid      uuid := auth.uid();
  v_transfer record;
BEGIN
  SELECT * INTO v_transfer
  FROM ownership_transfers
  WHERE workspace_id = v_ws AND status = 'pending'
  LIMIT 1;

  IF v_transfer.id IS NULL THEN
    RAISE EXCEPTION 'No pending transfer found' USING HINT = 'not_found';
  END IF;

  IF v_transfer.to_user_id <> v_uid THEN
    RAISE EXCEPTION 'Only the target member can decline the transfer' USING HINT = 'forbidden';
  END IF;

  UPDATE ownership_transfers
  SET status = 'declined', resolved_at = now()
  WHERE id = v_transfer.id;

  RETURN json_build_object('ok', true);
END;
$$;

------------------------------------------------------------------------
-- 10) api_accept_transfer — wraps existing accept_ownership_transfer RPC
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api_accept_transfer()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws       uuid := get_user_workspace_id();
  v_uid      uuid := auth.uid();
  v_transfer record;
BEGIN
  SELECT * INTO v_transfer
  FROM ownership_transfers
  WHERE workspace_id = v_ws AND status = 'pending'
  LIMIT 1;

  IF v_transfer.id IS NULL THEN
    RAISE EXCEPTION 'No pending transfer found' USING HINT = 'not_found';
  END IF;

  IF v_transfer.to_user_id <> v_uid THEN
    RAISE EXCEPTION 'Only the target member can accept the transfer' USING HINT = 'forbidden';
  END IF;

  -- Lazy expiration
  IF v_transfer.expires_at <= now() THEN
    UPDATE ownership_transfers
    SET status = 'expired', resolved_at = now()
    WHERE id = v_transfer.id;
    RAISE EXCEPTION 'Transfer has expired' USING HINT = 'expired';
  END IF;

  PERFORM accept_ownership_transfer(v_transfer.id);

  RETURN json_build_object('ok', true);
END;
$$;

------------------------------------------------------------------------
-- 11) api_get_invite_details — public (anon) endpoint
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api_get_invite_details(p_token text)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite record;
  v_ws_name text;
BEGIN
  SELECT wid.id, wid.email, wid.role, wid.expires_at, wid.accepted_at,
         wid.workspace_id, wid.inviter_email, wid.inviter_name
  INTO v_invite
  FROM workspace_invite_details wid
  WHERE wid.token = p_token;

  IF v_invite.id IS NULL THEN
    RETURN json_build_object('error', 'not_found');
  END IF;

  IF v_invite.accepted_at IS NOT NULL THEN
    RETURN json_build_object('error', 'already_accepted');
  END IF;

  IF v_invite.expires_at <= now() THEN
    RETURN json_build_object('error', 'expired');
  END IF;

  SELECT name INTO v_ws_name FROM workspaces WHERE id = v_invite.workspace_id;

  RETURN json_build_object(
    'ok', true,
    'invite_email', v_invite.email,
    'workspace_name', v_ws_name,
    'role', v_invite.role,
    'inviter_name', v_invite.inviter_name,
    'expires_at', v_invite.expires_at,
    'already_accepted', false
  );
END;
$$;

------------------------------------------------------------------------
-- Grants
------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION api_get_workspace() TO authenticated;
GRANT EXECUTE ON FUNCTION api_update_workspace(text, text, text, text, text, text, text, text, boolean, boolean, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION api_list_workspace_members(text) TO authenticated;
GRANT EXECUTE ON FUNCTION api_update_member_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION api_remove_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION api_revoke_invite(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION api_get_pending_transfer() TO authenticated;
GRANT EXECUTE ON FUNCTION api_cancel_transfer() TO authenticated;
GRANT EXECUTE ON FUNCTION api_decline_transfer() TO authenticated;
GRANT EXECUTE ON FUNCTION api_accept_transfer() TO authenticated;
GRANT EXECUTE ON FUNCTION api_get_invite_details(text) TO authenticated, anon;
