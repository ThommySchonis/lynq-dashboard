-- Add assigned_to column to email_conversations
-- References workspace_members for the team member picker.

alter table email_conversations
  add column if not exists assigned_to uuid references workspace_members(id) on delete set null;

create index idx_email_conversations_assigned_to
  on email_conversations (workspace_id, assigned_to);
