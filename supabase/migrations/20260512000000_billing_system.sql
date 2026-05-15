-- ============================================================
-- Billing & subscription system — data layer (PR 1 of 3)
--
-- Adds 8 tables + 1 invoice number generator + per-year sequences.
-- Coexists with the legacy user_email-keyed `subscriptions` table
-- (the 5 existing consumers continue to use that; this PR does not
-- migrate them). Whop integration is stubbed at the lib level.
--
-- New tables:
--   1. plans                   — canonical plan definitions (5 seeded)
--   2. workspace_subscriptions — one row per workspace, workspace_id
--                                keyed (vs the legacy table which is
--                                user_email keyed)
--   3. usage_counters          — current-period tickets / AI Suggest /
--                                AI Resolutions usage + overage
--   4. invoices                — billing history with full snapshot of
--                                customer billing info at issue time
--   5. billing_info            — per-workspace billing address + VAT
--   6. payment_methods         — Whop will populate post-integration
--   7. subscription_addons     — catalog: Emma, Voice, SMS, Convert
--   8. workspace_addons        — which workspaces have which add-ons
--
-- Invoice numbering: per-year sequences (`invoice_seq_YYYY`) accessed
-- via `next_invoice_number()` function. Yearly reset, LF-YYYY-NNNNN
-- format. Continuous within a year, gap-free.
--
-- RLS: 4-policy workspace-scoped pattern + super-admin SELECT using
-- the parameterless public.is_current_user_lynq_admin() helper from
-- 20260509_is_lynq_admin_tighten.sql. Catalog tables (plans,
-- subscription_addons) are read-only for all authenticated users.
--
-- Idempotent — re-runs are no-ops. Single transaction.
-- ============================================================

begin;

-- ============================================================
-- 1. plans — canonical plan definitions
-- ============================================================

create table if not exists public.plans (
  id                text        primary key,
  display_name      text        not null,
  price_eur         numeric(10,2),                     -- null for is_custom plans (Elite)
  ticket_limit      integer,                            -- null for is_custom plans
  ai_suggest_limit  integer,                            -- null for is_custom plans
  whop_product_id   text,
  whop_plan_id      text,
  is_active         boolean     not null default true,
  is_custom         boolean     not null default false,
  sort_order        integer     not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Seed the 5 plans (idempotent via on conflict do nothing — first
-- run populates, subsequent runs leave existing rows untouched so
-- price changes from the UI aren't blown away by re-running this
-- migration. Use a separate migration to update prices.)
insert into public.plans (id, display_name, price_eur, ticket_limit, ai_suggest_limit, is_custom, sort_order)
values
  ('starter',    'Starter',     30.00,   300, 150,   false, 1),
  ('growth',     'Growth',      89.00,  2000, 1000,  false, 2),
  ('scale',      'Scale',      249.00,  5000, 2500,  false, 3),
  ('enterprise', 'Enterprise', 599.00, 15000, 7500,  false, 4),
  ('elite',      'Elite',         null,  null, null,  true,  5)
on conflict (id) do nothing;

-- ============================================================
-- 2. workspace_subscriptions — per-workspace billing state
-- ============================================================

create table if not exists public.workspace_subscriptions (
  id                       uuid        primary key default gen_random_uuid(),
  workspace_id             uuid        not null references public.workspaces(id) on delete cascade unique,
  plan_id                  text        not null references public.plans(id),
  status                   text        not null default 'trial',
  trial_ends_at            timestamptz,
  current_period_start     timestamptz not null default now(),
  current_period_end       timestamptz not null,
  canceled_at              timestamptz,
  cancel_at_period_end     boolean     not null default false,
  whop_subscription_id     text,
  whop_customer_id         text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint workspace_subscriptions_status_check
    check (status in ('trial', 'active', 'past_due', 'canceled', 'paused'))
);

create index if not exists idx_workspace_subscriptions_status
  on public.workspace_subscriptions (status);

-- Partial index — only trial workspaces, drives trial-expiry cron.
create index if not exists idx_workspace_subscriptions_trial_ends_at
  on public.workspace_subscriptions (trial_ends_at)
  where status = 'trial';

-- For billing-period-rollover cron — find subs whose period is ending.
create index if not exists idx_workspace_subscriptions_period_end
  on public.workspace_subscriptions (current_period_end)
  where status in ('active', 'past_due');

-- ============================================================
-- 3. usage_counters — current-period usage per workspace
-- ============================================================

create table if not exists public.usage_counters (
  id                    uuid        primary key default gen_random_uuid(),
  workspace_id          uuid        not null references public.workspaces(id) on delete cascade,
  period_start          timestamptz not null,
  period_end            timestamptz not null,
  tickets_used          integer     not null default 0,
  ai_suggest_used       integer     not null default 0,
  ai_resolutions_used   integer     not null default 0,
  tickets_overage       integer     not null default 0,
  ai_suggest_overage    integer     not null default 0,
  -- Notification bookkeeping — set once each cron iteration sends, so
  -- we don't spam users. Reset on period rollover.
  notified_80_at        timestamptz,
  notified_100_at       timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (workspace_id, period_start)
);

create index if not exists idx_usage_counters_workspace_period_end
  on public.usage_counters (workspace_id, period_end desc);

-- ============================================================
-- 4. invoices — billing history
-- ============================================================

create table if not exists public.invoices (
  id                uuid        primary key default gen_random_uuid(),
  workspace_id      uuid        not null references public.workspaces(id) on delete cascade,
  invoice_number    text        not null unique,
  status            text        not null default 'draft',
  period_start      timestamptz not null,
  period_end        timestamptz not null,
  subtotal_eur      numeric(10,2) not null,
  vat_amount_eur    numeric(10,2) not null default 0,         -- always 0 at launch; column kept for future
  total_eur         numeric(10,2) not null,
  amount_paid_eur   numeric(10,2) not null default 0,
  amount_due_eur    numeric(10,2) not null,
  description       text,
  line_items        jsonb       not null default '[]'::jsonb,
  whop_invoice_id   text,
  paid_at           timestamptz,
  pdf_url           text,
  -- Snapshot of billing details at issue time (immutable record for
  -- audit; if a workspace updates its billing info later, this row
  -- still reflects the address that was on the invoice when sent).
  billing_email     text,
  billing_org_name  text,
  billing_address   jsonb,
  vat_number        text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint invoices_status_check
    check (status in ('draft', 'open', 'paid', 'void', 'failed'))
);

create index if not exists idx_invoices_workspace_created_at
  on public.invoices (workspace_id, created_at desc);

create index if not exists idx_invoices_status
  on public.invoices (status)
  where status in ('open', 'failed');

-- ============================================================
-- 5. billing_info — per-workspace billing address + VAT
-- ============================================================

create table if not exists public.billing_info (
  id                 uuid        primary key default gen_random_uuid(),
  workspace_id       uuid        not null references public.workspaces(id) on delete cascade unique,
  billing_email      text        not null,
  organization_name  text        not null,
  phone_number       text,
  address_line1      text        not null,
  address_line2      text,
  city               text        not null,
  postal_code        text        not null,
  country            text        not null,                    -- ISO 3166-1 alpha-2
  state              text,
  vat_number         text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- ============================================================
-- 6. payment_methods — Whop will populate this
-- ============================================================

create table if not exists public.payment_methods (
  id                       uuid        primary key default gen_random_uuid(),
  workspace_id             uuid        not null references public.workspaces(id) on delete cascade,
  type                     text        not null,
  last_four                text,
  brand                    text,
  is_default               boolean     not null default false,
  whop_payment_method_id   text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint payment_methods_type_check
    check (type in ('card', 'sepa', 'paypal'))
);

create index if not exists idx_payment_methods_workspace_default
  on public.payment_methods (workspace_id, is_default desc);

-- ============================================================
-- 7. subscription_addons — catalog (Emma, Voice, SMS, Convert)
-- ============================================================

create table if not exists public.subscription_addons (
  id                   text        primary key,
  display_name         text        not null,
  description          text,
  status               text        not null default 'coming_soon',
  price_eur            numeric(10,2),
  per_unit_price_eur   numeric(10,4),                          -- 4 decimals for sub-cent pricing
  per_unit_label       text,
  sort_order           integer     not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint subscription_addons_status_check
    check (status in ('coming_soon', 'beta', 'live'))
);

insert into public.subscription_addons (id, display_name, description, status, price_eur, per_unit_price_eur, per_unit_label, sort_order)
values
  ('ai_agent', 'AI Agent (Emma)', 'AI resolves tickets automatically', 'coming_soon', null,  0.1500, 'per resolution', 1),
  ('voice',    'Voice',           'Personalized phone support',         'coming_soon', 30.00, null,   null,             2),
  ('sms',      'SMS',             'Real-time SMS support',              'coming_soon', 20.00, null,   null,             3),
  ('convert',  'Convert',         'Pre-sales chat assistance',          'coming_soon', 30.00, null,   null,             4)
on conflict (id) do nothing;

-- ============================================================
-- 8. workspace_addons — which workspaces have which add-ons
-- ============================================================

create table if not exists public.workspace_addons (
  workspace_id    uuid        not null references public.workspaces(id) on delete cascade,
  addon_id        text        not null references public.subscription_addons(id),
  status          text        not null default 'inactive',
  activated_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  primary key (workspace_id, addon_id),
  constraint workspace_addons_status_check
    check (status in ('active', 'inactive', 'pending'))
);

create index if not exists idx_workspace_addons_active
  on public.workspace_addons (workspace_id, status)
  where status = 'active';

-- ============================================================
-- 9. Invoice numbering — per-year sequence + generator function
-- ============================================================

-- Pre-create the 2026 sequence so the first invoice doesn't pay
-- the DDL overhead inside the function.
create sequence if not exists invoice_seq_2026 start with 1 increment by 1;

-- next_invoice_number(): returns 'LF-YYYY-NNNNN', creating the
-- year-sequence on demand if it doesn't exist yet. SECURITY DEFINER
-- so authenticated callers don't need direct sequence privileges.
-- Pin search_path to prevent shadowing attacks.
create or replace function public.next_invoice_number()
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_year int;
  seq_name     text;
  n            bigint;
begin
  current_year := extract(year from now() at time zone 'UTC')::int;
  seq_name     := 'invoice_seq_' || current_year::text;

  -- Create the per-year sequence on first use of a new year.
  if not exists (
    select 1 from pg_class c
    join pg_namespace ns on ns.oid = c.relnamespace
    where ns.nspname = 'public'
      and c.relname  = seq_name
      and c.relkind  = 'S'
  ) then
    execute format('create sequence if not exists public.%I start with 1 increment by 1', seq_name);
  end if;

  execute format('select nextval(%L)', 'public.' || seq_name) into n;
  return 'LF-' || current_year::text || '-' || lpad(n::text, 5, '0');
end;
$$;

grant execute on function public.next_invoice_number() to authenticated, service_role;

-- ============================================================
-- 10. set_updated_at trigger for tables that have updated_at
-- (reuses the existing function from 20260508_workspace_settings.sql)
-- ============================================================

-- Defensive: create the function if the earlier migration hasn't run
-- (it has on main, but this keeps the migration self-contained if
-- applied to a fresh DB out of order).
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
  tables text[] := array[
    'plans',
    'workspace_subscriptions',
    'usage_counters',
    'invoices',
    'billing_info',
    'payment_methods',
    'subscription_addons',
    'workspace_addons'
  ];
begin
  foreach t in array tables loop
    execute format('drop trigger if exists %I_set_updated_at on public.%I', t, t);
    execute format(
      'create trigger %I_set_updated_at before update on public.%I '
      'for each row execute function public.set_updated_at()',
      t, t
    );
  end loop;
end $$;

-- ============================================================
-- 11. RLS — enable + 4-policy workspace-scoped + super-admin SELECT
-- ============================================================

-- Catalog tables: readable by any authenticated user (no workspace
-- filter — plans + add-ons are global), writable only by service_role.
alter table public.plans               enable row level security;
alter table public.subscription_addons enable row level security;

drop policy if exists plans_select_authenticated on public.plans;
create policy plans_select_authenticated
  on public.plans for select to authenticated using (true);

drop policy if exists subscription_addons_select_authenticated on public.subscription_addons;
create policy subscription_addons_select_authenticated
  on public.subscription_addons for select to authenticated using (true);

-- Workspace-scoped tables: standard 4-policy pattern via
-- user_workspace_ids() helper from 20260505_rls_workspace_aware_policies.sql.
alter table public.workspace_subscriptions enable row level security;
alter table public.usage_counters          enable row level security;
alter table public.invoices                enable row level security;
alter table public.billing_info            enable row level security;
alter table public.payment_methods         enable row level security;
alter table public.workspace_addons        enable row level security;

-- Drop any pre-existing policies before recreating (idempotent).
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'workspace_subscriptions','usage_counters','invoices',
        'billing_info','payment_methods','workspace_addons'
      )
  loop
    execute format('drop policy if exists %I on %I.%I',
      r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- Macro: emit the 4-policy workspace-scoped block for each table.
do $$
declare
  t text;
  tables text[] := array[
    'workspace_subscriptions','usage_counters','invoices',
    'billing_info','payment_methods','workspace_addons'
  ];
begin
  foreach t in array tables loop
    execute format(
      'create policy %I on public.%I for select '
      'using (workspace_id in (select public.user_workspace_ids()))',
      t || '_select_workspace_members', t
    );
    execute format(
      'create policy %I on public.%I for insert '
      'with check (workspace_id in (select public.user_workspace_ids()))',
      t || '_insert_workspace_members', t
    );
    execute format(
      'create policy %I on public.%I for update '
      'using (workspace_id in (select public.user_workspace_ids())) '
      'with check (workspace_id in (select public.user_workspace_ids()))',
      t || '_update_workspace_members', t
    );
    execute format(
      'create policy %I on public.%I for delete '
      'using (workspace_id in (select public.user_workspace_ids()))',
      t || '_delete_workspace_members', t
    );
  end loop;
end $$;

-- Super-admin SELECT — uses the parameterless helper added by
-- 20260509_is_lynq_admin_tighten.sql. Lynq admins can read all billing
-- data across workspaces for support purposes.
do $$
declare
  t text;
  tables text[] := array[
    'workspace_subscriptions','usage_counters','invoices',
    'billing_info','payment_methods','workspace_addons'
  ];
begin
  foreach t in array tables loop
    execute format(
      'create policy %I on public.%I for select to authenticated '
      'using (public.is_current_user_lynq_admin())',
      t || '_super_admin_select', t
    );
  end loop;
end $$;

-- ============================================================
-- Verification
-- ============================================================

do $$
declare
  v_plans_count          int;
  v_addons_count         int;
  v_tables_count         int;
  v_policies_count       int;
  v_fn_exists            bool;
  v_seq_exists           bool;
begin
  -- 5 plans seeded
  select count(*) into v_plans_count from public.plans;
  if v_plans_count < 5 then
    raise exception 'Expected >=5 plans seeded, found %', v_plans_count;
  end if;

  -- 4 add-ons seeded
  select count(*) into v_addons_count from public.subscription_addons;
  if v_addons_count < 4 then
    raise exception 'Expected >=4 add-ons seeded, found %', v_addons_count;
  end if;

  -- 8 tables exist
  select count(*) into v_tables_count
  from information_schema.tables
  where table_schema = 'public'
    and table_name in (
      'plans','workspace_subscriptions','usage_counters','invoices',
      'billing_info','payment_methods','subscription_addons','workspace_addons'
    );
  if v_tables_count <> 8 then
    raise exception 'Expected 8 billing tables, found %', v_tables_count;
  end if;

  -- Policies: 6 workspace tables × 4 (select/insert/update/delete) = 24
  --   + 6 super-admin select policies = 30
  --   + 2 catalog table select policies (plans, subscription_addons) = 32
  select count(*) into v_policies_count
  from pg_policies
  where schemaname = 'public'
    and tablename in (
      'plans','workspace_subscriptions','usage_counters','invoices',
      'billing_info','payment_methods','subscription_addons','workspace_addons'
    );
  if v_policies_count < 32 then
    raise exception 'Expected >=32 billing-area policies, found %', v_policies_count;
  end if;

  -- next_invoice_number function
  select exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'next_invoice_number'
  ) into v_fn_exists;
  if not v_fn_exists then
    raise exception 'next_invoice_number function missing';
  end if;

  -- 2026 invoice sequence
  select exists (
    select 1 from pg_class c
    join pg_namespace ns on ns.oid = c.relnamespace
    where ns.nspname = 'public' and c.relname = 'invoice_seq_2026' and c.relkind = 'S'
  ) into v_seq_exists;
  if not v_seq_exists then
    raise exception 'invoice_seq_2026 sequence missing';
  end if;

  raise notice 'OK — billing schema ready (8 tables, 5 plans + 4 add-ons seeded, % policies, invoice fn + seq present)', v_policies_count;
end $$;

commit;

notify pgrst, 'reload schema';
