@AGENTS.md

# Lynq & Flow — Dashboard Platform

## Project Overview

A client dashboard platform for Lynq & Flow agency. Each client gets their own login and sees their Shopify data (orders, refunds, KPIs). The admin (info@lynqagency.com) manages everything via a separate admin panel.

**Tech Stack:** Next.js 16.2.3 (app router), React 19, TanStack React Query, Zustand, react-hook-form + zod, Supabase, Vercel

**Repo:** github.com/ThommySchonis/lynq-dashboard | **Hosting:** lynq-dashboard.vercel.app | **Supabase:** cvrzvhnsltjubmfkcxql.supabase.co

## Design System

All design tokens live in `app/globals.css` as CSS variables, mapped to Tailwind via `@theme inline`. Colors use shadcn naming (hex/rgba, not oklch).

**Tokens:** Standard shadcn (`--background`, `--foreground`, `--card`, `--primary`, `--secondary`, `--muted`, `--destructive`, `--border`, `--input`, `--ring`) + semantic extensions (`--foreground-2`, `--foreground-3`, `--foreground-4`, `--success`, `--warning`, `--info`, `--border-hover`, `--accent-soft`).

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--background` | `#F9F8FF` | `#1C0F36` | Page background |
| `--card` | `#FFFFFF` | `#241352` | Card/surface background |
| `--primary` | `#8B5CF6` | `#A175FC` | Brand accent (purple) |
| `--foreground` | `#0F0F10` | `#F8FAFC` | Primary text |
| `--border` | `rgba(0,0,0,0.07)` | `rgba(255,255,255,0.07)` | Borders |

**Fonts:** Switzer (body, Fontshare CDN → `font-sans`), Instrument Serif (display, `--font-display`), DM Sans (value feed, `--font-dm-sans`). Light/dark mode via `:root` / `.dark` blocks.

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

**Shopify integration flow:** OAuth or manual API key → credentials in `integrations` table (workspace-scoped) → `getAuthContext()` → `getShopifyCredentialsByWorkspace()` → service function → JSON response. Orders synced to `shopify_orders` via cron Edge Function.

**Admin panel:** `/admin` (login via `/admin/login`), only for `info@lynqagency.com`. Tabs: Clients, Broadcasts, Notifications.

**Environment variables:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SECRET_KEY` (server-only), `OAUTH_STATE_SECRET`, `EMAIL_WEBHOOK_SECRET`, `WHOP_WEBHOOK_SECRET`, `WEBHOOK_RETRY_SECRET` (server-only), `PAYMENTS_ENABLED`. Stored in `.env.local` and Vercel Settings.

## Mandatory Rules

### Workspace Scoping

Every table with a `workspace_id` column must be queried with a `workspace_id` filter. Omitting it leaks data across workspaces. Use `getAuthContext(request)` → `ctx.workspaceId`. Use `scoped()` helper from `lib/db.ts` or explicit `.eq("workspace_id", ctx.workspaceId)`.

**Workspace-scoped tables:** `workspace_members`, `workspace_invites`, `clients`, `integrations`, `email_accounts`, `email_conversations`, `email_messages`, `conversation_notes`, `shopify_orders`, `shipments`, `analytics_actions`, `ai_settings`, `time_sessions`, `time_session_edits`, `macros`, `macro_onboarding`, `tags`, `team_members`, `tasks`, `feedback_submissions`, `workspace_subscriptions`, `usage_counters`, `invoices`, `billing_info`, `payment_methods`, `workspace_addons`, `workspace_deletion_log`, `oauth_states`, `stores`. Any new table with `workspace_id` follows the same rule.

### Backend Service Layer

API routes are thin wrappers only — auth + credentials + service call + JSON response. All business logic in `lib/services/`. Service functions are pure (accept data, return data, throw on errors). Never put business logic in route handlers.

### Auth

Always use `getAuthContext(request)` in API routes — returns `{ user, workspace, workspaceId, role, memberId }`. Never use `getUserFromToken()` directly.

### TypeScript Only

All new files must be `.ts`/`.tsx`. No `any` — use `unknown`, specific interfaces, or `Record<string, unknown>`. Enforced by ESLint.

### Imports

Use `@/` path alias for all imports (e.g., `@/lib/auth`, `@/components/ui/button`). No relative paths with `../../../`.

### Roles

Four roles in `workspace_members.role`: `owner`, `admin`, `agent`, `observer`. See `lib/permissions.ts` for `can.*` capability checks.

## API Architecture: Hono Edge Functions (Primary) + Next.js API Routes (Legacy)

Most API endpoints live in the **Hono app** at `supabase/functions/api/`. A few legacy endpoints remain as Next.js API routes in `app/api/` (AI streaming, OAuth callbacks, email sync). **All new API endpoints MUST be Hono routes** unless they require Next.js-specific features (streaming, OAuth redirects).

### Hono Route Pattern

Each route module is a Hono sub-app mounted in `supabase/functions/api/index.ts`:

```typescript
// supabase/functions/api/routes/my-feature.ts
import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth.ts'
import { requireWriteAccess } from '../middleware/workspace.ts'
import { getAdminClient } from '../lib/supabase.ts'
import type { AuthContext } from '../lib/types.ts'

const app = new Hono()
app.use('*', authMiddleware)

app.get('/', async (c) => {
  const ctx = c.get('authContext') as AuthContext
  const sb = getAdminClient()
  const { data } = await sb.from('table').select('*').eq('workspace_id', ctx.workspaceId)
  return c.json({ data })
})

app.post('/', async (c) => {
  const ctx = c.get('authContext') as AuthContext
  const blocked = requireWriteAccess(c)
  if (blocked) return blocked
  const body = await c.req.json()
  // ... validate, call service, return response
  return c.json({ success: true })
})

export { app as myFeatureRoutes }
```

Then register in `index.ts`:
```typescript
import { myFeatureRoutes } from './routes/my-feature.ts'
app.route('/my-feature', myFeatureRoutes)
```

And add the path prefix to `lib/api-client.ts` `honoRoutes` array so the frontend routes to Hono.

### Frontend API Routing

`lib/api-client.ts` has `apiUrl(path)` which checks if a path prefix is in the `honoRoutes` array. If yes → routes to `SUPABASE_URL/functions/v1/api/{path}`. If no → routes to Next.js `/api/{path}`. **When adding a new Hono route, always add its prefix to `honoRoutes`.**

### Hono Auth & Middleware

- **Auth:** `authMiddleware` extracts Bearer token → validates via Supabase Auth → loads workspace membership → sets `c.set('authContext', ctx)`
- **Write access:** `requireWriteAccess(c)` blocks writes to suspended workspaces
- **Permissions:** `can.*` functions in `lib/permissions.ts` for role-based checks
- **Supabase client:** `getAdminClient()` returns service-role client (bypasses RLS)

### Edge Function Decision Rule

Use **Hono Edge Functions** (default for all new endpoints) when:
- The operation is a standard CRUD API endpoint
- The operation is triggered by a webhook
- The operation is a scheduled/cron job

Use **Next.js API routes** only when:
- The operation requires streaming responses (AI chat)
- The operation requires Next.js-specific features (OAuth redirects with cookies)

## Database Migrations

- All schema changes must go through `supabase migration new <name>`
- Write SQL in the generated file in `supabase/migrations/`
- Apply via `supabase db push` (remote) or `supabase db reset` (local)
- **Never** run SQL directly in Supabase SQL Editor or any SQL terminal
- New tables must include `workspace_id` column + RLS policies

## Linter

- Run `npm run lint` after completing any task
- All errors must be resolved before considering work done
- No `any` types allowed — enforced by ESLint (`no-explicit-any`, `no-unsafe-*`)

## Skills Reference

You **MUST** invoke the relevant skill before creating or editing these files. Check this table on every file operation.

| When you are about to... | Invoke skill |
|---|---|
| Create/edit a React component (`components/**/*.tsx`, any `.tsx` exporting a component) | `component-rules` |
| Create/edit hooks (`hooks/**/*.ts`, `hooks/**/*.tsx`) | `component-rules` |
| Create/edit a page or layout (`app/**/page.tsx`, `app/**/layout.tsx`) | `page-rules` |
| Create/edit an API route (`app/api/**`) | `api-route-rules` |
| Create/edit a Supabase Edge Function (`supabase/functions/**`) | `edge-function-rules` |
| Change database schema, tables, stored functions, or RLS policies | `migration-rules` |

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
