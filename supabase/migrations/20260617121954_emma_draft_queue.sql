-- Async queue for bulk "Hand off to Emma" draft generation.
-- Rows are enqueued by the inbox bulk endpoint and drained by the Vercel-Cron
-- processor (app/api/cron/emma-drafts), which calls generateEmmaDraft() per row.
create table emma_draft_queue (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  conversation_id uuid not null references email_conversations(id) on delete cascade,
  user_id uuid not null,
  user_email text,
  member_id uuid,
  language text,
  status text not null default 'pending'
    check (status in ('pending','processing','completed','failed','skipped')),
  attempts integer not null default 0,
  error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index emma_draft_queue_pending_idx
  on emma_draft_queue (created_at)
  where status = 'pending';

create index emma_draft_queue_ws_conv_idx
  on emma_draft_queue (workspace_id, conversation_id);

alter table emma_draft_queue enable row level security;

create policy emma_draft_queue_select on emma_draft_queue
  for select using (
    workspace_id in (select workspace_id from workspace_members where user_id = auth.uid())
  );
