-- 1. Add scheduled_for_deletion_at to user_profiles
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS scheduled_for_deletion_at timestamptz DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_user_profiles_deletion
  ON public.user_profiles (scheduled_for_deletion_at)
  WHERE scheduled_for_deletion_at IS NOT NULL;

COMMENT ON COLUMN public.user_profiles.scheduled_for_deletion_at
  IS 'Non-null = account scheduled for deletion. Cron executes when this timestamp is in the past.';

-- 2. Account deletion log (append-only, no FK — user may be deleted)
CREATE TABLE IF NOT EXISTS public.account_deletion_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  user_email text NOT NULL,
  event text NOT NULL CHECK (event IN ('scheduled', 'cancelled', 'deleted', 'error')),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.account_deletion_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super-admin read-only" ON public.account_deletion_log;
CREATE POLICY "Super-admin read-only"
  ON public.account_deletion_log
  FOR SELECT
  USING (public.is_current_user_lynq_admin());

-- 3. Anonymized members audit trail
CREATE TABLE IF NOT EXISTS public.anonymized_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  original_user_id uuid NOT NULL,
  anonymized_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.anonymized_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super-admin read-only" ON public.anonymized_members;
CREATE POLICY "Super-admin read-only"
  ON public.anonymized_members
  FOR SELECT
  USING (public.is_current_user_lynq_admin());

-- 4. Anonymize workspace member function
CREATE OR REPLACE FUNCTION public.anonymize_workspace_member(p_user_id uuid, p_workspace_id uuid)
RETURNS void AS $$
DECLARE
  v_member_id uuid;
BEGIN
  -- Look up the workspace_members row for this user
  SELECT id INTO v_member_id FROM public.workspace_members
    WHERE user_id = p_user_id AND workspace_id = p_workspace_id;

  IF v_member_id IS NOT NULL THEN
    -- Nullify task references (tasks.assigned_to and created_by reference workspace_members.id)
    UPDATE public.tasks SET assigned_to = NULL WHERE assigned_to = v_member_id AND workspace_id = p_workspace_id;
    UPDATE public.tasks SET created_by = NULL WHERE created_by = v_member_id AND workspace_id = p_workspace_id;

    -- Nullify support event references (agent_id references workspace_members.id)
    UPDATE public.support_events SET agent_id = NULL WHERE agent_id = v_member_id AND workspace_id = p_workspace_id;

    -- Nullify conversation assignments (assigned_to references workspace_members.id)
    UPDATE public.email_conversations SET assigned_to = NULL WHERE assigned_to = v_member_id AND workspace_id = p_workspace_id;
  END IF;

  -- Nullify references that use auth.users(id) directly
  UPDATE public.macros SET created_by = NULL WHERE created_by = p_user_id AND workspace_id = p_workspace_id;
  UPDATE public.macro_onboarding SET created_by = NULL WHERE created_by = p_user_id AND workspace_id = p_workspace_id;

  -- Remove membership
  DELETE FROM public.workspace_members WHERE user_id = p_user_id AND workspace_id = p_workspace_id;

  -- Audit trail
  INSERT INTO public.anonymized_members (workspace_id, original_user_id, anonymized_at)
  VALUES (p_workspace_id, p_user_id, now());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
