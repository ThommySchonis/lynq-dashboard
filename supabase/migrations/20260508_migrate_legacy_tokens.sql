-- supabase/migrations/20260508_migrate_legacy_tokens.sql

-- Migrate gmail_tokens → email_accounts
-- Note: gmail_tokens uses user_id, we need workspace_id from workspace_members
-- client_id is a NOT NULL legacy column — set it to user_id
INSERT INTO email_accounts (client_id, workspace_id, provider, email_address, display_name, access_token, refresh_token, expires_at, status)
SELECT
  gt.user_id,
  wm.workspace_id,
  'gmail',
  gt.gmail_address,
  COALESCE(gt.gmail_address, gt.email),
  gt.access_token,
  gt.refresh_token,
  gt.expires_at,
  'active'
FROM gmail_tokens gt
JOIN workspace_members wm ON wm.user_id = gt.user_id
WHERE gt.access_token IS NOT NULL
ON CONFLICT (workspace_id, provider, email_address) DO NOTHING;

-- Migrate outlook_tokens → email_accounts
INSERT INTO email_accounts (client_id, workspace_id, provider, email_address, display_name, access_token, refresh_token, expires_at, status)
SELECT
  ot.user_id,
  wm.workspace_id,
  'outlook',
  ot.email,
  ot.email,
  ot.access_token,
  ot.refresh_token,
  ot.expires_at,
  'active'
FROM outlook_tokens ot
JOIN workspace_members wm ON wm.user_id = ot.user_id
WHERE ot.access_token IS NOT NULL
ON CONFLICT (workspace_id, provider, email_address) DO NOTHING;

-- Migrate custom_email_tokens → email_accounts
INSERT INTO email_accounts (client_id, workspace_id, provider, email_address, display_name, encrypted_password, username, imap_host, imap_port, smtp_host, smtp_port, status)
SELECT
  ct.user_id,
  wm.workspace_id,
  'custom',
  ct.email,
  ct.email,
  ct.encrypted_password,
  ct.email,
  ct.imap_host,
  ct.imap_port,
  ct.smtp_host,
  ct.smtp_port,
  'active'
FROM custom_email_tokens ct
JOIN workspace_members wm ON wm.user_id = ct.user_id
WHERE ct.encrypted_password IS NOT NULL
ON CONFLICT (workspace_id, provider, email_address) DO NOTHING;

-- Set first account per workspace as default
UPDATE email_accounts ea
SET is_default = true
WHERE ea.id = (
  SELECT id FROM email_accounts
  WHERE workspace_id = ea.workspace_id
  ORDER BY connected_at ASC
  LIMIT 1
)
AND NOT EXISTS (
  SELECT 1 FROM email_accounts
  WHERE workspace_id = ea.workspace_id AND is_default = true
);
