-- ============================================================
-- Tasks table — persistent action board items
-- ============================================================

create table if not exists public.tasks (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,

  -- Content
  title         text not null,
  description   text,
  category      text,
  priority      text not null default 'medium' check (priority in ('high', 'medium', 'low')),

  -- Status flow: open → picked_up → done
  status        text not null default 'open' check (status in ('open', 'picked_up', 'done')),

  -- Assignment
  assigned_to   uuid references public.workspace_members(id) on delete set null,
  picked_up_at  timestamptz,
  completed_at  timestamptz,
  result_note   text,

  -- Links
  shopify_order_id     text,
  shopify_order_name   text,
  shopify_customer_id  text,
  customer_name        text,
  customer_email       text,

  -- Origin
  trigger_type  text not null default 'manual' check (trigger_type in ('manual', 'pattern', 'ai_insight')),
  trigger_key   text,
  created_by    uuid references public.workspace_members(id) on delete set null,

  -- Metadata (for pattern-generated tasks)
  refund_count  int,
  total_amount  numeric,

  -- Soft delete
  deleted_at    timestamptz,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Indexes
create index if not exists idx_tasks_workspace on public.tasks(workspace_id);
create unique index if not exists idx_tasks_trigger_key on public.tasks(workspace_id, trigger_key) where trigger_key is not null;
create index if not exists idx_tasks_status on public.tasks(workspace_id, status) where deleted_at is null;

-- Auto-update updated_at (reuses shared function from 20260508_workspace_settings)
drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- RLS
alter table public.tasks enable row level security;

drop policy if exists "tasks_select" on public.tasks;
create policy "tasks_select" on public.tasks for select
  using (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()));

drop policy if exists "tasks_insert" on public.tasks;
create policy "tasks_insert" on public.tasks for insert
  with check (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()));

drop policy if exists "tasks_update" on public.tasks;
create policy "tasks_update" on public.tasks for update
  using (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()));

-- No DELETE policy: hard-deletes are intentionally blocked at RLS level.
-- Soft-delete (setting deleted_at) uses UPDATE, covered by tasks_update.

-- Add cooldown tracking column to workspaces
alter table public.workspaces add column if not exists last_tasks_generated_at timestamptz;

-- Verification
do $$
begin
  assert (select count(*) from information_schema.tables where table_name = 'tasks' and table_schema = 'public') = 1,
    'tasks table was not created';
  raise notice 'tasks migration OK';
end;
$$;
