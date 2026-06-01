-- Run this in Supabase SQL Editor (Database > SQL Editor > New Query)

-- 1. Workspaces — top-level isolation boundary
create table if not exists workspaces (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null,
  owner_id   uuid        references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 2. Workspace members — links auth users to a workspace with a role
--    Roles: owner (1 per workspace) | admin | agent | observer
create table if not exists workspace_members (
  id           uuid        primary key default gen_random_uuid(),
  workspace_id uuid        not null references workspaces(id) on delete cascade,
  user_id      uuid        not null references auth.users(id) on delete cascade,
  role         text        not null default 'agent'
                           check (role in ('owner', 'admin', 'agent', 'observer')),
  joined_at    timestamptz not null default now(),
  unique (workspace_id, user_id)
);

-- 3. Workspace invites — pending email invitations
--    Owner cannot be invited; ownership is transferred, not assigned via invite
create table if not exists workspace_invites (
  id           uuid        primary key default gen_random_uuid(),
  workspace_id uuid        not null references workspaces(id) on delete cascade,
  email        text        not null,
  role         text        not null default 'agent'
                           check (role in ('admin', 'agent', 'observer')),
  token        text        not null unique default encode(gen_random_bytes(32), 'hex'),
  invited_by   uuid        references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default (now() + interval '7 days'),
  accepted_at  timestamptz,
  unique (workspace_id, email)
);

-- Indexes for common lookups
create index if not exists workspace_members_user_id_idx   on workspace_members (user_id);
create index if not exists workspace_members_ws_id_idx     on workspace_members (workspace_id);
create index if not exists workspace_invites_token_idx     on workspace_invites (token);
create index if not exists workspace_invites_email_idx     on workspace_invites (email);
