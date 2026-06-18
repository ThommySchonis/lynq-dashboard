-- Fix: api_list_email_accounts referenced ea.created_at, but the
-- email_accounts table has no created_at column (only connected_at).
-- Referencing the missing column made the function throw 42703
-- "column does not exist" on every authenticated call, so the settings
-- "Connected accounts" list (and the inbox sync notice that reads the same
-- query) received no data.
--
-- Same root cause as 20260603083514, which fixed the sibling function
-- api_list_store_email_configs but missed this one.
--
-- Also aliases email_address -> email so the JSON key matches the frontend
-- EmailAccount type (email-account-row.tsx reads account.email); without the
-- alias the rows would render the provider label instead of the address once
-- the list starts loading again.

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
  SELECT COALESCE(json_agg(row_data ORDER BY row_data.connected_at ASC), '[]'::json)
  INTO v_result
  FROM (
    SELECT ea.id, ea.provider, ea.email_address AS email, ea.display_name,
           ea.status, ea.is_default, ea.last_sync_at,
           ea.connected_at
    FROM email_accounts ea
    WHERE ea.workspace_id = v_ws
      AND (p_store_id IS NULL OR ea.store_id = p_store_id)
  ) row_data;

  RETURN json_build_object('accounts', v_result);
END;
$$;
