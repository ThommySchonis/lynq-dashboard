---
name: shopify-rules
description: MUST invoke before touching Shopify integration — lib/services/shopify.ts, lib/store-credentials.ts, OAuth callback, or the shopify-sync / shopify-webhook edge functions
---

# Shopify Integration Rules

## Credential model
- Credentials live in the `integrations` table (workspace-scoped, one row per store). Columns include `shopify_domain`, `shopify_access_token`, `shopify_client_id`, `shopify_client_secret`, `shopify_refresh_token`, `shopify_token_expires_at`, `shopify_refresh_token_expires_at`.
- Per-row client credentials override env `SHOPIFY_CLIENT_ID` / `SHOPIFY_CLIENT_SECRET`.
- **Two onboarding paths:**
  - **OAuth:** initiated from the stores settings page → callback at `app/api/auth/shopify/callback/route.ts` exchanges the code for a token (with HMAC verification) → stored in `integrations`. (OAuth callbacks stay Next.js routes — they need redirects/cookies. See `hono-api-rules`.)
  - **Manual API key:** user pastes a key → stored in `integrations.shopify_access_token`, no expiry.

## Getting credentials (always go through the helper)
- Use `getStoreCredentials(storeId, workspaceId)` from `lib/store-credentials.ts`. It auto-refreshes expired OAuth tokens (5-min buffer) using the stored refresh token, and returns `{ domain, accessToken }` or null.
- **Never** read `shopify_access_token` directly from `integrations` in a route — you'll miss the refresh.

## Calling the Shopify API
- All calls go through `shopifyFetchJSON()` in `lib/services/shopify.ts` (builds the URL, sets the Bearer header, parses + types the response).
- **Never call the Shopify API directly from a route handler or a component** — only from `lib/services/shopify.ts`. Routes are thin wrappers (see `hono-api-rules`).
- On failure, throw `ShopifyApiError`; routes map it to an HTTP status.
- Demo-data check belongs in the route (`credentials.domain === DEMO_SHOP`), not in the service.

## Orders sync
- **Cron:** `supabase/functions/shopify-sync/index.ts` — fetches active integrations per workspace, pulls ~90 days of orders, parses presentment_money (multi-currency), upserts into `shopify_orders`. Skips suspended workspaces.
- **Webhook:** `supabase/functions/shopify-webhook/index.ts` — handles `orders/create` / `orders/updated`, verifies HMAC with the per-integration `shopify_client_secret`, upserts a single order.
- Both write to `shopify_orders` (workspace-scoped — see `supabase-auth-rules`).

## Other Shopify webhooks (Hono routes)
- Billing (app charges): `supabase/functions/api/routes/webhooks-shopify-billing.ts`.
- Compliance (GDPR erasure): `supabase/functions/api/routes/webhooks-shopify-compliance.ts`.
- All webhook functions must set `verify_jwt = false` and verify HMAC. See `deployment-rules`.

## Adding new Shopify functionality
1. Add a service function to `lib/services/shopify.ts` using `shopifyFetchJSON()`.
2. Add a thin route that calls it (Hono preferred — see `hono-api-rules`).
3. For heavy aggregations over `shopify_orders`, prefer a PostgreSQL stored function (see `db-rules`).
4. Display via TanStack Query hooks (see `ui-rules`) — never fetch Shopify from a component.
