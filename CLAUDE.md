@AGENTS.md

# Lynq & Flow — Dashboard Platform

## Wat is dit?

Een client dashboard platform voor Lynq & Flow agency. Elke klant krijgt een eigen login en ziet zijn eigen Shopify data (orders, refunds, KPIs). De admin (info@lynqagency.com) beheert alles via een apart admin panel.

## Tech Stack

- **Frontend:** Next.js 16.2.3 (app router), React 19
- **Database/Auth:** Supabase (project: cvrzvhnsltjubmfkcxql.supabase.co)
- **Hosting:** Vercel (lynq-dashboard.vercel.app)
- **Repo:** github.com/ThommySchonis/lynq-dashboard
- **Dashboard UI:** Static HTML in /public/dashboard.html (prototype: /Users/thommy.schonisziggo.nl/agency-dashboard/dashboard_prototype.html)

## Design

- Achtergrond: `#1C0F36`
- Surface: `#241352`
- Accent: `#A175FC`
- Font: Rethink Sans
- Border: `rgba(255,255,255,0.07)`

## Bestandsstructuur

```
app/
  admin/
    page.js          — Admin panel (clients, broadcasts, notifications tabs)
    login/page.js    — Admin login (alleen info@lynqagency.com)
  login/
    page.js          — Client login → redirect naar /dashboard.html
  api/
    shopify/         — Thin API route wrappers (auth + service call + JSON response)
  page.tsx           — Root redirect
lib/
  services/
    shopify.js       — All Shopify business logic (KPIs, orders, refunds, sync, etc.)
    refunds.js       — Refund classification and aggregation
    inbox.js         — Unified inbox operations (Gmail/Outlook/custom)
  utils/
    request.js       — Shared request helpers (parseDateRange)
  providers/         — Email provider adapters (Gmail, Outlook, custom SMTP)
  auth.js            — getAuthContext() — workspace-scoped auth for all API routes
  supabase.js        — Supabase client (use client, public key)
  supabaseAdmin.js   — Supabase admin client (secret key, server-only)
  shopifyCredentials.js — getShopifyCredentialsByWorkspace()
  db.js              — scoped() helper for workspace-scoped queries
  permissions.js     — Role-based access control (can.* checks)
supabase/
  migrations/        — PostgreSQL migrations (stored functions, schema changes)
  functions/
    shopify-webhook/ — Edge Function: receives Shopify webhook events
    shopify-sync/    — Edge Function: cron-based order sync (every 30 min)
public/
  dashboard.html     — Het volledige client dashboard (statische HTML)
middleware.js        — Passthrough (geen auth check op middleware niveau)
```

## Supabase Tabellen

- **clients** — id, company_name, email, shopify_domain, shopify_api_key, gorgias_domain, gorgias_api_key, parcel_panel_api_key, status, created_at
- **broadcasts** — id, title, body, type (update/tip/video/industry), created_at
- **notifications** — id, title, body, type (info/warn/danger), created_at

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=https://cvrzvhnsltjubmfkcxql.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...   ← server-only, nooit in client code
OAUTH_STATE_SECRET=...              ← optioneel; valt terug op SUPABASE_SECRET_KEY
EMAIL_WEBHOOK_SECRET=...            ← verplicht voor inbound email webhook verificatie
WHOP_WEBHOOK_SECRET=...             ← nodig zodra Whop/payments gekoppeld worden
PAYMENTS_ENABLED=true               ← pas aanzetten zodra echte payments gekoppeld zijn
```

Staan lokaal in .env.local en in Vercel onder Settings → Environment Variables.

## Hoe de Shopify koppeling werkt

1. Client connects Shopify via OAuth (`/api/auth/shopify`) or manual API key (`/api/shopify/manual-connect`)
2. Credentials are stored in the `integrations` table, scoped to `workspace_id`
3. Frontend sends Bearer token → API route calls `getAuthContext()` → resolves workspace
4. Route calls `getShopifyCredentialsByWorkspace(workspaceId)` → gets `{ domain, accessToken }`
5. Route delegates to service function in `lib/services/shopify.js` → data returned as JSON
6. Orders are synced to `shopify_orders` table via `/api/shopify/sync` or the `shopify-sync` Edge Function (cron)
7. KPIs and revenue trends are computed from `shopify_orders` via PostgreSQL stored functions (`get_kpis`, `get_revenue_trend`)

## Live data in dashboard.html

Het dashboard gebruikt `@supabase/supabase-js` via CDN. Bij laden:

- `initDashboard()` → controleert session, anders redirect naar /login
- `loadKPIs(token)` → vult KPI cards (revenue, refund rate, cancellations etc.)
- `loadOrders(token)` → vult de recente orders tabel onderaan home pagina
- `loadBroadcasts()` → vervangt Value Feed content met broadcasts uit Supabase

## Admin Panel

- URL: `/admin` (login via `/admin/login`)
- Alleen toegankelijk voor `info@lynqagency.com`
- Tabs: Clients (aanmaken), Broadcasts (pushen naar klanten), Notifications
- Bij client aanmaken: Supabase auth account + clients tabel record

## Git Branch Management — mandatory rule

**Never commit directly to `main`.** All work must happen on feature branches.

### Branch naming

Use prefixes: `feature/`, `fix/`, `refactor/`, `chore/`
Examples: `feature/refunds-table`, `fix/login-redirect`, `chore/update-deps`

### Workflow

1. Before starting any feature or fix, create a new branch from `main`:
   ```
   git checkout main && git pull && git checkout -b feature/short-description
   ```
2. Make commits on the feature branch with clear, descriptive messages.
3. When work is complete, push the branch and create a PR to `main`.
4. Do **not** merge PRs automatically — wait for review/approval.
5. After merge, delete the feature branch.

### Rules for Claude (AI assistant)

- **Always** check the current branch before making changes. If on `main`, create a feature branch first.
- **Never** force-push or rebase `main`.
- **Never** merge a feature branch into `main` without explicit user approval.
- When the user (client) has committed directly to `main`, do not overwrite their work. Instead, branch from the current state and continue from there.
- Keep commits small and focused — one logical change per commit.

## Workflow: aanpassen en deployen

1. Pas `dashboard_prototype.html` aan in `/Users/thommy.schonisziggo.nl/agency-dashboard/`
2. Kopieer naar `/Users/thommy.schonisziggo.nl/lynq-dashboard/public/dashboard.html`
3. Commit + push naar GitHub → Vercel deployt automatisch

## Backend Service Layer — mandatory rule

All backend business logic lives in `lib/services/`. API routes are **thin wrappers only** — they handle auth, call a service function, and return JSON. Never put business logic, Shopify API calls, or data transformations directly in a route handler.

### API route pattern

Every Shopify API route must follow this exact pattern:

```js
import { getAuthContext } from '../../../../lib/auth'
import { getShopifyCredentialsByWorkspace } from '../../../../lib/shopifyCredentials'
import { someServiceFn, ShopifyApiError } from '../../../../lib/services/shopify'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const credentials = await getShopifyCredentialsByWorkspace(ctx.workspaceId)
  if (!credentials) return NextResponse.json({ error: 'Shopify not configured' }, { status: 400 })

  try {
    const result = await someServiceFn(credentials, ...)
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof ShopifyApiError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
```

### Rules

- **Always** use `getAuthContext(request)` for auth — never `getUserFromToken()` directly in routes.
- **Never** call the Shopify API from a route handler. Use functions from `lib/services/shopify.js`.
- **Never** import `lib/shopify.js` — it has been deleted. Use `lib/services/shopify.js` instead.
- Service functions are **pure** — they accept data (credentials, workspaceId, params) and return data. No `request`/`response` objects.
- Service functions **throw** on errors. Routes catch and map to HTTP responses.
- Use `ShopifyApiError` for Shopify API failures (exported from `lib/services/shopify.js`).
- Demo data is handled in the **route**, not the service: check `credentials.domain === DEMO_SHOP` before calling the service function.
- Credential shape is `{ domain: string, accessToken: string }` from `getShopifyCredentialsByWorkspace()`.

### Adding new Shopify functionality

1. Add the service function to `lib/services/shopify.js`
2. Create a thin API route that calls it
3. Use `shopifyFetchJSON()` (internal helper in shopify.js) for Shopify REST API calls
4. For heavy aggregations on `shopify_orders`, prefer PostgreSQL stored functions (see `supabase/migrations/`)

### Supabase Edge Functions

- Located in `supabase/functions/` — these run on Supabase's Deno runtime, not Next.js
- `shopify-webhook`: receives real-time order events from Shopify, upserts into `shopify_orders`
- `shopify-sync`: cron job that bulk-syncs orders for all workspaces (last 90 days)
- Edge Functions are excluded from `tsconfig.json` (Deno TS is incompatible with Next.js TS)

## Workspace Scoping — mandatory rule

Every Supabase query on workspace-owned tables **must** include a `workspace_id` filter. Omitting it leaks data across workspaces.

**Workspace-owned tables:** `workspace_members`, `workspace_invites`, `tickets`, `agents`, `macros`, `ai_settings`, and any future resource table.

**Correct:**

```js
// Option A — explicit filter
supabaseAdmin.from("tickets").select("*").eq("workspace_id", ctx.workspaceId);

// Option B — scoped() helper from lib/db.js
import { scoped } from "../../../lib/db";
const { data } = await scoped(
  supabaseAdmin.from("tickets").select("*"),
  ctx.workspaceId,
);
```

**Wrong — never do this:**

```js
supabaseAdmin.from("tickets").select("*"); // ← missing workspace_id filter
```

Use `getAuthContext(request)` from `lib/auth.js` in every API route handler — it returns `{ user, workspace, workspaceId, role, memberId }`.

## Roles

Four roles in `workspace_members.role`: `owner`, `admin`, `agent`, `observer`.
Invite roles (cannot invite as owner): `admin`, `agent`, `observer`.
See `lib/permissions.js` for `can.*` capability checks.

## Volgende fases

- Fase 3: Refunds tabel live koppelen in dashboard
- Fase 4: Eigen domein (dashboard.lynqagency.com)
- Fase 5: Email notificaties bij nieuwe broadcasts
- Fase 6: Onboarding flow voor nieuwe klanten
