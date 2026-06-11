create table email_conversation_tags (
  conversation_id uuid not null references email_conversations(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (conversation_id, tag_id)
);

create index email_conversation_tags_workspace_idx on email_conversation_tags (workspace_id);
create index email_conversation_tags_tag_idx on email_conversation_tags (tag_id);

alter table email_conversation_tags enable row level security;

create policy email_conversation_tags_select on email_conversation_tags
  for select using (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()));

create policy email_conversation_tags_modify on email_conversation_tags
  for all using (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid() and role in ('owner','admin','agent')))
  with check (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid() and role in ('owner','admin','agent')));
