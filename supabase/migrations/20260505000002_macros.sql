-- ============================================================
-- Macros — pre-made response templates with variables.
-- Phase 1: manual CRUD only. AI generation is Phase 2.
--
-- Idempotent + transactional. Run in Supabase SQL Editor for
-- project cvrzvhnsltjubmfkcxql.
-- ============================================================

begin;

-- ── Table ───────────────────────────────────────────────────
create table if not exists public.macros (
  id           uuid        primary key default gen_random_uuid(),
  workspace_id uuid        not null references public.workspaces(id) on delete cascade,
  name         text        not null,
  body         text        not null default '',
  language     text        not null default 'auto'
                           check (language in ('auto', 'en', 'nl', 'fr', 'de', 'es', 'it')),
  tags         text[]      not null default '{}',
  usage_count  integer     not null default 0,
  last_used_at timestamptz,
  archived_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid        references auth.users(id) on delete set null
);

-- ── Indexes ────────────────────────────────────────────────
create index if not exists macros_ws_idx
  on public.macros (workspace_id);

create index if not exists macros_ws_archived_idx
  on public.macros (workspace_id, archived_at);

create index if not exists macros_ws_name_idx
  on public.macros (workspace_id, lower(name));

-- ── Auto-update updated_at on UPDATE ───────────────────────
create or replace function public.macros_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists macros_updated_at on public.macros;
create trigger macros_updated_at
  before update on public.macros
  for each row
  execute function public.macros_set_updated_at();

-- ── Verification ───────────────────────────────────────────
do $$
declare v_table bool;
begin
  select exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'macros'
  ) into v_table;
  if not v_table then raise exception 'macros table missing'; end if;
  raise notice 'OK — macros table + indexes + updated_at trigger present';
end $$;

commit;

notify pgrst, 'reload schema';
