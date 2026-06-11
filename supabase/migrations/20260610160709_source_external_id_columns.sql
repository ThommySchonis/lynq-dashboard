-- Identity columns for records imported from another platform
alter table email_conversations
  add column source_platform text,
  add column source_external_id text;

alter table email_messages
  add column source_platform text,
  add column source_external_id text;

alter table tags
  add column source_platform text,
  add column source_external_id text;

alter table macros
  add column source_platform text,
  add column source_external_id text;

-- Partial unique indexes scoped by workspace.
-- Lynq-native rows (NULL source_external_id) are unaffected.
create unique index email_conversations_source_external_id_uniq
  on email_conversations (workspace_id, source_platform, source_external_id)
  where source_external_id is not null;

create unique index email_messages_source_external_id_uniq
  on email_messages (workspace_id, source_platform, source_external_id)
  where source_external_id is not null;

create unique index tags_source_external_id_uniq
  on tags (workspace_id, source_platform, source_external_id)
  where source_external_id is not null;

create unique index macros_source_external_id_uniq
  on macros (workspace_id, source_platform, source_external_id)
  where source_external_id is not null;
