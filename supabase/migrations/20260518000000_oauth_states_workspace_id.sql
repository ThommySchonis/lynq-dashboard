-- Add workspace_id to oauth_states so the callback can skip the workspace_members lookup.
-- Nullable for backward compatibility with any in-flight OAuth rows.
ALTER TABLE oauth_states ADD COLUMN IF NOT EXISTS workspace_id uuid;
