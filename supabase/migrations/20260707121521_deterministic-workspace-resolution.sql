-- Deterministic workspace resolution for multi-workspace users.
--
-- Problem: a user who belongs to more than one workspace (e.g. agency staff)
-- was resolved to a DIFFERENT workspace by each of the three resolution paths:
--   1. getAuthContext (Next.js)      — .maybeSingle() threw → provisioned junk
--   2. authMiddleware (Hono)         — .maybeSingle() threw → provisioned junk
--   3. get_user_workspace_id() (SQL) — SELECT ... LIMIT 1 with no ORDER BY
-- The store connect wrote to one workspace while the stores tab / billing read
-- another, so the UI reported success but the stores tab stayed empty and
-- billing returned `no_billing_store`.
--
-- Fix (SQL side — the JS resolvers are fixed to match in lib/pick-membership.ts):
--   * get_user_workspace_id() now picks deterministically: owned workspace
--     first, then earliest joined_at, then id.
--   * provision_workspace() is made IDEMPOTENT — if the user already belongs to
--     a workspace it returns that membership instead of blindly creating a new
--     one. This is the safety net that guarantees all paths agree even if a
--     resolver ever reaches the provisioning branch.
--
-- The ordering here MUST stay in sync with pickPrimaryMembership() in both
-- lib/pick-membership.ts and supabase/functions/api/lib/pick-membership.ts.

-- ── 1. Deterministic get_user_workspace_id() ────────────────────────────────
CREATE OR REPLACE FUNCTION get_user_workspace_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws uuid;
BEGIN
  SELECT workspace_id INTO v_ws
  FROM workspace_members
  WHERE user_id = auth.uid()
  ORDER BY (role = 'owner') DESC, joined_at ASC, id ASC
  LIMIT 1;

  IF v_ws IS NULL THEN
    RAISE EXCEPTION 'NO_WORKSPACE'
      USING HINT = 'User has no active workspace membership';
  END IF;

  RETURN v_ws;
END;
$$;

-- ── 2. Idempotent provision_workspace() ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.provision_workspace(
  p_user_id        uuid,
  p_workspace_name text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_workspace_id uuid;
  v_member_id    uuid;
BEGIN
  -- Idempotency guard: if the user already belongs to a workspace, return that
  -- membership (same deterministic rule as get_user_workspace_id) instead of
  -- creating a duplicate. Prevents the runaway "new workspace per request"
  -- behaviour when a resolver reaches this branch for a multi-workspace user.
  SELECT workspace_id, id INTO v_workspace_id, v_member_id
  FROM workspace_members
  WHERE user_id = p_user_id
  ORDER BY (role = 'owner') DESC, joined_at ASC, id ASC
  LIMIT 1;

  IF v_workspace_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'workspace_id', v_workspace_id,
      'member_id',    v_member_id
    );
  END IF;

  -- Create workspace (ownership is recorded via workspace_members below).
  INSERT INTO public.workspaces (name)
  VALUES (p_workspace_name)
  RETURNING id INTO v_workspace_id;

  -- Create subscription row — single source of truth for billing state
  INSERT INTO public.workspace_subscriptions (
    workspace_id,
    plan_id,
    status,
    trial_ends_at,
    current_period_start,
    current_period_end
  )
  VALUES (
    v_workspace_id,
    'starter',
    'trial',
    now() + interval '7 days',
    now(),
    now() + interval '7 days'
  );

  -- Owner workspace_member
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (v_workspace_id, p_user_id, 'owner')
  RETURNING id INTO v_member_id;

  -- user_profile (idempotent — UPSERT in case it exists from elsewhere)
  INSERT INTO public.user_profiles (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN jsonb_build_object(
    'workspace_id', v_workspace_id,
    'member_id',    v_member_id
  );
END;
$$;
