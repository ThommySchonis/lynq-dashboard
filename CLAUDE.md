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

**Environment variables:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SECRET_KEY` (server-only), `OAUTH_STATE_SECRET`, `EMAIL_WEBHOOK_SECRET`, `WHOP_WEBHOOK_SECRET`, `WEBHOOK_RETRY_SECRET` (server-only), `SHOPIFY_APP_HANDLE` (App Store listing slug, used to construct Managed Pricing URLs), `PAYMENTS_ENABLED`, `EMMA_COST_PER_TRIGGER_EUR` (edge function secret, cost in EUR per Emma generation, default 0). Stored in `.env.local` and Vercel Settings (for Vercel env vars), or via `npx supabase secrets set` (for edge function secrets).

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

### Exception — AI agent settings CRUD

CRUD for the AI agent settings tables (`ai_policies`, `ai_scenarios`, `ai_autonomy_rules`, `ai_lessons`, `ai_examples`) is handled by Postgres `SECURITY DEFINER` functions in `supabase/migrations/`, called from the frontend via `lib/rpc.ts`. New endpoints for this area follow the same RPC pattern, not Hono. AI generation routes (`/api/ai/reply`, `/api/ai/chat`, `/api/ai/analyze`, `/api/ai/translate`, `/api/ai/macros`) remain Next.js routes for streaming/structured-output support.

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

## Common Pitfalls

These are gotchas that have already bitten this codebase. Check the relevant rule before touching the area.

### base-ui Select (NOT Radix)
`components/ui/select.tsx` wraps `@base-ui/react/select`. Behavior differs from Radix in two ways:
- **`<SelectValue>` shows the raw `value`** unless given a render-function child. The `label` prop on `<SelectItem>` is for keyboard text navigation only — it does NOT affect the trigger display. To show a friendly label in the trigger:
  ```tsx
  <SelectValue placeholder="…">
    {(value: string | null) => members.find((m) => m.id === value)?.name ?? value}
  </SelectValue>
  ```
- **`onValueChange` signature is `(value: string | null) => void`.** Handle null explicitly — base-ui emits null when selection is cleared. A typed callback `(v: string) => ...` will fail TypeScript build.

### Settings pages
- All settings pages live under `app/(protected)/settings/<category>/<page>/`. The `(protected)` route group supplies `AppShell` + `SettingsSidebar` via the parent `layout.tsx`. Putting a page under `app/settings/...` produces an unstyled, sidebar-less page.
- New pages also need a `SettingsNavItem` entry in `lib/settings-constants.ts` `SETTINGS_NAV` to appear in the sidebar. The sidebar is data-driven, not auto-discovered.
- Standard page shell: `<div className="max-w-3xl mx-auto px-10 py-12">` wrapping `<SettingsSection title=… description=… actions=…>` and `<SettingsCard>` from `components/features/settings/settings-section.tsx`. Don't roll your own header/card.

### shadcn `Card` has built-in `py-4`
Wrapping an interactive element (e.g. `<Button>`) inside `<Card>` creates visible top/bottom gutters that the hover background can't fill. Either drop the `Card` wrapper or pass `className="py-0"` to strip the padding.

### Postgres SETOF → JSON aggregation
When wrapping a table-returning function inside `json_build_object` (the standard `api_*` wrapper pattern), you MUST aggregate explicitly. The naive form silently returns only the first row, or errors with "more than one row returned by a subquery used as an expression":
```sql
-- WRONG
return (select json_build_object('data', my_setof_function(...)));

-- RIGHT
return (select json_build_object('data',
  coalesce(
    (select json_agg(row_to_json(t)) from my_setof_function(...) t),
    '[]'::json
  )
));
```

### Edge function deployments are separate from migrations
- SQL: `supabase db push` (remote) and `supabase migration up --local` (local). The two are independent — pushing to remote doesn't apply locally and vice versa.
- Edge functions: `supabase functions deploy <name>` per function, from `lynq-dashboard/`. Adding a new Hono route to `routes/` does NOT take effect on prod until the `api` function is redeployed.
- The CLI looks for the `supabase/` directory relative to cwd — run deploys from `lynq-dashboard/`, not the workspace root.

### Deno tests
Edge-function Deno tests must run from `supabase/functions/api/` (where `deno.json` with the import map lives), not from `supabase/functions/`:
```bash
cd supabase/functions/api && deno test --allow-read tests/<name>.test.ts
```
The `--allow-read` flag is required for any test that reads fixtures from disk.

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

### Installed Skills

| Skill | Path | Notes |
|---|---|---|
| `grill-me` | `.agents/skills/grill-me/SKILL.md` (symlinked at `.claude/skills/grill-me`) | A relentless interview to sharpen a plan or design. User-invoked only (`/grill-me` → runs a `/grilling` session). **When this skill is active, all communication with the user MUST be exclusively in Ukrainian.** |

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
