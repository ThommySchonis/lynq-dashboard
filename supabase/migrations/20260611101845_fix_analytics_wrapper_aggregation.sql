-- Fix the three analytics RPC wrappers: their inner functions return SETOF (table),
-- but the wrappers placed them directly inside json_build_object, which in scalar
-- context either grabs only the first row (as a composite record) or errors on
-- multi-row results. The frontend expects { data: T[] }, but was receiving
-- { data: { ...firstRow } }, breaking calls like .flatMap() on the chart side.
--
-- Wrap with json_agg + row_to_json so the result is always a proper JSON array,
-- and coalesce empty results to '[]' so the frontend never sees null.

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
    coalesce(
      (SELECT json_agg(row_to_json(t))
         FROM get_ticket_volume(v_ws, p_agent_id, p_date_from, p_date_to) t),
      '[]'::json
    )
  ));
END;
$$;

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
    coalesce(
      (SELECT json_agg(row_to_json(t))
         FROM get_agent_productivity(v_ws, p_agent_id, p_date_from, p_date_to) t),
      '[]'::json
    )
  ));
END;
$$;

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
    coalesce(
      (SELECT json_agg(row_to_json(t))
         FROM get_refund_reasons(v_ws, p_agent_id, p_date_from, p_date_to) t),
      '[]'::json
    )
  ));
END;
$$;
