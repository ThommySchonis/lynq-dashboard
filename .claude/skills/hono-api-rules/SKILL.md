---
name: hono-api-rules
description: MUST invoke before building or editing any API endpoint — Hono routes in supabase/functions/api/ or legacy Next.js routes in app/api/
---

# Hono API Rules (How to Build an API Endpoint)

Most API endpoints live in the **Hono app** at `supabase/functions/api/` (Deno runtime). A few legacy endpoints remain as Next.js API routes in `app/api/`. **All new API endpoints MUST be Hono routes** unless they need Next.js-specific features.

## Decision Rule: Hono vs Next.js
Use **Hono Edge Functions** (default for all new endpoints) when:
- Standard CRUD API endpoint, webhook receiver, or scheduled/cron job.

Use **Next.js API routes** only when:
- Streaming responses (AI chat), or Next.js-specific features (OAuth redirects with cookies).

### Exception — AI agent settings CRUD
CRUD for AI agent settings tables (`ai_policies`, `ai_scenarios`, `ai_autonomy_rules`, `ai_lessons`, `ai_examples`) uses Postgres `SECURITY DEFINER` functions called from the frontend via `lib/rpc.ts` — not Hono. New endpoints in this area follow the RPC pattern (see `db-rules`). AI generation routes (`/api/ai/reply`, `/api/ai/chat`, `/api/ai/analyze`, `/api/ai/translate`, `/api/ai/macros`) remain Next.js routes for streaming.

## The Service Layer Rule (applies to BOTH runtimes)
Route handlers are **thin wrappers only**: auth + credentials + service call + JSON response. All business logic lives in `lib/services/` (Next.js) or `supabase/functions/api/lib/services/` (Hono). Service functions are pure — accept data, return data, throw on errors. Never put business logic in a route handler.

## Hono Route Pattern
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

Register in `index.ts`:
```typescript
import { myFeatureRoutes } from './routes/my-feature.ts'
app.route('/my-feature', myFeatureRoutes)
```

Then add the path prefix to `lib/api-client.ts` `honoRoutes` array so the frontend routes to Hono.

## Hono Auth & Middleware
- **Auth:** `authMiddleware` extracts Bearer token → validates via Supabase Auth → loads workspace membership → sets `c.set('authContext', ctx)`. See `supabase-auth-rules` for the full flow.
- **Write access:** `requireWriteAccess(c)` blocks writes to suspended workspaces.
- **Permissions:** `can.*` functions in `supabase/functions/api/lib/permissions.ts` for role-based checks.
- **Supabase client:** `getAdminClient()` returns the service-role client (bypasses RLS).

## Frontend API Routing
`lib/api-client.ts` `apiUrl(path)` checks whether a path prefix is in the `honoRoutes` array. If yes → `SUPABASE_URL/functions/v1/api/{path}`. If no → Next.js `/api/{path}`. **When adding a new Hono route, always add its prefix to `honoRoutes`.**

## Workspace Scoping (mandatory)
Every query against a workspace-scoped table MUST filter by `workspace_id`. See `supabase-auth-rules` for the rule and full table list. Use `ctx.workspaceId` from the auth context.

## Legacy Next.js Route Pattern (app/api/ only)
Thin wrapper: `getAuthContext(request)` → (Shopify) `getStoreCredentials(storeId, ctx.workspaceId)` from `@/lib/store-credentials` → service call → `NextResponse.json()`.

### Input Validation (Required)
- Request bodies: `validateBody(request, schema)` from `@/lib/validation`
- Query params: `validateQuery(request, schema)`
- Route params: `validateParams(params, schema)`
- Schemas in `lib/schemas/<domain>.ts`; shared primitives in `lib/schemas/common.ts`
- Naming: `{action}{Domain}Body`, `{action}{Domain}Query`, `{domain}Params`
- Never cast `request.json()` to a TS interface without runtime Zod validation
- Validation goes after auth, before business logic. FormData routes (file uploads) validate manually.

```typescript
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { validateBody, validateQuery } from '@/lib/validation'
import { createItemBody, getItemsQuery } from '@/lib/schemas/items'
import { createItem, getItems } from '@/lib/services/items'

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [query, qErr] = validateQuery(request, getItemsQuery)
  if (qErr) return qErr

  try {
    const items = await getItems(ctx.workspaceId, query)
    return NextResponse.json({ items })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [body, bErr] = await validateBody(request, createItemBody)
  if (bErr) return bErr

  try {
    const item = await createItem(ctx.workspaceId, body)
    return NextResponse.json({ item }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

### Legacy route rules
- Never call Shopify API directly from route handlers — use `lib/services/shopify.ts` (see `shopify-rules`).
- Service functions are pure: accept data, return data, no `request`/`response` objects. They throw; routes catch and map to HTTP status codes. Use `ShopifyApiError` for Shopify failures.

## Edge Function Runtime Notes (non-`api` functions)
For standalone edge functions (webhooks, cron) outside the Hono `api` app:
- Deno runtime — not Node.js. Imports via `https://esm.sh/` (npm) or `https://deno.land/x/` (Deno-native).
- Supabase client: `import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'` (project convention — `esm.sh`, not `jsr:`).
- Env via `Deno.env.get('VAR_NAME')`. Self-contained — never import from `lib/`, `app/`, or Next.js code.
- Each function in its own directory: `supabase/functions/<function-name>/index.ts`. Excluded from project `tsconfig.json`.
- Handle CORS for HTTP-triggered functions. Error responses as JSON with appropriate status codes.
- For deployment, see `deployment-rules`.
