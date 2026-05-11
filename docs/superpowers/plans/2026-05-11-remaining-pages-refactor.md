# Remaining Pages Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the final 16 legacy `.js` page files + `proxy.js` to TypeScript with Tailwind, shadcn, TanStack React Query, and Lucide icons — reaching 100% TypeScript.

**Architecture:** Shared infrastructure first (auth layout, floating inputs, auth hooks), then pages in dependency order from simplest to most complex. Hooks and utility functions extracted; small page-specific sub-components stay inline.

**Tech Stack:** Next.js 16 (app router), React 19, TypeScript, TanStack React Query, Zustand (existing stores only), Tailwind CSS, shadcn/base-ui, Lucide icons, Supabase client SDK, Sonner (toasts).

**Spec:** `docs/superpowers/specs/2026-05-11-remaining-pages-refactor-design.md`

**Reference implementations:**
- Admin hooks pattern: `hooks/admin/use-admin-data.ts`, `hooks/admin/use-admin-mutations.ts`
- Admin barrel export: `hooks/admin/index.ts`
- Auth store: `stores/auth.ts` — `useAuthStore((s) => s.session?.access_token ?? '')`
- Existing inbox hooks: `hooks/inbox/use-inbox-data.ts`, `hooks/inbox/use-inbox-mutations.ts`
- Existing inbox utils: `lib/inbox-utils.ts` (has `authFetch`, `sanitizeHtml`, `plainTextToSafeHtml`, `normalizeSafeUrl`, `fmtDate`, `relTime`)
- Existing value-feed component: `components/features/value-feed/post-card.tsx`
- Existing globals keyframes: `app/globals.css` lines 260-360 (`shimmer`, `orbFloat1`–`orbFloat4`, `fadeInUp`)
- shadcn components: `components/ui/dialog.tsx` (base-ui, NOT Radix), `components/ui/button.tsx`, `components/ui/input.tsx`

---

## Task 1: CSS Keyframes & Float Field Rule

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Add new keyframes to globals.css**

Add the following after the existing `@keyframes fadeInUp` block (around line 360). Read the source pages to extract exact timing values:

```css
/* ── Auth page animations ─────────────────────────────────────────────── */
@keyframes wordReveal {
  from { opacity: 0; transform: translateY(20px); filter: blur(10px); }
  to   { opacity: 1; transform: translateY(0); filter: blur(0); }
}

@keyframes dotBounce {
  0%, 80%, 100% { transform: translateY(0); }
  40% { transform: translateY(-6px); }
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

@keyframes auroraBlob {
  0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.3; }
  33%      { transform: translate(100px, -50px) scale(1.2); opacity: 0.5; }
  66%      { transform: translate(-80px, 60px) scale(0.9); opacity: 0.35; }
}

/* ── Float field label transition ─────────────────────────────────────── */
.float-field:not(:placeholder-shown) ~ .float-label,
.float-field:focus ~ .float-label {
  transform: translateY(-1.25rem) scale(0.85);
  color: var(--text-4);
}
```

- [ ] **Step 2: Verify build**

Run: `npx next build 2>&1 | tail -20`
Expected: Build succeeds.

---

## Task 2: Auth Constants & Date Utils

**Files:**
- Create: `lib/auth-constants.ts`
- Create: `lib/date-utils.ts`

- [ ] **Step 1: Create auth constants**

Read `app/signup/page.js` for the exact password strength logic (the `passwordStrength()` function and `STRENGTH_META` array), and `app/login/page.js` for word reveal animation timing.

```typescript
// lib/auth-constants.ts
import type { LucideIcon } from 'lucide-react'
import { Check } from 'lucide-react'

// ── Password strength ──
export const PASSWORD_MIN = 8

export function calcPasswordStrength(pw: string): number {
  if (!pw) return 0
  let score = 0
  if (pw.length >= PASSWORD_MIN) score++
  if (pw.length >= 12) score++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^a-zA-Z0-9]/.test(pw)) score++
  return Math.min(score, 4)
}

export const STRENGTH_COLORS = ['bg-red-500', 'bg-orange-500', 'bg-yellow-400', 'bg-green-500']
export const STRENGTH_LABELS = ['Weak', 'Fair', 'Good', 'Strong']
export const STRENGTH_BG_IDLE = 'bg-white/10'

// ── Trust items (signup) ──
export interface TrustItem {
  icon: LucideIcon
  text: string
}

export const TRUST_ITEMS: TrustItem[] = [
  { icon: Check, text: 'No credit card' },
  { icon: Check, text: '7-day trial' },
  { icon: Check, text: 'Cancel anytime' },
]

// ── Animation ──
export const WORD_REVEAL_DELAY_MS = 120
```

- [ ] **Step 2: Create shared date utils**

Read `app/lynq-admin/feedback/page.js` for the `timeAgo()` function, and `app/value-feed/page.js` for `fmtDate()` and `timeUntil()`.

```typescript
// lib/date-utils.ts

/** Relative time: "just now", "3m ago", "2h ago", "5d ago", "2mo ago", "1y ago" */
export function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = Math.max(0, now - then)
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

/** Format date: "Jan 15, 2026"
 * Note: Similar fmtDate functions exist in lib/inbox-utils.ts, lib/analytics-constants.ts,
 * lib/supply-chain-constants.ts, lib/time-tracking-constants.ts. Consolidating those imports
 * to use this shared version is deferred — out of scope for this migration. */
export function fmtDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/** Time remaining until a future date: "in 2 days", "in 3 hours", "soon" */
export function timeUntil(dateStr: string): string {
  const now = Date.now()
  const target = new Date(dateStr).getTime()
  const diff = target - now
  if (diff <= 0) return 'now'
  const hours = Math.floor(diff / 3_600_000)
  if (hours < 1) return 'soon'
  if (hours < 24) return `in ${hours}h`
  const days = Math.floor(hours / 24)
  return `in ${days}d`
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors from the new files.

---

## Task 3: FloatField Component

**Files:**
- Create: `components/features/auth/float-field.tsx`

- [ ] **Step 1: Create FloatField**

Read `app/login/page.js` and `app/signup/page.js` for the `FloatField` sub-component and its CSS (`.field-input`, `.field-label`, `.field-wrap`). Port to Tailwind + shadcn Input.

```typescript
// components/features/auth/float-field.tsx
'use client'

import { forwardRef } from 'react'
import { Input } from '@/components/ui/input'

interface FloatFieldProps extends Omit<React.ComponentProps<typeof Input>, 'placeholder'> {
  label: string
  error?: string
}

export const FloatField = forwardRef<HTMLInputElement, FloatFieldProps>(
  function FloatField({ label, error, className, ...props }, ref) {
    return (
      <div className="relative">
        <Input
          ref={ref}
          placeholder=" "
          className={`
            float-field peer h-[54px] rounded-xl pt-5 pb-1.5 px-4
            bg-white/[0.06] border-white/[0.12] text-white text-[15px]
            focus:border-white/30 focus:ring-0 transition-colors
            ${error ? 'border-red-400' : ''}
            ${className ?? ''}
          `}
          {...props}
        />
        <label className="float-label pointer-events-none absolute left-4 top-4 text-[13px] text-white/50 transition-all duration-200">
          {label}
        </label>
        {error && (
          <p className="mt-1 text-xs text-red-400">{error}</p>
        )}
      </div>
    )
  }
)
```

**Note:** The `float-field` and `float-label` classes connect to the CSS rule added in Task 1 (`:placeholder-shown` technique). The `peer` class is a Tailwind alternative but we use the explicit class names for the CSS rule to work.

- [ ] **Step 2: Verify build**

Run: `npx next build 2>&1 | tail -20`

---

## Task 4: PasswordField Component

**Files:**
- Create: `components/features/auth/password-field.tsx`

- [ ] **Step 1: Create PasswordField**

Read `app/signup/page.js` for the password visibility toggle and strength meter patterns.

```typescript
// components/features/auth/password-field.tsx
'use client'

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { FloatField } from './float-field'
import { calcPasswordStrength, STRENGTH_COLORS, STRENGTH_LABELS, STRENGTH_BG_IDLE } from '@/lib/auth-constants'

interface PasswordFieldProps extends Omit<React.ComponentProps<typeof FloatField>, 'type'> {
  showStrength?: boolean
}

export function PasswordField({ showStrength = false, value, ...props }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false)
  const strength = showStrength && typeof value === 'string' ? calcPasswordStrength(value) : 0

  return (
    <div>
      <div className="relative">
        <FloatField
          {...props}
          value={value}
          type={visible ? 'text' : 'password'}
          className={`pr-12 ${props.className ?? ''}`}
        />
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
          tabIndex={-1}
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {showStrength && typeof value === 'string' && value.length > 0 && (
        <div className="mt-2">
          <div className="flex gap-1">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`h-[3px] flex-1 rounded-full transition-colors duration-200 ${
                  i < strength ? STRENGTH_COLORS[strength - 1] : STRENGTH_BG_IDLE
                }`}
              />
            ))}
          </div>
          {strength > 0 && (
            <p className="mt-1 text-[11px] text-white/50">{STRENGTH_LABELS[strength - 1]}</p>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `npx next build 2>&1 | tail -20`

---

## Task 5: AuthLayout Component

**Files:**
- Create: `public/textures/noise.svg`
- Create: `components/features/auth/auth-layout.tsx`

- [ ] **Step 1: Extract noise texture SVG**

The login/signup pages use an inline SVG noise texture as a background. Per CLAUDE.md rules, extract it to a separate file:

```bash
mkdir -p public/textures
```

Create `public/textures/noise.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <filter id="n">
    <feTurbulence type="fractalNoise" baseFrequency=".65" numOctaves="3" stitchTiles="stitch"/>
  </filter>
  <rect width="100%" height="100%" filter="url(#n)" opacity=".08"/>
</svg>
```

- [ ] **Step 2: Create AuthLayout**

Read `app/login/page.js` for the full page layout: 3 orbs, noise texture overlay, glassmorphism card, wordmark, gradient divider, footer links. Port inline styles → Tailwind. Reuse existing `orbFloat1`–`orbFloat4` keyframes from `globals.css`. Reference the noise texture from `public/textures/noise.svg` via URL (not inline).

```typescript
// components/features/auth/auth-layout.tsx
'use client'

import type { ReactNode } from 'react'

interface AuthLayoutProps {
  headline: ReactNode
  subhead?: string
  footer?: ReactNode
  children: ReactNode
  showOrbs?: boolean
  maxWidth?: string
}

export function AuthLayout({
  headline,
  subhead,
  footer,
  children,
  showOrbs = true,
  maxWidth = 'max-w-md',
}: AuthLayoutProps) {
  return (
    <div className="relative min-h-screen flex items-center justify-center bg-[#1C0F36] overflow-hidden font-[Switzer]">
      {/* Noise overlay — references public/textures/noise.svg */}
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-40 bg-repeat"
        style={{ backgroundImage: "url('/textures/noise.svg')" }}
      />

      {/* Orbs */}
      {showOrbs && (
        <>
          <div className="pointer-events-none fixed top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full opacity-30 blur-[80px] animate-[orbFloat1_75s_ease-in-out_infinite]"
            style={{ background: 'radial-gradient(circle, #7F77DD 0%, transparent 70%)' }}
          />
          <div className="pointer-events-none fixed bottom-[-15%] right-[-10%] w-[500px] h-[500px] rounded-full opacity-25 blur-[80px] animate-[orbFloat2_65s_ease-in-out_infinite]"
            style={{ background: 'radial-gradient(circle, #6366F1 0%, transparent 70%)' }}
          />
          <div className="pointer-events-none fixed top-[30%] right-[15%] w-[400px] h-[400px] rounded-full opacity-20 blur-[80px] animate-[orbFloat3_85s_ease-in-out_infinite]"
            style={{ background: 'radial-gradient(circle, #A78BFA 0%, transparent 70%)' }}
          />
        </>
      )}

      {/* Card */}
      <div className={`relative z-10 w-full ${maxWidth} mx-4`}>
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl p-10 shadow-2xl">
          {/* Wordmark */}
          <div className="flex justify-center mb-6">
            <img
              src="/lynq-wordmark.svg"
              alt="Lynq"
              className="h-6 brightness-0 invert opacity-80"
            />
          </div>

          {/* Headline */}
          <div className="text-center mb-2">
            <h1 className="text-[28px] font-semibold text-white leading-tight">
              {headline}
            </h1>
            {subhead && (
              <p className="mt-2 text-[14px] text-white/50">{subhead}</p>
            )}
          </div>

          {/* Gradient divider */}
          <div className="mx-auto my-6 h-px w-3/4 bg-gradient-to-r from-transparent via-white/20 to-transparent" />

          {/* Form content */}
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="mt-6 text-center text-[13px] text-white/40">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
```

**Important:** Read `app/login/page.js` to verify exact orb positions, sizes, gradients, and animation durations. Adjust Tailwind classes to match. Check if `/lynq-wordmark.svg` exists in `public/` — if a different logo path is used, update accordingly.

- [ ] **Step 3: Verify build**

Run: `npx next build 2>&1 | tail -20`

---

## Task 6: Auth Hooks

**Files:**
- Create: `hooks/auth/use-auth-data.ts`
- Create: `hooks/auth/use-auth-mutations.ts`
- Create: `hooks/auth/index.ts`

- [ ] **Step 1: Create query hooks**

Follow the pattern from `hooks/admin/use-admin-data.ts`.

```typescript
// hooks/auth/use-auth-data.ts
'use client'

import { useQuery } from '@tanstack/react-query'

export const authKeys = {
  invite: (token: string) => ['invite', token] as const,
}

interface InviteDetails {
  email: string
  role: string
  workspace_name: string
  inviter_name: string
  expires_at: string
}

export function useInviteDetails(token: string) {
  return useQuery<InviteDetails>({
    queryKey: authKeys.invite(token),
    queryFn: async () => {
      const res = await fetch(`/api/invites/${token}`)
      if (!res.ok) throw new Error('Invalid or expired invite')
      return res.json()
    },
    enabled: !!token,
    retry: false,
  })
}
```

- [ ] **Step 2: Create mutation hooks**

Read `app/login/page.js` (`supabase.auth.signInWithPassword`), `app/signup/page.js` (`supabase.auth.signUp` with `user_metadata`), `app/forgot-password/page.js` (`supabase.auth.resetPasswordForEmail`), `app/reset-password/page.js` (`supabase.auth.updateUser`), `app/invites/[token]/page.js` (accept POST), `app/invites/[token]/signup/page.js` (signup POST + auto sign-in).

```typescript
// hooks/auth/use-auth-mutations.ts
'use client'

import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'

// ── Sign In ──
interface SignInInput { email: string; password: string }

export function useSignIn() {
  return useMutation({
    mutationFn: async ({ email, password }: SignInInput) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
    },
  })
}

// ── Sign Up ──
interface SignUpInput {
  email: string
  password: string
  firstName: string
  lastName: string
  companyName: string
}

export function useSignUp() {
  return useMutation({
    mutationFn: async ({ email, password, firstName, lastName, companyName }: SignUpInput) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            company_name: companyName,
          },
        },
      })
      if (error) throw error
      return data
    },
  })
}

// ── Reset Password Request ──
export function useResetPasswordRequest() {
  return useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) throw error
    },
  })
}

// ── Reset Password (set new) ──
export function useResetPassword() {
  return useMutation({
    mutationFn: async (password: string) => {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
    },
  })
}

// ── Sign Out ──
export function useSignOut() {
  return useMutation({
    mutationFn: async () => {
      await supabase.auth.signOut()
    },
    onSuccess: () => {
      // Clear Zustand auth store to prevent stale user/workspace data
      useAuthStore.getState().clearSession()
    },
  })
}

// ── Accept Invite ──
export function useAcceptInvite(token: string) {
  return useMutation({
    mutationFn: async () => {
      const session = useAuthStore.getState().session
      const res = await fetch(`/api/invites/${token}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Failed to accept invite')
      }
      return res.json()
    },
  })
}

// ── Invite Signup ──
interface InviteSignupInput {
  fullName: string
  password: string
}

export function useInviteSignup(token: string) {
  return useMutation({
    mutationFn: async ({ fullName, password }: InviteSignupInput) => {
      const res = await fetch(`/api/invites/${token}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: fullName, password }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? body.code ?? 'Signup failed')
      return body
    },
  })
}
```

**Important:** Read each source page to verify exact Supabase SDK calls, redirect URLs, and error handling patterns. The `useAcceptInvite` accesses auth store directly via `getState()` since it's inside a mutation function.

- [ ] **Step 3: Create barrel export**

```typescript
// hooks/auth/index.ts
export * from './use-auth-data'
export * from './use-auth-mutations'
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

---

## Task 7: Login Page

**Files:**
- Create: `app/login/page.tsx`
- Delete: `app/login/page.js`

- [ ] **Step 1: Create login page**

Read `app/login/page.js` in full. Port to TypeScript + Tailwind + shared auth components. Key elements:
- `AuthLayout` with word-by-word headline reveal
- `FloatField` for email
- `PasswordField` (no strength meter)
- Error alert banner
- shadcn `Button` for CTA (gradient background via className)
- Footer links to `/signup` and `/forgot-password`
- `useSignIn()` mutation → `router.push('/inbox')` on success

The word reveal pattern uses spans with staggered `animationDelay`:
```tsx
<span className="inline-block opacity-0 animate-[wordReveal_800ms_cubic-bezier(0.16,1,0.3,1)_forwards]" style={{ animationDelay: '0ms' }}>
  Welcome
</span>
```

Read the source page for the exact headline words and footer link text.

- [ ] **Step 2: Delete old file**

```bash
rm app/login/page.js
```

- [ ] **Step 3: Verify build**

Run: `npx next build 2>&1 | tail -20`
Expected: Build succeeds. `/login` renders correctly.

---

## Task 8: Signup Page

**Files:**
- Create: `app/signup/page.tsx`
- Delete: `app/signup/page.js`

- [ ] **Step 1: Create signup page**

Read `app/signup/page.js` in full. Port to TypeScript + Tailwind. Key elements:
- `AuthLayout` with word reveal headline
- 6 `FloatField`s: email, first name + last name (2-col grid), company, `PasswordField` with `showStrength`
- Inline `TrustItem` sub-component rendering `TRUST_ITEMS` from constants
- `VerifyPanel` inline sub-component (glassmorphism card with ✉️ emoji)
- `useSignUp()` mutation
- Two states: `pending === null` (form) vs `pending === 'verify'` (verification panel)

Read the source for exact field order, grid layout, and verify panel styling.

- [ ] **Step 2: Delete old file**

```bash
rm app/signup/page.js
```

- [ ] **Step 3: Verify build**

Run: `npx next build 2>&1 | tail -20`

---

## Task 9: Forgot Password Page

**Files:**
- Create: `app/forgot-password/page.tsx`
- Delete: `app/forgot-password/page.js`

- [ ] **Step 1: Create forgot-password page**

Read `app/forgot-password/page.js` in full. Port to TypeScript + Tailwind. Key elements:
- `AuthLayout` with `showOrbs={false}`
- Single email `FloatField`
- Error banner (red text)
- Two states: form vs "Check your email" success (with ✉️ emoji)
- `useResetPasswordRequest()` mutation
- Footer: link back to `/login`

Read the source for the `AuthShell` rendering pattern (headline text, subhead, etc.) and re-implement using `AuthLayout`.

- [ ] **Step 2: Delete old file**

```bash
rm app/forgot-password/page.js
```

- [ ] **Step 3: Verify build**

Run: `npx next build 2>&1 | tail -20`

---

## Task 10: Reset Password Page

**Files:**
- Create: `app/reset-password/page.tsx`
- Delete: `app/reset-password/page.js`

- [ ] **Step 1: Create reset-password page**

Read `app/reset-password/page.js` in full. Port to TypeScript + Tailwind. Key elements:
- `AuthLayout`
- `useEffect` on mount: `supabase.auth.onAuthStateChange()` listening for `PASSWORD_RECOVERY` event, with cleanup and `cancelled` flag for race condition protection
- 3 states via `sessionValid: null | false | true`:
  - `null` → loading spinner
  - `false` → "Link expired" + "Request new link" button (links to `/forgot-password`)
  - `true` → password form
- 2x `PasswordField`, client-side validation: "Passwords don't match"
- `useResetPassword()` mutation → success state → `router.push('/login')` after 1.5s timeout
- Read the source for the exact auth state change handler and session validation logic

- [ ] **Step 2: Delete old file**

```bash
rm app/reset-password/page.js
```

- [ ] **Step 3: Verify build**

Run: `npx next build 2>&1 | tail -20`

---

## Task 11: InviteLayout Component

**Files:**
- Create: `components/features/auth/invite-layout.tsx`

- [ ] **Step 1: Create InviteLayout**

Read `app/invites/[token]/page.js` for the card layout (light theme, gradient top border). Port to Tailwind.

```typescript
// components/features/auth/invite-layout.tsx
'use client'

import type { ReactNode } from 'react'
import { Loader } from 'lucide-react'

interface InviteLayoutProps {
  children: ReactNode
  loading?: boolean
}

export function InviteLayout({ children, loading = false }: InviteLayoutProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F7FA] p-4 font-[Switzer]">
      <div className="w-full max-w-[440px]">
        {/* Wordmark */}
        <div className="flex justify-center mb-8">
          <img src="/lynq-wordmark.svg" alt="Lynq" className="h-6 opacity-70" />
        </div>

        {/* Card */}
        <div className="relative rounded-2xl bg-white shadow-lg overflow-hidden">
          {/* Gradient top border */}
          <div className="h-1 bg-gradient-to-r from-[#8B5CF6] via-[#6366F1] to-[#8B5CF6]" />

          <div className="p-8">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader className="h-6 w-6 animate-spin text-[#8B5CF6]" />
                <p className="mt-3 text-sm text-gray-500">Loading invite...</p>
              </div>
            ) : (
              children
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
```

**Important:** Read the source pages to verify exact card styling (padding, shadow, border-radius, gradient colors). Adjust as needed.

- [ ] **Step 2: Verify build**

Run: `npx next build 2>&1 | tail -20`

---

## Task 12: Invite Accept Page

**Files:**
- Create: `app/invites/[token]/page.tsx`
- Delete: `app/invites/[token]/page.js`

- [ ] **Step 1: Create invite accept page**

Read `app/invites/[token]/page.js` in full. Port to TypeScript + Tailwind. Key elements:
- `InviteLayout`
- Access `token` via page props: `use(params).token` (React 19 `use()` hook — check how other `[param]` pages in the project access dynamic params, e.g., `app/settings/workspace/macros/[id]/page.tsx`)
- `useInviteDetails(token)` hook for invite metadata
- `supabase.auth.getSession()` in `useEffect` to determine auth state
- 3-path flow (no session / email match / email mismatch) — read source for exact rendering logic per state
- `useAcceptInvite(token)` mutation → `router.push('/inbox')` on success
- Detail panel: Lucide `Building2` icon, role badge, inviter name, validity via `expiryText()` helper (inline)
- Success state: Lucide `Check` icon in green circle
- Styling: shadcn `Button` for primary/secondary actions

- [ ] **Step 2: Delete old file**

```bash
rm "app/invites/[token]/page.js"
```

- [ ] **Step 3: Verify build**

Run: `npx next build 2>&1 | tail -20`

---

## Task 13: Invite Signup Page

**Files:**
- Create: `app/invites/[token]/signup/page.tsx`
- Delete: `app/invites/[token]/signup/page.js`

- [ ] **Step 1: Create invite signup page**

Read `app/invites/[token]/signup/page.js` in full. Port to TypeScript + Tailwind. Key elements:
- `InviteLayout`
- `useInviteDetails(token)` to validate token + get locked email
- Locked email `FloatField` (add `readOnly` + `disabled` + gray styling via className)
- Name `FloatField`, `PasswordField` + confirm `PasswordField`
- Local state for form + field errors + banner error
- Client validation: name required, password 8+ chars, passwords match
- Server error mapping: `email_exists`, `weak_password`, `expired`, `name_required`
- `useInviteSignup(token)` mutation → on success: `supabase.auth.signInWithPassword()` → `router.push('/')`
- Success state with checkmark + "Redirecting..." text
- Footer: "Already have an account?" link to `/login`

Read the source for exact validation logic and error display patterns.

- [ ] **Step 2: Delete old file**

```bash
rm "app/invites/[token]/signup/page.js"
```

- [ ] **Step 3: Verify build**

Run: `npx next build 2>&1 | tail -20`

---

## Task 14: Simple Pages (Performance, Privacy, Lynq Admin Layout)

**Files:**
- Create: `app/performance/page.tsx`
- Delete: `app/performance/page.js`
- Create: `app/privacy/page.tsx`
- Delete: `app/privacy/page.js`
- Create: `app/lynq-admin/layout.tsx`
- Delete: `app/lynq-admin/layout.js`

- [ ] **Step 1: Create performance page**

Read `app/performance/page.js` (35 lines). Port to TypeScript + Tailwind. Simple page: session check in `useEffect`, renders `<EmptyState>` component. Check if `EmptyState` is already a shared component in `components/shared/` or if it's imported from elsewhere. Read the source for exact props passed (icon emoji, title, description, action buttons).

- [ ] **Step 2: Create privacy page**

Read `app/privacy/page.js` (120 lines). Port to TypeScript + Tailwind. Static content page with 8 sections. Port the inline `Section` sub-component and all text content. Dark theme (#1C0F36 bg). Logo at top.

- [ ] **Step 3: Create lynq-admin layout**

Read `app/lynq-admin/layout.js` (28 lines). Port to TypeScript + Tailwind. Flex wrapper importing `AdminSidebar` (already TypeScript) + `{children}`.

- [ ] **Step 4: Delete old files**

```bash
rm app/performance/page.js app/privacy/page.js app/lynq-admin/layout.js
```

- [ ] **Step 5: Verify build**

Run: `npx next build 2>&1 | tail -20`

---

## Task 15: Pricing Required Page

**Files:**
- Create: `lib/pricing-constants.ts`
- Create: `app/pricing-required/page.tsx`
- Delete: `app/pricing-required/page.js`

- [ ] **Step 1: Create pricing constants**

Read `app/pricing-required/page.js` for the `PLANS` array (4 plan objects with name, price, tickets, highlighted flag, badge).

```typescript
// lib/pricing-constants.ts
export interface PricingPlan {
  name: string
  price: string
  ticketLimit: string
  highlighted: boolean
  badge?: string
}

export const PRICING_PLANS: PricingPlan[] = [
  // Extract exact values from app/pricing-required/page.js PLANS array
]
```

- [ ] **Step 2: Create pricing-required page**

Port `app/pricing-required/page.js` to TypeScript + Tailwind. Key elements:
- Session check for `firstName` from `user.user_metadata`
- `useSignOut()` from auth hooks
- Greeting: "Welcome back, {firstName}"
- 4-column responsive grid of `PlanCard` (inline sub-component)
- "Most popular" badge on highlighted plan (gold border + shadow)
- Each card: plan name, price "/mo", ticket count, CTA button → `/settings/billing`
- Bottom: Enterprise link, data retention message, logout link
- Gradient background (#F9F9FF → #F1EEF5)

Read the source for exact styling values.

- [ ] **Step 3: Delete old file**

```bash
rm app/pricing-required/page.js
```

- [ ] **Step 4: Verify build**

Run: `npx next build 2>&1 | tail -20`

---

## Task 16: Value Feed Utils & Hooks

**Files:**
- Create: `lib/value-feed-utils.ts`
- Create: `hooks/value-feed/use-value-feed-data.ts`
- Create: `hooks/value-feed/index.ts`

- [ ] **Step 1: Create value-feed utils**

Read `app/value-feed/page.js` for `googleCalUrl()`, `initialsOf()`, `classifyBroadcast()`. Note: `fmtDate` and `timeUntil` are already in `lib/date-utils.ts`.

```typescript
// lib/value-feed-utils.ts

export type FeedItemKind = 'tip' | 'masterclass' | 'update'

export interface FeedItem {
  id: string
  kind: FeedItemKind
  title: string
  body?: string
  created_at: string
  pinned?: boolean
  // Masterclass-specific
  speaker_name?: string
  scheduled_at?: string
  zoom_url?: string
  youtube_url?: string
}

export function googleCalUrl(title: string, start: string, durationMinutes: number): string {
  // Read app/value-feed/page.js for exact implementation
  // Generates: https://calendar.google.com/calendar/render?action=TEMPLATE&...
}

export function initialsOf(name: string): string {
  // Read source for exact logic (first letters of first 2 words)
}

export function classifyBroadcast(broadcast: Record<string, unknown>): FeedItem {
  // Read source for exact classification logic (type === 'update' ? 'update' : 'tip')
}
```

- [ ] **Step 2: Create value-feed hook**

```typescript
// hooks/value-feed/use-value-feed-data.ts
'use client'

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { FeedItem } from '@/lib/value-feed-utils'
import { classifyBroadcast } from '@/lib/value-feed-utils'

export const valueFeedKeys = {
  all: ['value-feed'] as const,
  feed: () => [...valueFeedKeys.all, 'feed'] as const,
}

export function useValueFeed() {
  return useQuery<FeedItem[]>({
    queryKey: valueFeedKeys.feed(),
    queryFn: async () => {
      const [broadcastRes, masterclassRes] = await Promise.all([
        supabase.from('broadcasts').select('*').order('created_at', { ascending: false }),
        supabase.from('masterclasses').select('*')
          .gte('scheduled_at', new Date().toISOString())
          .order('scheduled_at', { ascending: true }),
      ])
      const broadcasts = (broadcastRes.data ?? []).map(classifyBroadcast)
      const masterclasses: FeedItem[] = (masterclassRes.data ?? []).map((m) => ({
        id: m.id,
        kind: 'masterclass' as const,
        title: m.title,
        body: m.description,
        created_at: m.created_at,
        speaker_name: m.speaker_name,
        scheduled_at: m.scheduled_at,
        zoom_url: m.zoom_url,
        youtube_url: m.youtube_url,
      }))
      // Sort: masterclasses first, then pinned, then by created_at desc
      return [...masterclasses, ...broadcasts.filter(b => b.pinned), ...broadcasts.filter(b => !b.pinned)]
    },
  })
}
```

Read the source to verify exact Supabase query columns and sort logic.

- [ ] **Step 3: Create barrel export**

```typescript
// hooks/value-feed/index.ts
export * from './use-value-feed-data'
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

---

## Task 17: Value Feed Page

**Files:**
- Create: `app/value-feed/page.tsx`
- Delete: `app/value-feed/page.js`

- [ ] **Step 1: Create value-feed page**

Read `app/value-feed/page.js` in full. Port to TypeScript + Tailwind. Key elements:
- `useValueFeed()` hook for data
- Reuse existing `PostCard` from `components/features/value-feed/post-card.tsx` — read its props interface
- Filter tabs: All, Tips, Masterclasses, Updates (read source for exact category names and count logic)
- Orb backgrounds (reuse `orbFloat` keyframes)
- Inline `Skeleton` sub-component for loading state (or use shadcn `Skeleton`)
- Inline `EmptyState` sub-component for no results
- Date formatting via `fmtDate()` and `timeUntil()` from `lib/date-utils.ts`
- Masterclass cards with speaker initials via `initialsOf()` from `lib/value-feed-utils.ts`
- Google Calendar URLs via `googleCalUrl()` from `lib/value-feed-utils.ts`
- No auth required (public page)

Read the source for exact filter logic (how `filter` state maps to `kind` filtering).

- [ ] **Step 2: Delete old file**

```bash
rm app/value-feed/page.js
```

- [ ] **Step 3: Verify build**

Run: `npx next build 2>&1 | tail -20`

---

## Task 18: Services Constants & Hooks

**Files:**
- Create: `lib/services-constants.ts`
- Create: `hooks/services/use-services-mutations.ts`
- Create: `hooks/services/index.ts`

- [ ] **Step 1: Create services constants**

Read `app/services/page.js` for the `SERVICES` array (5 services), `TRAIN_SERVICE`, and `GUARANTEE_ITEMS`. Map the inline SVG icon functions to Lucide icon equivalents.

```typescript
// lib/services-constants.ts
import type { LucideIcon } from 'lucide-react'
import { Headphones, ShieldCheck, Package, BarChart2, GraduationCap } from 'lucide-react'

// Extended from spec — extra fields (id, iconBg, iconColor, topGradient)
// are needed for card rendering (each service card has unique colors/gradients)
export interface ServiceDef {
  id: string
  icon: LucideIcon
  title: string
  description: string
  features: string[]
  guarantee: string[]
  badge?: string
  iconBg: string
  iconColor: string
  topGradient: string
}

export const SERVICES: ServiceDef[] = [
  // Extract exact values from app/services/page.js SERVICES + TRAIN_SERVICE arrays
  // Map mkIcon('headset') → Headphones, etc.
]

export const GUARANTEE_ITEMS: string[] = [
  // Extract from source
]
```

Read the source for exact values, colors, and gradient strings.

- [ ] **Step 2: Create services mutation hook**

```typescript
// hooks/services/use-services-mutations.ts
'use client'

import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

interface InquiryInput {
  serviceTitle: string
  phone: string
  message?: string
  userId: string
  userEmail: string
}

export function useSubmitInquiry() {
  return useMutation({
    mutationFn: async ({ serviceTitle, phone, message, userId, userEmail }: InquiryInput) => {
      const { error } = await supabase.from('service_inquiries').insert({
        service: serviceTitle,
        phone,
        message: message || null,
        user_id: userId,
        email: userEmail,
      })
      if (error) throw error
    },
  })
}
```

Read the source to verify exact table name and column names.

- [ ] **Step 3: Create barrel export**

```typescript
// hooks/services/index.ts
export * from './use-services-mutations'
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

---

## Task 19: Services Page

**Files:**
- Create: `app/services/page.tsx`
- Delete: `app/services/page.js`

- [ ] **Step 1: Create services page**

Read `app/services/page.js` in full. Port to TypeScript + Tailwind + shadcn. Key elements:
- Session check for `userId` + `userEmail`
- Service card grid (2-column + 1 full-width training card) from `SERVICES` constant
- Each card: Lucide icon (from `ServiceDef`), title, badge, description, features list, guarantee block, "Request More Info" button
- Inquiry modal: shadcn `Dialog` with phone input (required) + message textarea (optional)
- Success state inside modal (checkmark + "We'll be in touch")
- `useSubmitInquiry()` mutation
- Sonner `toast` for error notifications
- Escape key closes modal
- Inline `ServiceCard` and `InquiryForm` sub-components

Read the source for exact card layout, gradient colors, guarantee block styling.

- [ ] **Step 2: Delete old file**

```bash
rm app/services/page.js
```

- [ ] **Step 3: Verify build**

Run: `npx next build 2>&1 | tail -20`

---

## Task 20: Onboarding Hooks & Page

**Files:**
- Create: `hooks/onboarding/use-onboarding-mutations.ts`
- Create: `hooks/onboarding/index.ts`
- Create: `app/onboarding/page.tsx`
- Delete: `app/onboarding/page.js`

- [ ] **Step 1: Create onboarding mutation hooks**

Read `app/onboarding/page.js` for the `saveBrandSetup()`, `connectParcelPanel()`, and `finishOnboarding()` functions.

```typescript
// hooks/onboarding/use-onboarding-mutations.ts
'use client'

import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'

function useToken() {
  return useAuthStore((s) => s.session?.access_token ?? '')
}

interface BrandSetupInput {
  brandName: string
  language: string
  tone: string
}

export function useSaveBrand() {
  const token = useToken()
  return useMutation({
    mutationFn: async (input: BrandSetupInput) => {
      const res = await fetch('/api/settings/brand', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(input),
      })
      if (!res.ok) throw new Error('Failed to save brand settings')
    },
  })
}

export function useConnectParcelPanel() {
  const token = useToken()
  return useMutation({
    mutationFn: async (apiKey: string) => {
      const res = await fetch('/api/settings/integrations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ provider: 'parcelpanel', api_key: apiKey }),
      })
      if (!res.ok) throw new Error('Connection failed')
      return res.json()
    },
  })
}

export function useCompleteOnboarding() {
  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from('profiles')
        .upsert({ id: userId, onboarding_completed: true })
      if (error) throw error
    },
  })
}
```

Read the source to verify exact API endpoints, request bodies, and Supabase calls.

- [ ] **Step 2: Create barrel export**

```typescript
// hooks/onboarding/index.ts
export * from './use-onboarding-mutations'
```

- [ ] **Step 3: Create onboarding page**

Read `app/onboarding/page.js` in full. Port to TypeScript + Tailwind. Key elements:
- Session check → redirect to `/login`
- 4-step wizard with `useState` for `step` (1-4) and form fields
- Step 1: Welcome emoji + headline + continue button
- Step 2: Brand name input, language select (shadcn `Select`), tone radio buttons (card style with examples)
- Step 3: 3-column grid of connect cards (Gmail, Shopify, ParcelPanel) — Gmail/Shopify use OAuth redirects, ParcelPanel uses API key input
- Step 4: Success checkmark + "You're all set!" + continue to dashboard
- Progress bar: numbered circles with connector lines (inline sub-component)
- OAuth callback detection via `useSearchParams()` from `next/navigation` (checks `?shopify=connected`, `?gmail=connected`)
- Dark theme (#1C0F36 → #241352 card bg)
- Skip links between steps
- Inline sub-components: `ConnectCard`, `ProgressBar`

Read the source for exact field options (language list, tone options with examples), OAuth redirect URLs, progress bar styling.

- [ ] **Step 4: Delete old file**

```bash
rm app/onboarding/page.js
```

- [ ] **Step 5: Verify build**

Run: `npx next build 2>&1 | tail -20`

---

## Task 21: Home Page Hooks

**Files:**
- Create: `hooks/home/use-home-data.ts`
- Create: `hooks/home/use-ai-chat.ts`
- Create: `hooks/home/index.ts`

- [ ] **Step 1: Create home data hooks**

Read `app/home/page.js` for the parallel KPI/orders/refunds fetch and onboarding status fetch.

```typescript
// hooks/home/use-home-data.ts
'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'

function useToken() {
  return useAuthStore((s) => s.session?.access_token ?? '')
}

export const homeKeys = {
  all: ['home'] as const,
  kpis: () => [...homeKeys.all, 'kpis'] as const,
  onboarding: () => [...homeKeys.all, 'onboarding'] as const,
}

export interface ShopifyContext {
  kpis: Record<string, unknown> | null
  orders: unknown[] | null
  refunds: unknown[] | null
}

export function useHomeKpis() {
  const token = useToken()
  return useQuery<ShopifyContext>({
    queryKey: homeKeys.kpis(),
    queryFn: async () => {
      const headers = { Authorization: `Bearer ${token}` }
      const [kpiRes, ordersRes, refundsRes] = await Promise.all([
        fetch('/api/shopify/kpis', { headers }),
        fetch('/api/shopify/orders', { headers }),
        fetch('/api/shopify/refunds', { headers }),
      ])
      return {
        kpis: kpiRes.ok ? await kpiRes.json() : null,
        orders: ordersRes.ok ? await ordersRes.json() : null,
        refunds: refundsRes.ok ? await refundsRes.json() : null,
      }
    },
    enabled: !!token,
  })
}

export interface OnboardingStatus {
  trialEndsAt: string | null
  onboardingCompleted: boolean
  firstName: string
}

export function useOnboardingStatus() {
  const token = useToken()
  return useQuery<OnboardingStatus>({
    queryKey: homeKeys.onboarding(),
    queryFn: async () => {
      const res = await fetch('/api/onboarding/status', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to fetch onboarding status')
      return res.json()
    },
    enabled: !!token,
  })
}
```

Read the source for exact response shapes.

- [ ] **Step 2: Create AI chat hook**

Read `app/home/page.js` for the streaming `POST /api/ai/chat` pattern. This is a custom hook using `useState` + raw `fetch`, NOT TanStack (streaming).

```typescript
// hooks/home/use-ai-chat.ts
'use client'

import { useState, useCallback, useRef } from 'react'
import { useAuthStore } from '@/stores/auth'
import type { ShopifyContext } from './use-home-data'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface UseAiChatReturn {
  messages: ChatMessage[]
  isStreaming: boolean
  sendMessage: (text: string, context: ShopifyContext) => void
  clearMessages: () => void
}

export function useAiChat(): UseAiChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const messagesRef = useRef<ChatMessage[]>([])
  // Keep ref in sync for use inside sendMessage (avoids stale closure)
  messagesRef.current = messages

  const sendMessage = useCallback(async (text: string, context: ShopifyContext) => {
    const token = useAuthStore.getState().session?.access_token
    if (!token) return

    // Add user message
    const userMsg: ChatMessage = { role: 'user', content: text }
    setMessages((prev) => [...prev, userMsg])
    setIsStreaming(true)

    // Add empty assistant message
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }])

    try {
      abortRef.current = new AbortController()
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: text,
          history: messagesRef.current,
          context,
        }),
        signal: abortRef.current.signal,
      })

      if (!res.ok || !res.body) throw new Error('Chat request failed')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        setMessages((prev) => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          if (last?.role === 'assistant') {
            updated[updated.length - 1] = { ...last, content: last.content + chunk }
          }
          return updated
        })
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setMessages((prev) => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          if (last?.role === 'assistant' && !last.content) {
            updated[updated.length - 1] = { ...last, content: 'Sorry, something went wrong.' }
          }
          return updated
        })
      }
    } finally {
      setIsStreaming(false)
      abortRef.current = null
    }
  }, []) // stable ref — reads messagesRef.current for history

  const clearMessages = useCallback(() => setMessages([]), [])

  return { messages, isStreaming, sendMessage, clearMessages }
}
```

Read the source to verify exact request body shape, streaming parsing (the source may use `text/event-stream` SSE format vs raw text chunks), and error handling.

- [ ] **Step 3: Create barrel export**

```typescript
// hooks/home/index.ts
export * from './use-home-data'
export * from './use-ai-chat'
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

---

## Task 22: Home Page

**Files:**
- Create: `app/home/page.tsx`
- Delete: `app/home/page.js`

- [ ] **Step 1: Create home page**

Read `app/home/page.js` in full. This is one of the most complex pages. Port to TypeScript + Tailwind. Key elements:

- Session check → redirect to `/login`
- `useHomeKpis()` for Shopify context (parallel fetch of KPIs, orders, refunds)
- `useOnboardingStatus()` for banner logic (trial ending, welcome)
- `useAiChat()` for streaming AI conversation
- Two main states: **hero** (no messages) vs **conversation** (has messages)
- **Hero state:** greeting badge (time-based: "Good morning/afternoon/evening"), gradient headline, glassmorphic search bar with 4 suggestion chips
- **Conversation state:** scrollable message list, user bubbles (purple bg, right-aligned) + assistant bubbles (white bg, left-aligned), typing indicator
- `getGreeting()` inline helper (time-based)
- Inline sub-components: `TypingDots` (3 animated dots using `dotBounce` keyframe), `LynqBadge` (small purple pill), `ChatMessage` (bubble renderer)
- Bottom input: `<textarea>` with auto-height resize, send button (purple gradient)
- Orbs: 4 fixed-position orbs using `orbFloat1`–`orbFloat4` keyframes
- Banner logic: trial-ending banner (priority) vs welcome banner (dismissible)
- Toast notification (custom, absolute positioned)
- Scrollbar customization (use CSS in `globals.css` if not already present)
- Suggestion chips: 4 clickable tags that populate the input and auto-submit

Read the source for exact headline text, suggestion chip labels, greeting logic, message rendering, and CSS animation references.

- [ ] **Step 2: Delete old file**

```bash
rm app/home/page.js
```

- [ ] **Step 3: Verify build**

Run: `npx next build 2>&1 | tail -20`

---

## Task 23: Inbox Create Hooks Extension & Page

**Files:**
- Modify: `hooks/inbox/use-inbox-data.ts`
- Modify: `hooks/inbox/use-inbox-mutations.ts`
- Create: `app/inbox/create/page.tsx`
- Delete: `app/inbox/create/page.js`

- [ ] **Step 1: Extend inbox data hooks**

Read `hooks/inbox/use-inbox-data.ts` to understand existing hooks. Add `useComposeMacros()` if no macro-fetching hook exists. Check if `useEmailConnected()` returns enough data (it returns boolean) — if the page needs the full accounts list, add `useInboxAccounts()`.

```typescript
// Add to hooks/inbox/use-inbox-data.ts

export function useComposeMacros() {
  const token = useToken()
  return useQuery({
    queryKey: inboxKeys.macros(),
    queryFn: async () => {
      const res = await authFetch('/api/macros', {}, token)
      if (!res.ok) return []
      const data = await res.json()
      return data.macros ?? data ?? []
    },
    enabled: !!token,
  })
}
```

Add `macros: () => [...inboxKeys.all, 'macros'] as const` to the `inboxKeys` object if not present.

- [ ] **Step 2: Extend inbox mutation hooks**

Add `useComposeEmail()` to `hooks/inbox/use-inbox-mutations.ts`:

```typescript
// Add to hooks/inbox/use-inbox-mutations.ts

interface ComposeEmailInput {
  to: string
  subject: string
  body: string  // sanitized HTML
  cc?: string
  bcc?: string
  priority?: string
}

export function useComposeEmail() {
  const token = useToken()
  return useMutation({
    mutationFn: async (input: ComposeEmailInput) => {
      const res = await authFetch('/api/inbox/compose', {
        method: 'POST',
        body: JSON.stringify(input),
      }, token)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Failed to send email')
      }
      return res.json()
    },
  })
}
```

Read the source page and existing hooks files to verify exact API shape and `authFetch` import.

- [ ] **Step 3: Create inbox create page**

Read `app/inbox/create/page.js` in full (577 lines, most complex page). Port to TypeScript + Tailwind + shadcn. Key elements:

- Session check with Bearer token
- `useComposeMacros()` for macro data (with localStorage fallback)
- `useEmailConnected()` or `useInboxAccounts()` for provider detection
- `useComposeEmail()` mutation
- **Split-pane layout:** left (recent tickets, demo data) + right (compose editor)
- **Compose form fields:** To, Subject, Priority (shadcn `Select`), Customer search, Assignee
- **Tags:** inline chips with add/remove
- **Macro search:** input with dropdown (top 8 search results), suggested macros row
- **Rich text editor:** `contenteditable` div with toolbar (B/I/U/Link/Lists via `document.execCommand()`)
- Import `sanitizeHtml`, `plainTextToSafeHtml`, `normalizeSafeUrl` from `lib/inbox-utils.ts`
- Aurora background animation (dark mode): 2 animated blobs using `auroraBlob` keyframe + grid pattern
- Replace custom `Toast` with Sonner `toast`
- Replace inline SVGs with Lucide icons
- Demo mode warning banner when no email provider connected
- Inline sub-components: rich text editor, macro dropdown, avatar

Read the source carefully for the macro search/filter logic, toolbar button implementation, and compose form submission.

- [ ] **Step 4: Delete old file**

```bash
rm app/inbox/create/page.js
```

- [ ] **Step 5: Verify build**

Run: `npx next build 2>&1 | tail -20`

---

## Task 24: Lynq Admin Feedback Utils & Hooks

**Files:**
- Create: `lib/feedback-utils.ts`
- Create: `hooks/lynq-admin/use-lynq-admin-data.ts`
- Create: `hooks/lynq-admin/index.ts`

- [ ] **Step 1: Create feedback utils**

Read `app/lynq-admin/feedback/page.js` for `truncate()` and `initialsFor()`. Note: `timeAgo` is already in `lib/date-utils.ts`.

```typescript
// lib/feedback-utils.ts

/** Truncate string to maxLength with ellipsis */
export function truncate(s: string, maxLength: number): string {
  if (s.length <= maxLength) return s
  return s.slice(0, maxLength) + '…'
}

/** Get initials from user name or email */
export function initialsFor(user: { name?: string; email?: string }): string {
  const source = user.name || user.email || '?'
  return source.slice(0, 2).toUpperCase()
}
```

Read the source for exact logic.

- [ ] **Step 2: Create lynq-admin data hook**

```typescript
// hooks/lynq-admin/use-lynq-admin-data.ts
'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'

function useToken() {
  return useAuthStore((s) => s.session?.access_token ?? '')
}

export const lynqAdminKeys = {
  all: ['lynq-admin'] as const,
  feedback: () => [...lynqAdminKeys.all, 'feedback'] as const,
}

export interface FeedbackSubmission {
  id: string
  type: 'bug' | 'feedback' | 'other'
  message: string
  user_name?: string
  user_email?: string
  workspace_name?: string
  page_url?: string
  user_agent?: string
  created_at: string
}

export function useFeedbackList() {
  const token = useToken()
  return useQuery<FeedbackSubmission[]>({
    queryKey: lynqAdminKeys.feedback(),
    queryFn: async () => {
      const res = await fetch('/api/lynq-admin/feedback', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      if (res.status === 401 || res.status === 403) {
        throw new Error('Access denied')
      }
      if (!res.ok) throw new Error('Failed to fetch feedback')
      const data = await res.json()
      return data.submissions ?? data ?? []
    },
    enabled: !!token,
    retry: false,
  })
}
```

Read the source to verify exact API response shape.

- [ ] **Step 3: Create barrel export**

```typescript
// hooks/lynq-admin/index.ts
export * from './use-lynq-admin-data'
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

---

## Task 25: Lynq Admin Feedback Page

**Files:**
- Create: `app/lynq-admin/feedback/page.tsx`
- Delete: `app/lynq-admin/feedback/page.js`

- [ ] **Step 1: Create feedback page**

Read `app/lynq-admin/feedback/page.js` in full (531 lines). Port to TypeScript + Tailwind. Key elements:

- `useFeedbackList()` hook, redirect to `/inbox` on 403 error
- Local state: `filter` (all/bug/feedback/other), `search` string, `selected` (detail panel item)
- `useMemo` for `counts` (per-type counts) and `visible` (filtered + searched list)
- **Filter tabs:** All, Bug (Lucide `Bug`, red), Feedback (Lucide `Lightbulb`, purple), Other (Lucide `MessageSquare`, gray) — with count badges
- **Search input:** Lucide `Search` icon, filters by message/email/workspace
- **Table:** 6 columns — type badge (icon + color), message preview (truncated), user (avatar initials + name/email), workspace, page URL, submitted (timeAgo)
- **Empty state:** Lucide `Inbox` icon + message
- **Detail side panel:** slides in from right, backdrop overlay, escape key close
  - Type badge, full message, user info section, workspace, page URL (external link), user agent, "Reply via email" button (mailto link)
- Import `timeAgo` from `lib/date-utils.ts`, `truncate` and `initialsFor` from `lib/feedback-utils.ts`
- Sonner `toast` for errors
- Light theme (#F8F7FA background)

Read the source for exact table structure, detail panel layout, type metadata (icon, color, label per type), and slide animation.

- [ ] **Step 2: Delete old file**

```bash
rm app/lynq-admin/feedback/page.js
```

- [ ] **Step 3: Verify build**

Run: `npx next build 2>&1 | tail -20`

---

## Task 26: Proxy Middleware

**Files:**
- Create: `proxy.ts`
- Delete: `proxy.js`

- [ ] **Step 1: Convert proxy to TypeScript**

Read `proxy.js` (116 lines). Pure TS conversion — no behavioral changes. Add types for:

```typescript
// Types to add
interface SupabaseUser {
  id: string
  email: string
  [key: string]: unknown
}

interface WorkspaceMemberRow {
  workspace_id: string
  role: string
  workspaces: {
    subscription_status: string
    trial_ends_at: string | null
  }
}

type BlockedState = 'allowed' | 'trial_expired' | 'subscription_expired'
```

- Type the `checkBlockedState(token: string): Promise<BlockedState>` function
- Type the Next.js middleware function signature: `(request: NextRequest) => Promise<NextResponse>`
- Type the `config` export with `matcher` array
- Keep all bypass prefixes, auth logic, and fail-open behavior exactly as-is
- Use `NextRequest` and `NextResponse` from `next/server`

Read the source to check the exact `import` and `export` patterns for Next.js middleware.

- [ ] **Step 2: Delete old file**

```bash
rm proxy.js
```

- [ ] **Step 3: Verify build**

Run: `npx next build 2>&1 | tail -20`

---

## Task 27: Final Cleanup & Verification

- [ ] **Step 1: Verify no .js page files remain**

```bash
find app -name "*.js" -not -path "*/api/*" -type f
```

Expected: No results (all page/layout files converted to .tsx).

- [ ] **Step 2: Verify proxy.js is gone**

```bash
ls proxy.js 2>&1
```

Expected: "No such file or directory"

- [ ] **Step 3: Full build verification**

Run: `npx next build 2>&1 | tail -30`
Expected: Build succeeds with no errors.

- [ ] **Step 4: TypeScript check**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No type errors.

- [ ] **Step 5: Search for stale imports**

```bash
grep -r "from.*page\.js" --include="*.ts" --include="*.tsx" app/ components/ -l 2>/dev/null
```

Expected: No results.

- [ ] **Step 6: Manual smoke test checklist**

Navigate through all converted pages in the browser:
- `/login` → floating labels, orb animations, sign in flow
- `/signup` → 6 fields, password strength meter, trust items, email verification state
- `/forgot-password` → email input, "Check your email" success state
- `/reset-password` → 3 states (loading, invalid, form), password match validation
- `/invites/[token]` → 3-path flow (no session, match, mismatch)
- `/invites/[token]/signup` → locked email, form validation, auto sign-in
- `/home` → hero state, AI chat streaming, suggestion chips, banners
- `/value-feed` → filter tabs, feed items, skeleton loaders
- `/services` → card grid, inquiry modal, toast notifications
- `/onboarding` → 4-step wizard, OAuth redirects, progress bar
- `/inbox/create` → split-pane, macro search, rich editor, email compose
- `/lynq-admin/feedback` → filter tabs, table, detail panel
- `/performance` → empty state renders
- `/privacy` → static content renders
- `/pricing-required` → plan cards, sign-out button
