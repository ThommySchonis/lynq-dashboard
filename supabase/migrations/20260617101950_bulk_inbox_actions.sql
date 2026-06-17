-- Bulk inbox actions: snooze support.
-- 'snoozed' is a new value for email_conversations.status (free-text, no CHECK
-- constraint exists, so no constraint change needed). is_spam already exists.
-- snoozed_until is a display-only hint; conversations leave the Snoozed folder
-- only when a user manually moves them (no auto-reopen cron in Phase 1).

alter table public.email_conversations
  add column if not exists snoozed_until timestamptz;

-- Partial index so the Snoozed folder query stays fast.
create index if not exists idx_email_conversations_workspace_snoozed
  on public.email_conversations (workspace_id)
  where status = 'snoozed';

-- Partial index for the Spam folder (is_spam = true is a small subset).
create index if not exists idx_email_conversations_workspace_spam
  on public.email_conversations (workspace_id)
  where is_spam = true;
