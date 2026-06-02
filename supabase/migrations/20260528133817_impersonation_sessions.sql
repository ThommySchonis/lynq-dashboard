-- Impersonation session tracking for admin → client workspace viewing
create table if not exists impersonation_sessions (
  id                   uuid primary key default gen_random_uuid(),
  admin_user_id        uuid not null references auth.users(id),
  target_workspace_id  uuid not null references workspaces(id),
  started_at           timestamptz not null default now(),
  ended_at             timestamptz
);

create index if not exists idx_impersonation_sessions_admin on impersonation_sessions(admin_user_id);
create index if not exists idx_impersonation_sessions_active on impersonation_sessions(admin_user_id) where ended_at is null;

-- RLS: no client access. Only service role (server-side via supabaseAdmin) can read/write.
alter table impersonation_sessions enable row level security;
-- No policies = service_role only.
