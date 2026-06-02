-- ============================================================
-- Tighten admin-check helper
--
-- Old: public.is_lynq_admin(uid uuid)
--      Authenticated users could call with ANY uuid → small info-leak
--      ("which user IDs map to admins?"). Low value, but trivial to fix.
--
-- New: public.is_current_user_lynq_admin()
--      No parameter — always evaluates auth.uid() inside the function,
--      so no probing of other users' admin status is possible.
--
-- Migration steps:
--   1. Create the parameterless variant
--   2. Re-create the three feedback_submissions admin policies using it
--   3. Drop the old is_lynq_admin(uuid) — verified zero in-code callers
--      via grep before writing this migration; only the dropped policies
--      depended on it.
--
-- Idempotent + transactional. Run manually in Supabase SQL editor
-- (project cvrzvhnsltjubmfkcxql).
-- ============================================================

begin;

-- ─── 1. Parameterless variant ────────────────────────────────
create or replace function public.is_current_user_lynq_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1 from auth.users
    where id = auth.uid()
      and email in ('info@lynqagency.com')
  );
$$;

grant execute on function public.is_current_user_lynq_admin() to authenticated;

-- ─── 2. Re-create RLS policies on feedback_submissions ───────
-- Policy names match the original migration:
--   feedback_admin_select / feedback_admin_update / feedback_admin_delete
drop policy if exists "feedback_select_admin" on public.feedback_submissions;
drop policy if exists "feedback_update_admin" on public.feedback_submissions;
drop policy if exists "feedback_delete_admin" on public.feedback_submissions;
drop policy if exists "feedback_admin_select" on public.feedback_submissions;
drop policy if exists "feedback_admin_update" on public.feedback_submissions;
drop policy if exists "feedback_admin_delete" on public.feedback_submissions;

create policy "feedback_admin_select"
  on public.feedback_submissions for select
  to authenticated
  using (public.is_current_user_lynq_admin());

create policy "feedback_admin_update"
  on public.feedback_submissions for update
  to authenticated
  using      (public.is_current_user_lynq_admin())
  with check (public.is_current_user_lynq_admin());

create policy "feedback_admin_delete"
  on public.feedback_submissions for delete
  to authenticated
  using (public.is_current_user_lynq_admin());

-- ─── 3. Drop the old is_lynq_admin(uuid) ─────────────────────
-- Grep confirmed zero callers in app/ and lib/ before this migration
-- was written. The only DB-level dependents (the 3 policies above) are
-- now using the parameterless variant.
--
-- If a future commit introduces a caller of is_lynq_admin(uuid), the
-- correct response is to migrate that caller to is_current_user_lynq_admin()
-- — not to re-introduce the probing function.
drop function if exists public.is_lynq_admin(uuid);

-- ─── Verification ────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'is_current_user_lynq_admin'
  ) then raise exception 'is_current_user_lynq_admin() not present'; end if;

  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'is_lynq_admin'
  ) then raise exception 'old is_lynq_admin(uuid) still present — drop did not run'; end if;

  -- All three admin policies must exist on feedback_submissions.
  if (
    select count(*) from pg_policy
    where polrelid = 'public.feedback_submissions'::regclass
      and polname like 'feedback_admin_%'
  ) <> 3 then
    raise exception 'feedback_submissions admin policies missing after rebuild';
  end if;

  raise notice 'OK — is_current_user_lynq_admin() in place, policies rebuilt, old is_lynq_admin(uuid) dropped';
end $$;

commit;

notify pgrst, 'reload schema';
