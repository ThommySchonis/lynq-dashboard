-- Extend api_upsert_ai_policies with the 6 new fields, and add three
-- examples RPCs. Follows the Phase 3b pattern from
-- 20260602175840_phase3b-ai-agent-rpc.sql: SECURITY DEFINER + helpers
-- check_store_access + check_write_access + get_user_workspace_id.

-- ────────────────────────────────────────────────────────────────────
-- 1) Extend api_upsert_ai_policies
-- ────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION api_upsert_ai_policies(
  p_store_id                  uuid,
  p_brand_name                text  DEFAULT NULL,
  p_brand_description         text  DEFAULT NULL,
  p_tone_of_voice             text  DEFAULT NULL,
  p_sign_off                  text  DEFAULT NULL,
  p_languages                 jsonb DEFAULT NULL,
  p_website_url               text  DEFAULT NULL,
  p_shipping_policy           text  DEFAULT NULL,
  p_refund_policy             text  DEFAULT NULL,
  p_customs_policy            text  DEFAULT NULL,
  p_can_decide                jsonb DEFAULT NULL,
  p_cannot_decide             jsonb DEFAULT NULL,
  p_escalate_triggers         jsonb DEFAULT NULL,
  p_tracking_url              text  DEFAULT NULL,
  p_industry                  text  DEFAULT NULL,
  p_product_categories        jsonb DEFAULT NULL,
  p_formality_level           text  DEFAULT NULL,
  p_communication_style       jsonb DEFAULT NULL,
  p_personality_preferences   text  DEFAULT NULL,
  p_cancellation_policy       text  DEFAULT NULL
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
    customs_policy, can_decide, cannot_decide, escalate_triggers, tracking_url,
    industry, product_categories, formality_level, communication_style,
    personality_preferences, cancellation_policy
  ) VALUES (
    v_ws, p_store_id,
    p_brand_name, p_brand_description, p_tone_of_voice,
    p_sign_off, COALESCE(p_languages, '[]'::jsonb), p_website_url,
    p_shipping_policy, p_refund_policy, p_customs_policy,
    COALESCE(p_can_decide, '[]'::jsonb), COALESCE(p_cannot_decide, '[]'::jsonb),
    COALESCE(p_escalate_triggers, '[]'::jsonb), p_tracking_url,
    p_industry, COALESCE(p_product_categories, '[]'::jsonb),
    p_formality_level, COALESCE(p_communication_style, '[]'::jsonb),
    p_personality_preferences, p_cancellation_policy
  )
  ON CONFLICT (store_id) DO UPDATE SET
    brand_name              = COALESCE(EXCLUDED.brand_name, ai_policies.brand_name),
    brand_description       = COALESCE(EXCLUDED.brand_description, ai_policies.brand_description),
    tone_of_voice           = COALESCE(EXCLUDED.tone_of_voice, ai_policies.tone_of_voice),
    sign_off                = COALESCE(EXCLUDED.sign_off, ai_policies.sign_off),
    languages               = COALESCE(EXCLUDED.languages, ai_policies.languages),
    website_url             = COALESCE(EXCLUDED.website_url, ai_policies.website_url),
    shipping_policy         = COALESCE(EXCLUDED.shipping_policy, ai_policies.shipping_policy),
    refund_policy           = COALESCE(EXCLUDED.refund_policy, ai_policies.refund_policy),
    customs_policy          = COALESCE(EXCLUDED.customs_policy, ai_policies.customs_policy),
    can_decide              = COALESCE(EXCLUDED.can_decide, ai_policies.can_decide),
    cannot_decide           = COALESCE(EXCLUDED.cannot_decide, ai_policies.cannot_decide),
    escalate_triggers       = COALESCE(EXCLUDED.escalate_triggers, ai_policies.escalate_triggers),
    tracking_url            = COALESCE(EXCLUDED.tracking_url, ai_policies.tracking_url),
    industry                = COALESCE(EXCLUDED.industry, ai_policies.industry),
    product_categories      = COALESCE(EXCLUDED.product_categories, ai_policies.product_categories),
    formality_level         = COALESCE(EXCLUDED.formality_level, ai_policies.formality_level),
    communication_style     = COALESCE(EXCLUDED.communication_style, ai_policies.communication_style),
    personality_preferences = COALESCE(EXCLUDED.personality_preferences, ai_policies.personality_preferences),
    cancellation_policy     = COALESCE(EXCLUDED.cancellation_policy, ai_policies.cancellation_policy)
  RETURNING * INTO v_result;

  RETURN json_build_object('policies', row_to_json(v_result));
END;
$$;

GRANT EXECUTE ON FUNCTION api_upsert_ai_policies(
  uuid, text, text, text, text, jsonb, text, text, text, text, jsonb, jsonb, jsonb, text,
  text, jsonb, text, jsonb, text, text
) TO authenticated;

-- ────────────────────────────────────────────────────────────────────
-- 2) api_list_ai_examples — newest first
-- ────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION api_list_ai_examples(p_store_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws       uuid := get_user_workspace_id();
  v_examples json;
BEGIN
  PERFORM check_store_access(p_store_id, v_ws);

  SELECT COALESCE(json_agg(row_to_json(e) ORDER BY e.created_at DESC), '[]'::json)
  INTO v_examples
  FROM ai_examples e
  WHERE e.store_id = p_store_id AND e.workspace_id = v_ws;

  RETURN json_build_object('examples', v_examples);
END;
$$;

GRANT EXECUTE ON FUNCTION api_list_ai_examples(uuid) TO authenticated;

-- ────────────────────────────────────────────────────────────────────
-- 3) api_create_ai_example
-- ────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION api_create_ai_example(p_store_id uuid, p_example_text text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws  uuid := get_user_workspace_id();
  v_row record;
BEGIN
  PERFORM check_write_access(v_ws);
  PERFORM check_store_access(p_store_id, v_ws);

  IF p_example_text IS NULL OR length(trim(p_example_text)) = 0 THEN
    RAISE EXCEPTION 'example_text must not be empty' USING HINT = 'bad_request';
  END IF;

  INSERT INTO ai_examples (workspace_id, store_id, example_text)
  VALUES (v_ws, p_store_id, p_example_text)
  RETURNING * INTO v_row;

  RETURN json_build_object('example', row_to_json(v_row));
END;
$$;

GRANT EXECUTE ON FUNCTION api_create_ai_example(uuid, text) TO authenticated;

-- ────────────────────────────────────────────────────────────────────
-- 4) api_delete_ai_example — verifies store→workspace
-- ────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION api_delete_ai_example(p_example_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws       uuid := get_user_workspace_id();
  v_store_id uuid;
BEGIN
  PERFORM check_write_access(v_ws);

  SELECT store_id INTO v_store_id
  FROM ai_examples
  WHERE id = p_example_id AND workspace_id = v_ws;

  IF v_store_id IS NULL THEN
    RAISE EXCEPTION 'Example not found or access denied' USING HINT = 'forbidden';
  END IF;

  PERFORM check_store_access(v_store_id, v_ws);

  DELETE FROM ai_examples WHERE id = p_example_id;

  RETURN json_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION api_delete_ai_example(uuid) TO authenticated;
