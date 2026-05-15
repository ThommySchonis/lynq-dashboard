-- ============================================================
-- Billing — ticket-counting & reactivation columns (PR 3 of 3)
--
-- Adds the columns email_conversations needs so the inbox reply flow
-- can call recordOutboundMessage() and the inbound webhook can apply
-- the 10-day reactivation rule.
--
-- Columns added to public.email_conversations:
--
--   - last_outbound_at         timestamptz
--       set on every outbound. Drives the 10-day reactivation window
--       when a customer replies to a closed conversation.
--
--   - counted_in_usage_period  uuid → public.usage_counters(id)
--       set the first time an outbound is sent in a given billing
--       period. NULL = never been counted. Drives "count once per
--       conversation per billing period" semantics.
--
--   - billable_event_at        timestamptz
--       timestamp of the moment counted_in_usage_period was set.
--       Audit-only; nice for "when was this ticket actually billed?".
--
--   - is_spam                  boolean DEFAULT false
--       spam exclusion. Outbounds on spam=true conversations don't
--       count toward usage. There is no automatic spam classifier yet
--       (out of scope) — agents flag manually for now.
--
--   - reactivated_from         uuid → public.email_conversations(id)
--       tracking pointer for analytics: which prior closed-conversation
--       was this one created from on the 10-day-rule path? Not
--       load-bearing for billing.
--
-- Indexes:
--   - workspace_id + customer_email + last_outbound_at: 10-day-rule lookup
--   - counted_in_usage_period: join from period rollover to conversations
--
-- All columns nullable / boolean-default — adding them on a large
-- email_conversations table is an instant DDL (no row rewrite).
--
-- Idempotent — re-runs are no-ops. Single transaction.
-- ============================================================

begin;

-- ─── New columns ─────────────────────────────────────────────────

alter table public.email_conversations
  add column if not exists last_outbound_at         timestamptz,
  add column if not exists counted_in_usage_period  uuid,
  add column if not exists billable_event_at        timestamptz,
  add column if not exists is_spam                  boolean not null default false,
  add column if not exists reactivated_from         uuid;

-- ─── FKs ─────────────────────────────────────────────────────────
-- ON DELETE SET NULL for both so historical conversation rows survive
-- when a usage_counter is archived (won't happen in v1 but defensive)
-- or when a prior conversation is hard-deleted.

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'email_conversations_counted_in_usage_period_fkey'
      and conrelid = 'public.email_conversations'::regclass
  ) then
    alter table public.email_conversations
      add constraint email_conversations_counted_in_usage_period_fkey
      foreign key (counted_in_usage_period)
      references public.usage_counters(id)
      on delete set null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'email_conversations_reactivated_from_fkey'
      and conrelid = 'public.email_conversations'::regclass
  ) then
    alter table public.email_conversations
      add constraint email_conversations_reactivated_from_fkey
      foreign key (reactivated_from)
      references public.email_conversations(id)
      on delete set null;
  end if;
end $$;

-- ─── Indexes ─────────────────────────────────────────────────────

-- 10-day-rule lookup: when a new inbound arrives, find the most
-- recent closed conversation for this (workspace, customer) pair to
-- decide reopen-vs-reactivate.
create index if not exists idx_email_conversations_reactivation_lookup
  on public.email_conversations (workspace_id, customer_email, last_outbound_at desc)
  where status = 'closed';

-- Reverse-join from a usage_counter to the conversations that used it
-- (useful for analytics / "show me all conversations billed in May").
create index if not exists idx_email_conversations_counted_period
  on public.email_conversations (counted_in_usage_period)
  where counted_in_usage_period is not null;

-- ─── Verification ────────────────────────────────────────────────

do $$
declare
  v_col_count    int;
  v_fk_count     int;
  v_idx_count    int;
begin
  select count(*) into v_col_count
  from information_schema.columns
  where table_schema = 'public'
    and table_name   = 'email_conversations'
    and column_name in (
      'last_outbound_at',
      'counted_in_usage_period',
      'billable_event_at',
      'is_spam',
      'reactivated_from'
    );
  if v_col_count <> 5 then
    raise exception 'Expected 5 new columns on email_conversations, found %', v_col_count;
  end if;

  select count(*) into v_fk_count
  from pg_constraint
  where conrelid = 'public.email_conversations'::regclass
    and conname in (
      'email_conversations_counted_in_usage_period_fkey',
      'email_conversations_reactivated_from_fkey'
    );
  if v_fk_count <> 2 then
    raise exception 'Expected 2 FKs (counted_in_usage_period + reactivated_from), found %', v_fk_count;
  end if;

  select count(*) into v_idx_count
  from pg_indexes
  where schemaname = 'public'
    and indexname in (
      'idx_email_conversations_reactivation_lookup',
      'idx_email_conversations_counted_period'
    );
  if v_idx_count <> 2 then
    raise exception 'Expected 2 new indexes on email_conversations, found %', v_idx_count;
  end if;

  raise notice 'OK — counting columns ready (5 columns, 2 FKs, 2 indexes)';
end $$;

commit;

notify pgrst, 'reload schema';
