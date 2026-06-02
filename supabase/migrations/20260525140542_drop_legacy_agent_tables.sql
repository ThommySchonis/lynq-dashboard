-- Drop legacy agent system tables and sent_emails
-- These tables predate the workspace-based system and are fully replaced by:
--   - workspace_members (member management)
--   - support_events (action tracking / performance analytics)
-- sent_emails is a legacy per-user Gmail outbound log with no code references.

-- 1. Drop RLS policies on agents (only if table exists)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='agents') THEN
    EXECUTE $p$drop policy if exists "agents_select_workspace_members" on public.agents$p$;
    EXECUTE $p$drop policy if exists "agents_insert_workspace_members" on public.agents$p$;
    EXECUTE $p$drop policy if exists "agents_update_workspace_members" on public.agents$p$;
    EXECUTE $p$drop policy if exists "agents_delete_workspace_members" on public.agents$p$;
  END IF;
END $$;

-- 2. Drop RLS policies on agent_actions (only if table exists)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='agent_actions') THEN
    EXECUTE $p$drop policy if exists "agent_actions_select_workspace_members" on public.agent_actions$p$;
    EXECUTE $p$drop policy if exists "agent_actions_insert_workspace_members" on public.agent_actions$p$;
    EXECUTE $p$drop policy if exists "agent_actions_update_workspace_members" on public.agent_actions$p$;
    EXECUTE $p$drop policy if exists "agent_actions_delete_workspace_members" on public.agent_actions$p$;
  END IF;
END $$;

-- 3. Drop RLS policies on sent_emails (only if table exists)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='sent_emails') THEN
    EXECUTE $p$drop policy if exists "sent_emails_select_own" on public.sent_emails$p$;
    EXECUTE $p$drop policy if exists "sent_emails_insert_own" on public.sent_emails$p$;
    EXECUTE $p$drop policy if exists "sent_emails_update_own" on public.sent_emails$p$;
    EXECUTE $p$drop policy if exists "sent_emails_delete_own" on public.sent_emails$p$;
  END IF;
END $$;

-- 4. Drop sent_emails (has FK to agents.id)
drop table if exists public.sent_emails;

-- 5. Drop agent_actions (has FK to agents.id)
drop table if exists public.agent_actions;

-- 6. Drop agents
drop table if exists public.agents;
