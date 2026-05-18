-- Store Isolation Redesign Migration
-- Spec: docs/superpowers/specs/2026-05-18-store-isolation-redesign.md

-- 1. Add store_currency and store_id to integrations
ALTER TABLE integrations
  ADD COLUMN IF NOT EXISTS store_currency text,
  ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES stores(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_integrations_store_id ON integrations(store_id);

-- 2. Migrate: create integrations rows from stores that have credentials but no matching integration
INSERT INTO integrations (workspace_id, client_id, shopify_domain, shopify_access_token, shopify_client_secret, shopify_scope, shopify_connected_at, store_currency, store_id, status)
SELECT
  s.workspace_id,
  (SELECT owner_id FROM workspaces WHERE id = s.workspace_id),
  s.shopify_domain,
  s.shopify_access_token,
  s.shopify_client_secret,
  s.shopify_scope,
  s.shopify_connected_at,
  s.store_currency,
  s.id,
  'connected'
FROM stores s
WHERE s.shopify_access_token IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM integrations i
    WHERE i.workspace_id = s.workspace_id
      AND i.shopify_domain = s.shopify_domain
  );

-- 3. Link existing integrations rows to their matching stores
UPDATE integrations i
SET store_id = s.id, store_currency = COALESCE(i.store_currency, s.store_currency)
FROM stores s
WHERE i.workspace_id = s.workspace_id
  AND i.shopify_domain = s.shopify_domain
  AND i.store_id IS NULL;

-- 4. Simplify stores table BEFORE inserting new rows (drop NOT NULL Shopify columns)
ALTER TABLE stores
  DROP COLUMN IF EXISTS shopify_domain,
  DROP COLUMN IF EXISTS shopify_access_token,
  DROP COLUMN IF EXISTS shopify_client_secret,
  DROP COLUMN IF EXISTS shopify_scope,
  DROP COLUMN IF EXISTS shopify_connected_at,
  DROP COLUMN IF EXISTS store_currency;

-- 5. Drop old unique constraint and add new one on stores
ALTER TABLE stores
  DROP CONSTRAINT IF EXISTS stores_workspace_domain_unique;

ALTER TABLE stores
  ADD CONSTRAINT uq_stores_workspace_name UNIQUE (workspace_id, name);

-- 6. For any integrations rows still without store_id (no matching store),
--    create a store from the integration's data and link it
INSERT INTO stores (workspace_id, name)
SELECT i.workspace_id, COALESCE(i.shopify_domain, 'Default Store')
FROM integrations i
WHERE i.store_id IS NULL
  AND i.shopify_domain IS NOT NULL;

UPDATE integrations i
SET store_id = s.id
FROM stores s
WHERE i.workspace_id = s.workspace_id
  AND s.name = COALESCE(i.shopify_domain, 'Default Store')
  AND i.store_id IS NULL;

-- 7. Add unique constraint on integrations(workspace_id, store_id)
ALTER TABLE integrations
  ADD CONSTRAINT uq_integrations_workspace_store UNIQUE (workspace_id, store_id);

-- 8. Add store_id to email_accounts
ALTER TABLE email_accounts
  ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES stores(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS watch_expiry timestamptz;

CREATE INDEX IF NOT EXISTS idx_email_accounts_store_id ON email_accounts(store_id);

-- 9. Link email_accounts to stores (for workspaces with exactly one store)
UPDATE email_accounts ea
SET store_id = s.id
FROM (
  SELECT workspace_id, MIN(id::text)::uuid as id
  FROM stores
  GROUP BY workspace_id
  HAVING COUNT(*) = 1
) s
WHERE ea.workspace_id = s.workspace_id
  AND ea.store_id IS NULL;

-- 10. Migrate store_email_configs data to email_accounts
-- For matching rows: set store_id on existing email_accounts
UPDATE email_accounts ea
SET store_id = sec.store_id
FROM store_email_configs sec
WHERE ea.workspace_id = sec.workspace_id
  AND ea.provider = sec.provider
  AND ea.email_address = sec.email_address
  AND ea.store_id IS NULL;

-- For non-matching rows: insert new email_accounts from store_email_configs
INSERT INTO email_accounts (workspace_id, provider, email_address, access_token, refresh_token, store_id, status, connected_at, watch_expiry)
SELECT
  sec.workspace_id,
  sec.provider,
  sec.email_address,
  sec.access_token,
  sec.refresh_token,
  sec.store_id,
  'connected',
  sec.connected_at,
  sec.watch_expiry
FROM store_email_configs sec
WHERE NOT EXISTS (
  SELECT 1 FROM email_accounts ea
  WHERE ea.workspace_id = sec.workspace_id
    AND ea.provider = sec.provider
    AND ea.email_address = sec.email_address
);

-- 11. Add store_id to email_conversations (fix: old migration targeted wrong table email_threads)
ALTER TABLE email_conversations
  ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES stores(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_email_conversations_store_id ON email_conversations(store_id);

-- 12. Link email_conversations to stores via email_accounts
UPDATE email_conversations ec
SET store_id = ea.store_id
FROM email_accounts ea
WHERE ec.email_account_id = ea.id
  AND ea.store_id IS NOT NULL
  AND ec.store_id IS NULL;

-- 13. Drop store_email_configs table (including RLS policies)
DROP POLICY IF EXISTS "Workspace members can read store email configs" ON store_email_configs;
DROP POLICY IF EXISTS "Workspace owners and admins can manage store email configs" ON store_email_configs;
DROP TABLE IF EXISTS store_email_configs;
