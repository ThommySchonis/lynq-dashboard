-- ============================================================
-- Remove the deprecated emails_answered EOD field. The redesigned
-- clock-out modal no longer collects it (real activity is shown via
-- api_get_eod_impact). Recreate the two write RPCs without
-- p_emails_answered, then drop the column (auto-drops its CHECK).
-- Historical values are intentionally discarded.
-- ============================================================

-- ── api_time_clock_out — drop p_emails_answered (5-arg → 4-arg) ──────
DROP FUNCTION IF EXISTS api_time_clock_out(uuid, int, text, text, text);

CREATE OR REPLACE FUNCTION api_time_clock_out(
  p_session_id      uuid,
  p_what_went_well  text    DEFAULT NULL,
  p_needs_attention text    DEFAULT NULL,
  p_mood            text    DEFAULT NULL
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
    what_went_well = p_what_went_well,
    needs_attention = p_needs_attention,
    mood = p_mood
  WHERE id = p_session_id AND workspace_id = v_ws
  RETURNING * INTO v_result;

  RETURN json_build_object('session', row_to_json(v_result));
END;
$$;

GRANT EXECUTE ON FUNCTION api_time_clock_out(uuid, text, text, text) TO authenticated;

-- ── api_edit_time_session — drop p_emails_answered (8-arg → 7-arg) ───
DROP FUNCTION IF EXISTS api_edit_time_session(uuid, text, text, int, text, text, text, text);

CREATE OR REPLACE FUNCTION api_edit_time_session(
  p_session_id       uuid,
  p_clocked_in_at    text    DEFAULT NULL,
  p_clocked_out_at   text    DEFAULT NULL,
  p_what_went_well   text    DEFAULT NULL,
  p_needs_attention  text    DEFAULT NULL,
  p_mood             text    DEFAULT NULL,
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
    what_went_well  = COALESCE(p_what_went_well, what_went_well),
    needs_attention = COALESCE(p_needs_attention, needs_attention),
    mood            = COALESCE(p_mood, mood)
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

GRANT EXECUTE ON FUNCTION api_edit_time_session(uuid, text, text, text, text, text, text) TO authenticated;

-- ── Drop the column (auto-drops time_sessions_emails_answered_check) ──
ALTER TABLE time_sessions DROP COLUMN IF EXISTS emails_answered;

-- ── Verification ─────────────────────────────────────────────────────
do $$
begin
  assert (select count(*) from information_schema.columns
          where table_schema = 'public' and table_name = 'time_sessions'
            and column_name = 'emails_answered') = 0,
    'time_sessions.emails_answered was not dropped';
  assert (select count(*) from pg_proc
          where proname = 'api_time_clock_out' and pronargs = 4) = 1,
    'api_time_clock_out(4-arg) was not created';
  assert (select count(*) from pg_proc
          where proname = 'api_time_clock_out' and pronargs = 5) = 0,
    'old api_time_clock_out(5-arg) was not dropped';
  assert (select count(*) from pg_proc
          where proname = 'api_edit_time_session' and pronargs = 7) = 1,
    'api_edit_time_session(7-arg) was not created';
  assert (select count(*) from pg_proc
          where proname = 'api_edit_time_session' and pronargs = 8) = 0,
    'old api_edit_time_session(8-arg) was not dropped';
  raise notice 'drop emails_answered migration OK';
end;
$$;
