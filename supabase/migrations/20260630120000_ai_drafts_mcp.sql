-- ============================================================
-- ai_drafts — allow MCP-sourced drafts and the store_disabled
-- block reason.
--   • prompt_path gains 'mcp' so agent-composed replies are
--     distinguishable from Emma ('emma') and legacy ('fallback').
--   • auto_send_blocked_reason gains 'store_disabled' — the app's
--     own emma-generate path already emits this reason but the
--     original CHECK omitted it, so those rows silently failed to
--     persist. This fixes that latent gap too.
-- ============================================================

ALTER TABLE public.ai_drafts DROP CONSTRAINT IF EXISTS ai_drafts_prompt_path_check;
ALTER TABLE public.ai_drafts
  ADD CONSTRAINT ai_drafts_prompt_path_check
  CHECK (prompt_path IN ('emma', 'fallback', 'mcp'));

ALTER TABLE public.ai_drafts DROP CONSTRAINT IF EXISTS ai_drafts_auto_send_blocked_reason_check;
ALTER TABLE public.ai_drafts
  ADD CONSTRAINT ai_drafts_auto_send_blocked_reason_check
  CHECK (auto_send_blocked_reason IN ('master_off','blocked_intent','scenario_locked','emma_escalate','confidence_low','send_failed','store_disabled'));
