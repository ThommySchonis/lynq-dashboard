-- Phase 3b: AI Agent Config — RPC functions
-- All functions verify store belongs to workspace before operating.

------------------------------------------------------------------------
-- Helper: verify store belongs to workspace, raise if not
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_store_access(p_store_id uuid, p_workspace_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM stores WHERE id = p_store_id AND workspace_id = p_workspace_id) THEN
    RAISE EXCEPTION 'Store not found or access denied' USING HINT = 'forbidden';
  END IF;
END;
$$;

------------------------------------------------------------------------
-- 1) api_get_ai_policies
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api_get_ai_policies(p_store_id uuid)
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
  PERFORM check_store_access(p_store_id, v_ws);

  SELECT row_to_json(p) INTO v_result
  FROM ai_policies p
  WHERE p.store_id = p_store_id AND p.workspace_id = v_ws;

  RETURN json_build_object('policies', v_result);
END;
$$;

------------------------------------------------------------------------
-- 2) api_upsert_ai_policies
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api_upsert_ai_policies(
  p_store_id          uuid,
  p_brand_name        text    DEFAULT NULL,
  p_brand_description text    DEFAULT NULL,
  p_tone_of_voice     text    DEFAULT NULL,
  p_sign_off          text    DEFAULT NULL,
  p_languages         jsonb   DEFAULT NULL,
  p_website_url       text    DEFAULT NULL,
  p_shipping_policy   text    DEFAULT NULL,
  p_refund_policy     text    DEFAULT NULL,
  p_customs_policy    text    DEFAULT NULL,
  p_can_decide        jsonb   DEFAULT NULL,
  p_cannot_decide     jsonb   DEFAULT NULL,
  p_escalate_triggers jsonb   DEFAULT NULL,
  p_tracking_url      text    DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws     uuid := get_user_workspace_id();
  v_result record;
BEGIN
  PERFORM check_write_access(v_ws);
  PERFORM check_store_access(p_store_id, v_ws);

  INSERT INTO ai_policies (
    workspace_id, store_id, brand_name, brand_description, tone_of_voice,
    sign_off, languages, website_url, shipping_policy, refund_policy,
    customs_policy, can_decide, cannot_decide, escalate_triggers, tracking_url
  ) VALUES (
    v_ws, p_store_id,
    p_brand_name, p_brand_description, p_tone_of_voice,
    p_sign_off, COALESCE(p_languages, '[]'::jsonb), p_website_url,
    p_shipping_policy, p_refund_policy, p_customs_policy,
    COALESCE(p_can_decide, '[]'::jsonb), COALESCE(p_cannot_decide, '[]'::jsonb),
    COALESCE(p_escalate_triggers, '[]'::jsonb), p_tracking_url
  )
  ON CONFLICT (store_id) DO UPDATE SET
    brand_name        = COALESCE(EXCLUDED.brand_name, ai_policies.brand_name),
    brand_description = COALESCE(EXCLUDED.brand_description, ai_policies.brand_description),
    tone_of_voice     = COALESCE(EXCLUDED.tone_of_voice, ai_policies.tone_of_voice),
    sign_off          = COALESCE(EXCLUDED.sign_off, ai_policies.sign_off),
    languages         = COALESCE(EXCLUDED.languages, ai_policies.languages),
    website_url       = COALESCE(EXCLUDED.website_url, ai_policies.website_url),
    shipping_policy   = COALESCE(EXCLUDED.shipping_policy, ai_policies.shipping_policy),
    refund_policy     = COALESCE(EXCLUDED.refund_policy, ai_policies.refund_policy),
    customs_policy    = COALESCE(EXCLUDED.customs_policy, ai_policies.customs_policy),
    can_decide        = COALESCE(EXCLUDED.can_decide, ai_policies.can_decide),
    cannot_decide     = COALESCE(EXCLUDED.cannot_decide, ai_policies.cannot_decide),
    escalate_triggers = COALESCE(EXCLUDED.escalate_triggers, ai_policies.escalate_triggers),
    tracking_url      = COALESCE(EXCLUDED.tracking_url, ai_policies.tracking_url),
    updated_at        = now()
  RETURNING * INTO v_result;

  RETURN json_build_object('policies', row_to_json(v_result));
END;
$$;

------------------------------------------------------------------------
-- 3) api_list_ai_scenarios
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api_list_ai_scenarios(p_store_id uuid)
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
  PERFORM check_store_access(p_store_id, v_ws);

  SELECT COALESCE(json_agg(row_data ORDER BY row_data.scenario_key), '[]'::json)
  INTO v_result
  FROM (
    SELECT * FROM ai_scenarios
    WHERE store_id = p_store_id AND workspace_id = v_ws
  ) row_data;

  RETURN json_build_object('scenarios', v_result);
END;
$$;

------------------------------------------------------------------------
-- 4) api_upsert_ai_scenario
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api_upsert_ai_scenario(
  p_store_id          uuid,
  p_scenario_key      text,
  p_title             text    DEFAULT NULL,
  p_approach          text    DEFAULT NULL,
  p_questions_to_ask  jsonb   DEFAULT NULL,
  p_response_template text    DEFAULT NULL,
  p_escalate_when     text    DEFAULT NULL,
  p_autonomy_pct      int     DEFAULT NULL,
  p_enabled           boolean DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws     uuid := get_user_workspace_id();
  v_result record;
BEGIN
  PERFORM check_write_access(v_ws);
  PERFORM check_store_access(p_store_id, v_ws);

  INSERT INTO ai_scenarios (
    workspace_id, store_id, scenario_key, title, approach,
    questions_to_ask, response_template, escalate_when, autonomy_pct, enabled
  ) VALUES (
    v_ws, p_store_id, p_scenario_key,
    COALESCE(p_title, ''), p_approach,
    COALESCE(p_questions_to_ask, '[]'::jsonb), p_response_template,
    p_escalate_when, COALESCE(p_autonomy_pct, 0), COALESCE(p_enabled, true)
  )
  ON CONFLICT (store_id, scenario_key) DO UPDATE SET
    title             = COALESCE(EXCLUDED.title, ai_scenarios.title),
    approach          = COALESCE(EXCLUDED.approach, ai_scenarios.approach),
    questions_to_ask  = COALESCE(EXCLUDED.questions_to_ask, ai_scenarios.questions_to_ask),
    response_template = COALESCE(EXCLUDED.response_template, ai_scenarios.response_template),
    escalate_when     = COALESCE(EXCLUDED.escalate_when, ai_scenarios.escalate_when),
    autonomy_pct      = COALESCE(EXCLUDED.autonomy_pct, ai_scenarios.autonomy_pct),
    enabled           = COALESCE(EXCLUDED.enabled, ai_scenarios.enabled),
    updated_at        = now()
  RETURNING * INTO v_result;

  RETURN json_build_object('scenario', row_to_json(v_result));
END;
$$;

------------------------------------------------------------------------
-- 5) api_list_ai_lessons
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api_list_ai_lessons(p_store_id uuid)
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
  PERFORM check_store_access(p_store_id, v_ws);

  SELECT COALESCE(json_agg(row_data ORDER BY row_data.created_at DESC), '[]'::json)
  INTO v_result
  FROM (
    SELECT * FROM ai_lessons
    WHERE store_id = p_store_id AND workspace_id = v_ws AND enabled = true
  ) row_data;

  RETURN json_build_object('lessons', v_result);
END;
$$;

------------------------------------------------------------------------
-- 6) api_add_ai_lesson
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api_add_ai_lesson(
  p_store_id            uuid,
  p_lesson_text         text,
  p_applies_to_scenario text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws     uuid := get_user_workspace_id();
  v_uid    uuid := auth.uid();
  v_result record;
BEGIN
  PERFORM check_write_access(v_ws);
  PERFORM check_store_access(p_store_id, v_ws);

  INSERT INTO ai_lessons (workspace_id, store_id, lesson_text, source_type, created_by, applies_to_scenario)
  VALUES (v_ws, p_store_id, p_lesson_text, 'manual', v_uid, p_applies_to_scenario)
  RETURNING * INTO v_result;

  RETURN json_build_object('lesson', row_to_json(v_result));
END;
$$;

------------------------------------------------------------------------
-- 7) api_update_ai_lesson
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api_update_ai_lesson(
  p_lesson_id uuid,
  p_enabled   boolean
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws     uuid := get_user_workspace_id();
  v_result record;
BEGIN
  PERFORM check_write_access(v_ws);

  UPDATE ai_lessons SET enabled = p_enabled
  WHERE id = p_lesson_id AND workspace_id = v_ws
  RETURNING * INTO v_result;

  IF v_result.id IS NULL THEN
    RAISE EXCEPTION 'Lesson not found' USING HINT = 'not_found';
  END IF;

  RETURN json_build_object('lesson', row_to_json(v_result));
END;
$$;

------------------------------------------------------------------------
-- 8) api_get_ai_autonomy_rules
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api_get_ai_autonomy_rules(p_store_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws     uuid := get_user_workspace_id();
  v_config jsonb;
  v_exists boolean;
BEGIN
  PERFORM check_store_access(p_store_id, v_ws);

  SELECT config INTO v_config
  FROM ai_autonomy_rules
  WHERE store_id = p_store_id AND workspace_id = v_ws;

  v_exists := (v_config IS NOT NULL);

  RETURN json_build_object(
    'config', v_config,
    'has_persisted_config', v_exists
  );
END;
$$;

------------------------------------------------------------------------
-- 9) api_upsert_ai_autonomy_rules
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api_upsert_ai_autonomy_rules(
  p_store_id uuid,
  p_config   jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws     uuid := get_user_workspace_id();
  v_result record;
BEGIN
  PERFORM check_write_access(v_ws);
  PERFORM check_store_access(p_store_id, v_ws);

  INSERT INTO ai_autonomy_rules (workspace_id, store_id, config)
  VALUES (v_ws, p_store_id, p_config)
  ON CONFLICT (store_id) DO UPDATE SET
    config = EXCLUDED.config,
    updated_at = now()
  RETURNING * INTO v_result;

  RETURN json_build_object('config', v_result.config);
END;
$$;

------------------------------------------------------------------------
-- Grants
------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION check_store_access(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION api_get_ai_policies(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION api_upsert_ai_policies(uuid, text, text, text, text, jsonb, text, text, text, text, jsonb, jsonb, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION api_list_ai_scenarios(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION api_upsert_ai_scenario(uuid, text, text, text, jsonb, text, text, int, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION api_list_ai_lessons(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION api_add_ai_lesson(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION api_update_ai_lesson(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION api_get_ai_autonomy_rules(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION api_upsert_ai_autonomy_rules(uuid, jsonb) TO authenticated;
