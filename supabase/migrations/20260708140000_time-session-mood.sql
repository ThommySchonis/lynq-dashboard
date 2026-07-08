-- ============================================================
-- Persist the self-reported shift mood collected by the End-of-Day
-- modal. Adds time_sessions.mood and threads p_mood through the
-- clock-out and admin-edit RPCs.
--
-- mood is nullable (legacy sessions + the admin-edit COALESCE path)
-- and CHECK-constrained to the three UI values. api_list_time_sessions
-- needs no change — it selects ts.* / row_to_json(ts), so mood flows
-- through automatically.
-- ============================================================

ALTER TABLE time_sessions
  ADD COLUMN IF NOT EXISTS mood text
  CHECK (mood IN ('tough', 'steady', 'great'));

-- ── api_time_clock_out — add p_mood (trailing, defaulted) ────────────
-- Adding an argument changes the signature, so drop the old 4-arg
-- overload first (CREATE OR REPLACE would otherwise create a second
-- overload and make PostgREST calls ambiguous).
DROP FUNCTION IF EXISTS api_time_clock_out(uuid, int, text, text);

CREATE OR REPLACE FUNCTION api_time_clock_out(
  p_session_id      uuid,
  p_emails_answered int     DEFAULT NULL,
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
    emails_answered = p_emails_answered,
    what_went_well = p_what_went_well,
    needs_attention = p_needs_attention,
    mood = p_mood
  WHERE id = p_session_id AND workspace_id = v_ws
  RETURNING * INTO v_result;

  RETURN json_build_object('session', row_to_json(v_result));
END;
$$;

GRANT EXECUTE ON FUNCTION api_time_clock_out(uuid, int, text, text, text) TO authenticated;

-- ── api_edit_time_session — add p_mood (before p_reason) ─────────────
DROP FUNCTION IF EXISTS api_edit_time_session(uuid, text, text, int, text, text, text);

CREATE OR REPLACE FUNCTION api_edit_time_session(
  p_session_id       uuid,
  p_clocked_in_at    text    DEFAULT NULL,
  p_clocked_out_at   text    DEFAULT NULL,
  p_emails_answered  int     DEFAULT NULL,
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
    emails_answered = COALESCE(p_emails_answered, emails_answered),
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

GRANT EXECUTE ON FUNCTION api_edit_time_session(uuid, text, text, int, text, text, text, text) TO authenticated;

-- ── Verification ─────────────────────────────────────────────────────
do $$
begin
  assert (select count(*) from information_schema.columns
          where table_schema = 'public' and table_name = 'time_sessions'
            and column_name = 'mood') = 1,
    'time_sessions.mood column was not created';
  assert (select count(*) from pg_proc
          where proname = 'api_time_clock_out' and pronargs = 5) = 1,
    'api_time_clock_out(5-arg) was not created';
  assert (select count(*) from pg_proc
          where proname = 'api_edit_time_session' and pronargs = 8) = 1,
    'api_edit_time_session(8-arg) was not created';
  raise notice 'time_sessions.mood migration OK';
end;
$$;
