-- Phase 2b: Time Sessions — RPC functions

------------------------------------------------------------------------
-- 1) api_list_time_sessions — role-based view (admin vs employee)
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api_list_time_sessions(
  p_filter    text DEFAULT 'week',
  p_date_from text DEFAULT NULL,
  p_date_to   text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws       uuid := get_user_workspace_id();
  v_role     text := get_user_workspace_role();
  v_uid      uuid := auth.uid();
  v_from     timestamptz;
  v_to       timestamptz;
  v_sessions json;
  v_members  json;
  v_active   json;
  v_active_count int;
  v_paused_count int;
  v_is_admin boolean;
  v_member_id uuid;
  v_today_start timestamptz;
  v_today_secs  int;
  v_active_session json;
BEGIN
  -- Calculate date range
  IF p_filter = 'custom' AND p_date_from IS NOT NULL THEN
    v_from := p_date_from::timestamptz;
    v_to := COALESCE(p_date_to::timestamptz, now());
  ELSIF p_filter = 'today' THEN
    v_from := date_trunc('day', now());
    v_to := now();
  ELSIF p_filter = 'month' THEN
    v_from := date_trunc('month', now());
    v_to := now();
  ELSE -- 'week'
    v_from := date_trunc('week', now());
    v_to := now();
  END IF;

  v_is_admin := (v_role IN ('owner', 'admin'));

  IF v_is_admin THEN
    -- Admin view: all workspace members and sessions
    SELECT COALESCE(json_agg(json_build_object(
      'id', wmd.id, 'user_id', wmd.user_id, 'role', wmd.role,
      'email', wmd.email, 'display_name', wmd.display_name,
      'avatar_url', wmd.avatar_url
    )), '[]'::json) INTO v_members
    FROM workspace_member_details wmd
    WHERE wmd.workspace_id = v_ws;

    SELECT COALESCE(json_agg(s ORDER BY s.clocked_in_at DESC), '[]'::json) INTO v_sessions
    FROM (
      SELECT ts.*, wmd.email AS member_email, wmd.display_name AS member_name,
        (SELECT json_build_object('edited_at', tse.edited_at, 'edited_by_user_id', tse.edited_by_user_id)
         FROM time_session_edits tse WHERE tse.session_id = ts.id ORDER BY tse.edited_at DESC LIMIT 1
        ) AS last_edit
      FROM time_sessions ts
      LEFT JOIN workspace_member_details wmd ON wmd.user_id = ts.agent_id AND wmd.workspace_id = v_ws
      WHERE ts.workspace_id = v_ws
        AND ts.clocked_in_at >= v_from
        AND ts.clocked_in_at <= v_to
    ) s;

    -- Active/paused counts
    SELECT
      count(*) FILTER (WHERE status = 'active'),
      count(*) FILTER (WHERE status = 'paused')
    INTO v_active_count, v_paused_count
    FROM time_sessions
    WHERE workspace_id = v_ws AND clocked_out_at IS NULL;

    RETURN json_build_object(
      'sessions', v_sessions,
      'members', v_members,
      'active_count', v_active_count,
      'paused_count', v_paused_count,
      'from', v_from,
      'to', v_to,
      'is_client_admin', true
    );
  ELSE
    -- Employee view: own sessions only
    SELECT id INTO v_member_id FROM workspace_members
    WHERE workspace_id = v_ws AND user_id = v_uid;

    SELECT COALESCE(json_agg(s ORDER BY s.clocked_in_at DESC), '[]'::json) INTO v_sessions
    FROM (
      SELECT * FROM time_sessions
      WHERE workspace_id = v_ws AND agent_id = v_uid
        AND clocked_in_at >= v_from AND clocked_in_at <= v_to
    ) s;

    -- Active session
    SELECT row_to_json(ts) INTO v_active_session
    FROM time_sessions ts
    WHERE ts.workspace_id = v_ws AND ts.agent_id = v_uid AND ts.clocked_out_at IS NULL
    LIMIT 1;

    -- Today's total seconds
    v_today_start := date_trunc('day', now());
    SELECT COALESCE(sum(
      EXTRACT(EPOCH FROM (COALESCE(clocked_out_at, now()) - clocked_in_at))::int - COALESCE(paused_seconds, 0)
    ), 0)::int INTO v_today_secs
    FROM time_sessions
    WHERE workspace_id = v_ws AND agent_id = v_uid
      AND clocked_in_at >= v_today_start
      AND clocked_out_at IS NOT NULL;

    RETURN json_build_object(
      'sessions', v_sessions,
      'member', json_build_object('id', v_member_id, 'role', v_role),
      'active_session', v_active_session,
      'today_seconds', v_today_secs,
      'from', v_from,
      'to', v_to,
      'is_admin', false
    );
  END IF;
END;
$$;

------------------------------------------------------------------------
-- 2) api_time_clock_in
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api_time_clock_in()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws      uuid := get_user_workspace_id();
  v_uid     uuid := auth.uid();
  v_existing record;
  v_session  record;
BEGIN
  PERFORM check_write_access(v_ws);

  SELECT * INTO v_existing
  FROM time_sessions
  WHERE workspace_id = v_ws AND agent_id = v_uid AND clocked_out_at IS NULL
  LIMIT 1;

  IF v_existing.id IS NOT NULL THEN
    RETURN json_build_object('session', row_to_json(v_existing), 'already_active', true);
  END IF;

  INSERT INTO time_sessions (agent_id, workspace_id, status, active_seconds, idle_seconds, paused_seconds)
  VALUES (v_uid, v_ws, 'active', 0, 0, 0)
  RETURNING * INTO v_session;

  RETURN json_build_object('session', row_to_json(v_session));
END;
$$;

------------------------------------------------------------------------
-- 3) api_time_pause
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api_time_pause(p_session_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws  uuid := get_user_workspace_id();
  v_uid uuid := auth.uid();
  v_found boolean;
BEGIN
  PERFORM check_write_access(v_ws);

  UPDATE time_sessions
  SET status = 'paused', paused_at = now()
  WHERE id = p_session_id AND workspace_id = v_ws AND agent_id = v_uid AND clocked_out_at IS NULL
  RETURNING true INTO v_found;

  IF v_found IS NULL THEN
    RAISE EXCEPTION 'Session not found or already ended' USING HINT = 'not_found';
  END IF;

  RETURN json_build_object('ok', true);
END;
$$;

------------------------------------------------------------------------
-- 4) api_time_resume
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api_time_resume(p_session_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws     uuid := get_user_workspace_id();
  v_uid    uuid := auth.uid();
  v_session record;
  v_pause_duration int;
BEGIN
  PERFORM check_write_access(v_ws);

  SELECT paused_at, paused_seconds INTO v_session
  FROM time_sessions
  WHERE id = p_session_id AND workspace_id = v_ws AND agent_id = v_uid AND clocked_out_at IS NULL;

  IF v_session.paused_at IS NULL THEN
    RAISE EXCEPTION 'Session not found or not paused' USING HINT = 'not_found';
  END IF;

  v_pause_duration := EXTRACT(EPOCH FROM (now() - v_session.paused_at))::int;

  UPDATE time_sessions
  SET status = 'active',
      paused_at = NULL,
      paused_seconds = COALESCE(v_session.paused_seconds, 0) + v_pause_duration
  WHERE id = p_session_id AND workspace_id = v_ws;

  RETURN json_build_object('ok', true, 'paused_seconds', COALESCE(v_session.paused_seconds, 0) + v_pause_duration);
END;
$$;

------------------------------------------------------------------------
-- 5) api_time_clock_out
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api_time_clock_out(
  p_session_id      uuid,
  p_emails_answered int     DEFAULT NULL,
  p_what_went_well  text    DEFAULT NULL,
  p_needs_attention text    DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws      uuid := get_user_workspace_id();
  v_uid     uuid := auth.uid();
  v_session record;
  v_final_paused int;
  v_result  record;
BEGIN
  PERFORM check_write_access(v_ws);

  SELECT paused_at, paused_seconds INTO v_session
  FROM time_sessions
  WHERE id = p_session_id AND workspace_id = v_ws AND agent_id = v_uid AND clocked_out_at IS NULL;

  IF v_session IS NULL THEN
    RAISE EXCEPTION 'Session not found or already ended' USING HINT = 'not_found';
  END IF;

  v_final_paused := COALESCE(v_session.paused_seconds, 0);
  IF v_session.paused_at IS NOT NULL THEN
    v_final_paused := v_final_paused + EXTRACT(EPOCH FROM (now() - v_session.paused_at))::int;
  END IF;

  UPDATE time_sessions SET
    clocked_out_at = now(),
    status = 'completed',
    paused_at = NULL,
    paused_seconds = v_final_paused,
    emails_answered = p_emails_answered,
    what_went_well = p_what_went_well,
    needs_attention = p_needs_attention
  WHERE id = p_session_id AND workspace_id = v_ws
  RETURNING * INTO v_result;

  RETURN json_build_object('session', row_to_json(v_result));
END;
$$;

------------------------------------------------------------------------
-- 6) api_time_heartbeat
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api_time_heartbeat(p_session_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws     uuid := get_user_workspace_id();
  v_uid    uuid := auth.uid();
  v_status text;
  v_active int;
BEGIN
  SELECT status, active_seconds INTO v_status, v_active
  FROM time_sessions
  WHERE id = p_session_id AND workspace_id = v_ws AND agent_id = v_uid AND clocked_out_at IS NULL;

  IF v_status IS NULL THEN
    RETURN json_build_object('ok', false);
  END IF;

  IF v_status <> 'paused' THEN
    UPDATE time_sessions
    SET active_seconds = COALESCE(v_active, 0) + 30
    WHERE id = p_session_id AND workspace_id = v_ws;
  END IF;

  RETURN json_build_object('ok', true);
END;
$$;

------------------------------------------------------------------------
-- 7) api_edit_time_session — admin-only with audit trail
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api_edit_time_session(
  p_session_id       uuid,
  p_clocked_in_at    text    DEFAULT NULL,
  p_clocked_out_at   text    DEFAULT NULL,
  p_emails_answered  int     DEFAULT NULL,
  p_what_went_well   text    DEFAULT NULL,
  p_needs_attention  text    DEFAULT NULL,
  p_reason           text    DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws       uuid := get_user_workspace_id();
  v_role     text := get_user_workspace_role();
  v_uid      uuid := auth.uid();
  v_before   record;
  v_after    record;
  v_audited  boolean := false;
BEGIN
  IF v_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'FORBIDDEN' USING HINT = 'Only owners and admins can edit sessions.';
  END IF;

  PERFORM check_write_access(v_ws);

  SELECT * INTO v_before
  FROM time_sessions
  WHERE id = p_session_id AND workspace_id = v_ws;

  IF v_before.id IS NULL THEN
    RAISE EXCEPTION 'Session not found' USING HINT = 'not_found';
  END IF;

  UPDATE time_sessions SET
    clocked_in_at  = COALESCE(p_clocked_in_at::timestamptz, clocked_in_at),
    clocked_out_at = CASE WHEN p_clocked_out_at IS NOT NULL THEN p_clocked_out_at::timestamptz ELSE clocked_out_at END,
    emails_answered = COALESCE(p_emails_answered, emails_answered),
    what_went_well  = COALESCE(p_what_went_well, what_went_well),
    needs_attention = COALESCE(p_needs_attention, needs_attention)
  WHERE id = p_session_id AND workspace_id = v_ws
  RETURNING * INTO v_after;

  -- Audit trail (best-effort)
  BEGIN
    INSERT INTO time_session_edits (session_id, edited_by_user_id, reason, before_json, after_json)
    VALUES (p_session_id, v_uid, p_reason, row_to_json(v_before)::jsonb, row_to_json(v_after)::jsonb);
    v_audited := true;
  EXCEPTION WHEN OTHERS THEN
    v_audited := false;
  END;

  RETURN json_build_object('session', row_to_json(v_after), 'audited', v_audited);
END;
$$;

------------------------------------------------------------------------
-- Grants
------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION api_list_time_sessions(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION api_time_clock_in() TO authenticated;
GRANT EXECUTE ON FUNCTION api_time_pause(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION api_time_resume(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION api_time_clock_out(uuid, int, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION api_time_heartbeat(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION api_edit_time_session(uuid, text, text, int, text, text, text) TO authenticated;
