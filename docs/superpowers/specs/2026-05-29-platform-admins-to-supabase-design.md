# Platform Admins to Supabase

Move hardcoded admin/tester email arrays into a Supabase `platform_admins` table so that adding or removing privileged users no longer requires a code change and deploy.

## Roles

| Role | Payment bypass | Admin panel access |
|------|---------------|--------------------|
| `admin` | Yes | Yes |
| `tester` | Yes | No |

## Database

### New table: `platform_admins`

```sql
create table platform_admins (
  id         uuid primary key default gen_random_uuid(),
  email      text unique not null,
  role       text not null check (role in ('admin', 'tester')),
  created_at timestamptz not null default now()
);

-- Seed current admins
insert into platform_admins (email, role) values
  ('info@lynqagency.com',    'admin'),
  ('denver9523@gmail.com',   'admin'),
  ('del.socorro10@gmail.com', 'admin');
```

No RLS policies. The table is only queried server-side via `supabaseAdmin`.

### Access widening (intentional)

This migration intentionally consolidates fragmented access control. The following access changes are by design:

- **`denver9523@gmail.com`** gains subscription/payment bypass. Previously only in `ADMIN_EMAILS` (admin panel), not in `PLATFORM_ADMIN_EMAILS` (payment bypass). As the dev account, having full admin access is correct.
- **Routes with inline `ADMIN_EMAIL = 'info@lynqagency.com'`** (create-user, delete-user, team, migrate-users, seed-demo, candidates, retention-status, time) open up to all `admin`-role users. These were artificially restricted to a single email due to copy-paste, not by design intent.
- **`LYNQ_ADMIN_EMAILS` feedback routes** open up to all `admin`-role users. The narrower scope was not intentional — feedback visibility should match admin panel access.

## Server helper: `lib/platformAdmin.ts`

Replace the current hardcoded arrays and sync helpers with async functions backed by the database.

### Exports

```ts
/** True if email has role 'admin' or 'tester'. Used for payment/subscription bypass. */
export async function isPlatformAdminOrTester(email: string): Promise<boolean>

/** True if email has role 'admin'. Used for admin panel access. */
export async function isPlatformAdmin(email: string): Promise<boolean>
```

### Caching

Results are cached in a module-level `Map<string, { role: string | null; ts: number }>` with a 60-second TTL. On miss or expiry, a single query fetches the row from `platform_admins` by email. Cache is per-process (serverless function instance), so no cross-instance staleness concerns beyond the TTL window.

**Known behavior:** When an admin/tester is removed from the table, they retain access for up to 60 seconds until their cache entry expires. This is acceptable — admin removal is rare and not time-critical.

**Cold-start note:** The first call for any email in a new serverless instance requires a DB roundtrip. This affects `getAuthContext` (called on every authenticated request) for the impersonation check. For non-admin users, the cache will store a `null` role, so subsequent calls within 60s are free. Acceptable latency for v1.

### Removed

- `PLATFORM_ADMIN_EMAILS` array (deleted — only imported by `proxy.ts` and `onboarding/status`, both via the function, not the array directly)
- Sync `isPlatformAdmin()` function (replaced by async version)

## Consumer updates

### `lib/admin-constants.ts`

Remove the `ADMIN_EMAILS` array entirely. All consumers migrate to the async `isPlatformAdmin()` from `lib/platformAdmin.ts`.

### `proxy.ts` — `checkBlockedState()` function

The admin bypass check is inside `checkBlockedState()` at line 78, not in the top-level `proxy()` function. Currently:

```ts
if (isPlatformAdmin({ email: user.email as string | undefined })) return { blocked: false }
```

Change to:

```ts
if (await isPlatformAdminOrTester(user.email as string ?? '')) return { blocked: false }
```

`checkBlockedState()` is already async, so no signature changes needed.

### `app/api/onboarding/status/route.ts`

Currently returns `is_platform_admin: isPlatformAdmin(ctx.user)`. This flag is used by `BlockedStateGuard` on the client to skip the blocked/trial-expired UI.

Change to two separate checks:

```ts
// Payment bypass flag — used by BlockedStateGuard to hide blocked UI
is_payment_exempt: await isPlatformAdminOrTester(ctx.user.email ?? ''),

// Admin panel flag — used by admin layout to gate access
is_platform_admin: await isPlatformAdmin(ctx.user.email ?? ''),
```

This prevents testers from accessing the admin panel via the `is_platform_admin` flag while still bypassing payment UI. The `BlockedStateGuard` component updates to check `is_payment_exempt` instead of `is_platform_admin`.

### Admin API routes importing `ADMIN_EMAILS`

These routes import `ADMIN_EMAILS` from `lib/admin-constants.ts` and check `ADMIN_EMAILS.includes(email)`. Some use `getUserFromToken()` directly instead of `getAuthContext()`. Since these are admin-only routes that don't need workspace context, the `getUserFromToken()` pattern is acceptable — only the admin check itself changes:

- `app/api/admin/impersonate/route.ts`
- `app/api/admin/clients/overview/route.ts`
- `app/api/admin/cron-runs/route.ts`
- `app/api/admin/cron-runs/latest/route.ts`
- `app/api/admin/webhooks/route.ts`
- `app/api/admin/webhooks/dismiss/route.ts`
- `app/api/admin/webhooks/retry/route.ts`
- `app/api/auth/impersonation-status/route.ts`
- `lib/auth.ts` (impersonation session check in `getAuthContext`)

All change from `ADMIN_EMAILS.includes(email)` to `await isPlatformAdmin(email)`.

### Admin API routes with inline `ADMIN_EMAIL` / `ADMIN_EMAILS`

These routes define their own local constant instead of importing. All are consolidated to use the shared async `isPlatformAdmin()`. The inline constants are deleted.

**Inline single string (`ADMIN_EMAIL = 'info@lynqagency.com'`):**
- `app/api/admin/create-user/route.ts`
- `app/api/admin/team/route.ts`
- `app/api/admin/delete-user/route.ts`
- `app/api/admin/migrate-users/route.ts`
- `app/api/admin/seed-demo/route.ts`
- `app/api/admin/candidates/route.ts`
- `app/api/admin/candidates/[id]/validate/route.ts`
- `app/api/admin/retention-status/route.ts`
- `app/api/time/route.ts`

**Inline array (`ADMIN_EMAILS = [...]`):**
- `app/api/admin/clients/[id]/suspend/route.ts`
- `app/api/admin/clients/[id]/unsuspend/route.ts`

**Inline `LYNQ_ADMIN_EMAILS`:**
- `app/api/lynq-admin/feedback/route.ts`
- `app/api/lynq-admin/feedback/count/route.ts`

### Client components

Two client components currently import `ADMIN_EMAILS` for client-side checks:

**`app/(admin-login)/admin/login/page.tsx`** — Checks email before allowing admin login. Change to call a lightweight server endpoint (or inline server action) that returns `isPlatformAdmin(email)` result. The login form already makes a server call for password validation, so this adds minimal overhead.

**`app/admin/layout.tsx`** — Guards the admin layout. Change to use the `is_platform_admin` flag from the existing `onboarding/status` endpoint response. Redirect to `/admin/login` if not admin.

### `BlockedStateGuard` component

Update to check `is_payment_exempt` (new field) instead of `is_platform_admin` for determining whether to show the blocked/trial-expired UI.

## What is NOT changing

- The `workspace_members.role` system (`owner`, `admin`, `agent`, `observer`) is unrelated and unchanged.
- No UI for managing the `platform_admins` table. Managed via Supabase dashboard.
- No changes to RLS policies on other tables.
- Admin-only routes that use `getUserFromToken()` keep that pattern (no migration to `getAuthContext` — these routes don't need workspace context).

## Migration checklist

1. Create `platform_admins` table migration with seed data
2. Rewrite `lib/platformAdmin.ts` with async functions + cache
3. Remove `ADMIN_EMAILS` from `lib/admin-constants.ts`
4. Update `proxy.ts` (`checkBlockedState` function)
5. Update `onboarding/status` route (add `is_payment_exempt`, keep `is_platform_admin`)
6. Update `BlockedStateGuard` to use `is_payment_exempt`
7. Update all admin API routes (imported + inline)
8. Update `lib/auth.ts` impersonation check
9. Update client components (admin login + admin layout)
10. Run `npm run lint` and fix any issues
