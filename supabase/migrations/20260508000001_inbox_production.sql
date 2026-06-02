-- supabase/migrations/20260508_inbox_production.sql

-- 0. Fix email_accounts status CHECK constraint (old: pending/connected/error → new: active/disconnected/error)
ALTER TABLE email_accounts DROP CONSTRAINT IF EXISTS email_accounts_status_check;
ALTER TABLE email_accounts ADD CONSTRAINT email_accounts_status_check CHECK (status IN ('active', 'disconnected', 'error', 'pending', 'connected'));
-- Keep old values valid during migration, new code uses active/disconnected/error

-- 1. Update email_accounts: add columns for unified token storage
ALTER TABLE email_accounts
  ADD COLUMN IF NOT EXISTS access_token text,
  ADD COLUMN IF NOT EXISTS refresh_token text,
  ADD COLUMN IF NOT EXISTS encrypted_password text,
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS imap_host text,
  ADD COLUMN IF NOT EXISTS imap_port integer,
  ADD COLUMN IF NOT EXISTS smtp_host text,
  ADD COLUMN IF NOT EXISTS smtp_port integer,
  ADD COLUMN IF NOT EXISTS is_default boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_sync_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_address text;

-- 2. Add missing columns to email_conversations
ALTER TABLE email_conversations
  ADD COLUMN IF NOT EXISTS email_account_id uuid REFERENCES email_accounts(id),
  ADD COLUMN IF NOT EXISTS snippet text,
  ADD COLUMN IF NOT EXISTS provider_thread_id text,
  ADD COLUMN IF NOT EXISTS shopify_customer_id text,
  ADD COLUMN IF NOT EXISTS message_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_unread boolean DEFAULT true;

-- 3. Add missing columns to email_messages
ALTER TABLE email_messages
  ADD COLUMN IF NOT EXISTS provider_message_id text,
  ADD COLUMN IF NOT EXISTS to_email text,
  ADD COLUMN IF NOT EXISTS to_name text,
  ADD COLUMN IF NOT EXISTS cc jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS bcc jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS subject text;

-- 4. Create conversation_notes table
CREATE TABLE IF NOT EXISTS conversation_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES email_conversations(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 5. RLS for conversation_notes
ALTER TABLE conversation_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conversation_notes_select_workspace_members" ON conversation_notes;
CREATE POLICY "conversation_notes_select_workspace_members"
  ON conversation_notes FOR SELECT
  USING (workspace_id IN (SELECT public.user_workspace_ids()));

DROP POLICY IF EXISTS "conversation_notes_insert_workspace_members" ON conversation_notes;
CREATE POLICY "conversation_notes_insert_workspace_members"
  ON conversation_notes FOR INSERT
  WITH CHECK (workspace_id IN (SELECT public.user_workspace_ids()));

-- 6. Unique constraint for email_accounts upsert
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_accounts_workspace_provider_email
  ON email_accounts(workspace_id, provider, email_address);

-- 7. Indexes
CREATE INDEX IF NOT EXISTS idx_email_conversations_workspace_status
  ON email_conversations(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_email_conversations_workspace_last_message
  ON email_conversations(workspace_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_conversations_customer_email
  ON email_conversations(customer_email);
CREATE INDEX IF NOT EXISTS idx_email_conversations_provider_thread
  ON email_conversations(provider_thread_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_messages_provider_message_id
  ON email_messages(provider_message_id)
  WHERE provider_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_messages_conversation_created
  ON email_messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_conversation_notes_conversation
  ON conversation_notes(conversation_id, created_at);
