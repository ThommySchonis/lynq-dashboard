-- Extend ai_policies with brand/communication-style/cancellation fields
-- per docs/superpowers/specs/2026-06-05-ai-agent-settings-extension-design.md
--
-- All ALTERs are additive. Existing rows get the column defaults (NULL for
-- text, '[]'::jsonb for the two arrays). Stores previously marked
-- "complete" in the AI agent onboarding UI will revert to "incomplete"
-- until industry + cancellation_policy are filled — see RAISE NOTICE below.

ALTER TABLE public.ai_policies ADD COLUMN IF NOT EXISTS industry                text;
ALTER TABLE public.ai_policies ADD COLUMN IF NOT EXISTS product_categories      jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.ai_policies ADD COLUMN IF NOT EXISTS formality_level         text;
ALTER TABLE public.ai_policies ADD COLUMN IF NOT EXISTS communication_style     jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.ai_policies ADD COLUMN IF NOT EXISTS personality_preferences text;
ALTER TABLE public.ai_policies ADD COLUMN IF NOT EXISTS cancellation_policy     text;

-- formality_level is a closed enum-like text. Allow NULL (unset).
ALTER TABLE public.ai_policies DROP CONSTRAINT IF EXISTS ai_policies_formality_level_check;
ALTER TABLE public.ai_policies
  ADD CONSTRAINT ai_policies_formality_level_check
  CHECK (formality_level IS NULL OR formality_level IN ('casual', 'balanced', 'formal'));

DO $$
BEGIN
  ASSERT (SELECT count(*) FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'ai_policies'
            AND column_name IN (
              'industry', 'product_categories', 'formality_level',
              'communication_style', 'personality_preferences', 'cancellation_policy'
            )) = 6,
    'Expected 6 new columns on ai_policies';
  RAISE NOTICE 'ai_policies extended with: industry, product_categories, formality_level, communication_style, personality_preferences, cancellation_policy';
  RAISE NOTICE 'Stores previously marked complete will revert to incomplete until industry + cancellation_policy are filled.';
END;
$$;
