-- ============================================================
-- feedback_submissions: customer-submitted bug reports / feedback
--
-- Flow:
--   - Any logged-in user can INSERT a row for themselves, scoped
--     to a workspace they belong to.
--   - Regular users have NO SELECT — they don't browse their own
--     submissions in-product.
--   - Lynq admins (currently: info@lynqagency.com) can SELECT all
--     rows via the is_lynq_admin() helper.
--
-- The is_lynq_admin(uid) function is SECURITY DEFINER so it can
-- read auth.users.email even from contexts that wouldn't normally
-- have access. The hardcoded email list is intentional v1 — when
-- the admin set grows, swap to a real admin_users table.
--
-- Idempotent + transactional. Safe to re-run.
-- ============================================================

begin;

-- ─── Admin-check helper ─────────────────────────────────────
create or replace function public.is_lynq_admin(uid uuid)
returns boolean
language sql
security definer
set search_path = public, auth
as $$
  select exists (
    select 1 from auth.users
    where id = uid
      and email in ('info@lynqagency.com')
  );
$$;

-- Allow authenticated role to call the function (RLS uses it).
grant execute on function public.is_lynq_admin(uuid) to authenticated;

-- ─── Table ───────────────────────────────────────────────────
create table if not exists public.feedback_submissions (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  type          text not null check (type in ('bug', 'feedback', 'other')),
  message       text not null check (char_length(message) between 5 and 5000),
  page_url      text,
  user_agent    text,
  created_at    timestamptz not null default now()
);

-- ─── Indexes ─────────────────────────────────────────────────
create index if not exists feedback_submissions_created_at_idx
  on public.feedback_submissions (created_at desc);

create index if not exists feedback_submissions_workspace_created_at_idx
  on public.feedback_submissions (workspace_id, created_at desc);

-- ─── RLS ─────────────────────────────────────────────────────
alter table public.feedback_submissions enable row level security;

drop policy if exists "feedback_insert_own_in_workspace" on public.feedback_submissions;
drop policy if exists "feedback_select_admin"            on public.feedback_submissions;
drop policy if exists "feedback_update_admin"            on public.feedback_submissions;
drop policy if exists "feedback_delete_admin"            on public.feedback_submissions;

-- INSERT: only as yourself, only into a workspace you're a member of.
create policy "feedback_insert_own_in_workspace"
  on public.feedback_submissions for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = feedback_submissions.workspace_id
        and wm.user_id = auth.uid()
    )
  );

-- SELECT/UPDATE/DELETE: only Lynq admins.
create policy "feedback_select_admin"
  on public.feedback_submissions for select
  to authenticated
  using (public.is_lynq_admin(auth.uid()));

create policy "feedback_update_admin"
  on public.feedback_submissions for update
  to authenticated
  using      (public.is_lynq_admin(auth.uid()))
  with check (public.is_lynq_admin(auth.uid()));

create policy "feedback_delete_admin"
  on public.feedback_submissions for delete
  to authenticated
  using (public.is_lynq_admin(auth.uid()));

-- ─── Verification ────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'feedback_submissions'
      and c.relrowsecurity = true
  ) then raise exception 'feedback_submissions RLS not enabled'; end if;

  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'is_lynq_admin'
  ) then raise exception 'is_lynq_admin() helper not found'; end if;

  raise notice 'OK — feedback_submissions table + RLS + is_lynq_admin() ready';
end $$;

commit;

notify pgrst, 'reload schema';
