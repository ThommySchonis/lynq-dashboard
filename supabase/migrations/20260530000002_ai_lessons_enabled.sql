-- Extend ai_lessons with an `enabled` flag so the founder / agents can disable
-- a lesson without losing the row. Append-only writes are preserved
-- (no UPDATE/DELETE RLS policies) — the disable PATCH route flips this
-- column via supabaseAdmin which bypasses RLS, mirroring the existing
-- ai_drafts pattern for status mutations on append-only tables.

ALTER TABLE public.ai_lessons ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT true;
