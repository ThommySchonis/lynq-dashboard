-- ============================================================
-- Feature 1: pending invites in the Users page
--
-- Adds:
--   1. workspace_invites.sent_at — tracks last time the email
--      was actually sent (initial create OR resend)
--   2. workspace_invite_details view — joins invites with the
--      inviter's auth.users email/name so the UI can show
--      "Invited by Alice"
--
-- Idempotent + transactional.
-- Run in Supabase SQL Editor for project cvrzvhnsltjubmfkcxql.
-- ============================================================

begin;

-- ── 1. Add sent_at column ──────────────────────────────────
alter table public.workspace_invites
  add column if not exists sent_at timestamptz;

-- Backfill existing rows from created_at (one-time)
update public.workspace_invites
  set sent_at = created_at
  where sent_at is null;

-- Now make it NOT NULL with a default for future inserts
alter table public.workspace_invites
  alter column sent_at set default now();

alter table public.workspace_invites
  alter column sent_at set not null;

-- ── 2. workspace_invite_details view ───────────────────────
-- Joins invites with auth.users (inviter) so the UI can show
-- "Invited by Alice" without needing a separate lookup.
create or replace view public.workspace_invite_details as
select
  wi.id,
  wi.workspace_id,
  wi.email,
  wi.role,
  wi.token,
  wi.invited_by,
  wi.created_at,
  wi.sent_at,
  wi.expires_at,
  wi.accepted_at,
  inviter.email as inviter_email,
  coalesce(
    inviter.raw_user_meta_data->>'name',
    split_part(inviter.email, '@', 1)
  ) as inviter_name
from public.workspace_invites wi
left join auth.users inviter on inviter.id = wi.invited_by;

revoke all on public.workspace_invite_details from anon, authenticated;

-- ── 3. Verification ────────────────────────────────────────
do $$
declare
  v_has_col   bool;
  v_has_view  bool;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'workspace_invites'
      and column_name = 'sent_at'
  ) into v_has_col;

  select exists (
    select 1 from information_schema.views
    where table_schema = 'public'
      and table_name = 'workspace_invite_details'
  ) into v_has_view;

  if not v_has_col  then raise exception 'sent_at column missing';   end if;
  if not v_has_view then raise exception 'view missing';              end if;

  raise notice 'OK — sent_at column + workspace_invite_details view present';
end $$;

commit;

notify pgrst, 'reload schema';
