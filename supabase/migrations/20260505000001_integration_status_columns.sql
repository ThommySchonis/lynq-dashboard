-- ============================================================
-- Voor /settings/integrations/{shopify,email} pages:
-- - integrations  → status text (pending|connected|error)
-- - email_accounts → status text (idem) + provider text (gmail|outlook|imap|custom)
-- - email_accounts.real_email + forwarding_address → DROP NOT NULL,
--   zodat een pending row kan bestaan zonder echte email yet.
--
-- Default 'connected' op status zorgt dat bestaande rows ongewijzigd
-- blijven werken (oude /api/email/connect flow heeft real_email +
-- forwarding_address gezet → effectief connected).
--
-- Idempotent + transactional. Run handmatig in Supabase SQL editor.
-- ============================================================

begin;

-- ── integrations.status ──────────────────────────────────────
alter table public.integrations
  add column if not exists status text not null default 'connected';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname  = 'integrations_status_check'
      and conrelid = 'public.integrations'::regclass
  ) then
    alter table public.integrations
      add constraint integrations_status_check
      check (status in ('pending', 'connected', 'error'));
  end if;
end $$;

-- ── email_accounts.status ────────────────────────────────────
alter table public.email_accounts
  add column if not exists status text not null default 'connected';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname  = 'email_accounts_status_check'
      and conrelid = 'public.email_accounts'::regclass
  ) then
    alter table public.email_accounts
      add constraint email_accounts_status_check
      check (status in ('pending', 'connected', 'error'));
  end if;
end $$;

-- ── email_accounts.provider ──────────────────────────────────
alter table public.email_accounts
  add column if not exists provider text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname  = 'email_accounts_provider_check'
      and conrelid = 'public.email_accounts'::regclass
  ) then
    alter table public.email_accounts
      add constraint email_accounts_provider_check
      check (provider is null or provider in ('gmail', 'outlook', 'imap', 'custom'));
  end if;
end $$;

-- ── relax NOT NULLs voor pending rows ───────────────────────
-- ALTER ... DROP NOT NULL is idempotent; geen-op als kolom al nullable is.
alter table public.email_accounts alter column real_email         drop not null;
alter table public.email_accounts alter column forwarding_address drop not null;

-- ── Verification ────────────────────────────────────────────
do $$
declare v_int_status int; v_email_status int; v_email_provider int;
begin
  select count(*) into v_int_status
    from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'integrations'
      and column_name  = 'status';

  select count(*) into v_email_status
    from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'email_accounts'
      and column_name  = 'status';

  select count(*) into v_email_provider
    from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'email_accounts'
      and column_name  = 'provider';

  if v_int_status <> 1 then raise exception 'integrations.status missing'; end if;
  if v_email_status <> 1 then raise exception 'email_accounts.status missing'; end if;
  if v_email_provider <> 1 then raise exception 'email_accounts.provider missing'; end if;

  raise notice 'OK — status + provider columns present';
end $$;

commit;

notify pgrst, 'reload schema';
