create table workspace_migrations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  source_platform text not null check (source_platform in ('gorgias','zendesk','reamaze','commslayer')),
  source_subdomain text,
  auth_method text not null check (auth_method in ('oauth','api_key')),
  credentials_ref uuid references integrations(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','ready','running','completed','failed','cancelled')),
  phase text check (phase in ('tags','macros','conversations')),
  time_range_start timestamptz,
  time_range_end timestamptz,
  mailbox_links jsonb not null default '{}'::jsonb,
  progress jsonb not null default '{}'::jsonb,
  cursor jsonb not null default '{}'::jsonb,
  error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index workspace_migrations_workspace_idx on workspace_migrations (workspace_id, status);
create index workspace_migrations_runnable_idx on workspace_migrations (status) where status in ('ready','running');

alter table workspace_migrations enable row level security;

create policy workspace_migrations_select on workspace_migrations
  for select using (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()));

create policy workspace_migrations_modify on workspace_migrations
  for all using (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid() and role in ('owner','admin')))
  with check (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid() and role in ('owner','admin')));

create trigger workspace_migrations_set_updated_at
  before update on workspace_migrations
  for each row execute function set_updated_at();
