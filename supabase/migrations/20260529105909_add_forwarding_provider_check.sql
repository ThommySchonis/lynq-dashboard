-- Update provider check constraint to include 'forwarding'
ALTER TABLE public.email_accounts DROP CONSTRAINT IF EXISTS email_accounts_provider_check;
ALTER TABLE public.email_accounts
  ADD CONSTRAINT email_accounts_provider_check
  CHECK (provider IS NULL OR provider IN ('gmail', 'outlook', 'imap', 'custom', 'forwarding'));
