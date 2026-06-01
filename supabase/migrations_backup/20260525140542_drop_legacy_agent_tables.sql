-- Drop legacy agent system tables and sent_emails
-- These tables predate the workspace-based system and are fully replaced by:
--   - workspace_members (member management)
--   - support_events (action tracking / performance analytics)
-- sent_emails is a legacy per-user Gmail outbound log with no code references.

-- 1. Drop RLS policies on agents
drop policy if exists "agents_select_workspace_members" on public.agents;
drop policy if exists "agents_insert_workspace_members" on public.agents;
drop policy if exists "agents_update_workspace_members" on public.agents;
drop policy if exists "agents_delete_workspace_members" on public.agents;

-- 2. Drop RLS policies on agent_actions
drop policy if exists "agent_actions_select_workspace_members" on public.agent_actions;
drop policy if exists "agent_actions_insert_workspace_members" on public.agent_actions;
drop policy if exists "agent_actions_update_workspace_members" on public.agent_actions;
drop policy if exists "agent_actions_delete_workspace_members" on public.agent_actions;

-- 3. Drop RLS policies on sent_emails
drop policy if exists "sent_emails_select_own" on public.sent_emails;
drop policy if exists "sent_emails_insert_own" on public.sent_emails;
drop policy if exists "sent_emails_update_own" on public.sent_emails;
drop policy if exists "sent_emails_delete_own" on public.sent_emails;

-- 4. Drop sent_emails (has FK to agents.id)
drop table if exists public.sent_emails;

-- 5. Drop agent_actions (has FK to agents.id)
drop table if exists public.agent_actions;

-- 6. Drop agents
drop table if exists public.agents;
