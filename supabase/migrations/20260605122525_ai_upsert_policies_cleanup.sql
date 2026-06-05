-- Cleanup migration for api_upsert_ai_policies.
--
-- Context:
--   * Phase 3b (20260602175840_phase3b-ai-agent-rpc.sql) created a 14-arg
--     version of api_upsert_ai_policies.
--   * The AI agent settings extension (20260605122038_ai_examples_and_policies_rpc.sql)
--     added a NEW 20-arg version via CREATE OR REPLACE — which only replaces
--     same-signature functions. The old 14-arg overload still exists as a
--     separate function, creating dead code and a PostgREST ambiguous-call risk.
--
-- This migration:
--   1) Drops the old 14-arg overload so only the 20-arg version remains.
--   2) Re-creates the 20-arg version with `updated_at = now()` added to the
--      ON CONFLICT DO UPDATE SET list for explicit parity with the original
--      Phase 3b version. The `ai_policies_set_updated_at` trigger already
--      handles this on UPDATE — this is defensive style alignment, not a
--      correctness fix.

-- ────────────────────────────────────────────────────────────────────
-- 1) Drop the old 14-arg overload
-- ────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS api_upsert_ai_policies(
  uuid, text, text, text, text, jsonb, text, text, text, text, jsonb, jsonb, jsonb, text
);

-- ────────────────────────────────────────────────────────────────────
-- 2) Re-create the 20-arg version with updated_at = now() in UPDATE SET
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
    cancellation_policy     = COALESCE(EXCLUDED.cancellation_policy, ai_policies.cancellation_policy),
    updated_at              = now()
  RETURNING * INTO v_result;

  RETURN json_build_object('policies', row_to_json(v_result));
END;
$$;

GRANT EXECUTE ON FUNCTION api_upsert_ai_policies(
  uuid, text, text, text, text, jsonb, text, text, text, text, jsonb, jsonb, jsonb, text,
  text, jsonb, text, jsonb, text, text
) TO authenticated;

-- ────────────────────────────────────────────────────────────────────
-- 3) Confirmation notice
-- ────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE 'api_upsert_ai_policies cleanup complete: dropped 14-arg overload; 20-arg version now sets updated_at = now() on conflict.';
END;
$$;
