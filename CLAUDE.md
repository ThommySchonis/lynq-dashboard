@AGENTS.md

# Lynq & Flow — Dashboard Platform

## Wat is dit?

Een client dashboard platform voor Lynq & Flow agency. Elke klant krijgt een eigen login en ziet zijn eigen Shopify data (orders, refunds, KPIs). De admin (info@lynqagency.com) beheert alles via een apart admin panel.

## Tech Stack

- **Frontend:** Next.js 16.2.3 (app router), React 19, TanStack React Query, Zustand, react-hook-form + zod
- **Database/Auth:** Supabase (project: cvrzvhnsltjubmfkcxql.supabase.co)
- **Hosting:** Vercel (lynq-dashboard.vercel.app)
- **Repo:** github.com/ThommySchonis/lynq-dashboard
- **Dashboard UI:** Static HTML in /public/dashboard.html (prototype: /Users/thommy.schonisziggo.nl/agency-dashboard/dashboard_prototype.html)

## Design System

All design tokens live in `app/globals.css` as CSS variables and are mapped to Tailwind via `@theme inline`. Colors use shadcn naming convention (hex/rgba, not oklch).

### Token Architecture

- **Standard shadcn tokens** (`--background`, `--foreground`, `--card`, `--primary`, `--secondary`, `--muted`, `--destructive`, `--border`, `--input`, `--ring`) — used via Tailwind classes: `bg-background`, `text-foreground`, `bg-primary`, etc.
- **Semantic extensions** (`--foreground-2`, `--foreground-3`, `--foreground-4`, `--success`, `--warning`, `--info`, `--border-hover`, `--accent-soft`, `--shadow-card`, `--skeleton-from`, etc.) — used via `text-foreground-2`, `bg-success`, `hover:border-border-hover`, etc.
- **Light/dark mode** — `:root` (light) and `.dark` (dark) blocks. Dark mode toggled via `.dark` class on `<html>`, **not** `[data-theme="dark"]`.

### Key Colors

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--background` | `#F9F8FF` | `#1C0F36` | Page background |
| `--card` | `#FFFFFF` | `#241352` | Card/surface background |
| `--primary` | `#8B5CF6` | `#A175FC` | Brand accent (purple) |
| `--foreground` | `#0F0F10` | `#F8FAFC` | Primary text |
| `--border` | `rgba(0,0,0,0.07)` | `rgba(255,255,255,0.07)` | Borders |

### Fonts

- **Body:** Switzer (loaded via Fontshare CDN, mapped to `font-sans` in Tailwind theme)
- **Display:** Instrument Serif (loaded via `next/font/google`, variable `--font-display`)
- **Value Feed:** DM Sans (loaded via `next/font/google`, variable `--font-dm-sans`)

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
const { data } = await scoped(supabaseAdmin.from("tickets").select("*"), ctx.workspaceId);
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

## Frontend Development Rules — mandatory

These rules apply to all new features, components, and refactoring work on the frontend.

### 1. Separate business logic from UI

- **Never** put API calls, data transformations, or complex state logic directly in components.
- Extract logic into custom hooks in `hooks/` (grouped by feature, e.g. `hooks/inbox/`).
- Components should only handle rendering and call hooks for data and actions.

### 2. Use TanStack React Query for all server data

- All API fetches must use `useQuery` (reads) and `useMutation` (writes) from `@tanstack/react-query`.
- Define query keys in a `Keys` object per feature for consistent cache invalidation.
- **Never** use `useState` + `useEffect` + `fetch` for server data — that pattern is replaced by TanStack.
- Mutations should invalidate related queries on success.

### 3. Use Tailwind classes and shadcn components — no inline style objects

- **Never** use `style={{...}}` for static styling. Use Tailwind utility classes instead.
- `style={{}}` is only acceptable for truly dynamic values computed from JS variables (e.g., animation delays, complex decorative gradients).
- **Never** inject CSS via `<style dangerouslySetInnerHTML>` or `const CSS = \`...\``. Move styles to `globals.css` or use Tailwind.
- **Never** define custom CSS classes in `globals.css` for component styling. All styling must be inline Tailwind utilities in component `className` props. The only CSS classes in `globals.css` are pseudo-element selectors that Tailwind can't express (`::-webkit-scrollbar`, `[contenteditable]:empty:before`, `input:-webkit-autofill`, sibling selectors).
- Colors must use shadcn Tailwind token classes: `text-foreground`, `bg-card`, `bg-primary`, `text-muted-foreground`, `border-border`, `bg-secondary`, etc.
- For semantic extension tokens: `text-foreground-2`, `text-foreground-3`, `text-foreground-4`, `bg-success`, `bg-warning`, `hover:border-border-hover`, `bg-accent-soft`, etc.
- **Never** use old token names: `--bg-page`, `--bg-surface`, `--text-1`, `--text-2`, `--text-3`, `--text-4`, `--error`, `--danger`. These have been removed.
- **Never** hardcode hex colors that map to design tokens. Use `bg-primary` instead of `bg-[#A175FC]`, `text-foreground` instead of `text-[#0F0F10]`, etc. Hardcoded hex is only acceptable for decorative one-offs (confetti, SVG strokes, unique gradients).

### 4. Keep components small and focused

- Extract repeated UI blocks into separate component files.
- A component file should ideally be under 300 lines. If it grows beyond that, look for extractable sub-components.
- Group feature components in `components/features/<feature>/` and shared ones in `components/shared/`.

### 5. TypeScript only — no JavaScript files

- All new files must be `.ts` or `.tsx`. Never create `.js` or `.jsx` files.
- When modifying an existing `.js` file, convert it to `.ts`/`.tsx` as part of the change.
- Add proper type annotations — avoid `any`. Use `unknown`, specific interfaces, or `Record<string, unknown>` instead.
- Import types from `types/` (e.g. `import type { Thread } from '@/types/inbox'`).

### 6. Use Lucide icons — no inline SVGs

- Use icons from `lucide-react` for all standard icons.
- **Never** write inline `<svg>` tags in components.
- If a needed icon doesn't exist in Lucide, create a separate `.svg` file in `public/icons/` and import it — don't inline the SVG markup.
- Don't create wrapper components or icon objects (`const I = {...}`) around icons — use Lucide components directly.

### 7. Prefer Tailwind theme over globals.css

- Configure colors, spacing, and design tokens in the Tailwind theme (via `globals.css` CSS variables + `@theme inline` block).
- `globals.css` structure: imports → `:root` tokens → `.dark` tokens → `@layer base` → pseudo-element selectors → `@theme inline` → `@keyframes`. Nothing else.
- Only use `globals.css` for styles that genuinely can't be expressed with Tailwind: pseudo-element selectors (`::-webkit-scrollbar`, `[contenteditable]:empty:before`, `input:-webkit-autofill`), sibling selectors (`.float-field ~ .float-label`), and `@keyframes` definitions.
- **Never** add custom utility classes to `globals.css`. All component styling must be inline Tailwind in `className`.
- **Never** add element-level resets (`* {}`, `button {}`, `input {}`) outside `@layer base` — they override Tailwind utilities.
- Dark mode uses `.dark` class on `<html>` (Tailwind-native). Use `dark:` prefix in components. **Never** use `[data-theme="dark"]` selectors.
- New animations: define `@keyframes` in `globals.css` and register in `@theme inline` as `--animate-<name>`. Use as `animate-<name>` in components.
- `motion-reduce:` variant must be applied to any element with `opacity-0` + animation to respect `prefers-reduced-motion`.

### 8. Use Zustand for UI state, TanStack for server state

- **Zustand** is for client-side UI state only: selected items, toggles, modals, form inputs, expanded sections.
- **TanStack** is for all server-originated data: API responses, cached data, loading/error states.
- **Never** store API response data in Zustand — let TanStack manage it.
- Use Zustand selectors to avoid unnecessary re-renders: `useStore(s => s.field)`, not `useStore()`.
- Prefer a shared Zustand store over prop-drilling when multiple components need the same UI state.

### 9. Keep constants in separate files

- Move configuration objects, enums, label maps, and static data to dedicated files in `lib/` following the pattern `lib/<feature>-constants.ts` (e.g. `lib/inbox-constants.ts`, `lib/services-constants.ts`).
- **Never** define constant arrays, config objects, or label maps inline in page or component files.
- Helper/utility functions follow the pattern `lib/<feature>-utils.ts` (e.g. `lib/date-utils.ts`, `lib/value-feed-utils.ts`).
- Shared utilities (used across features) go in `lib/date-utils.ts`, `lib/inbox-utils.ts`, etc. — don't duplicate helpers across feature files.
- Constants should be importable and reusable across components and hooks.

### 10. Prefer shadcn components over custom-styled HTML elements

- Use `<Button>`, `<Input>`, `<Dialog>`, `<DropdownMenu>`, `<Checkbox>`, `<Tabs>`, `<Badge>`, `<Avatar>`, `<ScrollArea>`, `<Skeleton>`, etc. from `components/ui/`.
- **Never** create a custom-styled `<button>` or `<input>` when a shadcn equivalent exists.
- When a shadcn component needs visual customization, use the `className` prop with Tailwind — don't create a wrapper component.
- Note: shadcn in this project uses **base-ui** (not Radix). Triggers use the `render` prop instead of `asChild`.

### 11. Use react-hook-form + zod for all forms

- All forms with 2+ fields must use `useForm` from `react-hook-form` with `zodResolver` from `@hookform/resolvers/zod`.
- **Never** use manual `useState` per form field + a custom `validate()` function — that pattern is replaced by react-hook-form.
- Define a zod schema for each form. Use `.refine()` for cross-field validation (e.g. password confirmation).
- Use `register()` to bind fields — spread onto `<Input>`, `<FloatField>`, `<PasswordField>` (they accept native input props via `forwardRef`).
- Use `formState.errors` for field-level error display. Use `setError()` for server-side validation errors.
- For forms that need `Controller` (e.g. shadcn `Select`, radio groups), use `Controller` from react-hook-form.

### 12. Use auth store for client-side session access

- **Never** call `supabase.auth.getSession()` directly in components for session checks. The `AuthHydrator` in the root layout already populates the Zustand auth store.
- Use `useAuthStore((s) => s.session)` for session data, `useAuthStore((s) => s.user)` for user data, `useAuthStore((s) => s.isLoading)` for loading state.
- For redirect-on-no-session: `const session = useAuthStore((s) => s.session); const isLoading = useAuthStore((s) => s.isLoading); useEffect(() => { if (!isLoading && !session) router.replace('/login') }, [isLoading, session, router])`.
- Exception: `supabase.auth.onAuthStateChange()` is acceptable for listening to auth events (e.g. PASSWORD_RECOVERY in reset-password flow).

### 13. Page files must be thin orchestrators

- Page files (`app/**/page.tsx`) should only contain the page component itself — no sub-components, no constants, no helper functions.
- **Extract sub-components** to `components/features/<feature>/` — even if they're only used by one page.
- **Extract constants** (arrays, config objects, label maps, static data) to `lib/<feature>-constants.ts`.
- **Extract helper functions** (formatters, calculators, URL builders) to `lib/<feature>-utils.ts`.
- A page file should ideally be under 150 lines. It imports hooks, components, and constants — then renders.

### 14. Load fonts globally — never per-page

- **Never** import fonts via `next/font/google` inside individual page files. This creates duplicate font loading and inconsistent rendering.
- All fonts must be loaded once in `app/layout.tsx` using the `variable` option (e.g. `Instrument_Serif({ variable: '--font-display' })`), then applied to `<html>` via `className`.
- Reference fonts in components via Tailwind classes using CSS variables: `font-[family-name:var(--font-display)]` or `[font-family:var(--font-display)]`.

### 15. Hook directory structure

- Each feature's hooks live in `hooks/<feature>/` with this structure:
  - `use-<feature>-data.ts` — TanStack `useQuery` hooks (reads)
  - `use-<feature>-mutations.ts` — TanStack `useMutation` hooks (writes)
  - `index.ts` — barrel re-export (`export * from './use-<feature>-data'` etc.)
- All hook files must have `'use client'` directive at the top.
- Define query keys as a `<feature>Keys` object at the top of the data file.
- Custom hooks that don't fit TanStack (e.g. streaming responses) go in their own file (e.g. `use-ai-chat.ts`).

### 16. SVG and static assets

- Non-icon SVGs (textures, patterns, backgrounds) go in `public/textures/` or `public/icons/` — never inline as JavaScript string constants.
- Reference via URL: `style={{ backgroundImage: "url('/textures/noise.svg')" }}` or `<img src="/icons/logo.svg" />`.
- Icon SVGs use Lucide components (see rule 6). Only create `.svg` files for icons not available in Lucide.

## Volgende fases

- Fase 3: Refunds tabel live koppelen in dashboard
- Fase 4: Eigen domein (dashboard.lynqagency.com)
- Fase 5: Email notificaties bij nieuwe broadcasts
- Fase 6: Onboarding flow voor nieuwe klanten
