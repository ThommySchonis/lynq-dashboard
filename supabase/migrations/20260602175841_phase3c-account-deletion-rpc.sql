-- Phase 3c: Account Deletion — RPC functions

------------------------------------------------------------------------
-- 1) api_get_deletion_status
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api_get_deletion_status()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid          uuid := auth.uid();
  v_scheduled_at timestamptz;
BEGIN
  SELECT scheduled_for_deletion_at INTO v_scheduled_at
  FROM user_profiles
  WHERE user_id = v_uid;

  RETURN json_build_object(
    'scheduled', (v_scheduled_at IS NOT NULL),
    'scheduledFor', v_scheduled_at
  );
END;
$$;

------------------------------------------------------------------------
-- 2) api_cancel_account_deletion
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api_cancel_account_deletion()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid          uuid := auth.uid();
  v_scheduled_at timestamptz;
  v_ws_ids       uuid[];
BEGIN
  SELECT scheduled_for_deletion_at INTO v_scheduled_at
  FROM user_profiles
  WHERE user_id = v_uid;

  IF v_scheduled_at IS NULL THEN
    RAISE EXCEPTION 'No deletion scheduled' USING HINT = 'not_found';
  END IF;

  UPDATE user_profiles
  SET scheduled_for_deletion_at = NULL
  WHERE user_id = v_uid;

  SELECT array_agg(w.id) INTO v_ws_ids
  FROM workspaces w
  JOIN workspace_members wm ON wm.workspace_id = w.id
  WHERE wm.user_id = v_uid AND wm.role = 'owner';

  IF v_ws_ids IS NOT NULL THEN
    UPDATE workspaces
    SET scheduled_for_deletion_at = NULL
    WHERE id = ANY(v_ws_ids);
  END IF;

  INSERT INTO account_deletion_log (user_id, event, metadata)
  VALUES (v_uid, 'cancellation', '{}'::jsonb);

  RETURN json_build_object('cancelled', true);
END;
$$;

------------------------------------------------------------------------
-- Grants
------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION api_get_deletion_status() TO authenticated;
GRANT EXECUTE ON FUNCTION api_cancel_account_deletion() TO authenticated;
