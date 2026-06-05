-- Per-store free-text example replies for the Emma AI agent.
-- Add/delete only — mirrors the ai_lessons append-only convention.
-- See docs/superpowers/specs/2026-06-05-ai-agent-settings-extension-design.md

CREATE TABLE IF NOT EXISTS public.ai_examples (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  store_id     uuid        NOT NULL REFERENCES public.stores(id)     ON DELETE CASCADE,
  example_text text        NOT NULL CHECK (length(example_text) BETWEEN 1 AND 5000),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_examples_store     ON public.ai_examples(store_id);
CREATE INDEX IF NOT EXISTS idx_ai_examples_workspace ON public.ai_examples(workspace_id);

ALTER TABLE public.ai_examples ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_examples_select" ON public.ai_examples;
CREATE POLICY "ai_examples_select" ON public.ai_examples FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "ai_examples_insert" ON public.ai_examples;
CREATE POLICY "ai_examples_insert" ON public.ai_examples FOR INSERT
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "ai_examples_delete" ON public.ai_examples;
CREATE POLICY "ai_examples_delete" ON public.ai_examples FOR DELETE
  USING (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()));

-- No UPDATE policy: edits are delete + re-add. Mirrors ai_lessons.

DO $$
BEGIN
  ASSERT (SELECT count(*) FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'ai_examples') = 1,
    'ai_examples table was not created';
  RAISE NOTICE 'ai_examples table created with RLS (select/insert/delete; no update).';
END;
$$;
