-- ============================================================
-- Model 3 (forced upgrade): write_locked column on workspace_subscriptions
--
-- Per docs/billing-model.md (final 2026-05-13):
--   - When a workspace hits its plan limit, write_locked is set to true
--   - All ticket-creation and outbound endpoints refuse work while locked
--   - payment.succeeded webhook clears the flag + resets usage counters
--
-- One column only — no audit columns (write_locked_at, _reason) per
-- spec rationale: every lock is plan_limit and updated_at already
-- gives us the timestamp.
--
-- Idempotent + transactional. Run manually in Supabase SQL editor
-- (project cvrzvhnsltjubmfkcxql).
-- ============================================================

begin;

alter table public.workspace_subscriptions
  add column if not exists write_locked boolean not null default false;

-- Partial index for the lock state — used by the unlock cron and the
-- admin dashboard. Locked workspaces are the minority, so a partial
-- index keeps the index small.
create index if not exists workspace_subscriptions_write_locked_idx
  on public.workspace_subscriptions (workspace_id)
  where write_locked = true;

-- ─── Verification ────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'workspace_subscriptions'
      and column_name  = 'write_locked'
  ) then
    raise exception 'workspace_subscriptions.write_locked missing';
  end if;

  raise notice 'OK — workspace_subscriptions.write_locked column + index in place';
end $$;

commit;

notify pgrst, 'reload schema';
