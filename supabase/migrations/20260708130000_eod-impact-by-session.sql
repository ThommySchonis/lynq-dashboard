-- ============================================================
-- api_get_eod_impact — scope the End-of-Day impact tiles to the
-- SHIFT SESSION being clocked out, not the UTC calendar day.
--
-- Supersedes the zero-arg current_date version (20260708120000):
-- counts events between the session's clocked_in_at and
-- clocked_out_at (or now() while the session is still open), which
-- also removes the UTC-vs-local-day ambiguity.
--
-- Id spaces (unchanged): support_events.agent_id = workspace_members.id;
-- ai_drafts.resolved_by = auth.users.id; time_sessions.agent_id =
-- auth.users.id. Workspace + member derived from the caller.
-- ============================================================

-- Drop the old zero-arg overload so only the session-scoped signature
-- remains (CREATE OR REPLACE with a new arg list would ADD an overload,
-- not replace it).
DROP FUNCTION IF EXISTS api_get_eod_impact();

CREATE OR REPLACE FUNCTION api_get_eod_impact(p_session_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws        uuid := get_user_workspace_id();
  v_uid       uuid := auth.uid();
  v_member_id uuid;
  v_from      timestamptz;
  v_to        timestamptz;
  v_tickets   integer;
  v_messages  integer;
  v_drafts    integer;
BEGIN
  -- Caller's workspace_members.id (for support_events.agent_id).
  SELECT id INTO v_member_id
  FROM workspace_members
  WHERE workspace_id = v_ws AND user_id = v_uid
  LIMIT 1;

  -- Resolve the shift window. The session must belong to the caller
  -- (workspace + agent); time_sessions.agent_id = auth.users.id.
  SELECT clocked_in_at, clocked_out_at
    INTO v_from, v_to
  FROM time_sessions
  WHERE id = p_session_id AND workspace_id = v_ws AND agent_id = v_uid;

  -- Unknown / not-the-caller's session → zeros (never leak other data).
  IF v_from IS NULL THEN
    RETURN json_build_object(
      'tickets_resolved', 0, 'messages_sent', 0, 'emma_drafts_handled', 0
    );
  END IF;

  -- v_to is NULL while the session is still open (the EOD modal is shown
  -- before clock-out), so the window runs from clock-in to "now".
  SELECT count(*) INTO v_tickets
  FROM support_events
  WHERE workspace_id = v_ws
    AND agent_id = v_member_id
    AND event_type = 'ticket_resolved'
    AND created_at >= v_from
    AND (v_to IS NULL OR created_at <= v_to);

  SELECT count(*) INTO v_messages
  FROM support_events
  WHERE workspace_id = v_ws
    AND agent_id = v_member_id
    AND event_type = 'message_sent'
    AND created_at >= v_from
    AND (v_to IS NULL OR created_at <= v_to);

  -- Drafts this agent actioned during the shift.
  SELECT count(*) INTO v_drafts
  FROM ai_drafts
  WHERE workspace_id = v_ws
    AND resolved_by = v_uid
    AND resolved_at >= v_from
    AND (v_to IS NULL OR resolved_at <= v_to);

  RETURN json_build_object(
    'tickets_resolved',    coalesce(v_tickets, 0),
    'messages_sent',       coalesce(v_messages, 0),
    'emma_drafts_handled', coalesce(v_drafts, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION api_get_eod_impact(uuid) TO authenticated;

-- ── Verification ─────────────────────────────────────────────────────
do $$
begin
  assert (select count(*) from pg_proc
          where proname = 'api_get_eod_impact'
            and pronargs = 1) = 1,
    'api_get_eod_impact(uuid) was not created';
  assert (select count(*) from pg_proc
          where proname = 'api_get_eod_impact'
            and pronargs = 0) = 0,
    'old zero-arg api_get_eod_impact was not dropped';
  raise notice 'api_get_eod_impact(uuid) migration OK';
end;
$$;
