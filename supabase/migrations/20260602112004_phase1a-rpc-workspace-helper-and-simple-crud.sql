-- Phase 1a: workspace helper + simple CRUD RPC functions
-- These functions are called directly from the frontend via supabase.rpc()

------------------------------------------------------------------------
-- Schema fix: add missing language/tone columns to ai_settings
------------------------------------------------------------------------
ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS language text;
ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS tone text;

------------------------------------------------------------------------
-- Helper: resolve the calling user's workspace_id from their JWT
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_user_workspace_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws uuid;
BEGIN
  SELECT workspace_id INTO v_ws
  FROM workspace_members
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_ws IS NULL THEN
    RAISE EXCEPTION 'NO_WORKSPACE'
      USING HINT = 'User has no active workspace membership';
  END IF;

  RETURN v_ws;
END;
$$;

------------------------------------------------------------------------
-- Helper: check write access (subscription not write-locked)
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_write_access(p_workspace_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM workspace_subscriptions
    WHERE workspace_id = p_workspace_id
      AND write_locked = true
  ) THEN
    RAISE EXCEPTION 'WRITE_LOCKED'
      USING HINT = 'Workspace is read-only due to subscription status';
  END IF;
END;
$$;

------------------------------------------------------------------------
-- 1) api_submit_feedback
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api_submit_feedback(
  p_type       text,
  p_message    text,
  p_page_url   text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws  uuid := get_user_workspace_id();
  v_uid uuid := auth.uid();
  v_id  uuid;
BEGIN
  PERFORM check_write_access(v_ws);

  INSERT INTO feedback_submissions (workspace_id, user_id, type, message, page_url, user_agent)
  VALUES (
    v_ws,
    v_uid,
    p_type,
    trim(p_message),
    left(p_page_url, 500),
    left(p_user_agent, 500)
  )
  RETURNING id INTO v_id;

  RETURN json_build_object('id', v_id);
END;
$$;

------------------------------------------------------------------------
-- 2) api_get_brand_settings
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api_get_brand_settings()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws     uuid := get_user_workspace_id();
  v_result json;
BEGIN
  SELECT json_build_object(
    'brand_name',    brand_name,
    'language',      language,
    'tone',          tone,
    'system_prompt', system_prompt
  ) INTO v_result
  FROM ai_settings
  WHERE workspace_id = v_ws
  LIMIT 1;

  RETURN COALESCE(v_result, '{}'::json);
END;
$$;

------------------------------------------------------------------------
-- 3) api_save_brand_settings
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api_save_brand_settings(
  p_brand_name text,
  p_language   text,
  p_tone       text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws  uuid := get_user_workspace_id();
  v_uid uuid := auth.uid();
BEGIN
  PERFORM check_write_access(v_ws);

  INSERT INTO ai_settings (user_id, workspace_id, brand_name, language, tone)
  VALUES (v_uid, v_ws, p_brand_name, p_language, p_tone)
  ON CONFLICT (user_id)
  DO UPDATE SET
    brand_name   = EXCLUDED.brand_name,
    language     = EXCLUDED.language,
    tone         = EXCLUDED.tone,
    workspace_id = EXCLUDED.workspace_id;

  RETURN json_build_object('success', true);
END;
$$;

------------------------------------------------------------------------
-- 4) api_get_onboarding_status
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api_get_onboarding_status()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws                    uuid := get_user_workspace_id();
  v_uid                   uuid := auth.uid();
  v_email                 text;
  v_user_meta             jsonb;
  v_display_name          text;
  v_welcome_dismissed     timestamptz;
  v_checklist_dismissed   timestamptz;
  v_ws_name               text;
  v_macros_count          int;
  v_email_status          text;
  v_shopify_domain        text;
  v_integration_status    text;
  v_member_count          int;
  v_sub_status            text;
  v_trial_ends_at         timestamptz;
  v_is_admin              boolean;
  v_is_admin_or_tester    boolean;
  v_full_name             text;
BEGIN
  -- User info
  SELECT email, raw_user_meta_data
  INTO v_email, v_user_meta
  FROM auth.users WHERE id = v_uid;

  -- Profile
  SELECT display_name, welcome_dismissed_at, setup_checklist_dismissed_at
  INTO v_display_name, v_welcome_dismissed, v_checklist_dismissed
  FROM user_profiles WHERE user_id = v_uid;

  -- Workspace name
  SELECT name INTO v_ws_name FROM workspaces WHERE id = v_ws;

  -- Macros count (non-archived)
  SELECT count(*)::int INTO v_macros_count
  FROM macros WHERE workspace_id = v_ws AND archived_at IS NULL;

  -- Email account status
  SELECT status INTO v_email_status
  FROM email_accounts WHERE workspace_id = v_ws LIMIT 1;

  -- Integration
  SELECT shopify_domain, status
  INTO v_shopify_domain, v_integration_status
  FROM integrations WHERE workspace_id = v_ws LIMIT 1;

  -- Member count
  SELECT count(*)::int INTO v_member_count
  FROM workspace_members WHERE workspace_id = v_ws;

  -- Subscription
  SELECT status, trial_ends_at
  INTO v_sub_status, v_trial_ends_at
  FROM workspace_subscriptions WHERE workspace_id = v_ws LIMIT 1;

  -- Platform admin checks
  v_is_admin := EXISTS (
    SELECT 1 FROM platform_admins WHERE email = v_email AND role = 'admin'
  );
  v_is_admin_or_tester := EXISTS (
    SELECT 1 FROM platform_admins WHERE email = v_email
  );

  -- Derive first name
  v_full_name := COALESCE(
    v_display_name,
    v_user_meta->>'name',
    split_part(v_email, '@', 1),
    ''
  );

  RETURN json_build_object(
    'macros_count',        v_macros_count,
    'email_connected',     COALESCE(v_email_status = 'connected', false),
    'shopify_connected',   COALESCE(v_integration_status = 'connected' AND v_shopify_domain IS NOT NULL, false),
    'team_member_count',   v_member_count,
    'subscription_status', v_sub_status,
    'trial_ends_at',       v_trial_ends_at,
    'workspace_name',      v_ws_name,
    'is_payment_exempt',   v_is_admin_or_tester,
    'is_platform_admin',   v_is_admin,
    'user', json_build_object(
      'first_name',                   split_part(v_full_name, ' ', 1),
      'welcome_dismissed_at',         v_welcome_dismissed,
      'setup_checklist_dismissed_at', v_checklist_dismissed
    )
  );
END;
$$;

------------------------------------------------------------------------
-- Grant execute to authenticated users
------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION get_user_workspace_id() TO authenticated;
GRANT EXECUTE ON FUNCTION check_write_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION api_submit_feedback(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION api_get_brand_settings() TO authenticated;
GRANT EXECUTE ON FUNCTION api_save_brand_settings(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION api_get_onboarding_status() TO authenticated;
