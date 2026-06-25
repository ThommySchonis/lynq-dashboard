-- Dedicated persistence for ticket meta fields (BE-task #11).
-- All nullable text, no constraints; tier's allowed values are enforced in the UI.
alter table public.email_conversations
  add column if not exists contact_reason text,
  add column if not exists product        text,
  add column if not exists resolution     text,
  add column if not exists tier           text;
