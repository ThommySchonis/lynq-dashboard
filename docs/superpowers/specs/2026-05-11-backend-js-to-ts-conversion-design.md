# Backend JS to TS Conversion

## Goal

Convert all JavaScript API route files in `app/api/` to TypeScript and harden core type definitions in `lib/`.

## Out of Scope

- Frontend changes
- Service layer (`lib/services/`) — already TypeScript
- Supabase edge functions — already TypeScript
- Logic changes or bug fixes
- Git commits (user handles git)

## Verification

Run `npx tsc --noEmit` after each phase and confirm zero errors.

## Phase 1: Foundation — Shared Types & Core Hardening

### New file: `types/api.ts`

```ts
import type { NextRequest } from 'next/server'

// Generic for dynamic route params in Next.js 16 app router
export type RouteContext<T extends Record<string, string> = Record<string, string>> = {
  params: Promise<T>
}

// Common API error response shape
export interface ApiErrorResponse {
  error: string
}
```

### Harden: `lib/auth.ts`

- Replace `request: any` with `NextRequest`
- Define and export `AuthContext` interface based on actual runtime shape:
  ```ts
  import type { User } from '@supabase/supabase-js'
  import type { Role } from '@/types/database'

  export interface AuthWorkspace {
    id: string
    name: string
    owner_id: string
  }

  export interface AuthContext {
    user: User
    workspace: AuthWorkspace
    workspaceId: string
    role: Role | string   // Role for known paths, string for DB values
    memberId: string | null  // null possible in provisioning path C
  }
  ```
- Return type of `getAuthContext()` becomes `Promise<AuthContext | null>`

Note: `AuthWorkspace` is intentionally narrower than the full `Workspace` type — `getAuthContext()` only selects `id, name, owner_id` from the workspaces table.

### Harden: `lib/db.ts`

Replace `query: any` with a typed Supabase query:
```ts
import type { PostgrestFilterBuilder } from '@supabase/postgrest-js'

export const scoped = <Result>(
  query: PostgrestFilterBuilder<any, any, Result>,
  workspaceId: string
) => query.eq('workspace_id', workspaceId)
```

### Harden: `lib/shopifyCredentials.ts`

- Add explicit return type `Promise<{ domain: string; accessToken: string } | null>` to `getShopifyCredentialsByWorkspace()`
- Also annotate the legacy `getShopifyCredentials()` function if present

### Harden: `lib/permissions.ts`

- Remove the local `type Role = string` definition
- Import `Role` from `@/types/database` instead

### Update: `types/index.ts`

Add barrel exports for all feature type files not currently exported:
- `admin.ts`
- `settings.ts`
- `analytics.ts`
- `time-tracking.ts`
- `academy.ts`
- `supply-chain.ts`
- `api.ts`

## Phase 2: Route Conversion

All `.js` route files in `app/api/` are renamed to `.ts` and receive type annotations. One `.ts` file already exists (`app/api/sentry-example-api/route.ts`) — skip it.

### Standard conversion pattern

**Imports:**
- Add `NextRequest` from `next/server` (if not already imported)
- Add type imports for `AuthContext`, `RouteContext` where applicable
- Add feature-specific type imports from `types/`

**Handler signatures:**
```ts
// Static routes
export async function GET(request: NextRequest) { ... }
export async function POST(request: NextRequest) { ... }

// Dynamic routes with params
export async function GET(
  request: NextRequest,
  { params }: RouteContext<{ id: string }>
) { ... }
```

**Request body typing:**
- `await request.json()` typed with references to existing interfaces from `types/` when available
- For request bodies without existing types: use inline type annotations for small shapes (3 or fewer fields); create a named type in `types/` for larger shapes

**Response:**
- `NextResponse.json()` calls remain as-is — TypeScript infers the response type
- No explicit return type annotations on handlers

**No logic changes** — this is purely a type layer addition.

### Module conversion order

1. Auth routes — all `.js` files in `app/api/auth/`
2. Shopify routes — all `.js` files in `app/api/shopify/`
3. Inbox routes — all `.js` files in `app/api/inbox/`
4. Workspaces routes — all `.js` files in `app/api/workspaces/`
5. Macros routes — all `.js` files in `app/api/macros/`
6. Admin routes — all `.js` files in `app/api/admin/`
7. AI routes — all `.js` files in `app/api/ai/`
8. Analytics routes — all `.js` files in `app/api/analytics/`
9. Settings routes — all `.js` files in `app/api/settings/`
10. Remaining modules — all `.js` files in remaining `app/api/` subdirectories (tags, profile, invites, webhooks, parcel-panel, academy, exams, feedback, marketplace, subscription, time, translate, onboarding, whop, email)

### Rules

- No logic changes during conversion
- Use existing types from `types/` wherever possible
- Dynamic route params use `RouteContext<T>` from `types/api.ts`
- All files must compile under `strict: true`
