@AGENTS.md

# Lynq & Flow — Dashboard Platform

## Project Overview

A client dashboard platform for Lynq & Flow agency. Each client gets their own login and sees their Shopify data (orders, refunds, KPIs). The admin (info@lynqagency.com) manages everything via a separate admin panel.

**Tech Stack:** Next.js 16.2.3 (app router), React 19, TanStack React Query, Zustand, react-hook-form + zod, Supabase, Vercel

**Repo:** github.com/ThommySchonis/lynq-dashboard | **Hosting:** lynq-dashboard.vercel.app | **Supabase:** cvrzvhnsltjubmfkcxql.supabase.co

## Design System

> **Source of truth:** `app/globals.css` is the authoritative definition of all concrete colors, fonts, and styles — **not this file**. A redesign is in progress (owned by **tkvlad1966**), so palette, fonts, and visual styling may change. Never hardcode or "restore" specific hex values from documentation; always read the current token values from `app/globals.css`. If `globals.css` and any example below disagree, `globals.css` wins.

All design tokens live in `app/globals.css` as CSS variables, mapped to Tailwind via `@theme inline`. Colors use shadcn naming (hex/rgba, not oklch).

**Token names** (structural — stable across the redesign; values live in `globals.css`): Standard shadcn (`--background`, `--foreground`, `--card`, `--primary`, `--secondary`, `--muted`, `--destructive`, `--border`, `--input`, `--ring`) + semantic extensions (`--foreground-2`, `--foreground-3`, `--foreground-4`, `--success`, `--warning`, `--info`, `--border-hover`, `--accent-soft`).

**Fonts:** loaded globally and referenced via CSS variables (`--font-display`, `--font-dm-sans`, `font-sans`). Light/dark mode via `:root` / `.dark` blocks. Exact font families and palette are defined in `globals.css` and may change with the redesign.

See `ui-rules` for how to consume tokens (token classes only, no hardcoded hex).

## Architecture

```
app/
  admin/            — Admin panel (clients, broadcasts, notifications)
  login/            — Client login
  api/              — Legacy Next.js API routes (being migrated to Hono)
  page.tsx          — Root redirect
lib/
  services/         — Business logic for Next.js routes (shopify.ts, inbox.ts, etc.)
  providers/        — Email provider adapters (Gmail, Outlook, custom SMTP)
  auth.ts           — getAuthContext() — workspace-scoped auth (Next.js routes)
  api-client.ts     — apiUrl() helper — routes requests to Hono or Next.js
  supabase.ts       — Supabase client (public key)
  supabaseAdmin.ts  — Supabase admin client (secret key, server-only)
  store-credentials.ts — getStoreCredentials(storeId, workspaceId)
  db.ts             — scoped() helper for workspace-scoped queries
  permissions.ts    — Role-based access control (can.* checks)
hooks/              — Feature-grouped custom hooks (TanStack Query)
components/
  features/         — Feature-specific components
  shared/           — Shared components
  ui/               — shadcn (base-ui) primitives
stores/             — Zustand stores (UI state only)
types/              — TypeScript type definitions
supabase/
  migrations/       — PostgreSQL migrations
  functions/
    api/            — Main Hono app (Deno runtime) — most API endpoints
      index.ts      — Route registration + global middleware
      middleware/    — auth.ts, workspace.ts, cors.ts, error-handler.ts
      routes/       — Route modules (Hono sub-apps)
      lib/
        types.ts    — AuthContext, AuthWorkspace
        supabase.ts — getAdminClient(), getAuthClient(), getUserFromToken()
        permissions.ts — can.* role checks
        services/   — Business logic for Hono routes
    (other functions) — Webhooks, cron jobs
```

**Shopify integration flow:** OAuth or manual API key → credentials in `integrations` table (workspace-scoped) → `getAuthContext()` → `getStoreCredentials(storeId, workspaceId)` → service function → JSON response. Orders synced to `shopify_orders` via cron Edge Function.

**Admin panel:** `/admin` (login via `/admin/login`), only for `info@lynqagency.com`. Tabs: Clients, Broadcasts, Notifications.

**Environment variables:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SECRET_KEY` (server-only), `OAUTH_STATE_SECRET`, `EMAIL_WEBHOOK_SECRET`, `WHOP_WEBHOOK_SECRET`, `WEBHOOK_RETRY_SECRET` (server-only), `SHOPIFY_APP_HANDLE` (App Store listing slug, used to construct Managed Pricing URLs), `PAYMENTS_ENABLED`, `EMMA_COST_PER_TRIGGER_EUR` (edge function secret, cost in EUR per Emma generation, default 0). Stored in `.env.local` and Vercel Settings (for Vercel env vars), or via `npx supabase secrets set` (for edge function secrets).

## Mandatory Rules

### Workspace Scoping

Every table with a `workspace_id` column must be queried with a `workspace_id` filter. Omitting it leaks data across workspaces. Use `getAuthContext(request)` → `ctx.workspaceId`. Use `scoped()` helper from `lib/db.ts` or explicit `.eq("workspace_id", ctx.workspaceId)`. (full rule + table list in `supabase-auth-rules`)

### Backend Service Layer

API routes are thin wrappers only — auth + credentials + service call + JSON response. All business logic in `lib/services/`. Service functions are pure (accept data, return data, throw on errors). Never put business logic in route handlers. (see `hono-api-rules`)

### Auth

Always use `getAuthContext(request)` in API routes — returns `{ user, workspace, workspaceId, role, memberId }`. Never use `getUserFromToken()` directly. (see `supabase-auth-rules`)

### TypeScript Only

All new files must be `.ts`/`.tsx`. No `any` — use `unknown`, specific interfaces, or `Record<string, unknown>`. Enforced by ESLint.

### Imports

Use `@/` path alias for all imports (e.g., `@/lib/auth`, `@/components/ui/button`). No relative paths with `../../../`.

### Roles

Four roles in `workspace_members.role`: `owner`, `admin`, `agent`, `observer`. See `lib/permissions.ts` for `can.*` capability checks.

### Linter

Run `npm run lint` after every task; resolve all errors. No `any` (ESLint-enforced).

## How We Split Logic

Two runtimes, one architecture. **Next.js side** (`lib/`, `app/`) and **Hono/Deno side** (`supabase/functions/api/`). They mirror each other: services exist in both `lib/services/` and `supabase/functions/api/lib/services/`.

- **Routes are thin wrappers** (Hono or Next.js): auth → credentials → service call → JSON. No business logic. → `hono-api-rules`
- **Services are pure**: accept data, return data, throw on errors. All business logic here. DB access via the admin client.
- **Heavy data work** (aggregations) → PostgreSQL stored functions. → `db-rules`
- **UI never talks to services directly** — it calls the API via TanStack Query hooks. → `ui-rules`
- **Cross-cutting platform concerns** (auth, workspace scoping, clients) → `supabase-auth-rules`.

When deciding where code goes, ask: is it a request/response wrapper (route), reusable logic (service), heavy data math (stored function), or rendering/state (component/hook)?

## Third-Party Integrations

| Integration | Pattern | Where |
|---|---|---|
| Email (Gmail, Outlook, SMTP, forwarding) | **Adapter registry** — `ProviderAdapter` contract + `getAdapter(provider)` | `lib/providers/`; webhooks in `supabase/functions/api/routes/webhooks-email.ts` |
| AI (Anthropic default, OpenAI, Groq) | Pluggable provider via `AI_PROVIDER` / `AI_MODEL` env | `lib/ai/model.ts`; generation routes stay Next.js (streaming) |
| Billing (Whop) | HMAC webhook + API client | `supabase/functions/api/lib/whop.ts`, `routes/webhooks-whop.ts` |
| Transactional email (Resend) | Service + webhook | `lib/services/resend-domains.ts` |
| Error tracking (Sentry) | Config-only | `sentry.server.config.ts`, `sentry.edge.config.ts` |
| Shopify | OAuth/manual key + cron + webhooks | → `shopify-rules` |

**Adding an integration of an existing kind** (e.g. a new email provider): add a new adapter file implementing the contract + register it. Never modify existing adapters (Open/Closed). Webhook receivers are Hono routes with `verify_jwt = false` + HMAC verification (see `deployment-rules`).

## Design Principles

Apply these on every change. They're not aspirational — violations get caught in review.

### DRY — Don't Repeat Yourself
- Shared config, constants, and types live in a dedicated module. Examples: `lib/settings-constants.ts` (nav, roles, defaults), `components/features/migrations/platforms.ts` (per-platform config used by multiple step components). Never inline the same `const PLATFORMS = [...]` in two component files.
- If the same shape is declared in two places (e.g. an interface in a hook AND a component), one of them should import the other.
- One source of truth for platform / role / status labels. If a label changes, only one file should need editing.

### KISS — Keep It Simple
- Prefer the simplest thing that works. No abstractions until there are at least two real call-sites that need them.
- Don't introduce wrappers, configs, factories, or generic utilities for a single use case.
- A flat function with explicit logic beats an indirected pipeline that's "extensible."
- Don't add error handling, fallbacks, validation, or feature flags for scenarios that can't happen.

### SOLID
- **Single Responsibility:** one file = one clear job. Step components render UI and own local state; they import config from a sibling module. Adapters fetch + normalize source data; the orchestrator persists. Don't mix concerns.
- **Open/Closed:** the source-platform adapter pattern (`SourceAdapter` contract + registry) is the canonical example. Adding a new platform = new file under `adapters/` + registry entry. Never modify existing adapters when adding a new one.
- **Liskov:** components and adapters that implement a shared contract must be drop-in interchangeable. Don't add hidden assumptions about which concrete platform is in play.
- **Interface Segregation:** don't bloat a contract with optional fields nobody uses. If `fetchMacros` would be empty for a source, return an empty page — don't add an `isSupported` flag.
- **Dependency Inversion:** modules depend on stable contracts (types in `types/` and the `SourceAdapter` interface), not on each other directly. The orchestrator depends on the adapter interface, not on Gorgias.

## Skills Reference

You **MUST** invoke the relevant skill before the matching work. Check this table on every file operation and task.

| When you are about to… | Invoke skill |
|---|---|
| Edit a component, hook, page, layout, store, or styling | `ui-rules` |
| Build/edit an API endpoint (Hono route or legacy Next.js route) | `hono-api-rules` |
| Touch auth, Supabase clients, or workspace scoping | `supabase-auth-rules` |
| Change DB schema, migrations, stored functions, or RLS | `db-rules` |
| Deploy edge functions, push migrations, or ship to Vercel | `deployment-rules` |
| Debug a bug, test failure, or unexpected behavior | `debug-rules` |
| Touch Shopify integration (sync, webhooks, credentials, OAuth) | `shopify-rules` |

## Git Branch Management

### Dev vs. Client detection

Check `git config user.email` at the start of each session:
- **Dev (denver9523@gmail.com):** Can commit directly to `main`. Feature branches are optional.
- **Anyone else (client):** Must use feature branches. Never commit directly to `main`.

### Branch naming

Use prefixes: `feature/`, `fix/`, `refactor/`, `chore/`

### Workflow for clients (non-dev)

1. Create a new branch from `main`: `git checkout main && git pull && git checkout -b feature/short-description`
2. Make commits with clear, descriptive messages.
3. Push the branch and create a PR to `main`.
4. Do **not** merge PRs automatically — wait for review/approval.
5. After merge, delete the feature branch.

### Rules for Claude

- **First**, check `git config user.email`. If `denver9523@gmail.com` (dev), committing directly to `main` is allowed.
- If not the dev, always create a feature branch before making changes.
- **Never** force-push or rebase `main`.
- **Never** merge a feature branch into `main` without explicit user approval.
- When a client has committed directly to `main`, branch from the current state.
- Keep commits small and focused — one logical change per commit.
