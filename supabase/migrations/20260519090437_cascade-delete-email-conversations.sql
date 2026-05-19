-- Change email_conversations.email_account_id FK to CASCADE on delete
-- so removing an email account automatically removes its conversations

ALTER TABLE email_conversations
  DROP CONSTRAINT IF EXISTS email_conversations_email_account_id_fkey;

ALTER TABLE email_conversations
  ADD CONSTRAINT email_conversations_email_account_id_fkey
  FOREIGN KEY (email_account_id) REFERENCES email_accounts(id) ON DELETE CASCADE;
