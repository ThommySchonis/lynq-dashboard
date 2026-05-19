-- Support analytics events table
-- Captures state transitions for inbox analytics.
-- Schema designed for future ClickHouse migration.

create table support_events (
  id              uuid        primary key default gen_random_uuid(),
  workspace_id    uuid        not null references workspaces(id) on delete cascade,
  event_type      text        not null,
  conversation_id uuid        not null references email_conversations(id) on delete cascade,
  source          text        not null,
  agent_id        uuid        references workspace_members(id) on delete set null,
  metadata        jsonb       default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

-- Primary analytics query path
create index idx_support_events_workspace_type_date
  on support_events (workspace_id, event_type, created_at);

-- Per-ticket timeline
create index idx_support_events_workspace_conversation
  on support_events (workspace_id, conversation_id, event_type);

-- Per-agent filtering
create index idx_support_events_workspace_agent
  on support_events (workspace_id, agent_id, event_type, created_at);

-- RLS
alter table support_events enable row level security;

create policy "workspace members can read support events"
  on support_events for select
  using (
    workspace_id in (
      select workspace_id from workspace_members where user_id = auth.uid()
    )
  );

create policy "service role can insert support events"
  on support_events for insert
  with check (true);
