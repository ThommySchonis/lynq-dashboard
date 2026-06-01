-- Phase 2: Drop owner_id from workspaces.
-- All runtime code now derives ownership from workspace_members.role = 'owner'.
-- Safe to drop because Phase 1 removed all code references.
--
-- IMPORTANT: Only run this migration AFTER Phase 1 code changes are deployed
-- and verified in production.

ALTER TABLE workspaces DROP COLUMN IF EXISTS owner_id;
