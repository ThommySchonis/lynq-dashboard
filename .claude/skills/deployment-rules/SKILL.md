---
name: deployment-rules
description: MUST invoke before deploying — edge functions, database migrations, secrets, or shipping the Next.js app to Vercel
---

# Deployment Rules

The project has **three independent deploy surfaces.** Doing one does NOT do the others.

## 1. Next.js app → Vercel
- Deploys on git push (Vercel watches the repo).
- Cron jobs are registered in `vercel.json` (e.g. `/api/cron/data-retention`, `/api/cron/trial-expiry`, `/api/cron/usage-warnings`, `/api/cron/emma-drafts`). Adding a cron = add a `crons` entry in `vercel.json` pointing at a Next.js route.
- App env vars live in Vercel Settings and `.env.local`.

## 2. Database migrations → Supabase
- `supabase db push` (remote) / `supabase db reset` (local). Independent of each other — see `db-rules`.

## 3. Edge functions → Supabase (Deno)
- Deploy per function: `supabase functions deploy <name>` (e.g. `supabase functions deploy api`).
- **Adding a new Hono route to `routes/` does NOT take effect in prod until the `api` function is redeployed.** Edge-function deploys are separate from migrations.
- Run all `supabase ...` commands from `lynq-dashboard/` — the CLI looks for the `supabase/` directory relative to cwd, not the workspace root.
- Test locally first: `supabase functions serve`.

### Edge function secrets
- Set with `npx supabase secrets set NAME=value` (NOT Vercel env vars — those are for the Next.js app only).
- Examples: `EMAIL_WEBHOOK_SECRET`, `WHOP_WEBHOOK_SECRET`, `WEBHOOK_RETRY_SECRET`, `EMMA_COST_PER_TRIGGER_EUR`.

### verify_jwt for webhooks & cron (critical)
Webhook and cron edge functions must set `verify_jwt = false` (in the function's config / `supabase/config.toml`). Otherwise the Supabase gateway returns 401 on every request before your handler runs — external callers (Shopify, Whop, schedulers) don't send a Supabase JWT.

## Environment variable map
- **Next.js (Vercel + `.env.local`):** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SECRET_KEY`, `OAUTH_STATE_SECRET`, `SHOPIFY_APP_HANDLE`, `PAYMENTS_ENABLED`.
- **Edge function secrets (`supabase secrets set`):** `EMAIL_WEBHOOK_SECRET`, `WHOP_WEBHOOK_SECRET`, `WEBHOOK_RETRY_SECRET`, `EMMA_COST_PER_TRIGGER_EUR`.

## Pre-ship checklist
1. `npm run lint` passes (no errors, no `any`).
2. If you changed a Hono route → redeploy the `api` function.
3. If you changed SQL → `supabase db push`.
4. If you added a route prefix → it's in `lib/api-client.ts` `honoRoutes` (see `hono-api-rules`).
