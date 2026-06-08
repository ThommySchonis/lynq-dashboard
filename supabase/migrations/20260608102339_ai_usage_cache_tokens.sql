-- Adds Anthropic prompt-caching token columns to ai_usage. Both nullable —
-- pre-existing rows and non-Anthropic provider rows leave them empty.

ALTER TABLE public.ai_usage
  ADD COLUMN IF NOT EXISTS cache_read_input_tokens     int,
  ADD COLUMN IF NOT EXISTS cache_creation_input_tokens int;

COMMENT ON COLUMN public.ai_usage.cache_read_input_tokens IS
  'Anthropic prompt caching: tokens served from cache (priced at ~10% of input).';
COMMENT ON COLUMN public.ai_usage.cache_creation_input_tokens IS
  'Anthropic prompt caching: tokens written to cache (priced at ~125% of input).';