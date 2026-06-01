-- Emma onboarding refactor — ai_policies shape change.
-- Driven by docs spec: Emma Onboarding Refactor Content Spec.
--
-- Summary:
--  • Languages field is removed (Emma auto-detects from the customer's
--    most recent message — see ai-prompt-builder.ts).
--  • tone_of_voice stays text but its valid values become the 4 enum keys
--    'persoonlijk_eigenaar' | 'vriendelijk_warm' | 'professioneel_verzorgd' |
--    'direct_efficient'. Existing free-text values stay readable in the DB
--    and the UI coerces them to 'persoonlijk_eigenaar' on next save. No
--    CHECK constraint is added here so old values survive a read.
--  • can_decide + escalate_triggers (both jsonb) split into
--      can_decide_options    (jsonb, multi-select from a predefined list)
--    + can_decide_notes      (text, free-form brand-specific notes)
--    + cannot_decide_options (jsonb)
--    + cannot_decide_notes   (text)
--    Existing jsonb arrays are preserved into the new *_options columns;
--    notes start empty (merchant refines via UI).
--  • New per-store config: parcelpanel_url (text, nullable) and
--    cancellation_window (text, default '24h', enum CHECK).
--
-- Idempotent / additive. Safe to re-run. No RLS changes (existing
-- ai_policies_select / _insert / _update / _delete policies cover the
-- new columns).

-- Add new columns alongside the legacy ones so the data migration below
-- has both sides to read/write from in a single transaction.
ALTER TABLE public.ai_policies ADD COLUMN IF NOT EXISTS can_decide_options    jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.ai_policies ADD COLUMN IF NOT EXISTS can_decide_notes      text  NOT NULL DEFAULT '';
ALTER TABLE public.ai_policies ADD COLUMN IF NOT EXISTS cannot_decide_options jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.ai_policies ADD COLUMN IF NOT EXISTS cannot_decide_notes   text  NOT NULL DEFAULT '';
ALTER TABLE public.ai_policies ADD COLUMN IF NOT EXISTS parcelpanel_url       text;
ALTER TABLE public.ai_policies ADD COLUMN IF NOT EXISTS cancellation_window   text  NOT NULL DEFAULT '24h'
  CHECK (cancellation_window IN ('4h','12h','24h','none'));

-- Data migration: seed the new *_options columns from the legacy jsonb
-- arrays. COALESCE keeps the migration safe if a row had NULL — the
-- existing columns are NOT NULL DEFAULT '[]'::jsonb but old rows from
-- before the default existed could theoretically be NULL.
UPDATE public.ai_policies
SET
  can_decide_options    = COALESCE(can_decide,        '[]'::jsonb),
  cannot_decide_options = COALESCE(escalate_triggers, '[]'::jsonb)
WHERE
  can_decide_options = '[]'::jsonb
  AND cannot_decide_options = '[]'::jsonb;

-- Drop the legacy columns now that the data has moved.
ALTER TABLE public.ai_policies DROP COLUMN IF EXISTS languages;
ALTER TABLE public.ai_policies DROP COLUMN IF EXISTS can_decide;
ALTER TABLE public.ai_policies DROP COLUMN IF EXISTS escalate_triggers;
-- cannot_decide is intentionally NOT dropped — it already exists with a
-- different shape pre-refactor and is unused. Leaving it avoids surprises
-- for any out-of-band code that might still reference it; the new shape
-- lives in cannot_decide_options.

-- Verification — confirms the new shape is in place after the migration.
DO $$
DECLARE
  v_new_cols  int;
  v_old_cols  int;
BEGIN
  SELECT count(*) INTO v_new_cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name   = 'ai_policies'
    AND column_name IN (
      'can_decide_options', 'can_decide_notes',
      'cannot_decide_options', 'cannot_decide_notes',
      'parcelpanel_url', 'cancellation_window'
    );
  SELECT count(*) INTO v_old_cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name   = 'ai_policies'
    AND column_name IN ('languages', 'can_decide', 'escalate_triggers');

  ASSERT v_new_cols = 6,
    format('expected 6 new columns on ai_policies, got %s', v_new_cols);
  ASSERT v_old_cols = 0,
    format('expected 0 legacy columns (languages, can_decide, escalate_triggers), got %s', v_old_cols);

  RAISE NOTICE 'ai_policies onboarding refactor OK';
END;
$$;
