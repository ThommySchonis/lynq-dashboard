-- ============================================================
-- RLS / policy remediation
--
-- Trigger: Supabase Security Advisor — `rls_disabled_in_public` on
-- public.platform_admins. A live anon-key probe surfaced three more
-- anon-reachable tables whose RLS is enabled but guarded by an
-- over-permissive USING(true) / WITH CHECK(true) policy with no role
-- restriction (so the policy applies to `anon`).
--
-- All fixes are non-breaking:
--   * platform_admins / gmail_tokens / support_events are accessed only
--     via the service-role client, which bypasses RLS.
--   * masterclasses is read via the authenticated dashboard value-feed
--     and written from the admin panel (info@lynqagency.com).
--
-- Idempotent + transactional. Project cvrzvhnsltjubmfkcxql.
-- ============================================================

begin;

-- ─── 1. platform_admins — RLS was DISABLED (anon could read AND write
--        the platform-admin allowlist → self-escalate to admin). Enable
--        RLS; add NO policies. App reads go through the service-role
--        client, which bypasses RLS, so nothing breaks. ────────────────
alter table public.platform_admins enable row level security;

-- ─── 2. gmail_tokens — policy "Service role can manage tokens" was
--        USING(true) with no TO/FOR clause, so it applied to anon for
--        every command (read AND write of Gmail OAuth tokens). Service
--        role bypasses RLS and never needed it. Drop it; the own-row
--        "Users can read own tokens" SELECT policy remains. ────────────
drop policy if exists "Service role can manage tokens" on public.gmail_tokens;

-- ─── 3. masterclasses — replace the USING(true) read/write policies with
--        scoped ones: authenticated read (dashboard value-feed),
--        admin-only write (admin panel) via the existing
--        public.is_current_user_lynq_admin() helper. ───────────────────
drop policy if exists "read"  on public.masterclasses;
drop policy if exists "write" on public.masterclasses;

create policy "masterclasses_select_authenticated"
  on public.masterclasses for select
  to authenticated
  using (true);

create policy "masterclasses_insert_admin"
  on public.masterclasses for insert
  to authenticated
  with check (public.is_current_user_lynq_admin());

create policy "masterclasses_update_admin"
  on public.masterclasses for update
  to authenticated
  using      (public.is_current_user_lynq_admin())
  with check (public.is_current_user_lynq_admin());

create policy "masterclasses_delete_admin"
  on public.masterclasses for delete
  to authenticated
  using (public.is_current_user_lynq_admin());

-- ─── 4. support_events — insert policy was WITH CHECK(true) (anon could
--        insert arbitrary events). All inserts use the service-role
--        client; make the policy explicit to service_role. ─────────────
drop policy if exists "service role can insert support events" on public.support_events;

create policy "support_events_insert_service_role"
  on public.support_events for insert
  to service_role
  with check (true);

-- ─── Verification ────────────────────────────────────────────────────
do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.platform_admins'::regclass) then
    raise exception 'platform_admins RLS not enabled';
  end if;

  if exists (
    select 1 from pg_policy
    where polrelid = 'public.gmail_tokens'::regclass
      and polname = 'Service role can manage tokens'
  ) then raise exception 'gmail_tokens permissive policy still present'; end if;

  if exists (
    select 1 from pg_policy
    where polrelid = 'public.masterclasses'::regclass
      and polname in ('read', 'write')
  ) then raise exception 'old masterclasses USING(true) policies still present'; end if;

  if (
    select count(*) from pg_policy
    where polrelid = 'public.masterclasses'::regclass
      and polname like 'masterclasses_%'
  ) <> 4 then raise exception 'masterclasses scoped policies missing'; end if;

  if exists (
    select 1 from pg_policy
    where polrelid = 'public.support_events'::regclass
      and polname = 'service role can insert support events'
  ) then raise exception 'support_events permissive insert policy still present'; end if;

  raise notice 'OK — RLS remediation applied';
end $$;

commit;

notify pgrst, 'reload schema';
