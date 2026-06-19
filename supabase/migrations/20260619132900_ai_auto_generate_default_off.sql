-- Default Emma auto-generation to OFF for new stores, and turn it off for all
-- existing stores. The toggle is now wired to the inbox auto-generate behavior;
-- previously it controlled nothing.

alter table public.stores
  alter column ai_auto_generate set default false;

update public.stores
  set ai_auto_generate = false
  where ai_auto_generate is distinct from false;
