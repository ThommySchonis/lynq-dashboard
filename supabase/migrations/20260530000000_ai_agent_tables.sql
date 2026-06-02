-- ============================================================
-- AI agent tables (Emma) — B1: data layer
-- ai_policies, ai_scenarios, ai_autonomy_rules, ai_lessons
-- ============================================================

-- ── ai_policies — one row per store ─────────────────────────────────

create table if not exists public.ai_policies (
  id                  uuid        primary key default gen_random_uuid(),
  workspace_id        uuid        not null references public.workspaces(id) on delete cascade,
  store_id            uuid        not null references public.stores(id) on delete cascade,

  -- Merchant-supplied policies fed into the system prompt
  shipping_policy     text,
  refund_policy       text,
  customs_policy      text,
  tracking_url        text,

  -- Decision boundaries (jsonb arrays of strings — matches project list pattern)
  can_decide          jsonb       not null default '[]'::jsonb,
  cannot_decide       jsonb       not null default '[]'::jsonb,
  escalate_triggers   jsonb       not null default '[]'::jsonb,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  unique (store_id)
);

create index if not exists idx_ai_policies_workspace on public.ai_policies(workspace_id);
create index if not exists idx_ai_policies_store     on public.ai_policies(store_id);

drop trigger if exists ai_policies_set_updated_at on public.ai_policies;
create trigger ai_policies_set_updated_at
  before update on public.ai_policies
  for each row execute function public.set_updated_at();

alter table public.ai_policies enable row level security;

drop policy if exists "ai_policies_select" on public.ai_policies;
create policy "ai_policies_select" on public.ai_policies for select
  using (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()));

drop policy if exists "ai_policies_insert" on public.ai_policies;
create policy "ai_policies_insert" on public.ai_policies for insert
  with check (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()));

drop policy if exists "ai_policies_update" on public.ai_policies;
create policy "ai_policies_update" on public.ai_policies for update
  using (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()));

drop policy if exists "ai_policies_delete" on public.ai_policies;
create policy "ai_policies_delete" on public.ai_policies for delete
  using (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()));


-- ── ai_scenarios — many rows per store, one per scenario ────────────

create table if not exists public.ai_scenarios (
  id                  uuid        primary key default gen_random_uuid(),
  workspace_id        uuid        not null references public.workspaces(id) on delete cascade,
  store_id            uuid        not null references public.stores(id) on delete cascade,

  -- Scenario identity
  -- Intended keys: 'wismo', 'long_delivery', 'lost_package',
  --   'wrong_or_damaged', 'refund_or_cancel', 'customs_fees',
  --   'angry_or_chargeback'
  scenario_key        text        not null,
  title               text        not null,

  -- Behaviour config
  approach            text,
  questions_to_ask    jsonb       not null default '[]'::jsonb,
  response_template   text,
  escalate_when       text,
  autonomy_pct        integer     not null default 0 check (autonomy_pct between 0 and 100),
  enabled             boolean     not null default true,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  unique (store_id, scenario_key)
);

create index if not exists idx_ai_scenarios_workspace on public.ai_scenarios(workspace_id);
create index if not exists idx_ai_scenarios_store     on public.ai_scenarios(store_id);

drop trigger if exists ai_scenarios_set_updated_at on public.ai_scenarios;
create trigger ai_scenarios_set_updated_at
  before update on public.ai_scenarios
  for each row execute function public.set_updated_at();

alter table public.ai_scenarios enable row level security;

drop policy if exists "ai_scenarios_select" on public.ai_scenarios;
create policy "ai_scenarios_select" on public.ai_scenarios for select
  using (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()));

drop policy if exists "ai_scenarios_insert" on public.ai_scenarios;
create policy "ai_scenarios_insert" on public.ai_scenarios for insert
  with check (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()));

drop policy if exists "ai_scenarios_update" on public.ai_scenarios;
create policy "ai_scenarios_update" on public.ai_scenarios for update
  using (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()));

drop policy if exists "ai_scenarios_delete" on public.ai_scenarios;
create policy "ai_scenarios_delete" on public.ai_scenarios for delete
  using (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()));


-- ── ai_autonomy_rules — one row per store, JSONB config ─────────────
--
-- Intended config shape (enforced later; not constrained here to allow
-- incremental expansion across builds):
--   {
--     "master_enabled": false,
--     "confidence_threshold": 0.8,
--     "global_block_intents": ["refund","chargeback","threat","legal"],
--     "global_allow_intents": []
--   }

create table if not exists public.ai_autonomy_rules (
  id                  uuid        primary key default gen_random_uuid(),
  workspace_id        uuid        not null references public.workspaces(id) on delete cascade,
  store_id            uuid        not null references public.stores(id) on delete cascade,

  config              jsonb       not null default '{}'::jsonb,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  unique (store_id)
);

create index if not exists idx_ai_autonomy_rules_workspace on public.ai_autonomy_rules(workspace_id);
create index if not exists idx_ai_autonomy_rules_store     on public.ai_autonomy_rules(store_id);

drop trigger if exists ai_autonomy_rules_set_updated_at on public.ai_autonomy_rules;
create trigger ai_autonomy_rules_set_updated_at
  before update on public.ai_autonomy_rules
  for each row execute function public.set_updated_at();

alter table public.ai_autonomy_rules enable row level security;

drop policy if exists "ai_autonomy_rules_select" on public.ai_autonomy_rules;
create policy "ai_autonomy_rules_select" on public.ai_autonomy_rules for select
  using (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()));

drop policy if exists "ai_autonomy_rules_insert" on public.ai_autonomy_rules;
create policy "ai_autonomy_rules_insert" on public.ai_autonomy_rules for insert
  with check (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()));

drop policy if exists "ai_autonomy_rules_update" on public.ai_autonomy_rules;
create policy "ai_autonomy_rules_update" on public.ai_autonomy_rules for update
  using (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()));

drop policy if exists "ai_autonomy_rules_delete" on public.ai_autonomy_rules;
create policy "ai_autonomy_rules_delete" on public.ai_autonomy_rules for delete
  using (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()));


-- ── ai_lessons — many rows per store, append-only ───────────────────

create table if not exists public.ai_lessons (
  id                    uuid        primary key default gen_random_uuid(),
  workspace_id          uuid        not null references public.workspaces(id) on delete cascade,
  store_id              uuid        not null references public.stores(id) on delete cascade,

  lesson_text           text        not null,
  source_type           text        not null check (source_type in ('edit', 'reject', 'manual')),

  -- source_ref: id of the draft or suggestion that produced this lesson.
  -- No FK — the AI suggestions / drafts table does not exist yet (B4+).
  source_ref            uuid,

  applies_to_scenario   text,
  applies_to_policy     text,

  -- Mirrors macros + macro_onboarding created_by convention (auth.users FK).
  created_by            uuid        references auth.users(id) on delete set null,

  created_at            timestamptz not null default now()
  -- No updated_at: rows are append-only and never mutated.
  -- No UPDATE or DELETE RLS policies for the same reason.
);

create index if not exists idx_ai_lessons_workspace on public.ai_lessons(workspace_id);
create index if not exists idx_ai_lessons_store     on public.ai_lessons(store_id);

alter table public.ai_lessons enable row level security;

drop policy if exists "ai_lessons_select" on public.ai_lessons;
create policy "ai_lessons_select" on public.ai_lessons for select
  using (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()));

drop policy if exists "ai_lessons_insert" on public.ai_lessons;
create policy "ai_lessons_insert" on public.ai_lessons for insert
  with check (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()));

-- No UPDATE or DELETE policies: append-only table, mutations blocked at RLS.


-- ── Verification ─────────────────────────────────────────────────────

do $$
begin
  assert (select count(*) from information_schema.tables
          where table_schema = 'public' and table_name = 'ai_policies') = 1,
    'ai_policies table was not created';
  assert (select count(*) from information_schema.tables
          where table_schema = 'public' and table_name = 'ai_scenarios') = 1,
    'ai_scenarios table was not created';
  assert (select count(*) from information_schema.tables
          where table_schema = 'public' and table_name = 'ai_autonomy_rules') = 1,
    'ai_autonomy_rules table was not created';
  assert (select count(*) from information_schema.tables
          where table_schema = 'public' and table_name = 'ai_lessons') = 1,
    'ai_lessons table was not created';
  raise notice 'B1 AI agent tables migration OK';
end;
$$;
