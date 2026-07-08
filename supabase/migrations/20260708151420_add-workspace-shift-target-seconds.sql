-- Add a per-workspace nominal shift length, replacing the hardcoded 8h the
-- client used to scale the header timer's progress bar (SHIFT_TARGET_SEC in
-- lib/time-tracking-constants.ts — the "B10" backlog item noted there).
--
-- The pill's progress = elapsed / shift_target. Default 28800 (8h) preserves
-- the current visual behavior until a workspace configures a different value.
-- The value is surfaced through api_list_time_sessions (the fetch the Time
-- Tracking page already makes) so no extra request is needed.

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS shift_target_seconds int NOT NULL DEFAULT 28800
    CHECK (shift_target_seconds > 0);

COMMENT ON COLUMN public.workspaces.shift_target_seconds IS
  'Nominal shift length in seconds; scales the time-tracking header progress bar (default 28800 = 8h).';

-- Redefine api_list_time_sessions to include shift_target_seconds in both the
-- admin and employee return objects. Based on the current definition in
-- 20260708091118_add-active-session-to-admin-time-sessions.sql; the only change
-- is the added v_shift_target variable + field. The admin active_session fix
-- from that migration is preserved verbatim.
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
  v_active_count int;
  v_paused_count int;
  v_is_admin boolean;
  v_member_id uuid;
  v_today_start timestamptz;
  v_today_secs  int;
  v_active_session json;
  v_client_name text;
  v_shift_target int;
BEGIN
  -- Nominal shift length for the header progress bar (default 8h).
  SELECT shift_target_seconds INTO v_shift_target
  FROM workspaces WHERE id = v_ws;
  v_shift_target := COALESCE(v_shift_target, 28800);

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
    -- Admin view: all workspace members with per-member aggregates over the
    -- selected window, plus the full session list.
    SELECT COALESCE(json_agg(json_build_object(
      'id',             m.user_id,
      'user_id',        m.user_id,
      'name',           m.display_name,
      'email',          m.email,
      'role',           m.role,
      'worked_seconds', m.worked_seconds,
      'paused_seconds', m.paused_seconds,
      'sessions_count', m.sessions_count,
      'is_active',      m.is_active,
      'is_paused',      m.is_paused
    ) ORDER BY m.display_name), '[]'::json) INTO v_members
    FROM (
      SELECT
        wmd.user_id,
        wmd.display_name,
        wmd.email,
        wmd.role,
        -- Worked seconds within the window: elapsed minus paused, floored at 0.
        COALESCE((
          SELECT sum(GREATEST(
            EXTRACT(EPOCH FROM (COALESCE(ts.clocked_out_at, now()) - ts.clocked_in_at))::int
              - COALESCE(ts.paused_seconds, 0),
            0
          ))::int
          FROM time_sessions ts
          WHERE ts.workspace_id = v_ws AND ts.agent_id = wmd.user_id
            AND ts.clocked_in_at >= v_from AND ts.clocked_in_at <= v_to
        ), 0) AS worked_seconds,
        COALESCE((
          SELECT sum(COALESCE(ts.paused_seconds, 0))::int
          FROM time_sessions ts
          WHERE ts.workspace_id = v_ws AND ts.agent_id = wmd.user_id
            AND ts.clocked_in_at >= v_from AND ts.clocked_in_at <= v_to
        ), 0) AS paused_seconds,
        COALESCE((
          SELECT count(*)::int
          FROM time_sessions ts
          WHERE ts.workspace_id = v_ws AND ts.agent_id = wmd.user_id
            AND ts.clocked_in_at >= v_from AND ts.clocked_in_at <= v_to
        ), 0) AS sessions_count,
        -- Live status is not window-bound: a member is "active" if they have an
        -- open session right now, "paused" if that open session is paused.
        EXISTS (
          SELECT 1 FROM time_sessions ts
          WHERE ts.workspace_id = v_ws AND ts.agent_id = wmd.user_id
            AND ts.clocked_out_at IS NULL
        ) AS is_active,
        EXISTS (
          SELECT 1 FROM time_sessions ts
          WHERE ts.workspace_id = v_ws AND ts.agent_id = wmd.user_id
            AND ts.clocked_out_at IS NULL AND ts.status = 'paused'
        ) AS is_paused
      FROM workspace_member_details wmd
      WHERE wmd.workspace_id = v_ws
    ) m;

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

    -- The logged-in admin's OWN live session, NOT window-bound. Without this the
    -- frontend can only infer it from the date-windowed `sessions` list above,
    -- which misses sessions clocked in before v_from.
    SELECT row_to_json(ts) INTO v_active_session
    FROM time_sessions ts
    WHERE ts.workspace_id = v_ws AND ts.agent_id = v_uid AND ts.clocked_out_at IS NULL
    LIMIT 1;

    -- Workspace/client name for the page subtitle (frontend falls back to
    -- "All clients" when this is absent or null).
    SELECT company_name INTO v_client_name
    FROM clients WHERE workspace_id = v_ws LIMIT 1;

    RETURN json_build_object(
      'sessions', v_sessions,
      'members', v_members,
      'active_count', v_active_count,
      'paused_count', v_paused_count,
      'active_session', v_active_session,
      'client', json_build_object('company_name', v_client_name),
      'shift_target_seconds', v_shift_target,
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
      'shift_target_seconds', v_shift_target,
      'from', v_from,
      'to', v_to,
      'is_admin', false
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION api_list_time_sessions(text, text, text) TO authenticated;
