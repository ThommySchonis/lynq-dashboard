# Remaining Pages Refactor Design

**Goal:** Refactor the final 16 legacy `.js` page files + `proxy.js` (total ~5,814 lines) to TypeScript with Tailwind, shadcn, TanStack React Query, and Lucide icons — completing the codebase migration to 100% TypeScript.

**Approach:** Shared infrastructure first (auth layout, floating inputs, auth hooks), then pages in dependency order from simplest to most complex. Hooks and utility functions extracted out of pages; small page-specific sub-components stay inline.

**Tech Stack:** Next.js 16 (app router), React 19, TypeScript, TanStack React Query, Zustand (existing stores only), Tailwind CSS, shadcn/base-ui, Lucide icons, Supabase client SDK, Sonner (toasts).

---

## Scope

### Pages to migrate (16 files)

| Page | Path | Lines | Complexity |
|------|------|-------|------------|
| Login | `app/login/page.js` | 511 | Medium |
| Signup | `app/signup/page.js` | 689 | Medium-High |
| Forgot password | `app/forgot-password/page.js` | 152 | Low |
| Reset password | `app/reset-password/page.js` | 240 | Medium |
| Invite accept | `app/invites/[token]/page.js` | 337 | High |
| Invite signup | `app/invites/[token]/signup/page.js` | 339 | Medium |
| Home | `app/home/page.js` | 453 | High |
| Value feed | `app/value-feed/page.js` | 501 | Medium-High |
| Services | `app/services/page.js` | 495 | Medium |
| Performance | `app/performance/page.js` | 35 | Minimal |
| Onboarding | `app/onboarding/page.js` | 485 | Medium-High |
| Inbox create | `app/inbox/create/page.js` | 577 | Very High |
| Lynq admin layout | `app/lynq-admin/layout.js` | 28 | Minimal |
| Lynq admin feedback | `app/lynq-admin/feedback/page.js` | 531 | High |
| Privacy | `app/privacy/page.js` | 120 | Minimal |
| Pricing required | `app/pricing-required/page.js` | 205 | Low |

### Other files

| File | Path | Lines | Notes |
|------|------|-------|-------|
| Proxy middleware | `proxy.js` | 116 | Pure TS conversion, no behavioral changes |

---

## Section 1: Shared Auth Infrastructure

### New files

- `components/features/auth/auth-layout.tsx`
- `components/features/auth/float-field.tsx`
- `components/features/auth/password-field.tsx`
- `hooks/auth/use-auth-data.ts` — query hooks (`useInviteDetails`)
- `hooks/auth/use-auth-mutations.ts` — mutation hooks (`useSignIn`, `useSignUp`, etc.)
- `hooks/auth/index.ts` — barrel re-export
- `lib/auth-constants.ts`

### AuthLayout (`auth-layout.tsx`)

Full-page layout wrapping the auth pages (login, signup, forgot-password, reset-password). Provides:

- Dark background (#1C0F36) with 3 animated orbs (radial gradients, 60-80s drift cycles)
- Noise texture overlay
- Glassmorphism card container (backdrop blur, semi-transparent bg)
- Brand wordmark at top
- Gradient divider between header and form
- Footer links slot

Props:
```typescript
interface AuthLayoutProps {
  headline: ReactNode        // supports word-by-word reveal spans
  subhead?: string
  footer?: ReactNode         // login/signup toggle links
  children: ReactNode        // form content
  showOrbs?: boolean         // default true
  maxWidth?: string          // default 'max-w-md'
}
```

### FloatField (`float-field.tsx`)

Floating-label input using the `:placeholder-shown` CSS technique. The label animates up when the input has content or focus.

Props:
```typescript
interface FloatFieldProps extends Omit<React.ComponentProps<typeof Input>, 'placeholder'> {
  label: string
  error?: string
}
```

Requires a small CSS rule in `globals.css`:
```css
.float-field:not(:placeholder-shown) ~ .float-label,
.float-field:focus ~ .float-label {
  transform: translateY(-1.25rem) scale(0.85);
  color: var(--text-muted);
}
```

### PasswordField (`password-field.tsx`)

Extends `FloatField` with:
- Eye/EyeOff toggle (Lucide icons) for visibility
- Optional strength meter (4-segment bar: red → orange → yellow → green)
- Strength computed by `calcPasswordStrength()` from `lib/auth-constants.ts`

Props:
```typescript
interface PasswordFieldProps extends Omit<FloatFieldProps, 'type'> {
  showStrength?: boolean     // default false
}
```

### Auth hooks (split per project convention: data + mutations)

All hook files must include `'use client'` directive at the top, matching existing hook patterns.

**`hooks/auth/use-auth-data.ts`** — query hooks:
```typescript
export const authKeys = {
  invite: (token: string) => ['invite', token] as const,
}

useInviteDetails(token: string)  // GET /api/invites/${token} — useQuery
```

**`hooks/auth/use-auth-mutations.ts`** — mutation hooks:
```typescript
useSignIn()              // supabase.auth.signInWithPassword() → redirect /inbox
useSignUp()              // supabase.auth.signUp() with user_metadata
useResetPasswordRequest() // supabase.auth.resetPasswordForEmail()
useResetPassword()       // supabase.auth.updateUser({ password })
useSignOut()             // supabase.auth.signOut()
useAcceptInvite(token)   // POST /api/invites/${token}/accept
useInviteSignup(token)   // POST /api/invites/${token}/signup + auto sign-in
```

**`hooks/auth/index.ts`** — barrel export:
```typescript
export * from './use-auth-data'
export * from './use-auth-mutations'
```

### Auth constants (`lib/auth-constants.ts`)

```typescript
// Password strength calculation
calcPasswordStrength(password: string): number  // 0-4 score
STRENGTH_COLORS: string[]                       // ['red-500', 'orange-500', 'yellow-500', 'green-500']
STRENGTH_LABELS: string[]                       // ['Weak', 'Fair', 'Good', 'Strong']

// Trust items (signup page) — icons are Lucide component references (LucideIcon type)
TRUST_ITEMS: { icon: LucideIcon; text: string }[]   // 3 items (Check icon for each)

// Animation timing
WORD_REVEAL_DELAY_MS: number                    // per-word stagger
```

### CSS additions to `globals.css`

Keyframe animations (cannot be expressed in Tailwind):
- Reuse existing `@keyframes orbFloat1`–`orbFloat4` from `globals.css` (lines 333-351) — no new orb keyframes needed
- `@keyframes wordReveal` — fade-up word reveal
- `@keyframes dotBounce` — typing indicator dots
- `@keyframes blink` — streaming cursor
- `@keyframes auroraBlob` — aurora background for inbox/create (dark mode)
- Float field label transition rule (`:placeholder-shown`)
- Note: `@keyframes shimmer` already exists in `globals.css` (line 270) — do not duplicate

---

## Section 2: Auth Pages

### Login (`app/login/page.tsx`)

- Uses `AuthLayout` with animated word-by-word headline
- 2 fields: `FloatField` (email) + `PasswordField` (no strength meter)
- Error alert banner (red bg, white text)
- Loading CTA button (shadcn `Button`)
- Footer: link to `/signup` + link to `/forgot-password`
- Uses `useSignIn()` mutation → redirects to `/inbox` on success

### Signup (`app/signup/page.tsx`)

- Uses `AuthLayout` with word reveal headline
- 6 fields: email `FloatField`, first+last name (2-col grid) `FloatField`, company `FloatField`, `PasswordField` with `showStrength`
- Inline `TrustItem` sub-component (check icon + text, 3 items from `TRUST_ITEMS`)
- Two states: form vs inline `VerifyPanel` (email confirmation pending — checkmark emoji + instructions)
- Uses `useSignUp()` mutation with `user_metadata: { first_name, last_name, company_name }`

### Forgot password (`app/forgot-password/page.tsx`)

- Uses `AuthLayout` with `showOrbs={false}` (simpler variant)
- Single email `FloatField`
- Error banner
- Two states: form vs "Check your email" success message
- Uses `useResetPasswordRequest()` mutation
- Footer: link back to `/login`

### Reset password (`app/reset-password/page.tsx`)

- Uses `AuthLayout`
- On mount: listens for `PASSWORD_RECOVERY` event via `supabase.auth.onAuthStateChange()` with cleanup and race condition protection (`cancelled` flag)
- 3 states: loading (spinner) → invalid link (with "Request new link" button) → password form
- 2x `PasswordField`, "Passwords don't match" validation
- Uses `useResetPassword()` mutation → auto-redirect to `/login` after 1.5s

---

## Section 3: Invite Pages

### InviteLayout (`components/features/auth/invite-layout.tsx`)

Shared layout for both invite pages. Different from `AuthLayout`:
- Light theme (#F8F7FA background)
- White card with gradient top border (purple gradient)
- Centered vertically, max-width constrained
- Brand wordmark at top

Props:
```typescript
interface InviteLayoutProps {
  children: ReactNode
  loading?: boolean          // shows centered spinner
}
```

### Invite accept (`app/invites/[token]/page.tsx`)

- Uses `InviteLayout`
- Access `token` via `useParams()` from `next/navigation` (or page props `params.token` with React 19 `use()`)
- Uses `useInviteDetails(token)` to fetch invite metadata
- Uses `supabase.auth.getSession()` to check current session
- 3-path flow:
  - **No session:** "Sign in" button (→ `/login?redirect=/invites/${token}`) + "Create account" button (→ `/invites/${token}/signup`)
  - **Email match:** workspace icon (Lucide `Building2`), detail panel (role, email, inviter, validity), "Accept invite" confirm button
  - **Email mismatch:** warning message, "Sign out and use correct email" button
- Detail panel: role badge, inviter name, validity countdown
- Uses `useAcceptInvite(token)` mutation → redirect to `/inbox` on success
- Success state with checkmark icon

### Invite signup (`app/invites/[token]/signup/page.tsx`)

- Uses `InviteLayout`
- Uses `useInviteDetails(token)` to validate token + get locked email
- Locked email field (readonly `FloatField` with gray styling)
- Name `FloatField`, `PasswordField` + confirm `PasswordField`
- Field-level validation errors (red text below fields)
- Uses `useInviteSignup(token)` mutation → auto sign-in → redirect to `/inbox`
- Success state with checkmark + auto-redirect message
- Footer: link to `/login` ("Already have an account?")

---

## Section 4: Simple Pages

### Performance (`app/performance/page.tsx`)

- Trivial stub: session check + `EmptyState` component
- In-page conversion only, inline styles → Tailwind
- No new hooks or components needed

### Privacy (`app/privacy/page.tsx`)

- Static content, no auth, no data
- In-page conversion: inline styles → Tailwind
- Inline `Section` sub-component (heading + body wrapper) stays in-page
- Dark theme preserved (#1C0F36 bg)

### Pricing required (`app/pricing-required/page.tsx`)

- Session check for greeting ("Welcome back, {firstName}")
- 4 plan cards in grid layout
- Plan data extracted to `lib/pricing-constants.ts`:

```typescript
interface PricingPlan {
  name: string
  price: string
  ticketLimit: string
  highlighted: boolean
  badge?: string
}
export const PRICING_PLANS: PricingPlan[]
```

- `PlanCard` sub-component stays inline (only used here)
- Sign-out button uses `useSignOut()` from auth hooks
- Inline styles → Tailwind

### Lynq admin layout (`app/lynq-admin/layout.tsx`)

- Trivial: 28 lines, flex wrapper with sidebar + children
- Direct conversion: inline styles → Tailwind
- Imports existing `AdminSidebar` component (already TypeScript)

---

## Section 5: Medium Pages

### Value feed (`app/value-feed/page.tsx`)

**New files:**
- `hooks/value-feed/use-value-feed-data.ts`
- `hooks/value-feed/index.ts` — barrel export
- `lib/value-feed-utils.ts`

**Hook:** `useValueFeed()` — TanStack query fetching broadcasts from `supabase.from('broadcasts')` + masterclasses from `supabase.from('masterclasses')`. Returns combined, sorted feed items.

**Utils:**
- Date helpers `fmtDate` and `timeUntil` go in shared `lib/date-utils.ts` (also used by feedback page)
- `lib/value-feed-utils.ts` — feed-specific helpers:
```typescript
googleCalUrl(title: string, start: string, duration: number): string
initialsOf(name: string): string
classifyBroadcast(broadcast: Record<string, unknown>): FeedItem
```

**Page:**
- No auth required (public page)
- Orb animations shared from `globals.css`
- Filter tabs — preserve the existing categories from the current page.js (All, Tips, Masterclasses, Updates). Do not add new categories; this is a migration, not a feature change.
- Mixed feed: masterclass cards (with speaker initials avatar) + broadcast post cards
- Empty state with "Clear filters" button
- Skeleton loaders using shadcn `Skeleton`
- Filter tabs and feed items stay in-page
- Reuse existing `components/features/value-feed/post-card.tsx` for broadcast rendering — do not recreate

### Services (`app/services/page.tsx`)

**New files:**
- `lib/services-constants.ts`
- `hooks/services/use-services-mutations.ts`
- `hooks/services/index.ts` — barrel export

**Constants** (`lib/services-constants.ts`):
```typescript
import type { LucideIcon } from 'lucide-react'

interface ServiceDef {
  icon: LucideIcon           // Lucide component reference (e.g., Zap, Users, etc.)
  title: string
  description: string
  features: string[]
  guarantee: string[]
  badge?: string
}
export const SERVICES: ServiceDef[]     // 5 service definitions
```

**Hook:** `useSubmitInquiry()` — TanStack mutation, POST to `/api/services/inquiries`.

**Page:**
- Session check for user ID + email
- Service card grid (2-column + 1 full-width training card)
- Each card: Lucide icon, title, description, features list, guarantee block, CTA button
- Inquiry modal: shadcn `Dialog` with WhatsApp number input + message textarea
- Success state in modal
- Toast via Sonner
- Inline SVG icons replaced with Lucide equivalents
- `ServiceCard` and modal sub-components stay in-page

### Onboarding (`app/onboarding/page.tsx`)

**New files:**
- `hooks/onboarding/use-onboarding-mutations.ts`
- `hooks/onboarding/index.ts` — barrel export

**Mutations:**
```typescript
useSaveBrand()              // POST /api/settings/brand
useConnectParcelPanel()     // POST /api/settings/integrations (test connection)
useCompleteOnboarding()     // supabase.from('profiles').upsert() to mark complete
```

**Page:**
- Session check, redirects to `/login` if missing
- 4-step wizard with local `useState` for step + form data:
  1. Welcome — emoji + headline + continue
  2. Brand setup — name input, language select, tone radio buttons (card style with examples)
  3. Connect tools — 3-column grid (Gmail OAuth redirect, Shopify OAuth redirect, ParcelPanel API key input)
  4. Done — success checkmark + "You're all set!"
- Progress bar (numbered circles + connecting lines) stays in-page
- Connect card sub-components stay in-page
- OAuth callback detection via `useSearchParams()` from `next/navigation` (e.g., `?shopify=connected`)
- Inline styles → Tailwind, dark theme preserved

---

## Section 6: Complex Pages

### Home (`app/home/page.tsx`)

**New files:**
- `hooks/home/use-home-data.ts`
- `hooks/home/use-ai-chat.ts`
- `hooks/home/index.ts` — barrel export

**Hooks:**

`useHomeKpis()` — TanStack query, parallel fetch of `/api/shopify/kpis`, `/api/shopify/orders`, `/api/shopify/refunds`. Provides pre-loaded data context for AI chat.

`useOnboardingStatus()` — TanStack query, GET `/api/onboarding/status`. Used for conditional banners.

`useAiChat()` — Custom hook (NOT a TanStack mutation, since TanStack mutations don't support streaming). Uses `useState` for message list + streaming state, and raw `fetch` with `ReadableStream` for incremental text updates. This is the one exception to the "TanStack for all server data" rule — streaming responses require manual state management.

```typescript
interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface UseAiChatReturn {
  messages: ChatMessage[]
  isStreaming: boolean
  sendMessage: (text: string, context: ShopifyContext) => void
  clearMessages: () => void
}
```

**Streaming strategy:** `sendMessage` appends a user message to state, then calls `fetch('/api/ai/chat')`. The response body is a `ReadableStream`. The hook reads chunks via `reader.read()`, decoding each chunk and appending to the assistant message's `content` field in state. `isStreaming` is `true` while reading, `false` when the stream closes or errors.

**Page:**
- Session check → redirect to `/login`
- Two states: hero (empty chat) vs conversation
- Hero: greeting badge, gradient headline, glassmorphic search bar with 4 suggestion chips
- Chat area: user bubbles (purple, right) + assistant bubbles (white, left)
- Typing indicator (`TypingDots` inline sub-component, uses `dotBounce` keyframe)
- Streaming cursor (uses `blink` keyframe)
- Bottom input: textarea with auto-height resize, send button
- Orb animations shared from `globals.css`
- Banner logic: trial-ending (priority) vs welcome banner — conditional based on `useOnboardingStatus()`
- `ChatMessage`, `TypingDots`, `LynqBadge` sub-components stay in-page

### Inbox create (`app/inbox/create/page.tsx`)

**No new util files needed.** `sanitizeHtml`, `plainTextToSafeHtml`, and `normalizeSafeUrl` already exist in `lib/inbox-utils.ts` — import from there.

**Hooks:** Extend existing inbox hooks:
- `useEmailConnected()` already exists in `hooks/inbox/use-inbox-data.ts` (queries `/api/inbox/accounts`). If a full accounts list (not just boolean) is needed, add `useInboxAccounts()` alongside it.
- `useComposeMacros()` — GET `/api/macros`, add to existing inbox data hooks
- `useComposeEmail()` — POST `/api/inbox/compose`, add to existing inbox mutation hooks

**Page:**
- Session check with Bearer token
- Split-pane layout: recent tickets (left, demo data) + compose editor (right)
- Subject + priority select, customer search, assignee dropdown
- Tags (inline chips), contact reason, product, resolution buttons
- Thread area: "New outgoing email" info card
- To/From/CC/Bcc fields
- Macro search input with dropdown (velocity-style search results)
- Rich text editor: `contenteditable` div with `document.execCommand()` toolbar (B, I, U, link, bullets). Note: `execCommand` is deprecated but preserved as-is for this migration — replacing the editor is out of scope.
- Suggested macros row
- Aurora background animation (dark mode only) → keyframe in `globals.css`
- Custom `Toast` component replaced with Sonner
- Inline SVGs replaced with Lucide icons
- Demo mode banner (yellow warning if no email provider connected)
- Rich editor + macro dropdown sub-components stay in-page

### Lynq admin feedback (`app/lynq-admin/feedback/page.tsx`)

**New files:**
- `hooks/lynq-admin/use-lynq-admin-data.ts`
- `hooks/lynq-admin/index.ts` — barrel export
- `lib/date-utils.ts` — shared date formatting: `timeAgo`, `fmtDate`, `timeUntil` (consolidates date helpers used across value-feed and feedback pages)
- `lib/feedback-utils.ts` — feedback-specific: `truncate`, `initialsFor`

**Hook:** `useFeedbackList()` — TanStack query, GET `/api/lynq-admin/feedback` with Bearer token. Handles 401/403 (redirect to `/inbox`).

**Utils:**
- `lib/date-utils.ts`: `timeAgo(dateStr: string): string` (shared, also used by value-feed)
- `lib/feedback-utils.ts`: `truncate(text: string, maxLength: number): string`, `initialsFor(name: string): string`

**Page:**
- Auth check via Bearer token, server returns 403 if not admin
- Filter tabs (Bug/Feedback/Other/All) with counts
- Search input with Lucide `Search` icon
- Table: type badge (Lucide icon + color), message preview, user avatar + name/email, workspace, page URL, time ago
- Empty state (Lucide `Inbox` icon)
- Detail side panel: slides in from right, backdrop overlay, escape key to close
- Panel shows: type badge, full message, user info, workspace, page URL (external link), user agent, "Reply via email" button
- Inline styles → Tailwind
- Lucide icons already used (keep as-is)
- Toast via Sonner

---

## Section 7: Proxy Middleware

### `proxy.js` → `proxy.ts`

Pure TypeScript conversion, no behavioral changes:

```typescript
// Add types for:
interface TokenValidation {
  id: string
  email: string
  // ... other Supabase user fields
}

interface WorkspaceMember {
  workspace_id: string
  role: string
  workspaces: {
    subscription_status: string
    trial_ends_at: string | null
  }
}

type BlockedState = 'allowed' | 'trial_expired' | 'subscription_expired'
```

- Type `checkBlockedState(token: string): Promise<BlockedState>`
- Type the middleware `config` export
- Type request/response in the middleware function
- No changes to bypass prefixes, auth logic, or fail-open behavior

---

## File Summary

### Static assets (1 file)
| File | Purpose |
|------|---------|
| `public/textures/noise.svg` | Fractal noise texture used as background overlay in auth pages |

### New shared components (4 files)
| File | Purpose |
|------|---------|
| `components/features/auth/auth-layout.tsx` | Dark auth page wrapper with orbs, glassmorphism card |
| `components/features/auth/float-field.tsx` | Floating-label input |
| `components/features/auth/password-field.tsx` | Password input with eye toggle + optional strength meter |
| `components/features/auth/invite-layout.tsx` | Light invite page wrapper with gradient card |

### New hooks (8 files + 6 barrel exports)
| File | Hooks |
|------|-------|
| `hooks/auth/use-auth-data.ts` | `useInviteDetails` |
| `hooks/auth/use-auth-mutations.ts` | `useSignIn`, `useSignUp`, `useResetPasswordRequest`, `useResetPassword`, `useSignOut`, `useAcceptInvite`, `useInviteSignup` |
| `hooks/value-feed/use-value-feed-data.ts` | `useValueFeed` |
| `hooks/services/use-services-mutations.ts` | `useSubmitInquiry` |
| `hooks/onboarding/use-onboarding-mutations.ts` | `useSaveBrand`, `useConnectParcelPanel`, `useCompleteOnboarding` |
| `hooks/home/use-home-data.ts` | `useHomeKpis`, `useOnboardingStatus` |
| `hooks/home/use-ai-chat.ts` | `useAiChat` (custom hook with raw fetch + useState, not TanStack — streaming) |
| `hooks/lynq-admin/use-lynq-admin-data.ts` | `useFeedbackList` |

Barrel exports: `hooks/{auth,value-feed,services,onboarding,home,lynq-admin}/index.ts`

### Extended hooks (2 files)
| File | Added |
|------|-------|
| `hooks/inbox/use-inbox-data.ts` | `useInboxAccounts` (if `useEmailConnected` doesn't return full list), `useComposeMacros` |
| `hooks/inbox/use-inbox-mutations.ts` | `useComposeEmail` |

### New constants/utils (6 files)
| File | Contents |
|------|----------|
| `lib/auth-constants.ts` | `calcPasswordStrength`, strength colors/labels, trust items (`LucideIcon` type), animation timing |
| `lib/pricing-constants.ts` | `PRICING_PLANS` array (4 plans) |
| `lib/services-constants.ts` | `SERVICES` array (5 service definitions, `LucideIcon` type for icons) |
| `lib/date-utils.ts` | `timeAgo`, `fmtDate`, `timeUntil` (shared across value-feed + feedback) |
| `lib/value-feed-utils.ts` | `googleCalUrl`, `initialsOf`, `classifyBroadcast` |
| `lib/feedback-utils.ts` | `truncate`, `initialsFor` |

Note: `lib/compose-utils.ts` is NOT needed — `sanitizeHtml`, `plainTextToSafeHtml`, `normalizeSafeUrl` already exist in `lib/inbox-utils.ts`.

### CSS additions to `globals.css`
- Reuse existing `orbFloat1`–`orbFloat4` keyframes (already present)
- `shimmer` keyframe already exists — do not duplicate
- New: `wordReveal`, `dotBounce`, `blink`, `auroraBlob` keyframes
- New: float field label transition rule (`:placeholder-shown`)

### Pages converted (16 files)
All `.js` → `.tsx` with inline styles → Tailwind, `useState`+`useEffect`+`fetch` → TanStack hooks, inline SVGs → Lucide icons, custom toasts → Sonner.

### Proxy converted (1 file)
`proxy.js` → `proxy.ts` — types added, no behavioral changes.

---

## Migration Order

1. CSS keyframes in `globals.css`
2. `lib/auth-constants.ts`
3. Shared auth components (`auth-layout`, `float-field`, `password-field`)
4. `hooks/auth/use-auth-data.ts` + `hooks/auth/use-auth-mutations.ts` + `hooks/auth/index.ts`
5. Auth pages: login → signup → forgot-password → reset-password
6. `invite-layout.tsx` → invite accept → invite signup
7. Simple pages: performance → privacy → pricing-required → lynq-admin layout
8. Medium pages: value-feed → services → onboarding
9. Complex pages: home → inbox/create → lynq-admin feedback
10. `proxy.js` → `proxy.ts`
