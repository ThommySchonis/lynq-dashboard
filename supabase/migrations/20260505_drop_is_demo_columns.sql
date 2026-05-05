begin;

-- Drop is_demo columns die we niet meer gebruiken
alter table public.email_conversations drop column if exists is_demo;
alter table public.email_messages      drop column if exists is_demo;
alter table public.macros              drop column if exists is_demo;
alter table public.tags                drop column if exists is_demo;
alter table public.analytics_actions   drop column if exists is_demo;

-- Drop de bijbehorende indexes (worden auto-gedropt door drop column
-- maar idempotent voor herhaalde runs)
drop index if exists idx_email_conversations_is_demo;
drop index if exists idx_macros_is_demo;

-- Verification
do $$
declare v_count int;
begin
  select count(*) into v_count
  from information_schema.columns
  where table_schema = 'public'
    and column_name  = 'is_demo'
    and table_name in (
      'email_conversations','email_messages','macros',
      'tags','analytics_actions'
    );

  if v_count > 0 then
    raise exception 'Expected 0 is_demo columns, found %', v_count;
  end if;

  raise notice 'OK — all is_demo columns dropped';
end $$;

commit;

notify pgrst, 'reload schema';
