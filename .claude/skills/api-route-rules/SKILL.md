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
import { getAuthContext } from '@/lib/auth'
import { getShopifyCredentialsByWorkspace } from '@/lib/shopifyCredentials'
import { someServiceFn, ShopifyApiError } from '@/lib/services/shopify'
import { NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const credentials = await getShopifyCredentialsByWorkspace(ctx.workspaceId)
  if (!credentials) return NextResponse.json({ error: 'Shopify not configured' }, { status: 400 })

  try {
    const result = await someServiceFn(credentials)
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof ShopifyApiError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
```
