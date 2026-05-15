-- ============================================================
-- Multi-Store Support: stores + store_email_configs + store_id columns
-- ============================================================

-- 1. stores table
create table if not exists public.stores (
  id                    uuid primary key default gen_random_uuid(),
  workspace_id          uuid not null references public.workspaces(id) on delete cascade,
  name                  text not null,
  shopify_domain        text not null,
  shopify_access_token  text,
  shopify_client_secret text,
  shopify_scope         text,
  shopify_connected_at  timestamptz,
  store_currency        text,
  created_at            timestamptz not null default now()
);

-- One domain per workspace
alter table public.stores
  add constraint stores_workspace_domain_unique unique (workspace_id, shopify_domain);

-- Index for workspace lookups
create index if not exists idx_stores_workspace_id on public.stores(workspace_id);

-- RLS
alter table public.stores enable row level security;

create policy "stores_workspace_read" on public.stores
  for select using (
    workspace_id in (
      select workspace_id from public.workspace_members where user_id = auth.uid()
    )
  );

create policy "stores_workspace_write" on public.stores
  for all using (
    workspace_id in (
      select workspace_id from public.workspace_members
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

-- 2. store_email_configs table
create table if not exists public.store_email_configs (
  id              uuid primary key default gen_random_uuid(),
  store_id        uuid not null references public.stores(id) on delete cascade,
  workspace_id    uuid not null references public.workspaces(id) on delete cascade,
  provider        text not null check (provider in ('gmail', 'outlook', 'custom')),
  email_address   text not null,
  access_token    text,
  refresh_token   text,
  token_expiry    timestamptz,
  connected_at    timestamptz not null default now(),
  watch_expiry    timestamptz
);

create index if not exists idx_store_email_configs_store on public.store_email_configs(store_id);
create index if not exists idx_store_email_configs_workspace on public.store_email_configs(workspace_id);

alter table public.store_email_configs enable row level security;

create policy "store_email_configs_workspace_read" on public.store_email_configs
  for select using (
    workspace_id in (
      select workspace_id from public.workspace_members where user_id = auth.uid()
    )
  );

create policy "store_email_configs_workspace_write" on public.store_email_configs
  for all using (
    workspace_id in (
      select workspace_id from public.workspace_members
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

-- 3. Add store_id columns to existing tables (nullable for migration)
alter table public.shopify_orders
  add column if not exists store_id uuid references public.stores(id) on delete set null;

create index if not exists idx_shopify_orders_store on public.shopify_orders(store_id);

-- Note: shopify_customers may or may not exist yet; use IF NOT EXISTS
do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'shopify_customers' and table_schema = 'public') then
    execute 'alter table public.shopify_customers add column if not exists store_id uuid references public.stores(id) on delete set null';
    execute 'create index if not exists idx_shopify_customers_store on public.shopify_customers(store_id)';
  end if;
end $$;

-- Add store_id to email_threads if it exists
do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'email_threads' and table_schema = 'public') then
    execute 'alter table public.email_threads add column if not exists store_id uuid references public.stores(id) on delete set null';
    execute 'create index if not exists idx_email_threads_store on public.email_threads(store_id)';
  end if;
end $$;

-- Add store_name column to oauth_states for threading through OAuth flow
alter table public.oauth_states
  add column if not exists store_name text;
