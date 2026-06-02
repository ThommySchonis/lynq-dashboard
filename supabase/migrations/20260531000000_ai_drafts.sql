-- ============================================================
-- ai_drafts — Emma drafts persistence
-- One append-only row per AI Suggest generation. Linked to sent
-- emails retroactively via email_messages joins in a later trede.
-- ============================================================

create table if not exists public.ai_drafts (
  id                  uuid        primary key default gen_random_uuid(),
  workspace_id        uuid        not null references public.workspaces(id) on delete cascade,
  -- nullable: the fallback prompt path may not resolve to a store
  store_id            uuid        references public.stores(id) on delete set null,
  conversation_id     uuid        not null references public.email_conversations(id) on delete cascade,
  user_id             uuid        not null references auth.users(id) on delete cascade,

  -- Which prompt path produced this suggestion
  prompt_path         text        not null check (prompt_path in ('emma', 'fallback')),
  suggested_text      text        not null,

  -- LLM usage metadata — nullable, captured from the response when available
  model               text,
  prompt_tokens       integer,
  completion_tokens   integer,
  total_tokens        integer,

  generated_at        timestamptz not null default now()
  -- No updated_at: rows are append-only and never mutated.
  -- No UPDATE or DELETE RLS policies for the same reason.
);

-- For retroactive joins with email_messages (edit-rate / used-rate) per thread.
create index if not exists idx_ai_drafts_conversation on public.ai_drafts(conversation_id, generated_at desc);
-- For workspace-scoped dashboard reads in a later trede.
create index if not exists idx_ai_drafts_workspace     on public.ai_drafts(workspace_id, generated_at desc);

alter table public.ai_drafts enable row level security;

drop policy if exists "ai_drafts_select" on public.ai_drafts;
create policy "ai_drafts_select" on public.ai_drafts for select
  using (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()));

drop policy if exists "ai_drafts_insert" on public.ai_drafts;
create policy "ai_drafts_insert" on public.ai_drafts for insert
  with check (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()));

-- No UPDATE or DELETE policies: append-only table, mutations blocked at RLS.
-- INSERTs are performed server-side via supabaseAdmin (RLS bypass); the
-- INSERT policy above mirrors the other ai_* tables for convention parity.


-- ── Verification ─────────────────────────────────────────────────────

do $$
begin
  assert (select count(*) from information_schema.tables
          where table_schema = 'public' and table_name = 'ai_drafts') = 1,
    'ai_drafts table was not created';
  raise notice 'ai_drafts migration OK';
end;
$$;
