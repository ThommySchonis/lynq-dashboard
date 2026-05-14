-- ============================================================
-- time_sessions — structured End-of-Day report fields
--
-- Replaces the free-text eod_report column with three structured
-- fields. The old column stays in place (nullable) for backwards
-- compatibility with sessions clocked out before this migration.
--
-- New sessions write the three fields and leave eod_report NULL.
-- Old sessions have eod_report populated; the new fields are NULL.
-- Read-side code handles both shapes.
--
-- Idempotent + transactional. Run manually in Supabase SQL editor.
-- ============================================================

begin;

alter table public.time_sessions
  add column if not exists emails_answered  integer,
  add column if not exists what_went_well   text,
  add column if not exists needs_attention  text;

-- Non-negative check on emails_answered. Nullable for old rows.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname  = 'time_sessions_emails_answered_check'
      and conrelid = 'public.time_sessions'::regclass
  ) then
    alter table public.time_sessions
      add constraint time_sessions_emails_answered_check
      check (emails_answered is null or emails_answered >= 0);
  end if;
end $$;

-- ─── Verification ────────────────────────────────────────────
do $$
declare
  expected text[] := array['emails_answered', 'what_went_well', 'needs_attention'];
  col text;
begin
  foreach col in array expected loop
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name   = 'time_sessions'
        and column_name  = col
    ) then
      raise exception 'time_sessions.% missing', col;
    end if;
  end loop;

  raise notice 'OK — time_sessions EOD fields (emails_answered, what_went_well, needs_attention) ready';
end $$;

commit;

notify pgrst, 'reload schema';
