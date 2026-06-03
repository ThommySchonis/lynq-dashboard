-- Phase 4c: Settings reads — profile, email accounts, shopify integration

------------------------------------------------------------------------
-- 1) api_get_profile — read user profile with auth.users fallback
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api_get_profile()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_profile record;
  v_email   text;
  v_meta    jsonb;
BEGIN
  SELECT email, raw_user_meta_data INTO v_email, v_meta
  FROM auth.users WHERE id = v_uid;

  SELECT * INTO v_profile
  FROM user_profiles WHERE user_id = v_uid;

  RETURN json_build_object('profile', json_build_object(
    'email', v_email,
    'display_name', COALESCE(v_profile.display_name, v_meta->>'name', NULL),
    'bio', v_profile.bio,
    'avatar_url', v_profile.avatar_url,
    'theme', COALESCE(v_profile.theme, 'system'),
    'welcome_dismissed_at', v_profile.welcome_dismissed_at,
    'setup_checklist_dismissed_at', v_profile.setup_checklist_dismissed_at,
    'two_factor_enabled', (
      SELECT EXISTS (
        SELECT 1 FROM auth.mfa_factors
        WHERE user_id = v_uid AND status = 'verified'
      )
    )
  ));
END;
$$;

------------------------------------------------------------------------
-- 2) api_list_email_accounts — workspace email accounts
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api_list_email_accounts(
  p_store_id uuid DEFAULT NULL
)
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
  SELECT COALESCE(json_agg(row_data ORDER BY row_data.created_at ASC), '[]'::json)
  INTO v_result
  FROM (
    SELECT ea.id, ea.provider, ea.email_address, ea.display_name,
           ea.status, ea.is_default, ea.last_sync_at,
           ea.created_at
    FROM email_accounts ea
    WHERE ea.workspace_id = v_ws
      AND (p_store_id IS NULL OR ea.store_id = p_store_id)
  ) row_data;

  RETURN json_build_object('accounts', v_result);
END;
$$;

------------------------------------------------------------------------
-- 3) api_get_shopify_integration — check if Shopify is connected
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api_get_shopify_integration(
  p_store_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws   uuid := get_user_workspace_id();
  v_data record;
BEGIN
  IF p_store_id IS NOT NULL THEN
    SELECT shopify_domain, shopify_connected_at, status INTO v_data
    FROM integrations
    WHERE workspace_id = v_ws AND store_id = p_store_id
    LIMIT 1;
  ELSE
    SELECT shopify_domain, shopify_connected_at, status INTO v_data
    FROM integrations
    WHERE workspace_id = v_ws
    LIMIT 1;
  END IF;

  RETURN json_build_object(
    'domain', v_data.shopify_domain,
    'connectedAt', v_data.shopify_connected_at,
    'status', v_data.status,
    'shopify', (v_data.shopify_domain IS NOT NULL)
  );
END;
$$;

------------------------------------------------------------------------
-- Grants
------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION api_get_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION api_list_email_accounts(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION api_get_shopify_integration(uuid) TO authenticated;
