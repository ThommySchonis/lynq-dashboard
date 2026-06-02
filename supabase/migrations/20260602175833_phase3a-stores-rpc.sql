-- Phase 3a: Stores — RPC functions

------------------------------------------------------------------------
-- 1) api_list_stores — list stores with integration data
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api_list_stores()
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
    SELECT s.id, s.name, s.created_at,
           i.shopify_domain, i.shopify_connected_at, i.store_currency
    FROM stores s
    LEFT JOIN integrations i ON i.store_id = s.id AND i.workspace_id = v_ws
    WHERE s.workspace_id = v_ws
  ) row_data;

  RETURN json_build_object('stores', v_result);
END;
$$;

------------------------------------------------------------------------
-- 2) api_update_store — update store name
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api_update_store(
  p_store_id uuid,
  p_name     text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws    uuid := get_user_workspace_id();
  v_store record;
BEGIN
  PERFORM check_write_access(v_ws);

  UPDATE stores SET name = p_name
  WHERE id = p_store_id AND workspace_id = v_ws
  RETURNING * INTO v_store;

  IF v_store.id IS NULL THEN
    RAISE EXCEPTION 'Store not found' USING HINT = 'not_found';
  END IF;

  RETURN json_build_object('store', row_to_json(v_store));
END;
$$;

------------------------------------------------------------------------
-- 3) api_list_store_email_configs — list email accounts for a store
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api_list_store_email_configs(p_store_id uuid)
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
    SELECT ea.id, ea.provider, ea.email_address, ea.status,
           ea.created_at, ea.watch_expiry
    FROM email_accounts ea
    WHERE ea.store_id = p_store_id AND ea.workspace_id = v_ws
  ) row_data;

  RETURN json_build_object('configs', v_result);
END;
$$;

------------------------------------------------------------------------
-- 4) api_delete_store_email_config — delete email account
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api_delete_store_email_config(
  p_store_id  uuid,
  p_config_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws    uuid := get_user_workspace_id();
  v_found boolean;
BEGIN
  PERFORM check_write_access(v_ws);

  DELETE FROM email_accounts
  WHERE id = p_config_id AND store_id = p_store_id AND workspace_id = v_ws
  RETURNING true INTO v_found;

  IF v_found IS NULL THEN
    RAISE EXCEPTION 'Email config not found' USING HINT = 'not_found';
  END IF;

  RETURN json_build_object('ok', true);
END;
$$;

------------------------------------------------------------------------
-- Grants
------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION api_list_stores() TO authenticated;
GRANT EXECUTE ON FUNCTION api_update_store(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION api_list_store_email_configs(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION api_delete_store_email_config(uuid, uuid) TO authenticated;
