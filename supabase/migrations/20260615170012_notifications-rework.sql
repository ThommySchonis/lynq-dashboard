-- Notifications rework: canonical user-facing store, per-user read tracking,
-- workspace-scoped RLS, client RPCs, and a clear-hook on draft resolution.

-- ── Rework notifications into the canonical user-facing store ──
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS category    text NOT NULL DEFAULT 'broadcast',
  ADD COLUMN IF NOT EXISTS link        text,
  ADD COLUMN IF NOT EXISTS source_type text,
  ADD COLUMN IF NOT EXISTS source_id   uuid,
  ADD COLUMN IF NOT EXISTS cleared_at  timestamptz;

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_category_check;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_category_check
  CHECK (category IN ('broadcast','emma_pending_draft'));

ALTER TABLE public.notifications DROP COLUMN IF EXISTS read;


-- ── Per-user read tracking table + indexes ──
CREATE TABLE IF NOT EXISTS public.notification_reads (
  notification_id uuid NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id    uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  read_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (notification_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_notifications_ws_cleared_created
  ON public.notifications (workspace_id, cleared_at, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_source
  ON public.notifications (source_type, source_id)
  WHERE source_id IS NOT NULL;


-- ── RLS ──
DROP POLICY IF EXISTS notifications_select_all_authenticated ON public.notifications;
DROP POLICY IF EXISTS notifications_select_scoped ON public.notifications;
-- Membership is checked via a direct workspace_members subquery rather than
-- get_user_workspace_id(), which RAISEs for users with no membership (e.g. the
-- platform admin). A raise inside a policy predicate would abort the admin
-- panel's SELECT * on notifications once any workspace-scoped row exists.
CREATE POLICY notifications_select_scoped ON public.notifications
  FOR SELECT TO authenticated
  USING (
    workspace_id IS NULL
    OR workspace_id IN (
      SELECT wm.workspace_id FROM workspace_members wm WHERE wm.user_id = auth.uid()
    )
  );

ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notification_reads_own ON public.notification_reads;
CREATE POLICY notification_reads_own ON public.notification_reads
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- ── Client RPCs + clear helper ──
CREATE OR REPLACE FUNCTION api_list_notifications(
  p_limit  integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws    uuid := get_user_workspace_id();
  v_uid   uuid := auth.uid();
  v_items jsonb;
  v_unread integer;
  v_total  integer;
BEGIN
  SELECT count(*) INTO v_total
  FROM notifications n
  WHERE n.cleared_at IS NULL
    AND (n.workspace_id IS NULL OR n.workspace_id = v_ws);

  SELECT count(*) INTO v_unread
  FROM notifications n
  LEFT JOIN notification_reads r ON r.notification_id = n.id AND r.user_id = v_uid
  WHERE n.cleared_at IS NULL
    AND (n.workspace_id IS NULL OR n.workspace_id = v_ws)
    AND r.notification_id IS NULL;

  SELECT coalesce(jsonb_agg(item ORDER BY item->>'created_at' DESC), '[]'::jsonb)
  INTO v_items
  FROM (
    SELECT jsonb_build_object(
      'id', n.id,
      'category', n.category,
      'type', coalesce(n.type, 'info'),
      'title', n.title,
      'body', n.body,
      'link', n.link,
      'read', (r.notification_id IS NOT NULL),
      'created_at', n.created_at
    ) AS item
    FROM notifications n
    LEFT JOIN notification_reads r ON r.notification_id = n.id AND r.user_id = v_uid
    WHERE n.cleared_at IS NULL
      AND (n.workspace_id IS NULL OR n.workspace_id = v_ws)
    ORDER BY n.created_at DESC
    LIMIT p_limit OFFSET p_offset
  ) sub;

  RETURN jsonb_build_object(
    'items', v_items,
    'unread_count', v_unread,
    'has_more', (p_offset + p_limit) < v_total
  );
END;
$$;

CREATE OR REPLACE FUNCTION api_mark_notification_read(p_notification_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws  uuid := get_user_workspace_id();
  v_uid uuid := auth.uid();
BEGIN
  INSERT INTO notification_reads (notification_id, user_id, workspace_id, read_at)
  SELECT n.id, v_uid, n.workspace_id, now()
  FROM notifications n
  WHERE n.id = p_notification_id
    AND (n.workspace_id IS NULL OR n.workspace_id = v_ws)
  ON CONFLICT (notification_id, user_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION api_mark_all_notifications_read()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws  uuid := get_user_workspace_id();
  v_uid uuid := auth.uid();
BEGIN
  INSERT INTO notification_reads (notification_id, user_id, workspace_id, read_at)
  SELECT n.id, v_uid, n.workspace_id, now()
  FROM notifications n
  WHERE n.cleared_at IS NULL
    AND (n.workspace_id IS NULL OR n.workspace_id = v_ws)
  ON CONFLICT (notification_id, user_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION api_clear_source_notification(
  p_source_type text,
  p_source_id   uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE notifications
     SET cleared_at = now()
   WHERE source_type = p_source_type
     AND source_id   = p_source_id
     AND cleared_at IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION api_list_notifications(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION api_mark_notification_read(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION api_mark_all_notifications_read() TO authenticated;
-- api_clear_source_notification is intentionally NOT granted to authenticated.


-- ── Replace api_update_draft_status to clear its notification on resolution ──
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

  -- Draft successfully left 'pending' — clear its review notification.
  PERFORM api_clear_source_notification('ai_draft', p_draft_id);

  RETURN to_jsonb(v_result);
END;
$$;

GRANT EXECUTE ON FUNCTION api_update_draft_status(uuid, text, text, text, text) TO authenticated;


-- ── Verification ──
DO $$
BEGIN
  ASSERT (SELECT count(*) FROM pg_proc
          WHERE proname IN (
            'api_list_notifications',
            'api_mark_notification_read',
            'api_mark_all_notifications_read',
            'api_clear_source_notification'
          )) = 4,
    'Expected 4 notification RPCs to exist';
  ASSERT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'notifications' AND column_name = 'category'),
    'notifications.category column missing';
  ASSERT NOT EXISTS (SELECT 1 FROM information_schema.columns
                     WHERE table_name = 'notifications' AND column_name = 'read'),
    'legacy notifications.read column should be dropped';
  ASSERT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_name = 'notification_reads'),
    'notification_reads table missing';
END $$;
