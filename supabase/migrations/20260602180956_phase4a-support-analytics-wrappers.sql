-- Phase 4a: Support Analytics — secure wrappers
-- These wrap existing get_* functions, deriving workspace_id from auth.uid()
-- instead of accepting it as a parameter.

------------------------------------------------------------------------
-- 1) api_get_response_times
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api_get_response_times(
  p_agent_id  uuid        DEFAULT NULL,
  p_date_from timestamptz DEFAULT NULL,
  p_date_to   timestamptz DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws uuid := get_user_workspace_id();
BEGIN
  RETURN (SELECT json_build_object('data',
    get_response_times(v_ws, p_agent_id, p_date_from, p_date_to)
  ));
END;
$$;

------------------------------------------------------------------------
-- 2) api_get_resolution_times
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api_get_resolution_times(
  p_agent_id  uuid        DEFAULT NULL,
  p_date_from timestamptz DEFAULT NULL,
  p_date_to   timestamptz DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws uuid := get_user_workspace_id();
BEGIN
  RETURN (SELECT json_build_object('data',
    get_resolution_times(v_ws, p_agent_id, p_date_from, p_date_to)
  ));
END;
$$;

------------------------------------------------------------------------
-- 3) api_get_ticket_volume
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api_get_ticket_volume(
  p_agent_id  uuid        DEFAULT NULL,
  p_date_from timestamptz DEFAULT NULL,
  p_date_to   timestamptz DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws uuid := get_user_workspace_id();
BEGIN
  RETURN (SELECT json_build_object('data',
    get_ticket_volume(v_ws, p_agent_id, p_date_from, p_date_to)
  ));
END;
$$;

------------------------------------------------------------------------
-- 4) api_get_agent_productivity
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api_get_agent_productivity(
  p_agent_id  uuid        DEFAULT NULL,
  p_date_from timestamptz DEFAULT NULL,
  p_date_to   timestamptz DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws uuid := get_user_workspace_id();
BEGIN
  RETURN (SELECT json_build_object('data',
    get_agent_productivity(v_ws, p_agent_id, p_date_from, p_date_to)
  ));
END;
$$;

------------------------------------------------------------------------
-- 5) api_get_refund_reasons
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api_get_refund_reasons(
  p_agent_id  uuid        DEFAULT NULL,
  p_date_from timestamptz DEFAULT NULL,
  p_date_to   timestamptz DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws uuid := get_user_workspace_id();
BEGIN
  RETURN (SELECT json_build_object('data',
    get_refund_reasons(v_ws, p_agent_id, p_date_from, p_date_to)
  ));
END;
$$;

------------------------------------------------------------------------
-- Grants
------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION api_get_response_times(uuid, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION api_get_resolution_times(uuid, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION api_get_ticket_volume(uuid, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION api_get_agent_productivity(uuid, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION api_get_refund_reasons(uuid, timestamptz, timestamptz) TO authenticated;
