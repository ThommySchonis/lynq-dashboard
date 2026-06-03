-- Fix: api_list_store_email_configs referenced ea.created_at, but the
-- email_accounts table has no created_at column (only connected_at).
-- The broken function caused the RPC call to throw 42703 "column does not exist",
-- making the inbox/stores UI show an empty email list for any store with
-- connected accounts.

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
  SELECT COALESCE(json_agg(row_data ORDER BY row_data.connected_at ASC), '[]'::json)
  INTO v_result
  FROM (
    SELECT ea.id, ea.provider, ea.email_address, ea.status,
           ea.connected_at, ea.watch_expiry
    FROM email_accounts ea
    WHERE ea.store_id = p_store_id AND ea.workspace_id = v_ws
  ) row_data;

  RETURN json_build_object('configs', v_result);
END;
$$;
