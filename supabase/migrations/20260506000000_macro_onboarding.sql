-- ============================================================
-- macro_onboarding — stores the answers from the Generate-from-
-- your-store wizard so they can be re-used for regeneration without
-- making the customer re-fill 10 questions every time.
--
-- One row per workspace (UNIQUE workspace_id).
-- Idempotent + transactional.
-- Run in Supabase SQL Editor for project cvrzvhnsltjubmfkcxql.
-- ============================================================

begin;

create table if not exists public.macro_onboarding (
  id                 uuid        primary key default gen_random_uuid(),
  workspace_id       uuid        not null unique
                                  references public.workspaces(id) on delete cascade,
  answers            jsonb       not null default '{}',
  completed_at       timestamptz,
  last_generated_at  timestamptz,
  generation_count   integer     not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  created_by         uuid        references auth.users(id) on delete set null
);

-- updated_at trigger (mirrors the macros table pattern)
create or replace function public.macro_onboarding_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists macro_onboarding_updated_at on public.macro_onboarding;
create trigger macro_onboarding_updated_at
  before update on public.macro_onboarding
  for each row
  execute function public.macro_onboarding_set_updated_at();

-- Verification
do $$
declare v_table bool;
begin
  select exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'macro_onboarding'
  ) into v_table;
  if not v_table then raise exception 'macro_onboarding table missing'; end if;
  raise notice 'OK — macro_onboarding table + trigger present';
end $$;

commit;

notify pgrst, 'reload schema';
