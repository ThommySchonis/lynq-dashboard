-- OAuth-first Shopify install creates an oauth_states row BEFORE any user
-- exists (no login wall). user_id must therefore be nullable; the callback
-- branches on whether user_id is present (install vs authenticated manual-add).
alter table public.oauth_states alter column user_id drop not null;
