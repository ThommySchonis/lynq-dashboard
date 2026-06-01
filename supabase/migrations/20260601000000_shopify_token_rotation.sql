-- Add columns for Shopify expiring token rotation
ALTER TABLE integrations
  ADD COLUMN IF NOT EXISTS shopify_client_id text,
  ADD COLUMN IF NOT EXISTS shopify_refresh_token text,
  ADD COLUMN IF NOT EXISTS shopify_token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS shopify_refresh_token_expires_at timestamptz;

COMMENT ON COLUMN integrations.shopify_client_id IS 'OAuth app client_id used to connect this store — needed for token refresh';
COMMENT ON COLUMN integrations.shopify_refresh_token IS 'Shopify OAuth refresh token (shprt_...) — 90-day lifetime';
COMMENT ON COLUMN integrations.shopify_token_expires_at IS 'When shopify_access_token expires — NULL means non-expiring/manual token';
COMMENT ON COLUMN integrations.shopify_refresh_token_expires_at IS 'When shopify_refresh_token expires (90 days from issuance)';
