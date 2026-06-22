-- api_list_stores: also expose integration status so the UI can show a
-- "Reconnect required" state for stores flagged reauth_required.
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
           i.shopify_domain, i.shopify_connected_at, i.store_currency, i.status
    FROM stores s
    LEFT JOIN integrations i ON i.store_id = s.id AND i.workspace_id = v_ws
    WHERE s.workspace_id = v_ws
  ) row_data;

  RETURN json_build_object('stores', v_result);
END;
$$;

notify pgrst, 'reload schema';
