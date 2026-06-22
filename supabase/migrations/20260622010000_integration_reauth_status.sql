-- Allow 'reauth_required' on integrations.status so a store whose Shopify token
-- was rejected (non-expiring token deprecation) can be flagged for reconnect.
begin;

alter table public.integrations
  drop constraint if exists integrations_status_check;

alter table public.integrations
  add constraint integrations_status_check
  check (status in ('pending', 'connected', 'error', 'reauth_required'));

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'integrations_status_check'
      and conrelid = 'public.integrations'::regclass
  ) then
    raise exception 'integrations_status_check missing after migration';
  end if;
end $$;

commit;

notify pgrst, 'reload schema';
