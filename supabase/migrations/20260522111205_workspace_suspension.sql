-- Add suspension columns to workspaces table
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS suspended_at      timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS suspension_reason  text        DEFAULT NULL;

-- Index for cron queries that filter by suspension state
CREATE INDEX IF NOT EXISTS idx_workspaces_suspended_at ON public.workspaces (suspended_at)
  WHERE suspended_at IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN public.workspaces.suspended_at IS 'Non-null = workspace suspended. Used for read-only enforcement + 7-day sync grace period.';
COMMENT ON COLUMN public.workspaces.suspension_reason IS 'Optional admin-provided reason shown in banner/email. Cleared on unsuspend.';
