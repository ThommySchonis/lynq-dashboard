-- Emma onboarding refactor — ai_scenarios shape change + intent rename
-- propagation across ai_drafts / ai_lessons / ai_autonomy_rules.
--
-- Driven by docs spec: Emma Onboarding Refactor Content Spec §3, §4, §6.
--
-- Summary:
--  • ai_scenarios gets three new text fields:
--      triggers      — when this scenario fires (customer signals to detect)
--      must_do       — non-negotiable steps in the reply
--      must_not_do   — explicit no-go list (overrides example phrasings)
--    Existing approach + escalate_when stay as-is.
--  • Canonical scenario_keys are normalised to match the Notion §3 list:
--      wismo               -> order_status
--      wrong_or_damaged    -> wrong_or_damaged_item
--      refund_or_cancel    -> refund_or_return
--    New scenario_key 'cancellation' is added (no auto-seed — merchants
--    fill it in the UI; it appears in CANONICAL_SCENARIOS automatically).
--  • ai_drafts.intent CHECK is dropped + re-added with the new 10 values
--    so future structured-output INSERTs succeed. Existing ai_drafts
--    rows have their old intent values rewritten so the new CHECK passes.
--  • ai_lessons.applies_to_scenario rows holding old scenario_keys are
--    rewritten too so aiLessonsBody's zod enum still accepts them.
--  • ai_autonomy_rules.config.global_block_intents jsonb arrays are
--    rewritten: 'refund_or_cancel' becomes both 'refund_or_return' and
--    'cancellation' (per Notion §5); 'angry_or_chargeback' is ensured
--    present.
--
-- Idempotent. Re-running is a no-op once the data has already moved
-- (existing rows already use the new keys; the CHECK already lists the
-- new values).

-- ── 1. Extend ai_scenarios with the three new text fields ───────────
ALTER TABLE public.ai_scenarios ADD COLUMN IF NOT EXISTS triggers    text NOT NULL DEFAULT '';
ALTER TABLE public.ai_scenarios ADD COLUMN IF NOT EXISTS must_do     text NOT NULL DEFAULT '';
ALTER TABLE public.ai_scenarios ADD COLUMN IF NOT EXISTS must_not_do text NOT NULL DEFAULT '';

-- ── 2. Rename scenario_keys to match the Notion §3 final list ───────
--    UNIQUE(store_id, scenario_key) is on ai_scenarios, but renames
--    don't collide (no row has both old and new keys for the same store).
UPDATE public.ai_scenarios SET scenario_key = 'order_status'          WHERE scenario_key = 'wismo';
UPDATE public.ai_scenarios SET scenario_key = 'wrong_or_damaged_item' WHERE scenario_key = 'wrong_or_damaged';
UPDATE public.ai_scenarios SET scenario_key = 'refund_or_return'      WHERE scenario_key = 'refund_or_cancel';

-- ── 3. Migrate intent values on ai_drafts + relax then re-tighten CHECK
--    DROP CHECK first so the UPDATE can rewrite values that the old
--    CHECK still constrains; then ADD CHECK with the new 10-value list.
ALTER TABLE public.ai_drafts DROP CONSTRAINT IF EXISTS ai_drafts_intent_check;

UPDATE public.ai_drafts SET intent = 'order_status'          WHERE intent = 'wismo';
UPDATE public.ai_drafts SET intent = 'wrong_or_damaged_item' WHERE intent = 'wrong_or_damaged';
UPDATE public.ai_drafts SET intent = 'refund_or_return'      WHERE intent = 'refund_or_cancel';

ALTER TABLE public.ai_drafts ADD CONSTRAINT ai_drafts_intent_check
  CHECK (intent IN (
    'order_status',
    'long_delivery',
    'lost_package',
    'wrong_or_damaged_item',
    'refund_or_return',
    'cancellation',
    'customs_fees',
    'angry_or_chargeback',
    'other',
    'unknown'
  ));

-- ── 4. Migrate applies_to_scenario values on ai_lessons ─────────────
--    No CHECK constraint on this column so a plain UPDATE is enough.
UPDATE public.ai_lessons SET applies_to_scenario = 'order_status'          WHERE applies_to_scenario = 'wismo';
UPDATE public.ai_lessons SET applies_to_scenario = 'wrong_or_damaged_item' WHERE applies_to_scenario = 'wrong_or_damaged';
UPDATE public.ai_lessons SET applies_to_scenario = 'refund_or_return'      WHERE applies_to_scenario = 'refund_or_cancel';

-- ── 5. Rewrite global_block_intents inside ai_autonomy_rules.config ──
--    Per Notion §5 the new defaults are
--      ['refund_or_return', 'cancellation', 'angry_or_chargeback']
--    Any existing row with 'refund_or_cancel' is split into both new
--    intents; 'angry_or_chargeback' is ensured present; old intent
--    aliases on 'wismo' / 'wrong_or_damaged' are mapped to the new names.
--    Implemented as a per-row jsonb rebuild: SELECT current array, map
--    each element through the rename table, dedupe, write back.
UPDATE public.ai_autonomy_rules
SET config = jsonb_set(
  config,
  '{global_block_intents}',
  COALESCE(
    (
      SELECT to_jsonb(array_agg(DISTINCT v.new_intent))
      FROM jsonb_array_elements_text(config -> 'global_block_intents') old_intent
      CROSS JOIN LATERAL (
        VALUES
          (CASE old_intent
            WHEN 'wismo'             THEN 'order_status'
            WHEN 'wrong_or_damaged'  THEN 'wrong_or_damaged_item'
            WHEN 'refund_or_cancel'  THEN 'refund_or_return'
            ELSE old_intent
          END)
      ) AS v(new_intent)
    ),
    '[]'::jsonb
  )
)
WHERE config ? 'global_block_intents';

-- Add 'cancellation' next to 'refund_or_return' for any row that had
-- 'refund_or_cancel' before (we want both block-intents post-refactor).
UPDATE public.ai_autonomy_rules
SET config = jsonb_set(
  config,
  '{global_block_intents}',
  (config -> 'global_block_intents') || '["cancellation"]'::jsonb
)
WHERE config ? 'global_block_intents'
  AND (config -> 'global_block_intents') ? 'refund_or_return'
  AND NOT ((config -> 'global_block_intents') ? 'cancellation');

-- ── Verification ────────────────────────────────────────────────────
DO $$
DECLARE
  v_legacy_scenarios int;
  v_legacy_drafts    int;
  v_legacy_lessons   int;
  v_new_cols         int;
BEGIN
  -- Confirm no legacy scenario_keys remain on ai_scenarios
  SELECT count(*) INTO v_legacy_scenarios
  FROM public.ai_scenarios
  WHERE scenario_key IN ('wismo', 'wrong_or_damaged', 'refund_or_cancel');
  ASSERT v_legacy_scenarios = 0,
    format('expected 0 legacy scenario_keys, got %s', v_legacy_scenarios);

  -- Confirm no legacy intent values remain on ai_drafts
  SELECT count(*) INTO v_legacy_drafts
  FROM public.ai_drafts
  WHERE intent IN ('wismo', 'wrong_or_damaged', 'refund_or_cancel');
  ASSERT v_legacy_drafts = 0,
    format('expected 0 legacy intent values on ai_drafts, got %s', v_legacy_drafts);

  -- Confirm no legacy applies_to_scenario remain on ai_lessons
  SELECT count(*) INTO v_legacy_lessons
  FROM public.ai_lessons
  WHERE applies_to_scenario IN ('wismo', 'wrong_or_damaged', 'refund_or_cancel');
  ASSERT v_legacy_lessons = 0,
    format('expected 0 legacy applies_to_scenario on ai_lessons, got %s', v_legacy_lessons);

  -- Confirm the new columns exist on ai_scenarios
  SELECT count(*) INTO v_new_cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name   = 'ai_scenarios'
    AND column_name IN ('triggers', 'must_do', 'must_not_do');
  ASSERT v_new_cols = 3,
    format('expected 3 new columns on ai_scenarios, got %s', v_new_cols);

  RAISE NOTICE 'ai_scenarios onboarding refactor OK';
END;
$$;
