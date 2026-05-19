# Auth Guard with Login Redirect — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Centralize auth protection into a single `AuthGuard` component within a `(protected)` route group, so unauthenticated users are redirected to `/login?redirect={originalPath}` and returned after sign-in.

**Architecture:** A `(protected)` Next.js route group wraps all authenticated routes. Its layout renders an `AuthGuard` component that checks the Zustand auth store and redirects to login with a return URL. The login page reads the `?redirect` param and navigates there after successful sign-in.

**Tech Stack:** Next.js 16 (app router), React 19, Zustand, Supabase Auth

**Spec:** `docs/superpowers/specs/2026-05-19-auth-guard-redirect-design.md`

---

### Task 1: Create the AuthGuard component

**Files:**
- Create: `components/shared/auth-guard.tsx`

**Context:** This is a client component that reads from the Zustand auth store (`stores/auth.ts`). It uses `useAuthStore` which exposes `session` and `isLoading`. The component wraps children and only renders them when authenticated.

- [ ] **Step 1: Create `components/shared/auth-guard.tsx`**

@component-rules

```tsx
'use client'

import { useEffect, type ReactNode } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/stores/auth'

export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const session = useAuthStore((s) => s.session)
  const isLoading = useAuthStore((s) => s.isLoading)

  useEffect(() => {
    if (isLoading || session) return

    const search = searchParams.toString()
    const fullPath = search ? `${pathname}?${search}` : pathname
    router.replace(`/login?redirect=${encodeURIComponent(fullPath)}`)
  }, [isLoading, session, router, pathname, searchParams])

  if (isLoading || !session) return null

  return children
}
```

- [ ] **Step 2: Verify the file has no lint errors**

Run: `cd /Users/dendy/Documents/Work/Lynq/lynq-dashboard && npx eslint components/shared/auth-guard.tsx`
Expected: No errors

---

### Task 2: Create the `(protected)` route group layout

**Files:**
- Create: `app/(protected)/layout.tsx`

**Context:** This is a minimal layout that wraps children with `AuthGuard`. It does NOT need to be a client component — it just imports and renders the client `AuthGuard` component. Since `AuthGuard` is a client component, wrapping it in a server layout is fine.

- [ ] **Step 1: Create `app/(protected)/layout.tsx`**

@page-rules

```tsx
import { AuthGuard } from '@/components/shared/auth-guard'

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>
}
```

- [ ] **Step 2: Verify no lint errors**

Run: `cd /Users/dendy/Documents/Work/Lynq/lynq-dashboard && npx eslint app/\(protected\)/layout.tsx`
Expected: No errors

---

### Task 3: Move protected routes into `(protected)/`

**Files:**
- Move: `app/home/` → `app/(protected)/home/`
- Move: `app/inbox/` → `app/(protected)/inbox/`
- Move: `app/analytics/` → `app/(protected)/analytics/`
- Move: `app/performance/` → `app/(protected)/performance/`
- Move: `app/settings/` → `app/(protected)/settings/`
- Move: `app/services/` → `app/(protected)/services/`
- Move: `app/supply-chain/` → `app/(protected)/supply-chain/`
- Move: `app/time-tracking/` → `app/(protected)/time-tracking/`
- Move: `app/value-feed/` → `app/(protected)/value-feed/`
- Move: `app/academy/` → `app/(protected)/academy/`
- Move: `app/onboarding/` → `app/(protected)/onboarding/`
- Move: `app/pricing-required/` → `app/(protected)/pricing-required/`

**Context:** Next.js route groups (parenthesized folder names) are invisible in the URL. Moving `app/home/` to `app/(protected)/home/` keeps the URL as `/home`. All imports within these files use `@/` path aliases, so no import paths need updating.

- [ ] **Step 1: Create the `(protected)` directory and move all routes**

```bash
cd /Users/dendy/Documents/Work/Lynq/lynq-dashboard
mkdir -p app/\(protected\)
mv app/home app/\(protected\)/home
mv app/inbox app/\(protected\)/inbox
mv app/analytics app/\(protected\)/analytics
mv app/performance app/\(protected\)/performance
mv app/settings app/\(protected\)/settings
mv app/services app/\(protected\)/services
mv app/supply-chain app/\(protected\)/supply-chain
mv app/time-tracking app/\(protected\)/time-tracking
mv app/value-feed app/\(protected\)/value-feed
mv app/academy app/\(protected\)/academy
mv app/onboarding app/\(protected\)/onboarding
mv app/pricing-required app/\(protected\)/pricing-required
```

- [ ] **Step 2: Verify the directory structure**

Run: `ls app/\(protected\)/`
Expected: All 12 directories listed: `academy analytics home inbox onboarding performance pricing-required services settings supply-chain time-tracking value-feed`

- [ ] **Step 3: Verify public routes are still outside**

Run: `ls app/`
Expected: Should still contain `login/`, `signup/`, `forgot-password/`, `reset-password/`, `invites/`, `privacy/`, `admin/`, `(admin-login)/`, `lynq-admin/`, `api/`, `sentry-example-page/`, `(protected)/`, plus root files (`layout.tsx`, `page.tsx`, `globals.css`, etc.)

---

### Task 4: Remove scattered auth redirect checks

**Files:**
- Modify: `app/(protected)/home/page.tsx:51-53` — remove auth redirect useEffect
- Modify: `app/(protected)/performance/page.tsx:16-24` — remove auth redirect useEffect + unused imports
- Modify: `app/(protected)/inbox/create/page.tsx:37-45` — remove auth redirect useEffect
- Modify: `app/(protected)/onboarding/page.tsx:74-76` — remove session redirect (keep OAuth callback logic)
- Modify: `app/(protected)/pricing-required/page.tsx:77-78` — remove session redirect (keep `user` name derivation + sign-out handler)

**Context:** These `useEffect` blocks redirect to `/login` when there's no session. They are now redundant because the `(protected)` layout's `AuthGuard` handles this. Remove only the session-check-redirect logic. Keep any other logic in those `useEffect` blocks (OAuth callbacks, name derivation, etc). Also clean up now-unused imports if applicable.

- [ ] **Step 1: Clean up `app/(protected)/home/page.tsx`**

Remove lines 51-53 (the auth redirect useEffect):
```tsx
// REMOVE this:
useEffect(() => {
  if (!isLoading && !session) router.push('/login')
}, [isLoading, session, router])
```

After this change, `router`, `session`, and `isLoading` are no longer used in this file. `useAuthStore` is still needed for the `user` selector (line 25).

Remove:
- Line 4: Delete the entire `import { useRouter } from 'next/navigation'` line
- Line 22: `const router = useRouter()`
- Line 23: `const session = useAuthStore((s) => s.session)`
- Line 24: `const isLoading = useAuthStore((s) => s.isLoading)`
- Lines 51-53: The auth redirect `useEffect`

- [ ] **Step 2: Clean up `app/(protected)/performance/page.tsx`**

This file has minimal other logic. Do NOT touch the React imports (`useEffect`, `useState` are both still needed). Remove:
- Line 5: `import { useAuthStore } from '@/stores/auth'` — remove entirely
- Lines 17-18: `const session = ...` and `const isLoading = ...` — remove
- Lines 22-24: The auth redirect `useEffect` — remove

Keep `useRouter` (used for `router.push('/settings/integrations/email')` in the EmptyState onAction). Keep `useEffect` (used for the `setMounted` call).

After cleanup, the file should be:
```tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { EmptyState } from '@/components/shared/empty-state'
import { Users } from 'lucide-react'

export default function PerformancePage() {
  const [mounted, setMounted] = useState(false)
  const router = useRouter()

  useEffect(() => { setMounted(true) }, [])

  if (!mounted) return null

  return (
    <EmptyState
      icon={Users}
      title="No performance data yet"
      description="Connect your email to start tracking response time, ticket volume, and agent activity."
      actionLabel="Connect email"
      onAction={() => router.push('/settings/integrations/email')}
    />
  )
}
```

- [ ] **Step 3: Clean up `app/(protected)/inbox/create/page.tsx`**

Since AuthGuard guarantees a session when this page renders, the `ready` state (which just waited for session) and the auth redirect are both redundant.

Remove:
- Line 24: `import { useAuthStore } from '@/stores/auth'` — remove entirely
- Lines 37-38: `session` and `isLoading` selectors — remove
- Lines 41-45: Auth redirect useEffect — remove
- Line 65: `const [ready, setReady] = useState(false)` — remove
- Lines 83-86: `useEffect` that sets `ready` based on `session` — remove
- Lines 169-175: The loading block `if (isLoading || !session || !ready)` — remove entirely
- Lines 89-94: Change the focus effect to trigger on mount (remove `ready` dependency):
  ```tsx
  useEffect(() => {
    const timer = setTimeout(() => bodyRef.current?.focus(), 160)
    return () => clearTimeout(timer)
  }, [])
  ```
- Line 169: `if (isLoading || !session || !ready)` — remove the entire loading block (lines 169-175)
- Remove `import { useAuthStore } from '@/stores/auth'` if no other selectors remain — check: `useAuthStore` is only used for `session` and `isLoading`, so remove it.
Keep `Loader2` in the lucide import — it's also used in the send button (line 578).

- [ ] **Step 4: Clean up `app/(protected)/onboarding/page.tsx`**

The useEffect at lines 74-94 does two things: (1) session redirect and (2) OAuth callback detection. Remove only the session redirect. Keep `router` (used on line 123), keep `isLoading` (used on line 126), remove `session` selector.

Remove:
- Line 41: `const session = useAuthStore((s) => s.session)` — remove
- Line 76: `if (!session) { router.replace('/login'); return }` — remove
- Update useEffect dependency array on line 94: remove `session` and `router`, keep `isLoading` and `searchParams`

After cleanup, the useEffect becomes:
```tsx
useEffect(() => {
  if (isLoading) return

  // Detect OAuth callbacks via search params
  if (searchParams.get('shopify') === 'connected') {
    setShopifyConnected(true)
    setStep(3)
  }
  if (searchParams.get('gmail') === 'connected') {
    setGmailConnected(true)
    setStep(3)
  }
  const stepParam = searchParams.get('step')
  if (stepParam) {
    const parsed = parseInt(stepParam, 10)
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 4) {
      setStep(parsed)
    }
  }
}, [isLoading, searchParams])
```

- [ ] **Step 5: Clean up `app/(protected)/pricing-required/page.tsx`**

The useEffect at lines 77-84 does two things: (1) session redirect and (2) user name derivation. Remove only the session redirect. Keep `router` (used in sign-out handler on line 88). Remove `session` and `isLoading` selectors (not used elsewhere).

Remove:
- Line 73: `const session = useAuthStore((s) => s.session)` — remove
- Line 75: `const isLoading = useAuthStore((s) => s.isLoading)` — remove
- Line 78: `if (!isLoading && !session) { router.push('/login'); return }` — remove
- Update useEffect deps on line 84: remove `isLoading`, `session`, `router` — keep `user`

After cleanup:
```tsx
useEffect(() => {
  if (user) {
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>
    const raw = String(meta.name || meta.full_name || user.email?.split('@')[0] || '').split(/\s+/)[0]
    setFirstName(raw || '')
  }
}, [user])
```

- [ ] **Step 6: Run lint on all modified files**

Run: `cd /Users/dendy/Documents/Work/Lynq/lynq-dashboard && npx eslint app/\(protected\)/home/page.tsx app/\(protected\)/performance/page.tsx app/\(protected\)/inbox/create/page.tsx app/\(protected\)/onboarding/page.tsx app/\(protected\)/pricing-required/page.tsx`
Expected: No errors

---

### Task 5: Update the login page to support redirect param

**Files:**
- Modify: `app/login/page.tsx`

**Context:** Currently the login page hardcodes `router.push('/inbox')` on success (line 28). We need to:
1. Read `?redirect` from search params
2. Sanitize it (prevent open redirect)
3. Use it as the post-login destination
4. Also redirect already-authenticated users away from the login page

- [ ] **Step 1: Add `getSafeRedirect` helper and update the login page**

Add `useSearchParams` to the import from `next/navigation` (line 4). Add `useAuthStore` import. Add the helper function and update the sign-in success handler.

At the top of the file, add the helper (outside the component):
```tsx
function getSafeRedirect(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) {
    return '/inbox'
  }
  try {
    const url = new URL(raw, window.location.origin)
    return url.origin === window.location.origin ? url.pathname + url.search + url.hash : '/inbox'
  } catch {
    return '/inbox'
  }
}
```

Update React import on line 3 (add `useEffect`):
```tsx
import { useState, useEffect } from 'react'
```

Update imports on line 4:
```tsx
import { useRouter, useSearchParams } from 'next/navigation'
```

Add import for auth store:
```tsx
import { useAuthStore } from '@/stores/auth'
```

Inside `LoginPage`, after the existing state declarations (after line 18), add:
```tsx
const searchParams = useSearchParams()
const redirectTo = getSafeRedirect(searchParams.get('redirect'))
const session = useAuthStore((s) => s.session)
const isLoading = useAuthStore((s) => s.isLoading)
```

Add useEffect to redirect already-authenticated users (after the signIn hook):
```tsx
useEffect(() => {
  if (!isLoading && session) router.replace(redirectTo)
}, [isLoading, session, router, redirectTo])
```

Update the `onSuccess` handler on line 28:
```tsx
// Change from:
onSuccess: () => {
  router.push('/inbox')
},
// To:
onSuccess: () => {
  router.push(redirectTo)
},
```

- [ ] **Step 2: Run lint**

Run: `cd /Users/dendy/Documents/Work/Lynq/lynq-dashboard && npx eslint app/login/page.tsx`
Expected: No errors

---

### Task 6: Verify the full build compiles

**Files:** None (verification only)

- [ ] **Step 1: Run the linter across the whole project**

Run: `cd /Users/dendy/Documents/Work/Lynq/lynq-dashboard && npm run lint`
Expected: No errors (or only pre-existing warnings unrelated to our changes)

- [ ] **Step 2: Run the build**

Run: `cd /Users/dendy/Documents/Work/Lynq/lynq-dashboard && npm run build`
Expected: Build succeeds. Watch for any "page not found" or routing errors that would indicate a move went wrong.

---

### Task 7: Manual testing checklist

**Files:** None (testing only)

- [ ] **Test 1:** Visit `/inbox` while logged out → should redirect to `/login?redirect=%2Finbox`
- [ ] **Test 2:** Log in from that page → should land on `/inbox`
- [ ] **Test 3:** Visit `/login` directly and log in → should land on `/inbox` (default)
- [ ] **Test 4:** Visit `/login?redirect=https://evil.com` and log in → should land on `/inbox` (sanitized)
- [ ] **Test 5:** Visit `/login?redirect=//evil.com` and log in → should land on `/inbox` (sanitized)
- [ ] **Test 6:** Visit `/login?redirect=/\evil.com` and log in → should land on `/inbox` (sanitized)
- [ ] **Test 7:** Visit `/signup` while logged out → renders normally (public route)
- [ ] **Test 8:** Visit `/login?redirect=/invites/abc` and log in → should land on `/invites/abc`
- [ ] **Test 9:** Visit `/inbox?filter=unread` while logged out → redirect preserves query → after login, lands on `/inbox?filter=unread`
- [ ] **Test 10:** Visit `/login` while already logged in → immediately redirects to `/inbox`
- [ ] **Test 11:** Visit `/login?redirect=/analytics` while already logged in → immediately redirects to `/analytics`
