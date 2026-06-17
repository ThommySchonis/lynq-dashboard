# Role-Based Permissions — Design Spec

**Date:** 2026-06-16
**Status:** Approved — ready for implementation plan
**Source task:** `tasks/permissions.md` + `tasks/permissions-image.png`

## Goal

As a workspace admin, assign roles to team members so each user accesses only the
features relevant to their responsibilities. The system has four roles
(`owner`, `admin`, `agent`, `observer`); the product matrix specifies Admin / Agent /
Observer behavior.

This task is **not** building RBAC from scratch. Capability definitions (`can.*`)
already exist in both the frontend and the Hono backend. The real problem is that
**enforcement is incomplete and inconsistent** — many write routes only check
workspace suspension (`requireWriteAccess`), not role, so an **observer can currently
reply to tickets, add notes, change conversation status, issue refunds, cancel orders,
and connect email/stores**. The goal is to make enforcement complete and consistent,
with observer strictly view-only.

## Role model (decisions)

- **owner** — full access, including billing. One per workspace.
- **admin** — everything except billing.
- **agent** — operational work (tickets + orders) and editing operational content;
  no admin areas (settings, connections, user management, billing).
- **observer** — strictly **view-only everywhere**. Can open every operational
  section and view data, but **every write/edit action is blocked**.

**Matrix interpretation:** feature rows ("Inbox & tickets", "Order management",
"Analytics", etc.) mean *can see / navigate to this section*. The "Edit (any content)"
row is the **global write gate**. So "Observer ✅ Order management" means an observer
can view orders and refund history but cannot issue a refund or cancellation.

**Billing:** owner-only (matches current `can.manageBilling`). The matrix's
"Admin ✅ billing" maps to owner in this system. No change to `can.manageBilling`.

**Connections nuance:** store/email *connection management* is **Admin-only (Agent ❌)**,
but order *actions* (refund/cancel/edit) are **Agent ✅**. Both live in `shopify.ts`
and must be gated with different capabilities.

## Capability model (source of truth)

The matrix collapses to three write tiers plus view:

| Tier | Roles allowed | Covers |
|---|---|---|
| **View** (always) | all 4 | open Inbox, orders, analytics, performance, time-tracking, action board |
| **Operational write** | owner, admin, agent | reply, notes, conversation status/assign/close, order refund/cancel/edit/duplicate/fulfill/note/address/create, macros, tags, tasks |
| **Admin write** | owner, admin | workspace settings, email connections, store connections, member/role management, migrations |
| **Billing** | owner only | subscription, plan changes, delete workspace |

### Capability changes

- **New** `manageOrders` → `owner/admin/agent` — Shopify order write actions
  (currently ungated beyond suspension).
- **New** `manageConversations` → `owner/admin/agent` — conversation status/assign/notes
  (currently only suspension-gated).
- **Reuse** `replyToTickets` (`owner/admin/agent`) — replies/compose.
- **Reuse** `manageWorkspace` (`owner/admin`) — settings, email connections, **and store
  connections**. This *tightens* stores/parcel-panel from "block observer only" to
  "owner/admin only", per the matrix (agent must lose store/email connection access).
- **Keep** `manageBilling` (owner), member caps, macros/tags/tasks unchanged.
- **Sync** the Hono `supabase/functions/api/lib/permissions.ts` so it has full parity
  with `lib/permissions.ts` (it is currently missing several capabilities, e.g. tags/tasks/view caps).

### Judgment call

Order **sync/refresh** (pulling latest Shopify data) stays **operational** (agent
allowed) — it is a read-refresh, not a connection change. Not gated as admin-only.

## Backend enforcement (the security boundary)

### Reusable middleware factory (Hono)

Add to `supabase/functions/api/middleware/workspace.ts`:

```ts
export function requireCapability(cap: keyof typeof can) {
  return (c: Context): Response | null => {
    const ctx = c.get('authContext') as AuthContext
    if (!can[cap](ctx.role)) {
      return c.json({ error: 'forbidden', message: 'You do not have permission to perform this action.' }, 403)
    }
    return null
  }
}
```

Applied at the top of each write handler alongside the existing suspension check:

```ts
const blocked = requireWriteAccess(c) ?? requireCapability('manageOrders')(c)
if (blocked) return blocked
```

This makes "did we forget a check?" a single greppable, uniform pattern instead of 13
ad-hoc snippets.

### Routes to gate

| Route file | Endpoints | Capability |
|---|---|---|
| `routes/shopify.ts` | `/orders/:id/refund`, `/cancel`, `/edit`, `/duplicate`, `/note`, `/address`, `/fulfill`, `/orders/create`, `/cancel-order`, `/refund-order`, `/duplicate-order`, `/edit-address` | `manageOrders` |
| `routes/shopify.ts` | `/manual-connect` (POST/DELETE), `/link` | `manageWorkspace` (store connections = admin-only) |
| `routes/inbox-conversations.ts` | `PATCH /:id`, `POST /:id/notes` | `manageConversations` |
| `routes/inbox.ts` | `/integrations/email`, `/integrations`, `DELETE /accounts/:id` | `manageWorkspace` |
| `routes/settings.ts` | `/brand`, `/integrations/email`, `/integrations` | `manageWorkspace` |
| `routes/stores.ts` | `DELETE /:id`, `/:id/disconnect` | tighten observer-only → `manageWorkspace` |
| `routes/parcel-panel.ts` | `/connect` | tighten observer-only → `manageWorkspace` |

### Next.js streaming routes

Cannot use Hono middleware — call `can.*` directly after `getAuthContext`, return 403 if false:

- `app/api/inbox/conversations/[id]/reply/route.ts` → `replyToTickets`
- `app/api/inbox/compose/route.ts` → `replyToTickets`

### Note on `shopify.ts` local helper

`shopify.ts` defines its **own** local `requireWriteAccess` (suspension-only). Leave it
as-is (refactor is out of scope) and **layer** the capability check on top of it.

## Frontend enforcement (UX mirror)

### New primitives

**`hooks/use-permissions.ts`** — `usePermissions()` reads role from `useAuthStore` and
returns the bound capability map:

```ts
export function usePermissions() {
  const role = useAuthStore((s) => s.role)
  return useMemo(() => ({
    role,
    can: Object.fromEntries(
      Object.entries(can).map(([k, fn]) => [k, role ? fn(role) : false])
    ) as Record<keyof typeof can, boolean>,
  }), [role])
}
```

**`components/shared/gate.tsx`** — `<Gate>` supporting two modes:

```tsx
<Gate capability="manageOrders" mode="disable" reason="View-only access — ask an admin">
  <Button>Refund</Button>
</Gate>
```

- `mode="hide"` → renders nothing if denied.
- `mode="disable"` → renders children disabled (clone with `disabled`/`aria-disabled` +
  `pointer-events-none`) wrapped in a tooltip showing `reason`.

### Presentation decision (the "mix")

Disable+tooltip for inline action buttons; fully hide admin-only nav sections.

| Surface | Mode | Capability |
|---|---|---|
| Inbox reply composer (`conversation-panel.tsx`) | disable + tooltip | `replyToTickets` |
| Notes input (`notes-section.tsx`) | disable + tooltip | `manageConversations` |
| Ticket actions — close/assign/tag (`ticket-action-bar.tsx`) | disable + tooltip | `manageConversations` |
| Order action buttons — refund/cancel/edit/etc. | disable + tooltip | `manageOrders` |
| Store connect/disconnect (`store-card.tsx`) | disable + tooltip | `manageWorkspace` |

### Settings nav filtering

Add an optional `capability` to `SettingsNavItem` in `lib/settings-constants.ts`, then
filter `SETTINGS_NAV` by role in the settings sidebar (mirroring how `sidebar.tsx` hides
`/admin`).

| Settings item | Required capability (else hidden) |
|---|---|
| General, Stores, Email Display, Data Migration | `manageWorkspace` |
| Users | `inviteMembers` |
| Billing | `manageBilling` |
| Macros, Tags | `manageMacros` / `manageTags` (visible to agent; observer view-only) |
| AI Agent group | `manageWorkspace` |
| Personal (Profile, Security) | always visible |

For **Macros/Tags** pages observers can see (read-only): page stays visible, but
create/edit/delete controls use `<Gate mode="disable">`.

### Page-level guard

Admin-only settings pages get a small guard so a deep-linked observer/agent sees a
"You don't have access" state instead of a broken page. Backend already 403s; this is
UX only. Reuses the existing `(protected)` settings layout.

## Work checklist

**Foundation (first):**
1. Reconcile `can.*` — add `manageOrders`, `manageConversations` to `lib/permissions.ts`;
   sync Hono `permissions.ts` to full parity.
2. Add `requireCapability(cap)` to Hono `middleware/workspace.ts`.
3. Add `usePermissions()` hook + `<Gate>` component.

**Backend:**
4. Gate shopify order writes → `manageOrders`; store-connection writes → `manageWorkspace`.
5. Gate inbox-conversations (`PATCH`, notes) → `manageConversations`.
6. Gate inbox + settings integration/email/account routes → `manageWorkspace`.
7. Tighten stores + parcel-panel from observer-only → `manageWorkspace`.
8. Add `can.replyToTickets` checks to the two Next.js reply/compose routes.

**Frontend:**
9. Disable+tooltip: reply composer, notes, ticket actions, order actions, store connect.
10. Settings-nav role filtering + page-level guards.

## Testing

- **Backend:** Deno tests in `supabase/functions/api/tests/` asserting each gated route
  returns **403 for observer** (and **403 for agent** on store/email connections),
  2xx for admin. Run from `supabase/functions/api/`:
  `cd supabase/functions/api && deno test --allow-read tests/<name>.test.ts`.
- **Frontend:** `can.*` is pure, so disable/hide logic is unit-testable — light tests on
  `<Gate>` and the settings-nav filter, plus manual smoke per role.
- **Lint:** `npm run lint` clean, no `any`.

## Out of scope (explicit)

- Refactoring `shopify.ts`'s local `requireWriteAccess`.
- RLS / DB-level role enforcement (much of the write path uses the service-role admin
  client that bypasses RLS, so it would not even cover the Hono routes).
- The billing UI itself (blocked on Shopify approval).
