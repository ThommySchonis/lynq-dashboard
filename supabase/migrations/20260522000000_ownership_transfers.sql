-- Ownership transfer: two-step flow (initiate → accept/decline)
-- Only one pending transfer per workspace at a time.

-- 1. Table
CREATE TABLE IF NOT EXISTS ownership_transfers (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  from_user_id          uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user_id            uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  new_role_for_old_owner text       NOT NULL CHECK (new_role_for_old_owner IN ('admin', 'agent', 'observer')),
  status                text        NOT NULL DEFAULT 'pending'
                                    CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled', 'expired')),
  created_at            timestamptz NOT NULL DEFAULT now(),
  expires_at            timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  resolved_at           timestamptz
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_ownership_transfers_workspace
  ON ownership_transfers(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ownership_transfers_to_user
  ON ownership_transfers(to_user_id);

-- 3. Partial unique index — one pending transfer per workspace
CREATE UNIQUE INDEX IF NOT EXISTS idx_ownership_transfers_pending_unique
  ON ownership_transfers(workspace_id)
  WHERE status = 'pending';

-- 4. RLS
ALTER TABLE ownership_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view transfers in their workspace"
  ON ownership_transfers FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role has full access to ownership_transfers"
  ON ownership_transfers
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 5. Atomic swap function
CREATE OR REPLACE FUNCTION accept_ownership_transfer(p_transfer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_transfer RECORD;
BEGIN
  -- Lock the transfer row
  SELECT * INTO v_transfer
  FROM ownership_transfers
  WHERE id = p_transfer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transfer not found';
  END IF;

  IF v_transfer.status <> 'pending' THEN
    RAISE EXCEPTION 'Transfer is not pending (status: %)', v_transfer.status;
  END IF;

  -- Check expiration — mark expired and exit
  IF v_transfer.expires_at <= now() THEN
    UPDATE ownership_transfers
    SET status = 'expired', resolved_at = now()
    WHERE id = p_transfer_id;
    RAISE EXCEPTION 'Transfer has expired';
  END IF;

  -- Demote old owner
  UPDATE workspace_members
  SET role = v_transfer.new_role_for_old_owner
  WHERE workspace_id = v_transfer.workspace_id
    AND user_id = v_transfer.from_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Old owner membership not found';
  END IF;

  -- Promote new owner
  UPDATE workspace_members
  SET role = 'owner'
  WHERE workspace_id = v_transfer.workspace_id
    AND user_id = v_transfer.to_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target member no longer exists in the workspace';
  END IF;

  -- Mark transfer as accepted
  UPDATE ownership_transfers
  SET status = 'accepted', resolved_at = now()
  WHERE id = p_transfer_id;
END;
$$;
