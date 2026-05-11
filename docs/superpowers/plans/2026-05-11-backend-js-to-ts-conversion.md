# Backend JS to TS Conversion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert all 116 JavaScript API route files in `app/api/` to TypeScript and harden core type definitions.

**Architecture:** Foundation-first approach — harden shared types (`AuthContext`, `RouteContext`, `scoped()`) then batch-convert routes module by module. No logic changes, purely type annotations.

**Tech Stack:** TypeScript 5, Next.js 16 (App Router), Supabase, `@supabase/postgrest-js`

**No commits** — the user handles git themselves.

---

## Task 1: Create `types/api.ts` — Shared API Types

**Files:**
- Create: `types/api.ts`

- [ ] **Step 1: Create the shared API types file**

```ts
// types/api.ts

/** Generic for dynamic route params in Next.js 16 app router */
export type RouteContext<T extends Record<string, string> = Record<string, string>> = {
  params: Promise<T>
}

/** Common API error response shape */
export interface ApiErrorResponse {
  error: string
  code?: string
}
```

- [ ] **Step 2: Update `types/index.ts` barrel export**

Replace contents of `types/index.ts` with:

```ts
export * from './database'
export * from './inbox'
export * from './admin'
export * from './settings'
export * from './analytics'
export * from './time-tracking'
export * from './academy'
export * from './supply-chain'
export * from './api'
```

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit`
Expected: zero errors (or same errors as before — no new ones introduced)

---

## Task 2: Harden `lib/auth.ts`

**Files:**
- Modify: `lib/auth.ts`

- [ ] **Step 1: Add AuthContext types and type the function**

Add at the top of `lib/auth.ts` (after existing imports):

```ts
import type { NextRequest } from 'next/server'
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
  role: Role | string
  memberId: string | null
}
```

Change the function signature from:
```ts
export async function getAuthContext(request: any) {
```
to:
```ts
export async function getAuthContext(request: NextRequest): Promise<AuthContext | null> {
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit`
Expected: zero new errors

---

## Task 3: Harden `lib/db.ts`

**Files:**
- Modify: `lib/db.ts`

- [ ] **Step 1: Replace `any` with typed generic**

Replace the entire file with:

```ts
/**
 * Workspace-scoping helper for Supabase queries.
 *
 * Every query on workspace-owned tables MUST include a workspace_id filter
 * to prevent cross-workspace data leakage. Use scoped() to apply it.
 *
 * Usage:
 *   const { data } = await scoped(
 *     supabaseAdmin.from('tickets').select('*').order('created_at', { ascending: false }),
 *     ctx.workspaceId
 *   )
 *
 * Workspace-owned tables:
 *   tickets, agents, macros, workspace_members, workspace_invites,
 *   ai_settings, integrations, and any future resource table.
 */
export const scoped = <Q extends { eq: (column: string, value: string) => Q }>(
  query: Q,
  workspaceId: string
): Q => query.eq('workspace_id', workspaceId) as Q
```

Note: The generic `Q` preserves the query builder type through the chain, so callers retain full type safety on the returned query. The `as Q` cast is needed because Supabase's `.eq()` return type is technically a new builder instance, but structurally identical.

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit`
Expected: zero new errors

---

## Task 4: Harden `lib/permissions.ts`

**Files:**
- Modify: `lib/permissions.ts`

- [ ] **Step 1: Replace local Role type with import**

Remove line 7:
```ts
type Role = string
```

Replace with:
```ts
import type { Role } from '@/types/database'
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit`
Expected: zero new errors. If `can.*` functions break because they receive strings from DB, widen the parameter type to `string` and keep the internal `includes` check.

---

## Task 5: Harden `lib/shopifyCredentials.ts`

**Files:**
- Modify: `lib/shopifyCredentials.ts`

- [ ] **Step 1: Add explicit return type annotations**

Add return type to `getShopifyCredentialsByWorkspace`:
```ts
export async function getShopifyCredentialsByWorkspace(
  workspaceId: string
): Promise<{ domain: string; accessToken: string } | null> {
```

Add return type to `getShopifyCredentials` (if present):
```ts
export async function getShopifyCredentials(
  userId: string,
  userEmail: string
): Promise<{ domain: string; accessToken: string } | null> {
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit`
Expected: zero new errors

---

## Task 6: Convert Auth routes (11 files)

**Files:**
- Rename + modify: all `.js` files in `app/api/auth/`
  - `app/api/auth/shopify/route.js` → `.ts`
  - `app/api/auth/shopify/callback/route.js` → `.ts`
  - `app/api/auth/shopify/disconnect/route.js` → `.ts`
  - `app/api/auth/gmail/route.js` → `.ts`
  - `app/api/auth/gmail/callback/route.js` → `.ts`
  - `app/api/auth/gmail/disconnect/route.js` → `.ts`
  - `app/api/auth/outlook/route.js` → `.ts`
  - `app/api/auth/outlook/callback/route.js` → `.ts`
  - `app/api/auth/custom-email/connect/route.js` → `.ts`
  - `app/api/auth/mfa/cleanup/route.js` → `.ts`
  - `app/api/auth/recovery-codes/route.js` → `.ts`

- [ ] **Step 1: Rename all files**

```bash
find app/api/auth -name "route.js" -exec bash -c 'mv "$1" "${1%.js}.ts"' _ {} \;
```

- [ ] **Step 2: Add type annotations to each file**

For each file, apply these changes:
1. Add `import type { NextRequest } from 'next/server'` if not present
2. Change `export async function POST(request)` → `export async function POST(request: NextRequest)`
3. Change `export async function GET(request)` → `export async function GET(request: NextRequest)`
4. For `request.json()` calls — add `as { fieldName: type }` or inline type assertion
5. For catch blocks — type error as `catch (err: unknown)` and use `(err as Error).message` or guard

**Pattern for auth routes (most don't use `getAuthContext` — they do manual token check):**
```ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const { shop } = await request.json() as { shop: string }
  // ... rest unchanged
}
```

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit`
Fix any type errors that arise (typically `err` in catch blocks, or implicit `any` from `.json()`)

---

## Task 7: Convert Shopify routes (23 files)

**Files:**
- Rename + modify: all `.js` files in `app/api/shopify/`
  - `app/api/shopify/analytics/route.js` → `.ts`
  - `app/api/shopify/cancel-order/route.js` → `.ts`
  - `app/api/shopify/customer/route.js` → `.ts`
  - `app/api/shopify/debug-channels/route.js` → `.ts`
  - `app/api/shopify/duplicate-order/route.js` → `.ts`
  - `app/api/shopify/edit-address/route.js` → `.ts`
  - `app/api/shopify/kpis/route.js` → `.ts`
  - `app/api/shopify/link/route.js` → `.ts`
  - `app/api/shopify/manual-connect/route.js` → `.ts`
  - `app/api/shopify/orders/route.js` → `.ts`
  - `app/api/shopify/orders/[id]/route.js` → `.ts`
  - `app/api/shopify/orders/[id]/address/route.js` → `.ts`
  - `app/api/shopify/orders/[id]/cancel/route.js` → `.ts`
  - `app/api/shopify/orders/[id]/duplicate/route.js` → `.ts`
  - `app/api/shopify/orders/[id]/edit/route.js` → `.ts`
  - `app/api/shopify/orders/[id]/fulfill/route.js` → `.ts`
  - `app/api/shopify/orders/[id]/note/route.js` → `.ts`
  - `app/api/shopify/orders/[id]/refund/route.js` → `.ts`
  - `app/api/shopify/refund-order/route.js` → `.ts`
  - `app/api/shopify/refunds/route.js` → `.ts`
  - `app/api/shopify/revenue-trend/route.js` → `.ts`
  - `app/api/shopify/status/route.js` → `.ts`
  - `app/api/shopify/sync/route.js` → `.ts`

- [ ] **Step 1: Rename all files**

```bash
find app/api/shopify -name "route.js" -exec bash -c 'mv "$1" "${1%.js}.ts"' _ {} \;
```

- [ ] **Step 2: Add type annotations to each file**

Standard pattern for Shopify routes (most follow the CLAUDE.md API route pattern):
```ts
import type { NextRequest } from 'next/server'
import type { RouteContext } from '@/types/api'

// Static route:
export async function GET(request: NextRequest) { ... }

// Dynamic route (e.g., orders/[id]/route.ts):
export async function GET(
  request: NextRequest,
  { params }: RouteContext<{ id: string }>
) {
  const { id } = await params
  // ...
}

// POST with body:
export async function POST(request: NextRequest) {
  const body = await request.json() as { field1: string; field2?: number }
  // ...
}

// Catch blocks:
catch (err: unknown) {
  const message = err instanceof Error ? err.message : 'Unknown error'
  return NextResponse.json({ error: message }, { status: 500 })
}
```

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit`
Fix any type errors.

---

## Task 8: Convert Inbox routes (11 files)

**Files:**
- Rename + modify: all `.js` files in `app/api/inbox/`
  - `app/api/inbox/accounts/route.js` → `.ts`
  - `app/api/inbox/accounts/[id]/route.js` → `.ts`
  - `app/api/inbox/compose/route.js` → `.ts`
  - `app/api/inbox/conversations/route.js` → `.ts`
  - `app/api/inbox/conversations/[id]/route.js` → `.ts`
  - `app/api/inbox/conversations/[id]/link-customer/route.js` → `.ts`
  - `app/api/inbox/conversations/[id]/notes/route.js` → `.ts`
  - `app/api/inbox/conversations/[id]/reply/route.js` → `.ts`
  - `app/api/inbox/counts/route.js` → `.ts`
  - `app/api/inbox/shopify-customer/route.js` → `.ts`
  - `app/api/inbox/sync/route.js` → `.ts`

- [ ] **Step 1: Rename all files**

```bash
find app/api/inbox -name "route.js" -exec bash -c 'mv "$1" "${1%.js}.ts"' _ {} \;
```

- [ ] **Step 2: Add type annotations**

Use types from `types/inbox.ts` where applicable (Thread, Message, Note, etc.). Dynamic routes use `RouteContext<{ id: string }>`.

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit`

---

## Task 9: Convert Workspaces routes (7 files)

**Files:**
- Rename + modify: all `.js` files in `app/api/workspaces/`
  - `app/api/workspaces/current/route.js` → `.ts`
  - `app/api/workspaces/current/logo/route.js` → `.ts`
  - `app/api/workspaces/current/members/route.js` → `.ts`
  - `app/api/workspaces/current/members/[id]/route.js` → `.ts`
  - `app/api/workspaces/current/invites/[id]/route.js` → `.ts`
  - `app/api/workspaces/current/invites/[id]/resend/route.js` → `.ts`
  - `app/api/workspaces/repair-membership/route.js` → `.ts`

- [ ] **Step 1: Rename all files**

```bash
find app/api/workspaces -name "route.js" -exec bash -c 'mv "$1" "${1%.js}.ts"' _ {} \;
```

- [ ] **Step 2: Add type annotations**

Dynamic routes with `[id]` use `RouteContext<{ id: string }>`. Use `Role` type from `types/database.ts` for role-related payloads.

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit`

---

## Task 10: Convert Macros routes (7 files)

**Files:**
- Rename + modify: all `.js` files in `app/api/macros/`
  - `app/api/macros/route.js` → `.ts`
  - `app/api/macros/generate/route.js` → `.ts`
  - `app/api/macros/onboarding/route.js` → `.ts`
  - `app/api/macros/[id]/route.js` → `.ts`
  - `app/api/macros/[id]/archive/route.js` → `.ts`
  - `app/api/macros/[id]/duplicate/route.js` → `.ts`
  - `app/api/macros/[id]/restore/route.js` → `.ts`

- [ ] **Step 1: Rename all files**

```bash
find app/api/macros -name "route.js" -exec bash -c 'mv "$1" "${1%.js}.ts"' _ {} \;
```

- [ ] **Step 2: Add type annotations**

Use `Macro` type from `types/inbox.ts`. Dynamic routes use `RouteContext<{ id: string }>`.

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit`

---

## Task 11: Convert Admin routes (7 files)

**Files:**
- Rename + modify: all `.js` files in `app/api/admin/`
  - `app/api/admin/candidates/route.js` → `.ts`
  - `app/api/admin/candidates/[id]/validate/route.js` → `.ts`
  - `app/api/admin/create-user/route.js` → `.ts`
  - `app/api/admin/delete-user/route.js` → `.ts`
  - `app/api/admin/finance/route.js` → `.ts`
  - `app/api/admin/migrate-users/route.js` → `.ts`
  - `app/api/admin/seed-demo/route.js` → `.ts`

- [ ] **Step 1: Rename all files**

```bash
find app/api/admin -name "route.js" -exec bash -c 'mv "$1" "${1%.js}.ts"' _ {} \;
```

- [ ] **Step 2: Add type annotations**

Use types from `types/admin.ts`. Admin routes often use `getUserFromToken` directly (not `getAuthContext`) — type accordingly.

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit`

---

## Task 12: Convert AI routes (5 files)

**Files:**
- Rename + modify: all `.js` files in `app/api/ai/`
  - `app/api/ai/analyze/route.js` → `.ts`
  - `app/api/ai/chat/route.js` → `.ts`
  - `app/api/ai/macros/route.js` → `.ts`
  - `app/api/ai/reply/route.js` → `.ts`
  - `app/api/ai/translate/route.js` → `.ts`

- [ ] **Step 1: Rename all files**

```bash
find app/api/ai -name "route.js" -exec bash -c 'mv "$1" "${1%.js}.ts"' _ {} \;
```

- [ ] **Step 2: Add type annotations**

AI routes typically receive text/thread content in POST body. Type request bodies inline.

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit`

---

## Task 13: Convert remaining routes (38 files)

**Files:**
- Rename + modify: all remaining `.js` files:
  - `app/api/analytics/actions/route.js` → `.ts`
  - `app/api/analytics/email-stats/route.js` → `.ts`
  - `app/api/analytics/refund-insights/route.js` → `.ts`
  - `app/api/settings/brand/route.js` → `.ts`
  - `app/api/settings/integrations/route.js` → `.ts`
  - `app/api/settings/integrations/email/route.js` → `.ts`
  - `app/api/settings/integrations/shopify/route.js` → `.ts`
  - `app/api/tags/route.js` → `.ts`
  - `app/api/tags/[id]/route.js` → `.ts`
  - `app/api/tags/merge/route.js` → `.ts`
  - `app/api/profile/route.js` → `.ts`
  - `app/api/profile/avatar/route.js` → `.ts`
  - `app/api/invites/[token]/route.js` → `.ts`
  - `app/api/invites/[token]/accept/route.js` → `.ts`
  - `app/api/invites/[token]/signup/route.js` → `.ts`
  - `app/api/webhooks/email/inbound/route.js` → `.ts`
  - `app/api/webhooks/shopify/route.js` → `.ts`
  - `app/api/parcel-panel/connect/route.js` → `.ts`
  - `app/api/parcel-panel/setup/route.js` → `.ts`
  - `app/api/parcel-panel/tracking/route.js` → `.ts`
  - `app/api/parcel-panel/webhook/route.js` → `.ts`
  - `app/api/parcelpanel/shipments/route.js` → `.ts`
  - `app/api/academy/access/route.js` → `.ts`
  - `app/api/academy/purchase/route.js` → `.ts`
  - `app/api/exams/questions/route.js` → `.ts`
  - `app/api/exams/result/route.js` → `.ts`
  - `app/api/exams/submit/route.js` → `.ts`
  - `app/api/feedback/route.js` → `.ts`
  - `app/api/lynq-admin/feedback/route.js` → `.ts`
  - `app/api/lynq-admin/feedback/count/route.js` → `.ts`
  - `app/api/marketplace/candidates/route.js` → `.ts`
  - `app/api/marketplace/candidates/[id]/route.js` → `.ts`
  - `app/api/marketplace/profile/route.js` → `.ts`
  - `app/api/marketplace/purchase/route.js` → `.ts`
  - `app/api/subscription/activate/route.js` → `.ts`
  - `app/api/subscription/status/route.js` → `.ts`
  - `app/api/time/route.js` → `.ts`
  - `app/api/translate/route.js` → `.ts`
  - `app/api/onboarding/status/route.js` → `.ts`
  - `app/api/whop/webhook/route.js` → `.ts`
  - `app/api/agent-actions/route.js` → `.ts`
  - `app/api/agent-performance/route.js` → `.ts`
  - `app/api/agents/route.js` → `.ts`
  - `app/api/email/dns/route.js` → `.ts`
  - `app/api/email/usage/route.js` → `.ts`

- [ ] **Step 1: Rename all files**

```bash
find app/api/analytics app/api/settings app/api/tags app/api/profile app/api/invites app/api/webhooks app/api/parcel-panel app/api/parcelpanel app/api/academy app/api/exams app/api/feedback app/api/lynq-admin app/api/marketplace app/api/subscription app/api/time app/api/translate app/api/onboarding app/api/whop app/api/agent-actions app/api/agent-performance app/api/agents app/api/email -name "route.js" -exec bash -c 'mv "$1" "${1%.js}.ts"' _ {} \;
```

- [ ] **Step 2: Add type annotations to each file**

Same patterns as previous tasks:
- `NextRequest` for request params
- `RouteContext<{ id: string }>` or `RouteContext<{ token: string }>` for dynamic routes
- Inline types for request bodies
- `catch (err: unknown)` for error handling

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit`
Expected: zero errors across the entire project.

---

## Task 14: Final verification

- [ ] **Step 1: Confirm no `.js` route files remain**

```bash
find app/api -name "*.js" | head -20
```

Expected: empty output (no `.js` files left)

- [ ] **Step 2: Full type check**

```bash
npx tsc --noEmit
```

Expected: zero errors

- [ ] **Step 3: Dev server smoke test**

```bash
npm run dev
```

Verify the dev server starts without errors. Check one route in the browser (e.g., hit `/api/shopify/status` with a valid token) to confirm runtime behavior is unchanged.
