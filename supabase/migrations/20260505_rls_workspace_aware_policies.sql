-- ============================================================
-- RLS herziening — workspace-aware policies voor de helpdesk.
--
-- Dekt 19 tabellen:
--   meta  (3): workspaces, workspace_members, workspace_invites
--   data (16): clients, integrations, email_accounts,
--             email_conversations, email_messages, shopify_orders,
--             shipments, analytics_actions, ai_settings, agents,
--             agent_actions, time_sessions, macros, macro_onboarding,
--             tags, team_members
--
-- Idempotent: drop bestaande policies via DO block, daarna recreate.
-- Helper functions zijn `create or replace`. Single transaction.
--
-- Run handmatig in Supabase SQL editor (project cvrzvhnsltjubmfkcxql).
-- ============================================================

begin;

-- ─── Enable RLS on all 19 tables (idempotent) ────────────────

alter table public.workspaces             enable row level security;
alter table public.workspace_members      enable row level security;
alter table public.workspace_invites      enable row level security;
alter table public.team_members           enable row level security;
alter table public.clients                enable row level security;
alter table public.integrations           enable row level security;
alter table public.email_accounts         enable row level security;
alter table public.email_conversations    enable row level security;
alter table public.email_messages         enable row level security;
alter table public.shopify_orders         enable row level security;
alter table public.shipments              enable row level security;
alter table public.analytics_actions      enable row level security;
alter table public.ai_settings            enable row level security;
alter table public.agents                 enable row level security;
alter table public.agent_actions          enable row level security;
alter table public.time_sessions          enable row level security;
alter table public.macros                 enable row level security;
alter table public.macro_onboarding       enable row level security;
alter table public.tags                   enable row level security;

-- ============================================================
-- STAP A — Helper functions
-- SECURITY DEFINER zodat ze workspace_members kunnen lezen
-- zonder zelf in een RLS-recursie te belanden.
-- `set search_path = public, pg_temp` voorkomt search-path attacks
-- waar een attacker een schema/object zou kunnen shadowen.
-- ============================================================

create or replace function public.user_workspace_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select workspace_id from public.workspace_members
  where user_id = auth.uid()
$$;

create or replace function public.user_role_in_workspace(ws_id uuid)
returns text
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select role from public.workspace_members
  where user_id = auth.uid() and workspace_id = ws_id
$$;

create or replace function public.user_is_workspace_owner(ws_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists(
    select 1 from public.workspace_members
    where user_id = auth.uid()
      and workspace_id = ws_id
      and role = 'owner'
  )
$$;

-- ============================================================
-- STAP B — Drop bestaande policies op alle 19 helpdesk tabellen.
-- Dynamic SQL via pg_policies, zodat herhaalde runs niet falen.
-- ============================================================

do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'workspaces','workspace_members','workspace_invites','team_members',
        'clients','integrations','email_accounts','email_conversations',
        'email_messages','shopify_orders','shipments','analytics_actions',
        'ai_settings','agents','agent_actions','time_sessions','macros',
        'macro_onboarding','tags'
      )
  loop
    execute format('drop policy if exists %I on %I.%I',
      r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- ============================================================
-- STAP C — Standaard 4-policy patroon voor 16 data-tabellen.
-- Een member van een workspace mag SELECT/INSERT/UPDATE/DELETE
-- op rijen waarvan workspace_id matched een eigen workspace.
-- Geen rol-onderscheid tussen owner/admin/agent — die check is
-- al elders (Block C lib/permissions.js, server-side).
-- ============================================================

-- ── clients ───────────────────────────────────────────────────
create policy "clients_select_workspace_members"
  on public.clients for select
  using (workspace_id in (select public.user_workspace_ids()));

create policy "clients_insert_workspace_members"
  on public.clients for insert
  with check (workspace_id in (select public.user_workspace_ids()));

create policy "clients_update_workspace_members"
  on public.clients for update
  using (workspace_id in (select public.user_workspace_ids()))
  with check (workspace_id in (select public.user_workspace_ids()));

create policy "clients_delete_workspace_members"
  on public.clients for delete
  using (workspace_id in (select public.user_workspace_ids()));

-- ── integrations ──────────────────────────────────────────────
create policy "integrations_select_workspace_members"
  on public.integrations for select
  using (workspace_id in (select public.user_workspace_ids()));

create policy "integrations_insert_workspace_members"
  on public.integrations for insert
  with check (workspace_id in (select public.user_workspace_ids()));

create policy "integrations_update_workspace_members"
  on public.integrations for update
  using (workspace_id in (select public.user_workspace_ids()))
  with check (workspace_id in (select public.user_workspace_ids()));

create policy "integrations_delete_workspace_members"
  on public.integrations for delete
  using (workspace_id in (select public.user_workspace_ids()));

-- ── email_accounts ────────────────────────────────────────────
create policy "email_accounts_select_workspace_members"
  on public.email_accounts for select
  using (workspace_id in (select public.user_workspace_ids()));

create policy "email_accounts_insert_workspace_members"
  on public.email_accounts for insert
  with check (workspace_id in (select public.user_workspace_ids()));

create policy "email_accounts_update_workspace_members"
  on public.email_accounts for update
  using (workspace_id in (select public.user_workspace_ids()))
  with check (workspace_id in (select public.user_workspace_ids()));

create policy "email_accounts_delete_workspace_members"
  on public.email_accounts for delete
  using (workspace_id in (select public.user_workspace_ids()));

-- ── email_conversations ───────────────────────────────────────
create policy "email_conversations_select_workspace_members"
  on public.email_conversations for select
  using (workspace_id in (select public.user_workspace_ids()));

create policy "email_conversations_insert_workspace_members"
  on public.email_conversations for insert
  with check (workspace_id in (select public.user_workspace_ids()));

create policy "email_conversations_update_workspace_members"
  on public.email_conversations for update
  using (workspace_id in (select public.user_workspace_ids()))
  with check (workspace_id in (select public.user_workspace_ids()));

create policy "email_conversations_delete_workspace_members"
  on public.email_conversations for delete
  using (workspace_id in (select public.user_workspace_ids()));

-- ── email_messages ────────────────────────────────────────────
create policy "email_messages_select_workspace_members"
  on public.email_messages for select
  using (workspace_id in (select public.user_workspace_ids()));

create policy "email_messages_insert_workspace_members"
  on public.email_messages for insert
  with check (workspace_id in (select public.user_workspace_ids()));

create policy "email_messages_update_workspace_members"
  on public.email_messages for update
  using (workspace_id in (select public.user_workspace_ids()))
  with check (workspace_id in (select public.user_workspace_ids()));

create policy "email_messages_delete_workspace_members"
  on public.email_messages for delete
  using (workspace_id in (select public.user_workspace_ids()));

-- ── shopify_orders ────────────────────────────────────────────
create policy "shopify_orders_select_workspace_members"
  on public.shopify_orders for select
  using (workspace_id in (select public.user_workspace_ids()));

create policy "shopify_orders_insert_workspace_members"
  on public.shopify_orders for insert
  with check (workspace_id in (select public.user_workspace_ids()));

create policy "shopify_orders_update_workspace_members"
  on public.shopify_orders for update
  using (workspace_id in (select public.user_workspace_ids()))
  with check (workspace_id in (select public.user_workspace_ids()));

create policy "shopify_orders_delete_workspace_members"
  on public.shopify_orders for delete
  using (workspace_id in (select public.user_workspace_ids()));

-- ── shipments ─────────────────────────────────────────────────
create policy "shipments_select_workspace_members"
  on public.shipments for select
  using (workspace_id in (select public.user_workspace_ids()));

create policy "shipments_insert_workspace_members"
  on public.shipments for insert
  with check (workspace_id in (select public.user_workspace_ids()));

create policy "shipments_update_workspace_members"
  on public.shipments for update
  using (workspace_id in (select public.user_workspace_ids()))
  with check (workspace_id in (select public.user_workspace_ids()));

create policy "shipments_delete_workspace_members"
  on public.shipments for delete
  using (workspace_id in (select public.user_workspace_ids()));

-- ── analytics_actions ─────────────────────────────────────────
create policy "analytics_actions_select_workspace_members"
  on public.analytics_actions for select
  using (workspace_id in (select public.user_workspace_ids()));

create policy "analytics_actions_insert_workspace_members"
  on public.analytics_actions for insert
  with check (workspace_id in (select public.user_workspace_ids()));

create policy "analytics_actions_update_workspace_members"
  on public.analytics_actions for update
  using (workspace_id in (select public.user_workspace_ids()))
  with check (workspace_id in (select public.user_workspace_ids()));

create policy "analytics_actions_delete_workspace_members"
  on public.analytics_actions for delete
  using (workspace_id in (select public.user_workspace_ids()));

-- ── ai_settings ───────────────────────────────────────────────
create policy "ai_settings_select_workspace_members"
  on public.ai_settings for select
  using (workspace_id in (select public.user_workspace_ids()));

create policy "ai_settings_insert_workspace_members"
  on public.ai_settings for insert
  with check (workspace_id in (select public.user_workspace_ids()));

create policy "ai_settings_update_workspace_members"
  on public.ai_settings for update
  using (workspace_id in (select public.user_workspace_ids()))
  with check (workspace_id in (select public.user_workspace_ids()));

create policy "ai_settings_delete_workspace_members"
  on public.ai_settings for delete
  using (workspace_id in (select public.user_workspace_ids()));

-- ── agents ────────────────────────────────────────────────────
create policy "agents_select_workspace_members"
  on public.agents for select
  using (workspace_id in (select public.user_workspace_ids()));

create policy "agents_insert_workspace_members"
  on public.agents for insert
  with check (workspace_id in (select public.user_workspace_ids()));

create policy "agents_update_workspace_members"
  on public.agents for update
  using (workspace_id in (select public.user_workspace_ids()))
  with check (workspace_id in (select public.user_workspace_ids()));

create policy "agents_delete_workspace_members"
  on public.agents for delete
  using (workspace_id in (select public.user_workspace_ids()));

-- ── agent_actions ─────────────────────────────────────────────
create policy "agent_actions_select_workspace_members"
  on public.agent_actions for select
  using (workspace_id in (select public.user_workspace_ids()));

create policy "agent_actions_insert_workspace_members"
  on public.agent_actions for insert
  with check (workspace_id in (select public.user_workspace_ids()));

create policy "agent_actions_update_workspace_members"
  on public.agent_actions for update
  using (workspace_id in (select public.user_workspace_ids()))
  with check (workspace_id in (select public.user_workspace_ids()));

create policy "agent_actions_delete_workspace_members"
  on public.agent_actions for delete
  using (workspace_id in (select public.user_workspace_ids()));

-- ── time_sessions ─────────────────────────────────────────────
create policy "time_sessions_select_workspace_members"
  on public.time_sessions for select
  using (workspace_id in (select public.user_workspace_ids()));

create policy "time_sessions_insert_workspace_members"
  on public.time_sessions for insert
  with check (workspace_id in (select public.user_workspace_ids()));

create policy "time_sessions_update_workspace_members"
  on public.time_sessions for update
  using (workspace_id in (select public.user_workspace_ids()))
  with check (workspace_id in (select public.user_workspace_ids()));

create policy "time_sessions_delete_workspace_members"
  on public.time_sessions for delete
  using (workspace_id in (select public.user_workspace_ids()));

-- ── macros ────────────────────────────────────────────────────
create policy "macros_select_workspace_members"
  on public.macros for select
  using (workspace_id in (select public.user_workspace_ids()));

create policy "macros_insert_workspace_members"
  on public.macros for insert
  with check (workspace_id in (select public.user_workspace_ids()));

create policy "macros_update_workspace_members"
  on public.macros for update
  using (workspace_id in (select public.user_workspace_ids()))
  with check (workspace_id in (select public.user_workspace_ids()));

create policy "macros_delete_workspace_members"
  on public.macros for delete
  using (workspace_id in (select public.user_workspace_ids()));

-- ── macro_onboarding ──────────────────────────────────────────
create policy "macro_onboarding_select_workspace_members"
  on public.macro_onboarding for select
  using (workspace_id in (select public.user_workspace_ids()));

create policy "macro_onboarding_insert_workspace_members"
  on public.macro_onboarding for insert
  with check (workspace_id in (select public.user_workspace_ids()));

create policy "macro_onboarding_update_workspace_members"
  on public.macro_onboarding for update
  using (workspace_id in (select public.user_workspace_ids()))
  with check (workspace_id in (select public.user_workspace_ids()));

create policy "macro_onboarding_delete_workspace_members"
  on public.macro_onboarding for delete
  using (workspace_id in (select public.user_workspace_ids()));

-- ── tags ──────────────────────────────────────────────────────
create policy "tags_select_workspace_members"
  on public.tags for select
  using (workspace_id in (select public.user_workspace_ids()));

create policy "tags_insert_workspace_members"
  on public.tags for insert
  with check (workspace_id in (select public.user_workspace_ids()));

create policy "tags_update_workspace_members"
  on public.tags for update
  using (workspace_id in (select public.user_workspace_ids()))
  with check (workspace_id in (select public.user_workspace_ids()));

create policy "tags_delete_workspace_members"
  on public.tags for delete
  using (workspace_id in (select public.user_workspace_ids()));

-- ── team_members ──────────────────────────────────────────────
create policy "team_members_select_workspace_members"
  on public.team_members for select
  using (workspace_id in (select public.user_workspace_ids()));

create policy "team_members_insert_workspace_members"
  on public.team_members for insert
  with check (workspace_id in (select public.user_workspace_ids()));

create policy "team_members_update_workspace_members"
  on public.team_members for update
  using (workspace_id in (select public.user_workspace_ids()))
  with check (workspace_id in (select public.user_workspace_ids()));

create policy "team_members_delete_workspace_members"
  on public.team_members for delete
  using (workspace_id in (select public.user_workspace_ids()));

-- ============================================================
-- STAP D — Speciale tabellen (workspaces / workspace_members /
-- workspace_invites). Rol-gebaseerde restricties.
-- ============================================================

-- ── workspaces ────────────────────────────────────────────────
create policy "workspaces_select_members"
  on public.workspaces for select
  using (id in (select public.user_workspace_ids()));

create policy "workspaces_insert_authenticated"
  on public.workspaces for insert
  with check (auth.uid() is not null);

create policy "workspaces_update_owner_only"
  on public.workspaces for update
  using (public.user_is_workspace_owner(id))
  with check (public.user_is_workspace_owner(id));

create policy "workspaces_delete_owner_only"
  on public.workspaces for delete
  using (public.user_is_workspace_owner(id));

-- ── workspace_members ─────────────────────────────────────────
-- members van zelfde workspace zien elkaar; INSERT/UPDATE/DELETE
-- alleen voor owner+admin
create policy "workspace_members_select_same_workspace"
  on public.workspace_members for select
  using (workspace_id in (select public.user_workspace_ids()));

create policy "workspace_members_insert_owner_admin"
  on public.workspace_members for insert
  with check (
    public.user_role_in_workspace(workspace_id) in ('owner', 'admin')
  );

create policy "workspace_members_update_owner_admin"
  on public.workspace_members for update
  using (
    public.user_role_in_workspace(workspace_id) in ('owner', 'admin')
  )
  with check (
    public.user_role_in_workspace(workspace_id) in ('owner', 'admin')
  );

create policy "workspace_members_delete_owner_admin"
  on public.workspace_members for delete
  using (
    public.user_role_in_workspace(workspace_id) in ('owner', 'admin')
  );

-- ── workspace_invites ─────────────────────────────────────────
-- Zelfde patroon als workspace_members: alleen owner/admin
-- mogen inviten, intrekken of bijwerken.
create policy "workspace_invites_select_same_workspace"
  on public.workspace_invites for select
  using (workspace_id in (select public.user_workspace_ids()));

create policy "workspace_invites_insert_owner_admin"
  on public.workspace_invites for insert
  with check (
    public.user_role_in_workspace(workspace_id) in ('owner', 'admin')
  );

create policy "workspace_invites_update_owner_admin"
  on public.workspace_invites for update
  using (
    public.user_role_in_workspace(workspace_id) in ('owner', 'admin')
  )
  with check (
    public.user_role_in_workspace(workspace_id) in ('owner', 'admin')
  );

create policy "workspace_invites_delete_owner_admin"
  on public.workspace_invites for delete
  using (
    public.user_role_in_workspace(workspace_id) in ('owner', 'admin')
  );

-- ============================================================
-- Verification — minimaal 60 policies aanwezig over de 19 tabellen.
-- (Verwacht aantal: 16 × 4 + 3 × 4 = 76.)
-- ============================================================

do $$
declare
  v_table_count int;
  v_policy_count int;
begin
  select count(*) into v_policy_count
  from pg_policies
  where schemaname = 'public'
    and tablename in (
      'workspaces','workspace_members','workspace_invites','team_members',
      'clients','integrations','email_accounts','email_conversations',
      'email_messages','shopify_orders','shipments','analytics_actions',
      'ai_settings','agents','agent_actions','time_sessions','macros',
      'macro_onboarding','tags'
    );

  if v_policy_count < 60 then
    raise exception 'Expected at least 60 policies, found %', v_policy_count;
  end if;

  raise notice 'OK — % RLS policies created across helpdesk tables', v_policy_count;
end $$;

commit;

notify pgrst, 'reload schema';
