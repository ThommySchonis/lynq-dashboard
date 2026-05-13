-- ============================================================
-- Rename "Convert" add-on → "Meta & Instagram comments"
-- ============================================================
--
-- The Convert add-on (pre-sales chat assistance) is being repositioned
-- as a social-media comment management product. ID stays `convert` so
-- existing FKs in workspace_addons keep pointing at the same row;
-- display_name + description are updated to reflect the new scope.
--
-- The original seed in 20260512_billing_system.sql uses
-- `on conflict (id) do nothing`, so this UPDATE is needed to apply the
-- new labels to rows that were inserted by the earlier migration.
--
-- Pricing stays at €30/month (no per-unit pricing).
-- Idempotent — safe to re-run.
-- ============================================================

begin;

update public.subscription_addons
set
  display_name = 'Meta & Instagram comments',
  description  = 'Reply to Facebook and Instagram comments alongside tickets'
where id = 'convert';

commit;
