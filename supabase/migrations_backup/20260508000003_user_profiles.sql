-- ============================================================
-- user_profiles — per-user settings (name, bio, avatar, theme).
--
-- One row per auth.users row, keyed on user_id (primary key + FK).
-- Idempotent + transactional.
-- Run in Supabase SQL Editor for project cvrzvhnsltjubmfkcxql.
-- ============================================================

begin;

create table if not exists public.user_profiles (
  user_id      uuid        primary key references auth.users(id) on delete cascade,
  display_name text,
  bio          text,
  avatar_url   text,
  theme        text        not null default 'system'
                           check (theme in ('system', 'dark', 'light')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create or replace function public.user_profiles_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists user_profiles_updated_at on public.user_profiles;
create trigger user_profiles_updated_at
  before update on public.user_profiles
  for each row
  execute function public.user_profiles_set_updated_at();

-- ============================================================
-- Avatar storage bucket — public read, service-role write only
-- ============================================================
-- Bucket creation (idempotent via insert ... on conflict)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,             -- public reads (so <img src=...> works without signed URLs)
  524288,           -- 500 KB hard cap at the storage layer too (defence-in-depth)
  array['image/png', 'image/jpeg']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Public-read policy (anon + authenticated can SELECT objects in the
-- bucket — necessary because we display avatars across the app via
-- direct URLs). Idempotent via DROP + CREATE.
drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'avatars');

-- Writes happen via supabaseAdmin (service_role) which bypasses RLS,
-- so no insert/update/delete policy is needed for normal operation.

do $$
declare v_table bool; v_bucket bool;
begin
  select exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'user_profiles'
  ) into v_table;
  select exists (
    select 1 from storage.buckets where id = 'avatars'
  ) into v_bucket;
  if not v_table  then raise exception 'user_profiles missing'; end if;
  if not v_bucket then raise exception 'avatars bucket missing'; end if;
  raise notice 'OK — user_profiles table + avatars bucket present';
end $$;

commit;

notify pgrst, 'reload schema';
