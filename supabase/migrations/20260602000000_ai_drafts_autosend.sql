-- Track auto-send outcome on ai_drafts (Emma Phase 2 — gated auto-send).
-- Set by /api/ai/reply when the autonomy rules engine evaluates a draft:
--   • auto_sent_at = now() and auto_send_blocked_reason = null when the
--     draft was sent autonomously.
--   • auto_sent_at = null and auto_send_blocked_reason = <reason> when
--     auto-send was blocked, so the UI still surfaces the suggestion.
-- The fallback path (Emma never fired) leaves both columns null.
-- Both nullable, additive — existing RLS policies cover the new columns.

ALTER TABLE public.ai_drafts ADD COLUMN IF NOT EXISTS auto_sent_at timestamptz;
ALTER TABLE public.ai_drafts ADD COLUMN IF NOT EXISTS auto_send_blocked_reason text
  CHECK (auto_send_blocked_reason IN ('master_off','blocked_intent','scenario_locked','emma_escalate','confidence_low','send_failed'));
