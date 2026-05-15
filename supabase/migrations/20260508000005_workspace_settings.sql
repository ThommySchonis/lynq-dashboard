-- Workspace settings columns
-- Adds identity, regional, and preferences fields to the workspaces table.

alter table workspaces
  add column if not exists slug             text,
  add column if not exists logo_url         text,
  add column if not exists timezone         text        not null default 'Europe/Amsterdam',
  add column if not exists locale           text        not null default 'en',
  add column if not exists date_format      text        not null default 'DD/MM/YYYY',
  add column if not exists time_format      text        not null default '24h',
  add column if not exists first_day_of_week text       not null default 'Monday',
  add column if not exists show_order_data  boolean     not null default true,
  add column if not exists auto_translate   boolean     not null default false,
  add column if not exists allow_deletion   boolean     not null default false,
  add column if not exists updated_at       timestamptz not null default now();

-- Unique constraint on slug (allow null = not yet set)
create unique index if not exists workspaces_slug_idx on workspaces (slug) where slug is not null;

-- Auto-update updated_at on every row change
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists workspaces_set_updated_at on workspaces;
create trigger workspaces_set_updated_at
  before update on workspaces
  for each row execute function set_updated_at();
