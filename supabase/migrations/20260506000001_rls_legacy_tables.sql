-- ============================================================
-- RLS for legacy tables: broadcasts, notifications, sent_emails
-- (gemist in 20260505_rls_workspace_aware_policies.sql)
--
-- Threat model:
--   - broadcasts/notifications: platform-wide content, alleen
--     super-admin (info@lynqagency.com) schrijft via /admin paginas
--     met de anon-key supabase client. RLS policy met JWT email
--     check houdt non-admins eruit op DB-niveau.
--   - sent_emails: per-user log van Gmail outbound. Code path gaat
--     via supabaseAdmin (service-role, bypasses RLS), maar policies
--     hieronder zijn defense-in-depth voor anon-key access.
--
-- Idempotent + transactional. Run handmatig in Supabase SQL editor
-- (project cvrzvhnsltjubmfkcxql).
-- ============================================================

begin;

-- ─── broadcasts ─────────────────────────────────────────────
alter table public.broadcasts enable row level security;

drop policy if exists "broadcasts_select_all_authenticated" on public.broadcasts;
drop policy if exists "broadcasts_admin_all"                on public.broadcasts;

create policy "broadcasts_select_all_authenticated"
  on public.broadcasts for select
  to authenticated
  using (true);

-- Super-admin (info@lynqagency.com) krijgt FULL access — INSERT/UPDATE/
-- DELETE plus SELECT (OR'd met de algemene SELECT policy = nog steeds true).
create policy "broadcasts_admin_all"
  on public.broadcasts for all
  to authenticated
  using      (auth.jwt() ->> 'email' = 'info@lynqagency.com')
  with check (auth.jwt() ->> 'email' = 'info@lynqagency.com');

-- ─── notifications ──────────────────────────────────────────
alter table public.notifications enable row level security;

drop policy if exists "notifications_select_all_authenticated" on public.notifications;
drop policy if exists "notifications_admin_all"                on public.notifications;

create policy "notifications_select_all_authenticated"
  on public.notifications for select
  to authenticated
  using (true);

create policy "notifications_admin_all"
  on public.notifications for all
  to authenticated
  using      (auth.jwt() ->> 'email' = 'info@lynqagency.com')
  with check (auth.jwt() ->> 'email' = 'info@lynqagency.com');

-- ─── sent_emails: per-user owned (may not exist in fresh local DB) ──
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='sent_emails') then
    execute 'alter table public.sent_emails enable row level security';

    execute $p$drop policy if exists "sent_emails_select_own" on public.sent_emails$p$;
    execute $p$drop policy if exists "sent_emails_insert_own" on public.sent_emails$p$;
    execute $p$drop policy if exists "sent_emails_update_own" on public.sent_emails$p$;
    execute $p$drop policy if exists "sent_emails_delete_own" on public.sent_emails$p$;

    execute $p$create policy "sent_emails_select_own" on public.sent_emails for select to authenticated using (user_id = auth.uid())$p$;
    execute $p$create policy "sent_emails_insert_own" on public.sent_emails for insert to authenticated with check (user_id = auth.uid())$p$;
    execute $p$create policy "sent_emails_update_own" on public.sent_emails for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())$p$;
    execute $p$create policy "sent_emails_delete_own" on public.sent_emails for delete to authenticated using (user_id = auth.uid())$p$;
  end if;
end $$;

-- ─── Verification ──────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'broadcasts' and c.relrowsecurity = true
  ) then raise exception 'broadcasts RLS not enabled'; end if;

  if not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'notifications' and c.relrowsecurity = true
  ) then raise exception 'notifications RLS not enabled'; end if;

  raise notice 'OK — RLS enabled on broadcasts, notifications (+ sent_emails if table exists)';
end $$;

commit;

notify pgrst, 'reload schema';
