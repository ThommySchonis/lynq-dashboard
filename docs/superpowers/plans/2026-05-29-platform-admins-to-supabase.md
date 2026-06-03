# Platform Admins to Supabase — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move hardcoded admin email arrays into a `platform_admins` Supabase table with two roles (`admin`, `tester`) so changes don't require deploys.

**Architecture:** A new `platform_admins` table stores email+role. `lib/platformAdmin.ts` exposes two async helpers (`isPlatformAdmin`, `isPlatformAdminOrTester`) backed by the table with 60s in-memory cache. All 20+ consumer files switch from hardcoded constants to these helpers. The `onboarding/status` response gains `is_payment_exempt` for testers.

**Tech Stack:** Supabase (PostgreSQL), Next.js API routes, TypeScript

**Spec:** `docs/superpowers/specs/2026-05-29-platform-admins-to-supabase-design.md`

---

### Task 1: Database migration

**Files:**
- Create: `supabase/migrations/<timestamp>_create_platform_admins.sql`

**Skill:** Invoke `migration-rules` before writing the migration.

- [ ] **Step 1: Create the migration file**

```bash
cd /Users/dendy/Documents/Work/Lynq/lynq-dashboard
npx supabase migration new create_platform_admins
```

- [ ] **Step 2: Write the migration SQL**

In the generated file:

```sql
create table platform_admins (
  id         uuid primary key default gen_random_uuid(),
  email      text unique not null,
  role       text not null check (role in ('admin', 'tester')),
  created_at timestamptz not null default now()
);

-- Seed current admins
insert into platform_admins (email, role) values
  ('info@lynqagency.com',     'admin'),
  ('denver9523@gmail.com',    'admin'),
  ('del.socorro10@gmail.com', 'admin');
```

- [ ] **Step 3: Push the migration**

```bash
npx supabase db push
```

Expected: Migration applies successfully, table `platform_admins` exists with 3 rows.

---

### Task 2: Rewrite `lib/platformAdmin.ts`

**Files:**
- Modify: `lib/platformAdmin.ts`

- [ ] **Step 1: Rewrite the file**

Replace the entire contents of `lib/platformAdmin.ts` with:

```ts
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// ─── In-memory cache (per serverless instance) ──────────────────────
// Stores the role for known emails, or null for non-admin emails.
// 60s TTL — when an admin is removed, they retain access for up to
// 60 seconds. Acceptable: admin removal is rare and not time-critical.

const CACHE_TTL_MS = 60_000

interface CacheEntry {
  role: string | null
  ts: number
}

const cache = new Map<string, CacheEntry>()

async function getRole(email: string): Promise<string | null> {
  const now = Date.now()
  const cached = cache.get(email)
  if (cached && now - cached.ts < CACHE_TTL_MS) return cached.role

  const { data } = await supabaseAdmin
    .from('platform_admins')
    .select('role')
    .eq('email', email)
    .maybeSingle()

  const role = (data as { role: string } | null)?.role ?? null
  cache.set(email, { role, ts: now })
  return role
}

/**
 * True when the email belongs to a platform admin (full admin panel
 * access + payment bypass).
 */
export async function isPlatformAdmin(email: string | null | undefined): Promise<boolean> {
  if (!email) return false
  return (await getRole(email)) === 'admin'
}

/**
 * True when the email belongs to any privileged user (admin or tester).
 * Used for payment/subscription bypass — testers skip the payment gate
 * but cannot access the admin panel.
 */
export async function isPlatformAdminOrTester(email: string | null | undefined): Promise<boolean> {
  if (!email) return false
  const role = await getRole(email)
  return role === 'admin' || role === 'tester'
}
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
npx tsc --noEmit --pretty 2>&1 | head -30
```

Expected: Errors in consumer files (they still call the old sync signature). That's fine — we fix them in subsequent tasks.

---

### Task 3: Update `proxy.ts`

**Files:**
- Modify: `proxy.ts:5,77-78`

**Important:** `proxy.ts` runs in the proxy/middleware layer and deliberately avoids importing `@supabase/supabase-js`. The existing code uses raw `fetch` against the Supabase REST API. We CANNOT import `isPlatformAdminOrTester` from `lib/platformAdmin.ts` because that would pull in `supabaseAdmin`. Instead, inline a raw REST query matching the existing pattern in `checkBlockedState()`.

- [ ] **Step 1: Remove the import**

Delete line 5:
```ts
import { isPlatformAdmin } from '@/lib/platformAdmin'
```

- [ ] **Step 2: Replace the admin check in `checkBlockedState()`**

Replace lines 77-78:
```ts
  // Platform admins are never blocked, regardless of workspace subscription.
  if (isPlatformAdmin({ email: user.email as string | undefined })) return { blocked: false }
```
with a raw REST API query:
```ts
  // Platform admins and testers are never blocked, regardless of workspace subscription.
  const adminEmail = user.email as string | undefined
  if (adminEmail) {
    const adminUrl = `${supabaseUrl}/rest/v1/platform_admins`
      + `?email=eq.${encodeURIComponent(adminEmail)}`
      + `&select=role`
      + `&limit=1`
    const adminRes = await fetch(adminUrl, {
      headers: {
        Authorization: asciiSafe(`Bearer ${secretKey}`, 'Authorization', 'proxy'),
        apikey:        asciiSafe(secretKey,              'apikey',        'proxy'),
      },
      cache: 'no-store',
    })
    const adminRows = await adminRes.json().catch(() => []) as { role: string }[]
    if (Array.isArray(adminRows) && adminRows.length > 0) return { blocked: false }
  }
```

---

### Task 4: Update `onboarding/status` route

**Files:**
- Modify: `app/api/onboarding/status/route.ts:1-5,100-102`

- [ ] **Step 1: Update the import**

Replace the `isPlatformAdmin` import with:
```ts
import { isPlatformAdmin, isPlatformAdminOrTester } from '@/lib/platformAdmin'
```

- [ ] **Step 2: Update the response body**

Change lines 100-102 from:
```ts
    // Platform admins bypass the subscription gate entirely. Checked
    // server-side here so the client cannot spoof this flag via devtools.
    is_platform_admin: isPlatformAdmin(ctx.user),
```
to:
```ts
    // Payment-exempt users (admins + testers) bypass the subscription
    // gate. Checked server-side so the client cannot spoof this flag.
    is_payment_exempt: await isPlatformAdminOrTester(ctx.user.email ?? ''),

    // Platform admins get admin panel access.
    is_platform_admin: await isPlatformAdmin(ctx.user.email ?? ''),
```

---

### Task 5: Update `BlockedStateGuard` and `pricing-required` page

**Files:**
- Modify: `components/shared/blocked-state-guard.tsx:12,72`
- Modify: `app/(protected)/pricing-required/page.tsx:94-95`

**Skill:** Invoke `component-rules` before editing.

- [ ] **Step 1: Update the `OnboardingStatus` interface in `blocked-state-guard.tsx`**

At line 12, add the new field to the interface:
```ts
  is_payment_exempt?: boolean
```

- [ ] **Step 2: Update the admin bypass check**

Change line 72 from:
```ts
        if (data?.is_platform_admin) {
```
to:
```ts
        if (data?.is_payment_exempt) {
```

- [ ] **Step 3: Update `pricing-required/page.tsx`**

Change lines 94-95 from:
```ts
      .then((data: { is_platform_admin?: boolean } | null) => {
        if (data?.is_platform_admin) router.replace('/home')
```
to:
```ts
      .then((data: { is_payment_exempt?: boolean } | null) => {
        if (data?.is_payment_exempt) router.replace('/home')
```

---

### Task 6: Update `lib/auth.ts` (impersonation check)

**Files:**
- Modify: `lib/auth.ts:6,63`

- [ ] **Step 1: Update the import**

Change line 6 from:
```ts
import { ADMIN_EMAILS } from '@/lib/admin-constants'
```
to:
```ts
import { isPlatformAdmin } from '@/lib/platformAdmin'
```

- [ ] **Step 2: Update the impersonation check**

Change line 63 from:
```ts
  if (impersonateCookie && ADMIN_EMAILS.includes(user.email ?? '')) {
```
to:
```ts
  if (impersonateCookie && await isPlatformAdmin(user.email)) {
```

---

### Task 7: Update admin routes importing `ADMIN_EMAILS`

**Files:**
- Modify: `app/api/admin/impersonate/route.ts:7,14`
- Modify: `app/api/admin/clients/overview/route.ts:2,14`
- Modify: `app/api/admin/cron-runs/route.ts:4,14`
- Modify: `app/api/admin/cron-runs/latest/route.ts:4,12`
- Modify: `app/api/admin/webhooks/route.ts:4,14`
- Modify: `app/api/admin/webhooks/dismiss/route.ts:4,14`
- Modify: `app/api/admin/webhooks/retry/route.ts:4,14`
- Modify: `app/api/auth/impersonation-status/route.ts:5,22`

**Skill:** Invoke `api-route-rules` before editing.

Each file follows the same pattern. For each file:

- [ ] **Step 1: Replace the import**

Change:
```ts
import { ADMIN_EMAILS } from '@/lib/admin-constants'
```
to:
```ts
import { isPlatformAdmin } from '@/lib/platformAdmin'
```

- [ ] **Step 2: Replace the check**

Change whichever variant appears:
```ts
if (!ADMIN_EMAILS.includes(ctx.user.email ?? '')) {
```
or:
```ts
if (!user || !ADMIN_EMAILS.includes(user.email ?? '')) {
```
to the async equivalent:
```ts
if (!user || !(await isPlatformAdmin(user.email))) {
```

For `impersonate/route.ts` which uses `ctx.user`:
```ts
if (!(await isPlatformAdmin(ctx.user.email))) {
```

For `impersonation-status/route.ts` which returns `{ active: false }` instead of 401:
```ts
if (!user || !(await isPlatformAdmin(user.email))) {
  return NextResponse.json({ active: false })
```

---

### Task 8: Update admin routes with inline `ADMIN_EMAIL` (singular)

**Files:**
- Modify: `app/api/admin/create-user/route.ts:9,17`
- Modify: `app/api/admin/team/route.ts:7,25`
- Modify: `app/api/admin/delete-user/route.ts:8,18`
- Modify: `app/api/admin/migrate-users/route.ts:7,18`
- Modify: `app/api/admin/seed-demo/route.ts:8,16`
- Modify: `app/api/admin/candidates/route.ts:7,15`
- Modify: `app/api/admin/candidates/[id]/validate/route.ts:12,21`
- Modify: `app/api/admin/retention-status/route.ts:5`
- Modify: `app/api/time/route.ts:38,120`

**Skill:** Invoke `api-route-rules` before editing.

For each file:

- [ ] **Step 1: Add import, remove local constant**

Add at top:
```ts
import { isPlatformAdmin } from '@/lib/platformAdmin'
```
Delete the line:
```ts
const ADMIN_EMAIL = 'info@lynqagency.com'
```

- [ ] **Step 2: Replace the check**

Change:
```ts
if (!user || user.email !== ADMIN_EMAIL) {
```
to:
```ts
if (!user || !(await isPlatformAdmin(user.email))) {
```

**Special case — `app/api/time/route.ts:120`:**

This file uses `ADMIN_EMAIL` for a logic branch (not an access gate):
```ts
const isLynqAdmin = ctx.user.email === ADMIN_EMAIL
```
Change to:
```ts
const isLynqAdmin = await isPlatformAdmin(ctx.user.email)
```

---

### Task 9: Update admin routes with inline `ADMIN_EMAILS` (array)

**Files:**
- Modify: `app/api/admin/clients/[id]/suspend/route.ts:7,22`
- Modify: `app/api/admin/clients/[id]/unsuspend/route.ts:6,17`

**Skill:** Invoke `api-route-rules` before editing.

For each file:

- [ ] **Step 1: Add import, remove local constant**

Add at top:
```ts
import { isPlatformAdmin } from '@/lib/platformAdmin'
```
Delete the line:
```ts
const ADMIN_EMAILS = ['info@lynqagency.com', 'denver9523@gmail.com']
```

- [ ] **Step 2: Replace the check**

Change:
```ts
if (!user || !ADMIN_EMAILS.includes(user.email ?? '')) {
```
to:
```ts
if (!user || !(await isPlatformAdmin(user.email))) {
```

---

### Task 10: Update `LYNQ_ADMIN_EMAILS` feedback routes

**Files:**
- Modify: `app/api/lynq-admin/feedback/route.ts:6-16`
- Modify: `app/api/lynq-admin/feedback/count/route.ts:6,14`

**Skill:** Invoke `api-route-rules` before editing.

- [ ] **Step 1: Update `feedback/route.ts`**

Add import:
```ts
import { isPlatformAdmin } from '@/lib/platformAdmin'
```

Delete lines 6-16 (the `LYNQ_ADMIN_EMAILS` constant and the `requireLynqAdmin` helper function).

Replace the check at lines 19-21:
```ts
  const admin = await requireLynqAdmin(request)
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
```
with:
```ts
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user || !(await isPlatformAdmin(user.email))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
```

- [ ] **Step 2: Update `feedback/count/route.ts`**

Add import:
```ts
import { isPlatformAdmin } from '@/lib/platformAdmin'
```

Delete line 6:
```ts
const LYNQ_ADMIN_EMAILS = ['info@lynqagency.com']
```

Change line 14 from:
```ts
  if (!user || !LYNQ_ADMIN_EMAILS.includes(user.email ?? '')) {
```
to:
```ts
  if (!user || !(await isPlatformAdmin(user.email))) {
```

---

### Task 11: Update client components

**Files:**
- Modify: `app/(admin-login)/admin/login/page.tsx:5,21-24`
- Modify: `app/admin/layout.tsx:5,16-19,30-31`

**Skill:** Invoke `component-rules` before editing.

- [ ] **Step 1: Update admin login page**

Remove the import:
```ts
import { ADMIN_EMAILS } from '@/lib/admin-constants'
```

Remove the pre-login admin email check entirely (lines 21-25). The `signInWithPassword` call will succeed for any valid user, but non-admins will be rejected by the admin layout's server-side check and redirected back to `/admin/login`. This avoids needing an unauthenticated endpoint that reveals admin emails.

Delete these lines:
```ts
    if (!ADMIN_EMAILS.includes(email)) {
      setError('No access.')
      setLoading(false)
      return
    }
```

After a successful `signInWithPassword`, the redirect to `/admin` will trigger the layout guard which checks admin status server-side. Non-admins get redirected back to `/admin/login`.

- [ ] **Step 2: Update admin layout**

Replace the entire file `app/admin/layout.tsx` with:

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '@/stores/auth'
import { AdminSidebar } from '@/components/features/admin/admin-sidebar'
import { AdminTopbar } from '@/components/features/admin/admin-topbar'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  const session = useAuthStore((s) => s.session)
  const isLoading = useAuthStore((s) => s.isLoading)
  const redirected = useRef(false)
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)

  useEffect(() => {
    if (isLoading || redirected.current || !session?.access_token) return

    void fetch('/api/onboarding/status', {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: 'no-store',
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { is_platform_admin?: boolean } | null) => {
        if (data?.is_platform_admin) {
          setIsAdmin(true)
        } else {
          redirected.current = true
          window.location.href = '/admin/login'
        }
      })
      .catch(() => {
        redirected.current = true
        window.location.href = '/admin/login'
      })
  }, [session, isLoading])

  if (isLoading || isAdmin !== true) {
    return (
      <div className="min-h-screen bg-[#F9F9FB] flex items-center justify-center text-[13px] text-muted-foreground font-sans">
        Checking access…
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-[#F9F9FB] overflow-hidden font-sans">
      <AdminSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <AdminTopbar />
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>
      </div>
    </div>
  )
}
```

**Skill:** Invoke `component-rules` before editing.

---

### Task 12: Remove `ADMIN_EMAILS` from `lib/admin-constants.ts`

**Files:**
- Modify: `lib/admin-constants.ts:17`

- [ ] **Step 1: Delete the `ADMIN_EMAILS` line**

Remove line 17:
```ts
export const ADMIN_EMAILS = ['info@lynqagency.com', 'denver9523@gmail.com', 'del.socorro10@gmail.com']
```

- [ ] **Step 2: Verify no remaining imports**

```bash
cd /Users/dendy/Documents/Work/Lynq/lynq-dashboard && grep -r "ADMIN_EMAILS\|ADMIN_EMAIL\b\|LYNQ_ADMIN_EMAILS\|PLATFORM_ADMIN_EMAILS" --include='*.ts' --include='*.tsx' lib/ app/ proxy.ts components/ | grep -v node_modules | grep -v 'docs/'
```

Expected: Only the new `isPlatformAdmin` / `isPlatformAdminOrTester` imports appear. No hardcoded email constants remain.

---

### Task 13: Lint and verify

- [ ] **Step 1: Run the linter**

```bash
cd /Users/dendy/Documents/Work/Lynq/lynq-dashboard && npm run lint
```

Expected: No errors. Fix any that appear.

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit --pretty
```

Expected: No type errors.

- [ ] **Step 3: Verify build**

```bash
npm run build 2>&1 | tail -20
```

Expected: Build succeeds.
