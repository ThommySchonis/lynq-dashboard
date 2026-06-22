---
name: debug-rules
description: MUST invoke when debugging any bug, test failure, or unexpected behavior in this stack
---

# Debugging Rules

## First: use the systematic method
For any non-trivial bug, drive with `superpowers:systematic-debugging` (reproduce → isolate → hypothesize → verify). The notes below are stack-specific shortcuts, not a replacement for it.

## Running tests
- **Deno (edge function) tests** run from `supabase/functions/api/` — where `deno.json` with the import map lives — NOT from `supabase/functions/`:
  ```bash
  cd supabase/functions/api && deno test --allow-read tests/<name>.test.ts
  ```
  `--allow-read` is required for any test that reads fixtures from disk.
- **Lint** (catches most type/`any` errors): `npm run lint` from `lynq-dashboard/`.

## Logs & observability
- **Edge function logs:** `supabase functions logs <name>` (e.g. `supabase functions logs api`). Check here first for Hono route / webhook / cron failures in prod.
- **Sentry** captures frontend, server, and edge errors (`sentry.server.config.ts`, `sentry.edge.config.ts`). Search by route or workspace.
- **Gateway 401 on a webhook/cron** → almost always missing `verify_jwt = false`. See `deployment-rules`.

## Common-cause checklist (check before deep-diving)
- **A scoped query returns empty / wrong rows** → missing `workspace_id` filter, or an RLS policy calling `get_user_workspace_id()`. See `supabase-auth-rules`.
- **A stored function returns only one row** → SETOF not aggregated with `json_agg`. See `db-rules`.
- **A new Hono route 404s in prod** → the `api` function wasn't redeployed, or the prefix is missing from `honoRoutes`. See `hono-api-rules` / `deployment-rules`.
- **A Select shows a raw id instead of a label, or a build type error on `onValueChange`** → base-ui Select quirks. See `ui-rules`.
- **A settings page renders unstyled / sidebar-less** → it's under `app/settings/...` instead of `app/(protected)/settings/...`. See `ui-rules`.
- **Shopify call fails with auth error** → expired OAuth token not refreshed, or wrong per-store credentials. See `shopify-rules`.

## Don't
- Don't run ad-hoc SQL in the Supabase SQL Editor to "debug" — reproduce via a migration or a script. See `db-rules`.
- Don't add speculative error handling for cases that can't happen (KISS).
