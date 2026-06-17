# Role-Based Permissions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make role enforcement complete and consistent across the dashboard so that `observer` is strictly view-only, `agent` can do operational work but not admin actions, and `admin`/`owner` retain full access (billing owner-only).

**Architecture:** Capabilities (`can.*`) are the single source of truth. The backend is the security boundary: a reusable `requireCapability(cap)` Hono middleware factory gates every write route, and the two streaming Next.js routes call `can.*` directly. The frontend mirrors capabilities through a `usePermissions()` hook and a `<Gate>` component (hide admin nav; disable+tooltip inline actions).

**Tech Stack:** Next.js 16 (app router) + React 19, Hono Edge Functions (Deno), Supabase, TanStack Query, Zustand, base-ui primitives. Tests: Deno unit tests (`@std/assert`) for pure logic. ESLint (`npm run lint`) + manual per-role smoke for routes/components (no route-integration or frontend test harness exists).

**Spec:** `docs/superpowers/specs/2026-06-16-role-permissions-design.md`

**Capability tiers:**
- View — all roles (no gating needed; already open).
- Operational write — `owner/admin/agent`: replies, conversation status/notes, order actions, macros/tags/tasks. Capabilities: `replyToTickets`, `manageConversations` (new), `manageOrders` (new), `manageMacros`, `manageTags`, `manageTasks`.
- Admin write — `owner/admin`: workspace settings, email connections, store connections, members, migrations. Capability: `manageWorkspace` (+ member caps, `manageMigrations`).
- Billing — `owner` only: `manageBilling`.

**Note on testing reality:** The existing Deno tests are unit tests of pure functions; there is no harness that boots the Hono app with mocked auth, and no frontend test runner is configured. Therefore TDD applies to the two pure pieces (the capability matrix and the `requireCapability` decision). Route-wiring and component tasks are verified with `npm run lint` and manual per-role smoke (Task 17). This is deliberate — do not scaffold a new test framework.

---

## File Structure

**Created:**
- `hooks/use-permissions.ts` — `usePermissions()` hook (frontend capability map bound to current role).
- `components/shared/gate.tsx` — `<Gate>` component (hide / disable+tooltip).
- `supabase/functions/api/tests/permissions.test.ts` — Deno unit test for the Hono capability matrix.
- `supabase/functions/api/tests/require-capability.test.ts` — Deno unit test for the middleware factory.

**Modified — foundation:**
- `lib/permissions.ts` — add `manageOrders`, `manageConversations`.
- `supabase/functions/api/lib/permissions.ts` — full parity + `export type Role`.
- `supabase/functions/api/middleware/workspace.ts` — add `requireCapability(cap)`.

**Modified — backend gating:**
- `supabase/functions/api/routes/settings.ts`
- `supabase/functions/api/routes/inbox-conversations.ts`
- `supabase/functions/api/routes/inbox.ts`
- `supabase/functions/api/routes/shopify.ts`
- `supabase/functions/api/routes/stores.ts`
- `supabase/functions/api/routes/parcel-panel.ts`
- `app/api/inbox/conversations/[id]/reply/route.ts`
- `app/api/inbox/compose/route.ts`

**Modified — frontend gating:**
- `components/features/inbox/notes-section.tsx`
- `components/features/inbox/ticket-action-bar.tsx`
- `components/features/inbox/conversation-panel.tsx`
- `components/features/inbox/orders-section.tsx`
- `components/features/settings/stores/store-card.tsx`
- `lib/settings-constants.ts`
- `components/features/settings/settings-sidebar.tsx`

---

## Task 1: Add operational-write capabilities to the frontend permission map

**Files:**
- Modify: `lib/permissions.ts`

- [ ] **Step 1: Add the two new capabilities**

In `lib/permissions.ts`, inside the `can` object, add `manageOrders` next to the ticket operations and `manageConversations` after `replyToTickets`:

```ts
  // Ticket operations
  replyToTickets:  (role: Role) => ['owner', 'admin', 'agent'].includes(role),
  // Conversation edits — status, assignment, internal notes
  manageConversations: (role: Role) => ['owner', 'admin', 'agent'].includes(role),
  viewTickets:     (_role: Role) => true,  // all four roles can view

  // Shopify order write actions — refund, cancel, edit, duplicate, fulfill, note, address
  manageOrders:    (role: Role) => ['owner', 'admin', 'agent'].includes(role),
```

- [ ] **Step 2: Verify lint passes**

Run: `npm run lint`
Expected: PASS (no new errors).

- [ ] **Step 3: Commit**

```bash
git add lib/permissions.ts
git commit -m "feat(permissions): add manageOrders and manageConversations capabilities"
```

---

## Task 2: Bring the Hono capability map to full parity + add a unit test

The Hono `can` map is missing several capabilities the frontend has (`viewTickets`, `viewMacros`, `deleteMacros`, tags/tasks view+delete, and the two new ones). Sync it and lock the matrix with a test.

**Files:**
- Modify: `supabase/functions/api/lib/permissions.ts`
- Test: `supabase/functions/api/tests/permissions.test.ts`

- [ ] **Step 1: Write the failing test**

Create `supabase/functions/api/tests/permissions.test.ts`:

```ts
import { assertEquals } from '@std/assert'
import { can } from '../lib/permissions.ts'

const ROLES = ['owner', 'admin', 'agent', 'observer'] as const

Deno.test('observer is view-only: every write capability denies observer', () => {
  const writeCaps = [
    'inviteMembers', 'removeMembers', 'changeRole', 'manageWorkspace',
    'manageBilling', 'deleteWorkspace', 'replyToTickets', 'manageConversations',
    'manageOrders', 'manageMacros', 'deleteMacros', 'manageTags', 'deleteTags',
    'manageTasks', 'deleteTasks', 'manageMigrations',
  ] as const
  for (const cap of writeCaps) {
    assertEquals(can[cap]('observer'), false, `observer must be denied ${cap}`)
  }
})

Deno.test('operational writes allow agent, deny observer', () => {
  for (const cap of ['replyToTickets', 'manageConversations', 'manageOrders'] as const) {
    assertEquals(can[cap]('agent'), true, `agent allowed ${cap}`)
    assertEquals(can[cap]('admin'), true)
    assertEquals(can[cap]('owner'), true)
    assertEquals(can[cap]('observer'), false)
  }
})

Deno.test('admin writes deny agent and observer', () => {
  for (const cap of ['manageWorkspace', 'inviteMembers', 'manageMigrations'] as const) {
    assertEquals(can[cap]('admin'), true, `admin allowed ${cap}`)
    assertEquals(can[cap]('owner'), true)
    assertEquals(can[cap]('agent'), false, `agent denied ${cap}`)
    assertEquals(can[cap]('observer'), false)
  }
})

Deno.test('billing + delete workspace are owner only', () => {
  for (const cap of ['manageBilling', 'deleteWorkspace'] as const) {
    assertEquals(can[cap]('owner'), true)
    assertEquals(can[cap]('admin'), false, `admin denied ${cap}`)
    assertEquals(can[cap]('agent'), false)
    assertEquals(can[cap]('observer'), false)
  }
})

Deno.test('view capabilities allow all roles', () => {
  for (const role of ROLES) {
    assertEquals(can.viewTickets(role), true)
    assertEquals(can.viewMacros(role), true)
  }
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd supabase/functions/api && deno test --allow-read tests/permissions.test.ts`
Expected: FAIL — `can.manageConversations`, `can.manageOrders`, `can.viewTickets`, etc. are `undefined` in the Hono map (TypeError: can[cap] is not a function).

- [ ] **Step 3: Replace the Hono permission map with full parity**

Overwrite `supabase/functions/api/lib/permissions.ts`:

```ts
export type Role = 'owner' | 'admin' | 'agent' | 'observer'

export const can = {
  // Member management
  inviteMembers:   (role: Role) => ['owner', 'admin'].includes(role),
  removeMembers:   (role: Role) => ['owner', 'admin'].includes(role),
  changeRole:      (role: Role) => ['owner', 'admin'].includes(role),

  // Workspace settings, integrations, connections
  manageWorkspace: (role: Role) => ['owner', 'admin'].includes(role),

  // Billing — owner only
  manageBilling:   (role: Role) => role === 'owner',
  deleteWorkspace: (role: Role) => role === 'owner',

  // Ticket operations
  replyToTickets:      (role: Role) => ['owner', 'admin', 'agent'].includes(role),
  manageConversations: (role: Role) => ['owner', 'admin', 'agent'].includes(role),
  viewTickets:         (_role: Role) => true,

  // Shopify order write actions
  manageOrders:    (role: Role) => ['owner', 'admin', 'agent'].includes(role),

  // Macros
  viewMacros:      (_role: Role) => true,
  manageMacros:    (role: Role) => ['owner', 'admin', 'agent'].includes(role),
  deleteMacros:    (role: Role) => ['owner', 'admin'].includes(role),

  // Tags
  viewTags:        (_role: Role) => true,
  manageTags:      (role: Role) => ['owner', 'admin', 'agent'].includes(role),
  deleteTags:      (role: Role) => ['owner', 'admin'].includes(role),

  // Tasks
  viewTasks:       (_role: Role) => true,
  manageTasks:     (role: Role) => ['owner', 'admin', 'agent'].includes(role),
  deleteTasks:     (role: Role) => ['owner', 'admin'].includes(role),

  // Workspace migrations
  manageMigrations: (role: Role) => ['owner', 'admin'].includes(role),
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd supabase/functions/api && deno test --allow-read tests/permissions.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/api/lib/permissions.ts supabase/functions/api/tests/permissions.test.ts
git commit -m "feat(permissions): sync Hono capability map to parity with frontend"
```

---

## Task 3: Add the `requireCapability` middleware factory + unit test

**Files:**
- Modify: `supabase/functions/api/middleware/workspace.ts`
- Test: `supabase/functions/api/tests/require-capability.test.ts`

- [ ] **Step 1: Write the failing test**

Create `supabase/functions/api/tests/require-capability.test.ts`:

```ts
import { assertEquals } from '@std/assert'
import { requireCapability } from '../middleware/workspace.ts'

// Minimal fake Hono Context: only `get` (authContext) and `json` are used.
function fakeContext(role: string) {
  return {
    get: (_key: string) => ({ role }),
    json: (data: unknown, status?: number) => ({ data, status }),
  // deno-lint-ignore no-explicit-any
  } as any
}

Deno.test('requireCapability allows a permitted role (returns null)', () => {
  const guard = requireCapability('manageOrders')
  assertEquals(guard(fakeContext('agent')), null)
  assertEquals(guard(fakeContext('admin')), null)
})

Deno.test('requireCapability blocks a denied role with 403', () => {
  const guard = requireCapability('manageOrders')
  const res = guard(fakeContext('observer')) as { status: number; data: { error: string } } | null
  assertEquals(res?.status, 403)
  assertEquals(res?.data.error, 'forbidden')
})

Deno.test('requireCapability blocks agent on admin-only capability', () => {
  const guard = requireCapability('manageWorkspace')
  const res = guard(fakeContext('agent')) as { status: number } | null
  assertEquals(res?.status, 403)
  assertEquals(guard(fakeContext('admin')), null)
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd supabase/functions/api && deno test --allow-read tests/require-capability.test.ts`
Expected: FAIL — `requireCapability` is not exported from `workspace.ts`.

- [ ] **Step 3: Implement the factory**

In `supabase/functions/api/middleware/workspace.ts`, add the import at the top (below the existing imports) and the factory at the end:

```ts
import { can, type Role } from '../lib/permissions.ts'
```

```ts
/**
 * Returns a guard that blocks the request with 403 unless the current role
 * satisfies the given capability. Use alongside requireWriteAccess:
 *   const blocked = requireWriteAccess(c) ?? requireCapability('manageOrders')(c)
 *   if (blocked) return blocked
 */
export function requireCapability(cap: keyof typeof can) {
  return (c: Context): Response | null => {
    const ctx = c.get('authContext') as AuthContext
    if (!can[cap](ctx.role as Role)) {
      return c.json(
        { error: 'forbidden', message: 'You do not have permission to perform this action.' },
        403,
      )
    }
    return null
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd supabase/functions/api && deno test --allow-read tests/require-capability.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/api/middleware/workspace.ts supabase/functions/api/tests/require-capability.test.ts
git commit -m "feat(permissions): add requireCapability middleware factory"
```

---

## Task 4: Add the `usePermissions` frontend hook

**Files:**
- Create: `hooks/use-permissions.ts`

- [ ] **Step 1: Create the hook**

Create `hooks/use-permissions.ts`:

```ts
import { useMemo } from 'react'
import { useAuthStore } from '@/stores/auth'
import { can } from '@/lib/permissions'

/**
 * Binds the capability map to the current role.
 * `permissions.can.manageOrders` is a boolean for the logged-in user.
 */
export function usePermissions() {
  const role = useAuthStore((s) => s.role)
  return useMemo(() => {
    const caps = Object.fromEntries(
      Object.entries(can).map(([key, fn]) => [key, role ? fn(role) : false]),
    ) as Record<keyof typeof can, boolean>
    return { role, can: caps }
  }, [role])
}
```

- [ ] **Step 2: Verify lint passes**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add hooks/use-permissions.ts
git commit -m "feat(permissions): add usePermissions hook"
```

---

## Task 5: Add the `<Gate>` component

**Files:**
- Create: `components/shared/gate.tsx`

- [ ] **Step 1: Create the component**

Create `components/shared/gate.tsx`:

```tsx
'use client'

import { cloneElement, isValidElement, type ReactElement } from 'react'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { usePermissions } from '@/hooks/use-permissions'
import type { can } from '@/lib/permissions'

type Capability = keyof typeof can

interface GateProps {
  capability: Capability
  /** 'hide' removes the child entirely; 'disable' renders it disabled with a tooltip. */
  mode?: 'hide' | 'disable'
  reason?: string
  children: ReactElement
}

/**
 * Renders children only when the current role has `capability`.
 * - mode="hide": returns null when denied (use for nav items / whole sections).
 * - mode="disable": clones the child with `disabled` and wraps it in a tooltip
 *   explaining why (use for inline action buttons).
 */
export function Gate({
  capability,
  mode = 'hide',
  reason = 'View-only access — ask an admin to make changes.',
  children,
}: GateProps) {
  const { can: allowed } = usePermissions()

  if (allowed[capability]) return children
  if (mode === 'hide') return null

  const disabledChild = isValidElement(children)
    ? cloneElement(children as ReactElement<{ disabled?: boolean }>, { disabled: true })
    : children

  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex cursor-not-allowed" />}>
        {disabledChild}
      </TooltipTrigger>
      <TooltipContent>{reason}</TooltipContent>
    </Tooltip>
  )
}
```

- [ ] **Step 2: Verify lint passes**

Run: `npm run lint`
Expected: PASS. (If lint flags the base-ui `render` prop on `TooltipTrigger`, confirm against `components/ui/tooltip.tsx` — `TooltipTrigger` forwards `TooltipPrimitive.Trigger.Props`, which includes `render`.)

- [ ] **Step 3: Commit**

```bash
git add components/shared/gate.tsx
git commit -m "feat(permissions): add Gate component for role-based UI gating"
```

---

## Task 6: Gate workspace settings routes (admin write)

**Files:**
- Modify: `supabase/functions/api/routes/settings.ts:26-29, 69-72, 100-103`

- [ ] **Step 1: Import the factory**

In `supabase/functions/api/routes/settings.ts`, update the workspace-middleware import (line 3):

```ts
import { requireWriteAccess, requireCapability } from '../middleware/workspace.ts'
```

- [ ] **Step 2: Add capability checks to all three POST handlers**

In each of `POST /brand`, `POST /integrations/email`, and `POST /integrations`, replace the existing two-line suspension guard:

```ts
  const blocked = requireWriteAccess(c)
  if (blocked) return blocked
```

with:

```ts
  const blocked = requireWriteAccess(c) ?? requireCapability('manageWorkspace')(c)
  if (blocked) return blocked
```

- [ ] **Step 3: Verify lint passes**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/api/routes/settings.ts
git commit -m "feat(permissions): gate workspace settings routes with manageWorkspace"
```

---

## Task 7: Gate inbox-conversations writes (operational write)

**Files:**
- Modify: `supabase/functions/api/routes/inbox-conversations.ts` (`PATCH /:id`, `POST /:id/notes`)

- [ ] **Step 1: Import the factory**

Update line 3:

```ts
import { requireWriteAccess, requireCapability } from '../middleware/workspace.ts'
```

- [ ] **Step 2: Add the capability check to `PATCH /:id` and `POST /:id/notes`**

In both handlers, immediately after the `ctx` is read and before the write, add (or merge into the existing `requireWriteAccess` guard if present):

```ts
  const blocked = requireWriteAccess(c) ?? requireCapability('manageConversations')(c)
  if (blocked) return blocked
```

If a handler currently has only `requireWriteAccess(c)`, replace it with the `??` form above. If a handler has no suspension guard at all, add the full two lines.

- [ ] **Step 3: Verify lint passes**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/api/routes/inbox-conversations.ts
git commit -m "feat(permissions): gate conversation edits and notes with manageConversations"
```

---

## Task 8: Gate inbox integration/email/account routes (admin write)

**Files:**
- Modify: `supabase/functions/api/routes/inbox.ts` (`POST /integrations/email`, `POST /integrations`, `DELETE /accounts/:id`)

- [ ] **Step 1: Import the factory**

Add to the imports at the top of `supabase/functions/api/routes/inbox.ts`:

```ts
import { requireCapability } from '../middleware/workspace.ts'
```

(If `requireWriteAccess` is already imported from the same module, extend that import instead of adding a second line.)

- [ ] **Step 2: Add the capability check to each of the three handlers**

After the `ctx` is read in `POST /integrations/email`, `POST /integrations`, and `DELETE /accounts/:id`, add:

```ts
  const blocked = requireCapability('manageWorkspace')(c)
  if (blocked) return blocked
```

If a handler already has a `requireWriteAccess(c)` guard, combine: `requireWriteAccess(c) ?? requireCapability('manageWorkspace')(c)`.

- [ ] **Step 3: Verify lint passes**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/api/routes/inbox.ts
git commit -m "feat(permissions): gate inbox email/integration/account routes with manageWorkspace"
```

---

## Task 9: Gate Shopify order writes and store-connection writes

`shopify.ts` has a **local** `requireWriteAccess(ctx)` helper (suspension-only) used as `if (requireWriteAccess(ctx)) return c.json(...)`. Leave it; layer the capability check on top using the shared factory (which reads `authContext` from `c`).

**Files:**
- Modify: `supabase/functions/api/routes/shopify.ts`

- [ ] **Step 1: Import the factory**

Add to the imports at the top of `supabase/functions/api/routes/shopify.ts`:

```ts
import { requireCapability } from '../middleware/workspace.ts'
```

- [ ] **Step 2: Gate the order write endpoints with `manageOrders`**

In each of these handlers, immediately after the existing local suspension guard line `if (requireWriteAccess(ctx)) return c.json({ error: 'workspace_suspended' }, 403)`, add:

```ts
    const capBlocked = requireCapability('manageOrders')(c)
    if (capBlocked) return capBlocked
```

Apply to: `POST /orders/:id/refund`, `POST /orders/:id/cancel`, `POST /orders/:id/edit`, `POST /orders/:id/duplicate`, `PUT /orders/:id/note`, `PUT /orders/:id/address`, `POST /orders/:id/fulfill`, `POST /orders/create`, `POST /cancel-order`, `POST /refund-order`, `POST /duplicate-order`, `POST /edit-address`.

- [ ] **Step 3: Gate the store-connection endpoints with `manageWorkspace`**

In `POST /manual-connect`, `DELETE /manual-connect`, and `POST /link`, after the same local suspension guard line, add:

```ts
    const capBlocked = requireCapability('manageWorkspace')(c)
    if (capBlocked) return capBlocked
```

Leave `POST /sync` as-is (order refresh is operational; agent allowed).

- [ ] **Step 4: Verify lint passes**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/api/routes/shopify.ts
git commit -m "feat(permissions): gate shopify order writes (manageOrders) and connections (manageWorkspace)"
```

---

## Task 10: Tighten stores & parcel-panel from observer-only to admin-only

These currently block only `observer` (`if (ctx.role === 'observer')`), which lets agents disconnect stores / connect parcel-panel — violating the matrix (connections are admin-only).

**Files:**
- Modify: `supabase/functions/api/routes/stores.ts:17, 30`
- Modify: `supabase/functions/api/routes/parcel-panel.ts:46`

- [ ] **Step 1: Import the factory in both files**

In `stores.ts` add:

```ts
import { requireCapability } from '../middleware/workspace.ts'
```

In `parcel-panel.ts` add the same import.

- [ ] **Step 2: Replace the observer-only checks**

In `stores.ts` `DELETE /:id` (around line 17) and `POST /:id/disconnect` (around line 30), replace:

```ts
  if (ctx.role === 'observer') {
    return c.json({ error: 'forbidden' }, 403)
  }
```

with:

```ts
  const blocked = requireCapability('manageWorkspace')(c)
  if (blocked) return blocked
```

In `parcel-panel.ts` `POST /connect` (around line 46), make the same replacement.

- [ ] **Step 3: Verify lint passes**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/api/routes/stores.ts supabase/functions/api/routes/parcel-panel.ts
git commit -m "fix(permissions): restrict store/parcel-panel connections to admin (was observer-only)"
```

---

## Task 11: Gate the Next.js streaming reply & compose routes

These cannot use Hono middleware; call `can.replyToTickets` directly.

**Files:**
- Modify: `app/api/inbox/conversations/[id]/reply/route.ts`
- Modify: `app/api/inbox/compose/route.ts`

- [ ] **Step 1: Add the import and the check in `reply/route.ts`**

Add near the top:

```ts
import { can } from '@/lib/permissions'
```

After the existing auth/suspension checks (where `ctx` from `getAuthContext` is available, and right after the existing `requireWriteAccess(ctx)` handling), add:

```ts
  if (!can.replyToTickets(ctx.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
```

If `NextResponse` is not already imported, add `import { NextResponse } from 'next/server'` (or mirror the file's existing error-response style).

- [ ] **Step 2: Add the same import and check in `compose/route.ts`**

Repeat Step 1 in `app/api/inbox/compose/route.ts`.

- [ ] **Step 3: Verify lint passes**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/api/inbox/conversations/[id]/reply/route.ts app/api/inbox/compose/route.ts
git commit -m "feat(permissions): gate Next.js reply/compose routes with replyToTickets"
```

---

## Task 12: Disable conversation notes + ticket actions for non-writers

**Files:**
- Modify: `components/features/inbox/notes-section.tsx`
- Modify: `components/features/inbox/ticket-action-bar.tsx`

- [ ] **Step 1: Gate the Add-Note control**

In `notes-section.tsx`, import the hook:

```ts
import { usePermissions } from '@/hooks/use-permissions'
```

Inside the component, read the capability:

```ts
  const { can } = usePermissions()
  const canManage = can.manageConversations
```

Extend the existing `disabled` on the note textarea and the Add Note button to include `|| !canManage`:

```tsx
        <textarea
          // ...existing props...
          disabled={isSuspended || !canManage}
          title={!canManage ? 'View-only access — ask an admin to add notes.' : undefined}
        />
```

```tsx
        <Button
          variant="outline"
          onClick={() => void handleAddNote()}
          disabled={isSuspended || addingNote || !noteInput.trim() || !canManage}
          title={!canManage ? 'View-only access — ask an admin to add notes.' : undefined}
          className={/* existing classes */}
        >
```

(The existing textarea has no `disabled` prop yet — add it as shown.)

- [ ] **Step 2: Gate the ticket action bar**

In `ticket-action-bar.tsx`, import the hook and read `const { can } = usePermissions()` inside the component, then `const canManage = can.manageConversations`.

Wrap the interactive controls (status field buttons, the tag remove `×` buttons, the "+ Add tag" button, and the assignee selector) so they are disabled when `!canManage`. For the native `<button>` elements add `disabled={!canManage}` and `title={!canManage ? 'View-only access' : undefined}`. For the close button (line ~29) add the same. Example for the add-tag button:

```tsx
        <button
          onClick={onAddTag}
          disabled={!canManage}
          title={!canManage ? 'View-only access — ask an admin.' : undefined}
          className="border-none bg-transparent text-[10.5px] text-muted-foreground font-[inherit] p-0 disabled:opacity-50 disabled:cursor-not-allowed"
        >
```

Apply the same `disabled` + `title` + `disabled:opacity-50 disabled:cursor-not-allowed` pattern to the other action buttons in this component.

- [ ] **Step 3: Verify lint passes**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add components/features/inbox/notes-section.tsx components/features/inbox/ticket-action-bar.tsx
git commit -m "feat(permissions): disable notes and ticket actions for view-only roles"
```

---

## Task 13: Disable the reply composer for non-writers

**Files:**
- Modify: `components/features/inbox/conversation-panel.tsx`

- [ ] **Step 1: Read the capability**

Add the import:

```ts
import { usePermissions } from '@/hooks/use-permissions'
```

Inside the component:

```ts
  const { can } = usePermissions()
  const canReply = can.replyToTickets
```

- [ ] **Step 2: Disable the composer input and send button**

Find the reply composer (textarea/editor + send button) rendered by this panel. Add `disabled={!canReply || /* existing */}` to the input and the send button, and add a hint when blocked:

```tsx
      {!canReply && (
        <p className="px-3 py-2 text-xs text-muted-foreground">
          View-only access — you cannot reply to tickets.
        </p>
      )}
```

If the composer is a separate child component receiving props, thread a `disabled` (or `canReply`) prop down and apply it to the input + send button there. Do not remove the composer — disable it (per the disable+tooltip decision).

- [ ] **Step 3: Verify lint passes**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add components/features/inbox/conversation-panel.tsx
git commit -m "feat(permissions): disable reply composer for view-only roles"
```

---

## Task 14: Disable order action buttons for observers

**Files:**
- Modify: `components/features/inbox/orders-section.tsx`

- [ ] **Step 1: Read the capability**

Add the import and read it inside `OrdersSection`:

```ts
import { usePermissions } from '@/hooks/use-permissions'
```

```ts
  const { can } = usePermissions()
  const canManageOrders = can.manageOrders
```

- [ ] **Step 2: Gate each order action button**

The order action buttons (Refund ~line 234, Cancel ~line 242, Duplicate ~line 212, Edit address ~line 365, Note ~line 250, plus the create/refund-order buttons) open a modal via `onClick={() => setModal(...)}`. Wrap each with `<Gate>` in disable mode, or add `disabled={!canManageOrders}` directly. Prefer `<Gate>` for consistency:

```tsx
import { Gate } from '@/components/shared/gate'
```

```tsx
{canRefund && (
  <Gate capability="manageOrders" mode="disable" reason="View-only access — you cannot issue refunds.">
    <Button /* existing props */ onClick={() => setModal({ type: 'refund', order })}>
      <RotateCcw size={11} /> Refund
    </Button>
  </Gate>
)}
```

Apply the same wrapping to Cancel, Duplicate, Edit address, and Note action buttons. (Each `<Gate>` child must be a single element — wrap the `<Button>` only.)

- [ ] **Step 3: Verify lint passes**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add components/features/inbox/orders-section.tsx
git commit -m "feat(permissions): disable order actions for view-only roles"
```

---

## Task 15: Disable store connect/disconnect for non-admins

**Files:**
- Modify: `components/features/settings/stores/store-card.tsx`

- [ ] **Step 1: Read the capability**

Add the import and read it inside `StoreCard`:

```ts
import { usePermissions } from '@/hooks/use-permissions'
```

```ts
  const { can } = usePermissions()
  const canManage = can.manageWorkspace
```

- [ ] **Step 2: Gate Disconnect and Delete buttons**

Extend the existing `disabled` on the Disconnect button (line ~109) and the Delete button (line ~119), and add a tooltip title:

```tsx
          <Button
            // ...existing props...
            onClick={() => setDisconnectOpen(true)}
            disabled={isSuspended || disconnectMutation.isPending || !canManage}
            title={!canManage ? 'Admin access required to manage store connections.' : undefined}
          >
            Disconnect
          </Button>
```

Apply the same `|| !canManage` and `title` to the Delete button and the email-config delete/add buttons in this card.

- [ ] **Step 3: Verify lint passes**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add components/features/settings/stores/store-card.tsx
git commit -m "feat(permissions): disable store connection actions for non-admins"
```

---

## Task 16: Filter the settings nav by role + page guards

**Files:**
- Modify: `lib/settings-constants.ts`
- Modify: `components/features/settings/settings-sidebar.tsx`

- [ ] **Step 1: Add an optional capability to the nav item type**

In `lib/settings-constants.ts`, extend `SettingsNavItem` and tag the admin-only items. Import the capability key type:

```ts
import type { can } from '@/lib/permissions'
```

```ts
export interface SettingsNavItem {
  label: string
  href: string
  /** Capability required to see this item. Omitted = always visible. */
  capability?: keyof typeof can
}
```

Update `RAW_SETTINGS_NAV` with capabilities:

```ts
const RAW_SETTINGS_NAV: SettingsNavGroup[] = [
  { label: 'WORKSPACE', items: [
    { label: 'General',  href: '/settings/workspace/general', capability: 'manageWorkspace' },
    { label: 'Users',    href: '/settings/workspace/members', capability: 'inviteMembers'  },
    { label: 'Macros',   href: '/settings/workspace/macros',  capability: 'viewMacros'     },
    { label: 'Tags',     href: '/settings/workspace/tags',    capability: 'viewTags'       },
    { label: 'Stores',   href: '/settings/workspace/stores',  capability: 'manageWorkspace' },
    { label: 'Billing',  href: '/settings/workspace/billing', capability: 'manageBilling'  },
  ]},
  { label: 'AI AGENT', items: [
    { label: 'Onboarding', href: '/settings/ai-agent/onboarding', capability: 'manageWorkspace' },
    { label: 'Lessons',    href: '/settings/ai-agent/lessons',    capability: 'manageWorkspace' },
    { label: 'Rules',      href: '/settings/ai-agent/rules',      capability: 'manageWorkspace' },
  ]},
  { label: 'INTEGRATIONS', items: [
    { label: 'Email Display',    href: '/settings/integrations/email-display', capability: 'manageWorkspace' },
    { label: 'Data Migration',   href: '/settings/integrations/migrations',    capability: 'manageMigrations' },
  ]},
  { label: 'PERSONAL', items: [
    { label: 'Profile',        href: '/settings/personal/profile' },
    { label: 'Password & 2FA', href: '/settings/personal/security' },
  ]},
]
```

(Macros/Tags keep `viewMacros`/`viewTags` so agents and observers still see the read-only pages; the create/edit/delete controls inside those pages are already capability-gated via existing `can.manageMacros`/`can.manageTags` usage and `<Gate>`.)

- [ ] **Step 2: Add a role-aware filtered nav helper**

Still in `lib/settings-constants.ts`, add a helper that filters groups by capability (drops empty groups):

```ts
export function visibleSettingsNav(
  caps: Record<keyof typeof can, boolean>,
): SettingsNavGroup[] {
  return SETTINGS_NAV
    .map(group => ({
      ...group,
      items: group.items.filter(item => !item.capability || caps[item.capability]),
    }))
    .filter(group => group.items.length > 0)
}
```

- [ ] **Step 3: Use the filtered nav in the sidebar**

In `components/features/settings/settings-sidebar.tsx`, replace the direct `SETTINGS_NAV` usage (the `SETTINGS_NAV.map(...)` at line ~126 and the `personalGroupIndex` lookup at line ~57) with the filtered version:

```ts
import { visibleSettingsNav, ALL_SETTINGS_ITEMS } from '@/lib/settings-constants'
import { usePermissions } from '@/hooks/use-permissions'
```

Inside the component:

```ts
  const { can } = usePermissions()
  const nav = visibleSettingsNav(can)
```

Then map over `nav` instead of `SETTINGS_NAV`, and compute `personalGroupIndex` from `nav` (`nav.findIndex(g => g.label === 'PERSONAL')`). Leave the search dropdown using `ALL_SETTINGS_ITEMS` as-is, OR filter it the same way for consistency:

```ts
  const searchable = ALL_SETTINGS_ITEMS.filter(item => {
    const group = visibleSettingsNav(can).find(g => g.label === item.group)
    return !!group?.items.some(i => i.href === item.href)
  })
```

(If the simpler approach is preferred, leave search on `ALL_SETTINGS_ITEMS` — backend 403 still protects deep links; this is UX only.)

- [ ] **Step 4: Verify lint passes**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/settings-constants.ts components/features/settings/settings-sidebar.tsx
git commit -m "feat(permissions): filter settings nav by role"
```

---

## Task 17: Final verification — full test run, lint, and manual per-role smoke

**Files:** none (verification only)

- [ ] **Step 1: Run the full Deno test suite**

Run: `cd supabase/functions/api && deno test --allow-read tests/permissions.test.ts tests/require-capability.test.ts`
Expected: PASS (all 8 tests).

- [ ] **Step 2: Run lint over the whole project**

Run: `npm run lint`
Expected: PASS with no errors.

- [ ] **Step 3: Manual per-role smoke (record results)**

Confirm the matrix by logging in (or impersonating) as each role and checking:

- **Observer:** Inbox/orders/analytics all *visible*; reply composer, note input, ticket actions, and order Refund/Cancel buttons all *disabled with tooltip*; Settings sidebar shows only Macros/Tags (read-only) + Personal; deep-linking `/settings/workspace/general` is blocked/empty.
- **Agent:** can reply, add notes, change conversation status, issue refunds/cancellations; Settings sidebar hides General/Users/Stores/Billing/AI Agent/Email Display/Data Migration; store Disconnect is disabled.
- **Admin:** everything except Billing nav item (hidden — billing is owner-only).
- **Owner:** everything including Billing.

- [ ] **Step 4: Final commit (if any smoke fixes were needed)**

```bash
git add -A
git commit -m "chore(permissions): role smoke-test fixes"
```

(If no fixes were needed, skip this commit.)

---

## Notes for the implementer

- **Backend is the boundary.** The `<Gate>`/`disabled` UI is cosmetic; the `requireCapability` checks are what actually protect data. Never rely on UI gating alone.
- **base-ui, not Radix.** `<Gate>`'s tooltip uses the `render` prop on `TooltipTrigger` (base-ui composition). If a child element doesn't accept `disabled`, the native `title`-attribute approach used in Tasks 12/15 is the fallback.
- **Edge functions need redeploy.** The Hono route changes (Tasks 6–10) only take effect on prod after `supabase functions deploy api` from `lynq-dashboard/`. That deploy is a user-initiated step — not part of these tasks.
- **No git push.** Per project preference, plans cover code changes only; commits are local and pushing/merging is user-initiated.
