-- Extend ai_policies with brand-identity columns for Emma Phase 1 (Fundament)
-- These fields mirror the existing ai_settings columns but are scoped per store,
-- allowing multi-store workspaces to configure distinct brand identities.

ALTER TABLE public.ai_policies ADD COLUMN IF NOT EXISTS brand_name        text;
ALTER TABLE public.ai_policies ADD COLUMN IF NOT EXISTS brand_description  text;
ALTER TABLE public.ai_policies ADD COLUMN IF NOT EXISTS tone_of_voice      text;
ALTER TABLE public.ai_policies ADD COLUMN IF NOT EXISTS sign_off           text;
ALTER TABLE public.ai_policies ADD COLUMN IF NOT EXISTS languages          jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.ai_policies ADD COLUMN IF NOT EXISTS website_url        text;
