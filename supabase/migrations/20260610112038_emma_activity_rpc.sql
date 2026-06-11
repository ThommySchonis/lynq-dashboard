-- ============================================================
-- api_list_emma_activity — Recent Emma activity feed
-- Returns ai_drafts joined with email_conversations for a store
-- within a date range, with optional multi-status filter and
-- limit/offset pagination. Includes total via COUNT(*) OVER ()
-- so the client can decide whether to show "Load more".
-- ============================================================

CREATE OR REPLACE FUNCTION public.api_list_emma_activity(
  p_store_id  uuid,
  p_from      text,
  p_to        text,
  p_statuses  text[] DEFAULT NULL,
  p_limit     integer DEFAULT 20,
  p_offset    integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws     uuid := get_user_workspace_id();
  v_items  jsonb;
  v_total  bigint;
BEGIN
  PERFORM check_store_access(p_store_id, v_ws);

  WITH filtered AS (
    SELECT
      d.id,
      d.conversation_id,
      d.status,
      d.generated_at,
      d.resolved_at,
      COALESCE(d.resolved_at, d.generated_at) AS event_at,
      d.suggested_text,
      d.edited_text,
      d.feedback_category,
      d.feedback_comment,
      ec.subject        AS conversation_subject,
      ec.customer_email AS customer_email,
      COUNT(*) OVER ()  AS total_count
    FROM ai_drafts d
    LEFT JOIN email_conversations ec ON ec.id = d.conversation_id
    WHERE d.workspace_id = v_ws
      AND d.store_id     = p_store_id
      AND d.generated_at >= p_from::timestamptz
      AND d.generated_at <  (p_to::date + 1)::timestamptz
      AND (p_statuses IS NULL OR d.status = ANY(p_statuses))
    ORDER BY COALESCE(d.resolved_at, d.generated_at) DESC, d.generated_at DESC, d.id DESC
    LIMIT  p_limit
    OFFSET p_offset
  )
  SELECT
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'id',                    f.id,
        'conversation_id',       f.conversation_id,
        'status',                f.status,
        'generated_at',          f.generated_at,
        'resolved_at',           f.resolved_at,
        'event_at',              f.event_at,
        'suggested_text',        f.suggested_text,
        'edited_text',           f.edited_text,
        'feedback_category',     f.feedback_category,
        'feedback_comment',      f.feedback_comment,
        'conversation_subject',  f.conversation_subject,
        'customer_email',        f.customer_email
      )
      ORDER BY f.event_at DESC, f.generated_at DESC, f.id DESC
    ), '[]'::jsonb),
    COALESCE(MAX(f.total_count), 0)
  INTO v_items, v_total
  FROM filtered f;

  RETURN jsonb_build_object(
    'items',    v_items,
    'has_more', (p_offset + p_limit) < v_total,
    'total',    v_total
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.api_list_emma_activity(uuid, text, text, text[], integer, integer) TO authenticated;


-- ── Verification ─────────────────────────────────────────────

DO $$
BEGIN
  ASSERT (
    SELECT count(*) FROM pg_proc WHERE proname = 'api_list_emma_activity'
  ) = 1, 'api_list_emma_activity function not found';

  RAISE NOTICE 'emma_activity_rpc migration OK';
END;
$$;
