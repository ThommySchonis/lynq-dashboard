-- ============================================================
-- api_get_eod_impact — per-member, per-day activity for the
-- End-of-Day modal's "Today's impact" tiles.
--
-- Bridges two id spaces on purpose:
--   support_events.agent_id = workspace_members.id
--   ai_drafts.resolved_by   = auth.users.id
-- Workspace + member are derived from the caller (auth.uid()),
-- mirroring api_list_time_sessions' member resolution.
-- ============================================================

CREATE OR REPLACE FUNCTION api_get_eod_impact()
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
  v_tickets   integer;
  v_messages  integer;
  v_drafts    integer;
BEGIN
  -- Resolve the caller's workspace_members.id (same lookup as
  -- api_list_time_sessions). LIMIT 1 guards multi-membership.
  SELECT id INTO v_member_id
  FROM workspace_members
  WHERE workspace_id = v_ws AND user_id = v_uid
  LIMIT 1;

  SELECT count(*) INTO v_tickets
  FROM support_events
  WHERE workspace_id = v_ws
    AND agent_id = v_member_id
    AND event_type = 'ticket_resolved'
    AND created_at::date = current_date;

  SELECT count(*) INTO v_messages
  FROM support_events
  WHERE workspace_id = v_ws
    AND agent_id = v_member_id
    AND event_type = 'message_sent'
    AND created_at::date = current_date;

  -- Drafts this agent actioned today (approved / edited / auto-resolved).
  -- resolved_by is null for un-actioned drafts, so pending/other-agent
  -- drafts are naturally excluded.
  SELECT count(*) INTO v_drafts
  FROM ai_drafts
  WHERE workspace_id = v_ws
    AND resolved_by = v_uid
    AND resolved_at::date = current_date;

  RETURN json_build_object(
    'tickets_resolved',    coalesce(v_tickets, 0),
    'messages_sent',       coalesce(v_messages, 0),
    'emma_drafts_handled', coalesce(v_drafts, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION api_get_eod_impact() TO authenticated;

-- ── Verification ─────────────────────────────────────────────────────
-- Behavioral counts depend on auth.uid() (null in a migration context),
-- so this asserts the function exists and is grantable. Count correctness
-- is verified from the running app (Task 5 finishing verification).
do $$
begin
  assert (select count(*) from pg_proc
          where proname = 'api_get_eod_impact') = 1,
    'api_get_eod_impact was not created';
  raise notice 'api_get_eod_impact migration OK';
end;
$$;
