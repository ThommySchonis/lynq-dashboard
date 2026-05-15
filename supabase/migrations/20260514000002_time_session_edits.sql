-- ============================================================
-- time_session_edits — append-only audit log for manual edits
-- to time_sessions rows. Admins/owners may edit a session's
-- timestamps and EOD fields; every edit lands a row here with
-- the before/after JSON, edit reason, and editor.
--
-- Immutable: no UPDATE / DELETE policies. RLS:
--   - INSERT: only an owner/admin of the session's workspace
--   - SELECT: owner/admin of that workspace, OR the session's
--             own agent (so an edited agent can see the change)
--
-- Run handmatig in Supabase SQL editor (project cvrzvhnsltjubmfkcxql).
-- ============================================================

begin;

create table if not exists public.time_session_edits (
  id                uuid        primary key default gen_random_uuid(),
  session_id        uuid        not null references public.time_sessions(id) on delete cascade,
  edited_by_user_id uuid        not null references auth.users(id) on delete set null,
  edited_at         timestamptz not null default now(),
  reason            text        not null check (char_length(trim(reason)) >= 3),
  before_json       jsonb       not null,
  after_json        jsonb       not null
);

-- Latest-first lookup per session for the "edited by …" display.
create index if not exists time_session_edits_session_edited_idx
  on public.time_session_edits (session_id, edited_at desc);

alter table public.time_session_edits enable row level security;

drop policy if exists "time_session_edits_insert_admin"          on public.time_session_edits;
drop policy if exists "time_session_edits_select_admin_or_self"  on public.time_session_edits;

-- INSERT: only an owner/admin of the session's workspace.
create policy "time_session_edits_insert_admin"
  on public.time_session_edits for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.time_sessions ts
      join public.workspace_members wm
        on wm.workspace_id = ts.workspace_id
      where ts.id      = session_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  );

-- SELECT: owner/admin of the workspace, OR the session's own agent.
create policy "time_session_edits_select_admin_or_self"
  on public.time_session_edits for select
  to authenticated
  using (
    exists (
      select 1
      from public.time_sessions ts
      where ts.id = session_id
        and (
          ts.agent_id = auth.uid()
          or exists (
            select 1
            from public.workspace_members wm
            where wm.workspace_id = ts.workspace_id
              and wm.user_id      = auth.uid()
              and wm.role in ('owner', 'admin')
          )
        )
    )
  );

-- No UPDATE / DELETE policies — audit log is immutable. Service-role
-- callers (supabaseAdmin) bypass RLS so admin maintenance scripts
-- can still operate if ever needed.

-- ─── Verification ────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'time_session_edits'
  ) then raise exception 'time_session_edits table missing'; end if;

  if not exists (
    select 1 from pg_policy
    where polrelid = 'public.time_session_edits'::regclass
      and polname  = 'time_session_edits_insert_admin'
  ) then raise exception 'insert policy missing'; end if;

  if not exists (
    select 1 from pg_policy
    where polrelid = 'public.time_session_edits'::regclass
      and polname  = 'time_session_edits_select_admin_or_self'
  ) then raise exception 'select policy missing'; end if;

  raise notice 'OK — time_session_edits table + RLS policies in place';
end $$;

commit;

notify pgrst, 'reload schema';
