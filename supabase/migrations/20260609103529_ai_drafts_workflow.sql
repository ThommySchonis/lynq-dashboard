-- ============================================================
-- ai_drafts workflow columns, indexes, RLS, and RPC functions
-- Adds status lifecycle tracking, feedback capture, and promote-
-- to-lesson/example flows for Emma draft review workflow.
-- ============================================================

-- ── 1. Add workflow columns to ai_drafts ────────────────────────────

ALTER TABLE public.ai_drafts
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','declined','edited','auto_sent','regenerated'));

ALTER TABLE public.ai_drafts
  ADD COLUMN IF NOT EXISTS edited_text text;

ALTER TABLE public.ai_drafts
  ADD COLUMN IF NOT EXISTS feedback_category text
    CHECK (feedback_category IN (
      'wrong_tone','incorrect_info','not_relevant',
      'too_long','too_short','missing_context','other'
    ));

ALTER TABLE public.ai_drafts
  ADD COLUMN IF NOT EXISTS feedback_comment text;

ALTER TABLE public.ai_drafts
  ADD COLUMN IF NOT EXISTS resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.ai_drafts
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz;

ALTER TABLE public.ai_drafts
  ADD COLUMN IF NOT EXISTS promoted_to_lesson_id uuid
    REFERENCES public.ai_lessons(id) ON DELETE SET NULL;

ALTER TABLE public.ai_drafts
  ADD COLUMN IF NOT EXISTS promoted_to_example_id uuid
    REFERENCES public.ai_examples(id) ON DELETE SET NULL;


-- ── 2. Indexes ───────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_ai_drafts_conversation_status
  ON public.ai_drafts (conversation_id, status, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_drafts_store_resolved
  ON public.ai_drafts (store_id, resolved_at DESC)
  WHERE status IN ('approved','declined','edited','auto_sent','regenerated');


-- ── 3. UPDATE RLS policy ─────────────────────────────────────────────

DROP POLICY IF EXISTS "ai_drafts_update" ON public.ai_drafts;
CREATE POLICY "ai_drafts_update" ON public.ai_drafts FOR UPDATE
  USING (workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  ));


-- ── 4. RPC: api_get_pending_draft ────────────────────────────────────
-- Returns the latest pending draft for a conversation (if the calling
-- user belongs to the draft's workspace). Returns NULL if none found.

CREATE OR REPLACE FUNCTION api_get_pending_draft(p_conversation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws   uuid := get_user_workspace_id();
  v_row  record;
BEGIN
  SELECT
    d.id,
    d.conversation_id,
    d.store_id,
    d.suggested_text,
    d.prompt_path,
    d.model,
    d.status,
    d.generated_at,
    d.auto_sent_at,
    d.auto_send_blocked_reason
  INTO v_row
  FROM ai_drafts d
  WHERE d.conversation_id = p_conversation_id
    AND d.workspace_id    = v_ws
    AND d.status          = 'pending'
  ORDER BY d.generated_at DESC
  LIMIT 1;

  IF v_row.id IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'id',                       v_row.id,
    'conversation_id',          v_row.conversation_id,
    'store_id',                 v_row.store_id,
    'suggested_text',           v_row.suggested_text,
    'prompt_path',              v_row.prompt_path,
    'model',                    v_row.model,
    'status',                   v_row.status,
    'generated_at',             v_row.generated_at,
    'auto_sent_at',             v_row.auto_sent_at,
    'auto_send_blocked_reason', v_row.auto_send_blocked_reason
  );
END;
$$;

GRANT EXECUTE ON FUNCTION api_get_pending_draft(uuid) TO authenticated;


-- ── 5. RPC: api_update_draft_status ─────────────────────────────────
-- Updates a pending draft's status + optional feedback fields.
-- Enforces: draft must be pending + belong to the caller's workspace.

CREATE OR REPLACE FUNCTION api_update_draft_status(
  p_draft_id          uuid,
  p_status            text,
  p_edited_text       text DEFAULT NULL,
  p_feedback_category text DEFAULT NULL,
  p_feedback_comment  text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws     uuid := get_user_workspace_id();
  v_result record;
BEGIN
  PERFORM check_write_access(v_ws);

  UPDATE ai_drafts SET
    status            = p_status,
    edited_text       = p_edited_text,
    feedback_category = p_feedback_category,
    feedback_comment  = p_feedback_comment,
    resolved_by       = auth.uid(),
    resolved_at       = now()
  WHERE id            = p_draft_id
    AND workspace_id  = v_ws
    AND status        = 'pending'
  RETURNING * INTO v_result;

  IF v_result.id IS NULL THEN
    RAISE EXCEPTION 'Draft not found, already resolved, or access denied'
      USING HINT = 'not_found';
  END IF;

  RETURN to_jsonb(v_result);
END;
$$;

GRANT EXECUTE ON FUNCTION api_update_draft_status(uuid, text, text, text, text) TO authenticated;


-- ── 6. RPC: api_list_resolved_drafts ────────────────────────────────
-- Returns resolved drafts for a store, joined with conversation
-- subject + customer_email. Ordered by resolved_at DESC.

CREATE OR REPLACE FUNCTION api_list_resolved_drafts(
  p_store_id uuid,
  p_status   text    DEFAULT NULL,
  p_limit    integer DEFAULT 50,
  p_offset   integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws     uuid := get_user_workspace_id();
  v_result jsonb;
BEGIN
  PERFORM check_store_access(p_store_id, v_ws);

  SELECT COALESCE(jsonb_agg(row_data ORDER BY row_data.resolved_at DESC), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT
      d.id,
      d.conversation_id,
      d.store_id,
      d.suggested_text,
      d.edited_text,
      d.prompt_path,
      d.model,
      d.status,
      d.feedback_category,
      d.feedback_comment,
      d.resolved_by,
      d.resolved_at,
      d.generated_at,
      d.promoted_to_lesson_id,
      d.promoted_to_example_id,
      ec.subject          AS conversation_subject,
      ec.customer_email   AS customer_email
    FROM ai_drafts d
    LEFT JOIN email_conversations ec ON ec.id = d.conversation_id
    WHERE d.store_id     = p_store_id
      AND d.workspace_id = v_ws
      AND d.status      != 'pending'
      AND (p_status IS NULL OR d.status = p_status)
    ORDER BY d.resolved_at DESC
    LIMIT  p_limit
    OFFSET p_offset
  ) row_data;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION api_list_resolved_drafts(uuid, text, integer, integer) TO authenticated;


-- ── 7. RPC: api_promote_draft_to_lesson ─────────────────────────────
-- Inserts an ai_lesson from a resolved draft and links back.
-- source_type is derived from draft status:
--   approved | edited | auto_sent → 'edit'
--   declined                      → 'reject'

CREATE OR REPLACE FUNCTION api_promote_draft_to_lesson(
  p_draft_id            uuid,
  p_lesson_text         text,
  p_applies_to_scenario text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws          uuid := get_user_workspace_id();
  v_uid         uuid := auth.uid();
  v_draft       record;
  v_source_type text;
  v_lesson      record;
BEGIN
  PERFORM check_write_access(v_ws);

  -- Load and authorise draft
  SELECT * INTO v_draft
  FROM ai_drafts
  WHERE id = p_draft_id AND workspace_id = v_ws;

  IF v_draft.id IS NULL THEN
    RAISE EXCEPTION 'Draft not found or access denied' USING HINT = 'not_found';
  END IF;

  -- Determine source_type from draft status
  v_source_type := CASE v_draft.status
    WHEN 'approved'   THEN 'edit'
    WHEN 'edited'     THEN 'edit'
    WHEN 'auto_sent'  THEN 'edit'
    WHEN 'declined'   THEN 'reject'
    ELSE 'edit'
  END;

  -- Insert lesson
  INSERT INTO ai_lessons (
    workspace_id, store_id, lesson_text,
    source_type, source_ref,
    applies_to_scenario, created_by
  ) VALUES (
    v_ws, v_draft.store_id, p_lesson_text,
    v_source_type, p_draft_id,
    p_applies_to_scenario, v_uid
  )
  RETURNING * INTO v_lesson;

  -- Link back to draft
  UPDATE ai_drafts
    SET promoted_to_lesson_id = v_lesson.id
  WHERE id = p_draft_id;

  RETURN jsonb_build_object('lesson', to_jsonb(v_lesson));
END;
$$;

GRANT EXECUTE ON FUNCTION api_promote_draft_to_lesson(uuid, text, text) TO authenticated;


-- ── 8. RPC: api_promote_draft_to_example ────────────────────────────
-- Inserts an ai_example from a resolved draft (approved/edited/auto_sent
-- only) and links back.

CREATE OR REPLACE FUNCTION api_promote_draft_to_example(
  p_draft_id    uuid,
  p_example_text text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws      uuid := get_user_workspace_id();
  v_draft   record;
  v_example record;
BEGIN
  PERFORM check_write_access(v_ws);

  -- Load and authorise draft
  SELECT * INTO v_draft
  FROM ai_drafts
  WHERE id = p_draft_id AND workspace_id = v_ws;

  IF v_draft.id IS NULL THEN
    RAISE EXCEPTION 'Draft not found or access denied' USING HINT = 'not_found';
  END IF;

  -- Only positive-outcome drafts qualify
  IF v_draft.status NOT IN ('approved','edited','auto_sent') THEN
    RAISE EXCEPTION 'Only approved, edited, or auto_sent drafts can be promoted to examples'
      USING HINT = 'bad_request';
  END IF;

  -- Insert example
  INSERT INTO ai_examples (workspace_id, store_id, example_text)
  VALUES (v_ws, v_draft.store_id, p_example_text)
  RETURNING * INTO v_example;

  -- Link back to draft
  UPDATE ai_drafts
    SET promoted_to_example_id = v_example.id
  WHERE id = p_draft_id;

  RETURN jsonb_build_object('example', to_jsonb(v_example));
END;
$$;

GRANT EXECUTE ON FUNCTION api_promote_draft_to_example(uuid, text) TO authenticated;


-- ── Verification ─────────────────────────────────────────────────────

DO $$
BEGIN
  ASSERT (
    SELECT count(*) FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'ai_drafts'
      AND column_name  = 'status'
  ) = 1, 'ai_drafts.status column not found';

  ASSERT (
    SELECT count(*) FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'ai_drafts'
      AND column_name  = 'resolved_at'
  ) = 1, 'ai_drafts.resolved_at column not found';

  RAISE NOTICE 'ai_drafts_workflow migration OK';
END;
$$;
