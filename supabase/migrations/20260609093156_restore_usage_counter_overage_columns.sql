-- Restore vestigial overage columns dropped in 20260608125923_shopify_billing.sql.
-- The previous migration removed these on the assumption they were dead per the
-- Model 3 docs, but `lib/services/limit-check.ts`, `lib/usage.ts`, and the
-- Whop webhook handlers still SELECT/INSERT them and break at runtime when missing
-- (e.g. POST /api/inbox/compose returns 500 "column usage_counters.tickets_overage
-- does not exist").
--
-- Re-added with the original NOT NULL DEFAULT 0 shape from the baseline migration.
-- Existing rows get the default; no data loss because the dropped columns were
-- always 0 under Model 3.

alter table usage_counters
  add column if not exists tickets_overage    integer not null default 0,
  add column if not exists ai_suggest_overage integer not null default 0;
