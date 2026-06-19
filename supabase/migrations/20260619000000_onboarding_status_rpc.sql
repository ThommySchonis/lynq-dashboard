-- ============================================================
-- api_onboarding_status — returns whether the calling user has
-- completed onboarding. SECURITY DEFINER so the public/anon client
-- (authenticated session) can read its own flag without a profiles
-- RLS select policy. Reads profiles by auth.uid(); no row => false.
--
-- Also ensures profiles.onboarding_completed exists (profiles predates
-- the migrations folder; add the column idempotently if missing).
-- ============================================================

begin;

alter table public.profiles
  add column if not exists onboarding_completed boolean not null default false;

create or replace function public.api_onboarding_status()
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select onboarding_completed from public.profiles where id = auth.uid()),
    false
  );
$$;

revoke all on function public.api_onboarding_status() from public;
grant execute on function public.api_onboarding_status() to authenticated;

commit;

notify pgrst, 'reload schema';
