begin;

create table public.email_display_settings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  store_id uuid references stores(id) on delete cascade,
  email_account_id uuid references email_accounts(id) on delete cascade,
  display_name text,
  closing_text text,
  signature_html text,
  logo_url text,
  logo_width integer default 150,
  logo_link_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Store-level: one row per store (email_account_id is NULL)
create unique index email_display_settings_store_uniq
  on public.email_display_settings (workspace_id, store_id)
  where email_account_id is null;

-- Account-level: one row per account override
create unique index email_display_settings_account_uniq
  on public.email_display_settings (workspace_id, store_id, email_account_id)
  where email_account_id is not null;

alter table public.email_display_settings enable row level security;

create policy "email_display_settings_select"
  on public.email_display_settings for select
  using (workspace_id in (
    select workspace_id from public.workspace_members where user_id = auth.uid()
  ));

create policy "email_display_settings_insert"
  on public.email_display_settings for insert
  with check (workspace_id in (
    select workspace_id from public.workspace_members where user_id = auth.uid()
  ));

create policy "email_display_settings_update"
  on public.email_display_settings for update
  using (workspace_id in (
    select workspace_id from public.workspace_members where user_id = auth.uid()
  ));

create policy "email_display_settings_delete"
  on public.email_display_settings for delete
  using (workspace_id in (
    select workspace_id from public.workspace_members where user_id = auth.uid()
  ));

-- Storage bucket for signature logos
insert into storage.buckets (id, name, public)
values ('email-logos', 'email-logos', true)
on conflict (id) do nothing;

create policy "email_logos_upload"
  on storage.objects for insert
  with check (bucket_id = 'email-logos');

create policy "email_logos_read"
  on storage.objects for select
  using (bucket_id = 'email-logos');

create policy "email_logos_delete"
  on storage.objects for delete
  using (bucket_id = 'email-logos');

commit;
