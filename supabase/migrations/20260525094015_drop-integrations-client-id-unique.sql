-- Drop legacy unique constraint on integrations.client_id
-- Multi-store support means the same user can connect multiple stores,
-- so client_id is no longer unique. Uniqueness is enforced by
-- uq_integrations_workspace_store (workspace_id, store_id) instead.
ALTER TABLE public.integrations
  DROP CONSTRAINT IF EXISTS integrations_client_id_unique;
