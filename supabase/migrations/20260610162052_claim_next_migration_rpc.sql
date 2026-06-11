-- supabase/migrations/20260610162052_claim_next_migration_rpc.sql

create or replace function claim_next_migration()
returns setof workspace_migrations
language plpgsql
security definer
as $$
declare
  claimed workspace_migrations;
begin
  with cte as (
    select id from workspace_migrations
    where status in ('ready','running')
    order by updated_at asc nulls first
    for update skip locked
    limit 1
  )
  update workspace_migrations m
    set status = 'running',
        started_at = coalesce(m.started_at, now()),
        updated_at = now()
    from cte
    where m.id = cte.id
    returning m.* into claimed;
  if claimed.id is null then
    return;
  end if;
  return next claimed;
end;
$$;
