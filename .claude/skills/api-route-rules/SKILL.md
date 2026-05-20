---
name: api-route-rules
description: MUST invoke before creating or editing any API route in app/api/
---

# API Route Rules

## Pattern
Every API route must follow this thin wrapper pattern:
1. `getAuthContext(request)` -> check auth
2. `getShopifyCredentialsByWorkspace(ctx.workspaceId)` -> get credentials (if Shopify)
3. Call service function from `lib/services/`
4. Return `NextResponse.json()`

## Input Validation (Required)
All API routes must validate user input using Zod schemas and the validation helpers in `lib/validation.ts`:

- **Request bodies:** Use `validateBody(request, schema)` from `@/lib/validation`
- **Query params:** Use `validateQuery(request, schema)` from `@/lib/validation`
- **Route params:** Use `validateParams(params, schema)` from `@/lib/validation`
- **Schemas:** Define in `lib/schemas/<domain>.ts` (e.g., `lib/schemas/tags.ts`). Import shared primitives from `lib/schemas/common.ts`
- **Naming:** `{action}{Domain}Body` for bodies, `{action}{Domain}Query` for queries, `{domain}Params` for params
- **Never** cast `request.json()` to a TypeScript interface without runtime Zod validation
- Validation goes after auth but before business logic
- FormData routes (file uploads) skip `validateBody` — validate manually

## Rules
- Never call Shopify API directly from route handlers — use `lib/services/shopify.ts`
- Never import `lib/shopify.js` (deleted) — use `lib/services/shopify.ts`
- Service functions are pure: accept data, return data, no `request`/`response` objects
- Service functions throw on errors — routes catch and map to HTTP status codes
- Use `ShopifyApiError` for Shopify API failures
- Demo data check in route (`credentials.domain === DEMO_SHOP`), not in service
- Credential shape: `{ domain: string, accessToken: string }`
- All Supabase queries must include `workspace_id` filter
- Use `scoped()` from `lib/db.ts` or explicit `.eq("workspace_id", ctx.workspaceId)`
- Use `@/` path alias for imports, not relative paths

## Template

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
