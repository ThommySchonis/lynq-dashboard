# Auth Guard with Login Redirect

**Date:** 2026-05-19
**Status:** Draft

## Problem

Protected routes use scattered `useEffect` blocks to check for a session and redirect to `/login`. The login page always redirects to `/inbox` after sign-in, ignoring the page the user originally tried to visit. The invite flow already constructs `/login?redirect=/invites/{token}` but the login page doesn't read it.

## Solution

A centralized `AuthGuard` component inside a `(protected)` route group layout. Unauthenticated users are redirected to `/login?redirect={originalPath}`, and the login page respects that param after successful sign-in.

## Design

### 1. AuthGuard Component

**File:** `components/shared/auth-guard.tsx`

A client component with a single responsibility: redirect unauthenticated users to login.

**Behavior:**
- Reads `session` and `isLoading` from `useAuthStore` (Zustand)
- Reads current path via `usePathname()` and query string via `useSearchParams()`
- Builds the full return URL: `pathname + (search ? '?' + search : '')` — so `/inbox?filter=unread` is preserved, not just `/inbox`
- `isLoading` → render nothing (same as current behavior — pages already return null while loading)
- `!isLoading && !session` → `router.replace('/login?redirect=' + encodeURIComponent(fullPath))`
- `!isLoading && session` → render `children`

**No business logic.** Trial/subscription blocking remains in `BlockedStateGuard` (root layout). This component only answers: "is there a session?"

**Interaction with BlockedStateGuard:** `BlockedStateGuard` runs in the root layout (above `AuthGuard`). When there is no session, `BlockedStateGuard` passes through — it only gates subscription/trial status for authenticated users. So the two guards do not conflict: `BlockedStateGuard` passes through unauthenticated requests, then `AuthGuard` catches them and redirects to login.

### 2. Route Group: `app/(protected)/`

Create `app/(protected)/layout.tsx` that wraps children with `AuthGuard`.

```tsx
import { AuthGuard } from '@/components/shared/auth-guard'

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>
}
```

**Move these routes into `app/(protected)/`:**

| Route | Current location |
|---|---|
| `home/` | `app/home/` |
| `inbox/` | `app/inbox/` |
| `analytics/` | `app/analytics/` |
| `performance/` | `app/performance/` |
| `settings/` | `app/settings/` |
| `services/` | `app/services/` |
| `supply-chain/` | `app/supply-chain/` |
| `time-tracking/` | `app/time-tracking/` |
| `value-feed/` | `app/value-feed/` |
| `academy/` | `app/academy/` |
| `onboarding/` | `app/onboarding/` |
| `pricing-required/` | `app/pricing-required/` |

**Public routes (stay outside):**

| Route | Reason |
|---|---|
| `login/` | Auth page |
| `signup/` | Auth page |
| `forgot-password/` | Auth page |
| `reset-password/` | Auth page |
| `invites/` | Pre-auth invite acceptance |
| `privacy/` | Static/legal page |
| `admin/` | Separate admin auth flow |
| `(admin-login)/` | Admin login |
| `lynq-admin/` | Admin panel |
| `api/` | API routes (server-side auth) |
| `sentry-example-page/` | Debug/monitoring |

The `(protected)` prefix is a Next.js route group — invisible in URLs. `/home` stays `/home`.

### 3. Login Page — Redirect Param Support

**File:** `app/login/page.tsx`

**Changes:**
- Read `redirect` from `useSearchParams()`
- After successful sign-in: `router.push(redirectTo)` where `redirectTo` is the sanitized redirect param, falling back to `/inbox`
- **Sanitization:** parse with `new URL()` to ensure the redirect stays on the same origin. Reject absolute URLs, `//`, backslash tricks, and any path that resolves to a different origin.

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

const searchParams = useSearchParams()
const redirectTo = getSafeRedirect(searchParams.get('redirect'))

// In handleSubmit onSuccess:
router.push(redirectTo)
```

- **Already-authenticated users:** If a user with an active session navigates to `/login`, the login page should detect this and redirect them immediately to `redirectTo` (or `/inbox`). This prevents a logged-in user from seeing the login form unnecessarily.

Signup flow is unchanged — always redirects to `/home`.

### 4. Cleanup — Remove Scattered Auth Checks

Remove the `useEffect` session-check-and-redirect blocks from these files (now redundant since the `(protected)` layout handles it):

| File | What to remove |
|---|---|
| `app/home/page.tsx` | `useEffect` that checks `!isLoading && !session` and pushes `/login` |
| `app/performance/page.tsx` | Same pattern |
| `app/inbox/create/page.tsx` | Same pattern |
| `app/onboarding/page.tsx` | `if (!session) router.replace('/login')` block |
| `app/pricing-required/page.tsx` | `if (!isLoading && !session) router.push('/login')` block (keep the sign-out redirect) |

Also remove any now-unused imports (`useRouter`, `useAuthStore`) from those files if they were only used for the auth redirect.

## Component Hierarchy (after)

```
RootLayout
  AuthHydrator          ← hydrates Zustand auth store
  ThemeSync
  QueryProvider
    BlockedStateGuard   ← trial/subscription gating (all routes)
      PageTransition
        (protected)/layout.tsx
          AuthGuard     ← session check + redirect (protected routes only)
            Page
```

## Testing

- Visit a protected route (e.g., `/inbox`) while logged out → should redirect to `/login?redirect=%2Finbox`
- Log in → should land on `/inbox`, not hardcoded default
- Visit `/login` directly and log in → should land on `/inbox` (default fallback)
- Visit `/login?redirect=https://evil.com` → should land on `/inbox` (sanitized away)
- Visit `/login?redirect=//evil.com` → should land on `/inbox` (sanitized away)
- Visit `/login?redirect=/\evil.com` → should land on `/inbox` (sanitized away)
- Visit a public route while logged out (e.g., `/signup`) → no redirect, renders normally
- Invite flow: `/login?redirect=/invites/{token}` → after login, lands on invite page
- Visit `/inbox?filter=unread` while logged out → redirect preserves query string → after login, lands on `/inbox?filter=unread`
- Visit `/login` while already logged in → immediately redirects to `/inbox`
- Visit `/login?redirect=/analytics` while already logged in → immediately redirects to `/analytics`
