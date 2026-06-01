-- Extend ai_drafts with structured-generation metadata (Emma structured output).
-- Captured only on the Emma path via structured output; left null on the
-- fallback path. All nullable, additive — existing RLS policies cover the
-- new columns.

ALTER TABLE public.ai_drafts ADD COLUMN IF NOT EXISTS intent          text
  CHECK (intent IN ('wismo','long_delivery','lost_package','wrong_or_damaged','refund_or_cancel','customs_fees','angry_or_chargeback','other','unknown'));
ALTER TABLE public.ai_drafts ADD COLUMN IF NOT EXISTS confidence      numeric
  CHECK (confidence >= 0 AND confidence <= 1);
ALTER TABLE public.ai_drafts ADD COLUMN IF NOT EXISTS should_escalate boolean;
ALTER TABLE public.ai_drafts ADD COLUMN IF NOT EXISTS escalate_reason text;
