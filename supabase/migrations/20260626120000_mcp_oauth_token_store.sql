-- MCP / OAuth token store. Managed exclusively by the service role
-- (supabaseAdmin bypasses RLS). RLS is enabled with NO policies, so
-- anon/authenticated roles cannot read or write these tables directly.

create table if not exists oauth_clients (
  client_id                  text primary key,
  client_name                text not null,
  redirect_uris              text[] not null default '{}',
  token_endpoint_auth_method text not null default 'none',
  created_at                 timestamptz not null default now()
);

create table if not exists oauth_authorization_codes (
  code_hash             text primary key,
  client_id             text not null references oauth_clients(client_id) on delete cascade,
  user_id               uuid not null,
  workspace_id          uuid not null,
  redirect_uri          text not null,
  code_challenge        text not null,
  code_challenge_method text not null default 'S256',
  scope                 text,
  expires_at            timestamptz not null,
  created_at            timestamptz not null default now()
);

create table if not exists oauth_tokens (
  id                  uuid primary key default gen_random_uuid(),
  client_id           text not null references oauth_clients(client_id) on delete cascade,
  user_id             uuid not null,
  workspace_id        uuid not null,
  access_token_hash   text not null unique,
  refresh_token_hash  text unique,
  scope               text,
  access_expires_at   timestamptz not null,
  refresh_expires_at  timestamptz,
  created_at          timestamptz not null default now(),
  last_used_at        timestamptz,
  revoked_at          timestamptz
);

create index if not exists oauth_tokens_access_hash_idx  on oauth_tokens(access_token_hash);
create index if not exists oauth_tokens_refresh_hash_idx on oauth_tokens(refresh_token_hash);
create index if not exists oauth_tokens_user_idx         on oauth_tokens(user_id);
create index if not exists oauth_codes_expires_idx       on oauth_authorization_codes(expires_at);

alter table oauth_clients              enable row level security;
alter table oauth_authorization_codes  enable row level security;
alter table oauth_tokens               enable row level security;
