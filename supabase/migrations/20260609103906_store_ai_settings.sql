ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS ai_auto_generate boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ai_auto_send_enabled boolean NOT NULL DEFAULT false;
