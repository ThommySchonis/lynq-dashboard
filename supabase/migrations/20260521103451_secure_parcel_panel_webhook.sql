-- Add webhook token column to integrations
ALTER TABLE public.integrations
  ADD COLUMN IF NOT EXISTS parcelpanel_webhook_token text;

-- Unique index for token lookup
CREATE UNIQUE INDEX IF NOT EXISTS uq_integrations_parcelpanel_webhook_token
  ON public.integrations (parcelpanel_webhook_token)
  WHERE parcelpanel_webhook_token IS NOT NULL;

-- Replace tracking_number unique constraint on shipments with composite
-- (workspace_id, tracking_number) to prevent cross-workspace collisions.
-- The existing constraint may be a table constraint (requires ALTER TABLE DROP CONSTRAINT)
-- or a standalone index (requires DROP INDEX). Handle both cases.
DO $$
DECLARE
  v_constraint_name text;
  v_index_name      text;
BEGIN
  -- Check for a table constraint on tracking_number without workspace_id
  SELECT conname INTO v_constraint_name
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE t.relname = 'shipments'
    AND n.nspname = 'public'
    AND c.contype = 'u'
    AND EXISTS (
      SELECT 1 FROM pg_attribute a
      JOIN pg_index i ON i.indrelid = a.attrelid AND a.attnum = ANY(i.indkey)
      WHERE i.indexrelid = c.conindid
        AND a.attname = 'tracking_number'
    )
    AND NOT EXISTS (
      SELECT 1 FROM pg_attribute a
      JOIN pg_index i ON i.indrelid = a.attrelid AND a.attnum = ANY(i.indkey)
      WHERE i.indexrelid = c.conindid
        AND a.attname = 'workspace_id'
    )
  LIMIT 1;

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.shipments DROP CONSTRAINT IF EXISTS ' || quote_ident(v_constraint_name);
  ELSE
    -- Fallback: drop a standalone unique index on tracking_number without workspace_id
    SELECT indexname INTO v_index_name
    FROM pg_indexes
    WHERE tablename = 'shipments'
      AND schemaname = 'public'
      AND indexdef LIKE '%tracking_number%'
      AND indexdef NOT LIKE '%workspace_id%'
    LIMIT 1;

    IF v_index_name IS NOT NULL THEN
      EXECUTE 'DROP INDEX IF EXISTS public.' || quote_ident(v_index_name);
    END IF;
  END IF;
END $$;

-- Create composite unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS uq_shipments_workspace_tracking
  ON public.shipments (workspace_id, tracking_number);
