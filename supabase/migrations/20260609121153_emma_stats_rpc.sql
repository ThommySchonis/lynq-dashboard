-- ============================================================
-- api_get_emma_stats — aggregated Emma AI performance metrics
-- Returns draft status counts + conversation coverage for a
-- store within a date range. Called from the analytics page.
-- ============================================================

-- ── Index for the stats query ────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_ai_drafts_workspace_store_generated
  ON public.ai_drafts (workspace_id, store_id, generated_at);


-- ── RPC: api_get_emma_stats ──────────────────────────────────

CREATE OR REPLACE FUNCTION api_get_emma_stats(
  p_store_id uuid,
  p_from     text,
  p_to       text
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

  WITH draft_counts AS (
    SELECT
      count(*)                                                              AS total_suggestions,
      count(*) FILTER (WHERE status = 'pending')                            AS pending,
      count(*) FILTER (WHERE status = 'approved')                           AS approved,
      count(*) FILTER (WHERE status = 'declined')                           AS declined,
      count(*) FILTER (WHERE status = 'edited')                             AS edited,
      count(*) FILTER (WHERE status = 'auto_sent')                          AS auto_sent,
      count(*) FILTER (WHERE status = 'regenerated')                        AS regenerated,
      count(*) FILTER (WHERE status IN ('approved','declined','edited','auto_sent')) AS total_resolved,
      count(DISTINCT conversation_id)                                       AS conversations_with_draft
    FROM ai_drafts
    WHERE workspace_id = v_ws
      AND store_id     = p_store_id
      AND generated_at >= p_from::timestamptz
      AND generated_at <  (p_to::date + 1)::timestamptz
  ),
  conv_count AS (
    SELECT count(*) AS total_conversations
    FROM email_conversations
    WHERE workspace_id = v_ws
      AND store_id     = p_store_id
      AND created_at  >= p_from::timestamptz
      AND created_at  <  (p_to::date + 1)::timestamptz
  )
  SELECT jsonb_build_object(
    'total_suggestions',        dc.total_suggestions,
    'pending',                  dc.pending,
    'approved',                 dc.approved,
    'declined',                 dc.declined,
    'edited',                   dc.edited,
    'auto_sent',                dc.auto_sent,
    'regenerated',              dc.regenerated,
    'total_resolved',           dc.total_resolved,
    'conversations_with_draft', dc.conversations_with_draft,
    'total_conversations',      cc.total_conversations
  )
  INTO v_result
  FROM draft_counts dc, conv_count cc;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION api_get_emma_stats(uuid, text, text) TO authenticated;


-- ── Verification ─────────────────────────────────────────────

DO $$
BEGIN
  ASSERT (
    SELECT count(*) FROM pg_proc
    WHERE proname = 'api_get_emma_stats'
  ) = 1, 'api_get_emma_stats function not found';

  RAISE NOTICE 'emma_stats_rpc migration OK';
END;
$$;
