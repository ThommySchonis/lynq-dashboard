-- Add columns for email forwarding feature (Gorgias-style)
-- Supports forwarding-based email connection as alternative to IMAP/SMTP

ALTER TABLE public.email_accounts ADD COLUMN IF NOT EXISTS domain_verified boolean DEFAULT false;
ALTER TABLE public.email_accounts ADD COLUMN IF NOT EXISTS forwarding_verified boolean DEFAULT false;
ALTER TABLE public.email_accounts ADD COLUMN IF NOT EXISTS resend_domain_id text;
ALTER TABLE public.email_accounts ADD COLUMN IF NOT EXISTS verification_token text;
ALTER TABLE public.email_accounts ADD COLUMN IF NOT EXISTS verification_token_expires_at timestamptz;
ALTER TABLE public.email_accounts ADD COLUMN IF NOT EXISTS sender_domain text;

-- Unique index on forwarding_address to prevent hash collisions
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_accounts_forwarding_address
  ON email_accounts(forwarding_address) WHERE forwarding_address IS NOT NULL;
