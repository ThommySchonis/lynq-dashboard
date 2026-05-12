# Project Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clean up the codebase by replacing custom HTML elements with shadcn components, migrating auth calls to the store, extracting oversized components, and fixing small inconsistencies.

**Architecture:** Four sequential passes by concern type: (1) shadcn migration, (2) auth store migration, (3) component extraction, (4) small fixes. Each pass produces focused, independently reviewable commits.

**Tech Stack:** Next.js 16, React 19, shadcn/ui (base-ui), TanStack React Query, Zustand, react-hook-form + zod

**Spec:** `docs/superpowers/specs/2026-05-11-project-cleanup-design.md`

**Excluded:** Hardcoded hex color migration (in progress separately).

---

## File Map

### Pass 1 — shadcn migration
- Modify: `app/inbox/create/page.tsx`
- Modify: `app/onboarding/page.tsx`
- Modify: `app/home/page.tsx`

### Pass 2 — Auth store migration
- Modify: `app/home/page.tsx`
- Modify: `app/onboarding/page.tsx`
- Modify: `app/performance/page.tsx`
- Modify: `app/pricing-required/page.tsx`
- Modify: `components/features/academy/academy-page.tsx`
- Modify: `components/features/academy/final-exam.tsx`
- Modify: `components/features/academy/certificate-page.tsx`
- Modify: `components/layout/setup-checklist.tsx`
- Modify: `components/shared/feedback-modal.tsx`
- Modify: `components/shared/welcome-banner.tsx`
- Modify: `components/providers/sentry-user-sync.tsx`

### Pass 3 — Component extraction
- Modify: `components/features/inbox/customer-sidebar.tsx`
- Create: `components/features/inbox/customer-stats.tsx`
- Create: `components/features/inbox/orders-section.tsx`
- Modify: `components/features/inbox/customer-panel.tsx`
- Create: `components/features/inbox/customer-card.tsx`
- Create: `components/features/inbox/customer-stats-grid.tsx`
- Modify: `components/features/academy/final-exam.tsx`
- Create: `components/features/academy/exam-locked-view.tsx`
- Create: `components/features/academy/exam-intro-view.tsx`
- Create: `components/features/academy/exam-results-view.tsx`

### Pass 4 — Small fixes
- Modify: `lib/academy-constants.ts`
- Modify: `lib/onboarding-constants.ts`
- Modify: `components/features/academy/final-exam.tsx`
- Modify: `app/onboarding/page.tsx`
- Modify: `hooks/onboarding/use-onboarding-mutations.ts`
- Modify: `hooks/settings/use-settings-mutations.ts`
- Create: `hooks/settings/use-workspace-mutations.ts`
- Create: `hooks/settings/use-member-mutations.ts`
- Create: `hooks/settings/use-profile-mutations.ts`
- Create: `hooks/settings/use-macro-mutations.ts`
- Create: `hooks/settings/use-tag-mutations.ts`
- Create: `hooks/settings/use-integration-mutations.ts`
- Modify: `hooks/settings/index.ts`

---

## Pass 1: shadcn Component Migration

### Task 1: Replace custom elements in inbox/create page

**Files:**
- Modify: `app/inbox/create/page.tsx`

**Context:**
- shadcn `Button` variants: `default`, `outline`, `secondary`, `ghost`, `destructive`, `link`. Sizes: `default`, `xs`, `sm`, `lg`, `icon`, `icon-xs`, `icon-sm`, `icon-lg`.
- shadcn `Input` accepts standard native input props + `className`.
- shadcn `Select` uses base-ui with `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem`. Trigger has `size="sm"` option.
- Toolbar formatting buttons (B, I, U) and tiny inline controls (tag remove X, macro clear X) stay as raw `<button>` — shadcn Button's padding/focus rings conflict with toolbar layouts.
- Preserve `onMouseDown={(e) => e.preventDefault()}` on buttons near the contenteditable editor.

- [ ] **Step 1: Add imports**

Add at the top of the file:
```tsx
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
```

- [ ] **Step 2: Replace the Back button (~line 194)**

Replace:
```tsx
<button
  onClick={() => router.push('/inbox')}
  className="flex items-center gap-1 rounded-[7px] border border-(--border) bg-(--bg-input) px-2.5 py-1 text-[11.5px] font-semibold text-(--text-2) transition-colors hover:border-(--border-hover) hover:text-(--text-1)"
>
  <ChevronLeft className="h-2.5 w-2.5" />
  Back
</button>
```

With:
```tsx
<Button
  variant="outline"
  size="xs"
  onClick={() => router.push('/inbox')}
  className="gap-1 text-[11.5px] font-semibold"
>
  <ChevronLeft className="h-2.5 w-2.5" />
  Back
</Button>
```

- [ ] **Step 3: Replace the priority `<select>` (~line 254)**

Replace the native `<select>` + `<ChevronDown>` overlay with shadcn Select. Since this page uses `useState` for priority (not react-hook-form), no Controller needed:

```tsx
<Select value={priority} onValueChange={setPriority}>
  <SelectTrigger size="sm" className="text-[11.5px]">
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    {PRIORITY_OPTS.map((p) => (
      <SelectItem key={p} value={p}>{p}</SelectItem>
    ))}
  </SelectContent>
</Select>
```

Remove the `<ChevronDown>` icon that was overlaid on the native select — shadcn Select includes its own chevron.

- [ ] **Step 4: Replace custom `<input>` elements**

For each custom `<input>` (To, CC, BCC, Subject, Tag input, Customer search, Macro search), replace `<input>` with `<Input>`. Keep all existing props (`value`, `onChange`, `placeholder`, `autoFocus`, `onKeyDown`). Move styling to `className`.

Example for the To field (~line 372):
```tsx
// Before
<input
  value={to}
  onChange={(e) => setTo(e.target.value)}
  placeholder="customer@email.com"
  autoFocus
  className="min-w-0 flex-1 border-none bg-transparent text-[13px] text-(--text-1) outline-none placeholder:text-(--text-3)"
/>

// After
<Input
  value={to}
  onChange={(e) => setTo(e.target.value)}
  placeholder="customer@email.com"
  autoFocus
  className="min-w-0 flex-1 border-none bg-transparent text-[13px] text-(--text-1) shadow-none placeholder:text-(--text-3)"
/>
```

Apply the same pattern to: Subject input, CC input, BCC input, Tag input, Customer search input, Macro search input. Add `shadow-none` to override shadcn Input's default shadow when using borderless/transparent style.

- [ ] **Step 5: Replace remaining action buttons**

Replace the Send button (~line 570) and other primary/action buttons with `<Button>`. Keep `onClick`, `disabled`, and any content. Map the styling:
- Gradient/primary buttons → `<Button variant="default">`
- Bordered/outline buttons → `<Button variant="outline">`
- Icon-only buttons → `<Button variant="ghost" size="icon-sm">`

Do NOT replace toolbar formatting buttons or tiny inline icon controls.

- [ ] **Step 6: Verify build**

Run: `npx next build 2>&1 | head -50`
Expected: Build succeeds with no type errors in `app/inbox/create/page.tsx`.

---

### Task 2: Replace custom elements in onboarding page

**Files:**
- Modify: `app/onboarding/page.tsx`

**Context:**
- This file has ~8 custom `<button>` elements. Inputs already use shadcn Input.
- Buttons have hardcoded colors like `bg-[#A175FC]` — these are in-scope for shadcn migration (mapping to `variant="default"` which uses the accent color). Do NOT change the color values themselves (that's the hex color migration the user is handling separately).

- [ ] **Step 1: Add Button import**

```tsx
import { Button } from '@/components/ui/button'
```

- [ ] **Step 2: Replace all custom `<button>` elements**

For each button, map to the appropriate variant:

**"Get Started →" (~line 183):**
```tsx
// Before
<button onClick={() => setStep(2)} className="bg-[#A175FC] text-white rounded-[10px] px-10 py-3.5 text-[15px] font-semibold cursor-pointer">
  Get Started →
</button>

// After
<Button onClick={() => setStep(2)} className="bg-[#A175FC] rounded-[10px] px-10 py-3.5 text-[15px] font-semibold">
  Get Started →
</Button>
```

**Connect buttons (Gmail, Shopify, ParcelPanel):**
```tsx
// Before
<button onClick={handler} disabled={!ready} className={[...].join(' ')}>Connect X</button>

// After
<Button variant="outline" onClick={handler} disabled={!ready} className="w-full text-[13px]">Connect X</Button>
```

**Complete / Submit buttons:** → `<Button variant="default">`
**Skip buttons:** → `<Button variant="ghost">`

Apply to all ~8 buttons in the file. Keep all `onClick`, `disabled`, and conditional logic intact.

- [ ] **Step 3: Verify build**

Run: `npx next build 2>&1 | head -50`
Expected: Build succeeds.

---

### Task 3: Replace custom elements in home page

**Files:**
- Modify: `app/home/page.tsx`

- [ ] **Step 1: Add imports**

```tsx
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
```

- [ ] **Step 2: Replace hero search input (~line 193)**

```tsx
// Before
<input ref={heroInputRef} type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={onKey} placeholder={...} disabled={...} className="flex-1 border-none bg-transparent text-sm text-[#111111] outline-none placeholder:text-[#BDBDBD]" />

// After
<Input ref={heroInputRef} type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={onKey} placeholder={contextLoaded ? 'Ask anything about your store\u2026' : 'Connecting\u2026'} disabled={!contextLoaded || isStreaming} className="flex-1 border-none bg-transparent text-sm text-[#111111] shadow-none placeholder:text-[#BDBDBD]" />
```

- [ ] **Step 3: Replace send buttons (~lines 203, 272)**

```tsx
// Before
<button onClick={() => handleSend(input)} disabled={...} aria-label="Send" className="flex size-[34px] shrink-0 cursor-pointer items-center justify-center rounded-lg bg-[#111111] ...">

// After
<Button onClick={() => handleSend(input)} disabled={!input.trim() || isStreaming || !contextLoaded} aria-label="Send" size="icon" className="size-[34px] rounded-lg bg-[#111111] hover:bg-[#333333]">
```

Apply to both the hero and bottom send buttons.

- [ ] **Step 4: Replace suggestion chip buttons (~line 222)**

```tsx
// Before
<button onClick={...} className="rounded-full border ...">suggestion text</button>

// After
<Button variant="outline" size="sm" onClick={...} className="rounded-full">suggestion text</Button>
```

- [ ] **Step 5: Leave the bottom textarea as-is**

The bottom `<textarea>` uses `onInput` for auto-height resize with direct DOM manipulation (`target.style.height`). shadcn `Textarea` doesn't support this pattern cleanly. Leave it as a native `<textarea>`. (Note: the spec mentions `~2 custom <input>/<textarea>` for home — this textarea exclusion is intentional.)

- [ ] **Step 6: Verify build**

Run: `npx next build 2>&1 | head -50`
Expected: Build succeeds.

---

## Pass 2: Auth Store Migration

### Task 4: Migrate pages to auth store (Pattern A — redirect)

**Files:**
- Modify: `app/home/page.tsx`
- Modify: `app/performance/page.tsx`
- Modify: `app/pricing-required/page.tsx`

**Context:**
- Auth store is at `stores/auth.ts`, import as `import { useAuthStore } from '@/stores/auth'`
- Store provides: `session`, `user`, `workspace`, `workspaceId`, `role`, `memberId`, `isLoading`
- `home/page.tsx` already imports `useAuthStore` — just remove the redundant `getSession()` call
- `pricing-required/page.tsx` extracts `firstName` from session metadata — use `useAuthStore((s) => s.user)` instead

- [ ] **Step 1: Fix `app/home/page.tsx`**

Remove the `getSession()` block (~lines 49-57):
```tsx
// DELETE this entire useEffect:
useEffect(() => {
  setMounted(true)
  supabase.auth.getSession().then(({ data: { session: s } }) => {
    if (!s) {
      router.push('/login')
    }
  })
}, [router])
```

The file already has `const session = useAuthStore((s) => s.session)` and an auth redirect effect. Move `setMounted(true)` to a separate unconditional effect (it gates SSR hydration and must fire on mount):
```tsx
useEffect(() => { setMounted(true) }, [])
```

Remove `supabase` import if no longer used elsewhere in the file.

- [ ] **Step 2: Fix `app/performance/page.tsx`**

Replace (~lines 18-23):
```tsx
useEffect(() => {
  setMounted(true)
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (!session) router.push('/login')
  })
}, [router])
```

With:
```tsx
const session = useAuthStore((s) => s.session)
const isLoading = useAuthStore((s) => s.isLoading)

useEffect(() => { setMounted(true) }, [])

useEffect(() => {
  if (!isLoading && !session) router.push('/login')
}, [isLoading, session, router])
```

Add `import { useAuthStore } from '@/stores/auth'`. Remove `supabase` import if unused.

- [ ] **Step 3: Fix `app/pricing-required/page.tsx`**

Replace (~lines 74-81):
```tsx
useEffect(() => {
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (!session) { router.push('/login'); return }
    const meta = session.user.user_metadata ?? {}
    const raw = (meta.name || meta.full_name || session.user.email?.split('@')[0] || '').split(/\s+/)[0]
    setFirstName(raw || '')
  })
}, [router])
```

With:
```tsx
const session = useAuthStore((s) => s.session)
const user = useAuthStore((s) => s.user)
const isLoading = useAuthStore((s) => s.isLoading)

useEffect(() => {
  if (!isLoading && !session) { router.push('/login'); return }
  if (user) {
    const meta = user.user_metadata ?? {}
    const raw = (meta.name || meta.full_name || user.email?.split('@')[0] || '').split(/\s+/)[0]
    setFirstName(raw || '')
  }
}, [isLoading, session, user, router])
```

Add `import { useAuthStore } from '@/stores/auth'`. Remove `supabase` import if unused.

- [ ] **Step 4: Verify build**

Run: `npx next build 2>&1 | head -50`

---

### Task 5: Migrate onboarding page to auth store (Pattern A + B)

**Files:**
- Modify: `app/onboarding/page.tsx`

**Context:**
- This file uses `getSession()` for both redirect AND for `handleConnectShopify` (access token).
- The redirect + OAuth callback detection block (~lines 82-107) needs to use the store for session and user data.
- `handleConnectShopify` (~line 126) gets `session.access_token` — replace with `useAuthStore.getState().session`.
- The file has a local `user` state (`useState`) — this can be removed in favor of `useAuthStore((s) => s.user)`.

- [ ] **Step 1: Add auth store import and selectors**

```tsx
import { useAuthStore } from '@/stores/auth'

// Inside component:
const session = useAuthStore((s) => s.session)
const user = useAuthStore((s) => s.user)
const isLoading = useAuthStore((s) => s.isLoading)
```

- [ ] **Step 2: Replace the session check + OAuth callback useEffect (~lines 82-107)**

```tsx
// Replace with:
useEffect(() => {
  if (isLoading) return
  if (!session) { router.replace('/login'); return }

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
}, [isLoading, session, router, searchParams])
```

- [ ] **Step 3: Replace `handleConnectShopify` token access (~line 126)**

```tsx
async function handleConnectShopify() {
  if (!shopifyStore) return
  const session = useAuthStore.getState().session
  if (!session) return
  // rest stays the same...
}
```

- [ ] **Step 4: Remove local `user` state**

Remove `const [user, setUser] = useState(...)` and replace all references to the local `user` with the store's `user` from `useAuthStore((s) => s.user)`.

Verify that no code depends on properties of the local `user` that differ from the store's `User` type. The local state was set from `session.user` — the store's `user` is the same Supabase `User` object, so references should be compatible.

Remove `supabase` import if no longer used.

- [ ] **Step 5: Verify build**

Run: `npx next build 2>&1 | head -50`

---

### Task 6: Migrate academy components to auth store (Pattern A + B)

**Files:**
- Modify: `components/features/academy/academy-page.tsx`
- Modify: `components/features/academy/final-exam.tsx`
- Modify: `components/features/academy/certificate-page.tsx`

**Context:**
- All three files follow the same pattern: `getSession()` → redirect if no session → extract user metadata → use `access_token` for API calls.
- They store session in local state as `Record<string, unknown>` — replace with store session.
- They extract `userName` from `user.user_metadata` — use `useAuthStore((s) => s.user)`.
- API calls using `session.access_token` → `useAuthStore.getState().session?.access_token`.

- [ ] **Step 1: Fix `academy-page.tsx`**

Replace the `getSession()` block (~lines 44-64) with auth store pattern:

```tsx
const storeSession = useAuthStore((s) => s.session)
const storeUser = useAuthStore((s) => s.user)
const isLoading = useAuthStore((s) => s.isLoading)

useEffect(() => {
  if (isLoading) return
  if (!storeSession || !storeUser) {
    window.location.href = '/login'
    return
  }

  // Set session for downstream use (double-cast is tech debt — ideally remove local session state in a future pass)
  setSession(storeSession as unknown as Record<string, unknown>)
  const meta = (storeUser.user_metadata || {}) as Record<string, string>
  const raw = (storeUser.email || '').split('@')[0]
  setUserName(meta.full_name || meta.name || raw.charAt(0).toUpperCase() + raw.slice(1))

  // Fetch exam results using store token
  const token = storeSession.access_token
  fetch('/api/exams/result', {
    headers: { Authorization: `Bearer ${token}` },
  }).then(/* ... existing logic ... */)
}, [isLoading, storeSession, storeUser])
```

Add `import { useAuthStore } from '@/stores/auth'`. Remove `supabase` import if unused.

- [ ] **Step 2: Fix `final-exam.tsx`**

Same pattern as above for (~lines 56-81). Replace `getSession()` with store selectors. The file also reads from `supabase.from('exam_submissions')` which still needs the `supabase` import — only remove the auth import, not the database client.

- [ ] **Step 3: Fix `certificate-page.tsx`**

Same pattern for (~lines 30-52). Replace `getSession()` with store selectors. Keep `supabase` import if used for database queries.

- [ ] **Step 4: Verify build**

Run: `npx next build 2>&1 | head -50`

---

### Task 7: Migrate shared/layout components to auth store (Pattern B)

**Files:**
- Modify: `components/layout/setup-checklist.tsx`
- Modify: `components/shared/feedback-modal.tsx`
- Modify: `components/shared/welcome-banner.tsx`
- Modify: `components/providers/sentry-user-sync.tsx`

**Context:**
- These files use `getSession()` inside callbacks/handlers to get `access_token` for API calls.
- Replace with `useAuthStore.getState().session` inside the callback.
- `sentry-user-sync.tsx` uses `getSession()` in a useEffect to set Sentry user — replace with reactive selector.

- [ ] **Step 1: Fix `setup-checklist.tsx` (~line 107)**

```tsx
// Before
const { data: { session } } = await supabase.auth.getSession()
if (!session) return

// After
const session = useAuthStore.getState().session
if (!session) return
```

Add `import { useAuthStore } from '@/stores/auth'`. Remove `supabase` import if unused.

- [ ] **Step 2: Fix `feedback-modal.tsx` (~line 67)**

```tsx
// Before
const { data: { session } } = await supabase.auth.getSession()
if (!session) { onError?.("You must be logged in to send feedback."); setSubmitting(false); return }

// After
const session = useAuthStore.getState().session
if (!session) { onError?.("You must be logged in to send feedback."); setSubmitting(false); return }
```

- [ ] **Step 3: Fix `welcome-banner.tsx` (~line 20)**

```tsx
// Before
const { data: { session } } = await supabase.auth.getSession()
if (!session) return

// After
const session = useAuthStore.getState().session
if (!session) return
```

- [ ] **Step 4: Fix `sentry-user-sync.tsx` (~line 11)**

Only replace the initial `getSession()` call with the auth store. Keep the `onAuthStateChange` listener intact (it handles SIGNED_OUT reliably and CLAUDE.md says don't replace event listeners).

```tsx
// Before
supabase.auth.getSession().then(({ data: { session } }) => {
  if (cancelled) return
  if (session?.user) {
    Sentry.setUser({ id: session.user.id, email: session.user.email })
  }
})

// After — replace ONLY the getSession block, keep the onAuthStateChange listener:
const user = useAuthStore.getState().session?.user
if (user) {
  Sentry.setUser({ id: user.id, email: user.email })
}
```

The `onAuthStateChange` listener (~lines 18-26) stays exactly as-is. Keep the `supabase` import since `onAuthStateChange` still needs it. Add `import { useAuthStore } from '@/stores/auth'`.

- [ ] **Step 5: Verify build**

Run: `npx next build 2>&1 | head -50`

---

## Pass 3: Component Extraction

### Task 8: Extract components from customer-sidebar

**Files:**
- Modify: `components/features/inbox/customer-sidebar.tsx`
- Create: `components/features/inbox/customer-stats.tsx`
- Create: `components/features/inbox/orders-section.tsx`

**Context:**
- `customer-sidebar.tsx` is 778 lines. Extract the 3-column KPI stats bar (~30 lines) and the orders tab content (~300 lines).
- Extracted components receive data via props. Don't refactor internal logic — just move.
- Read the exact line ranges at implementation time since earlier passes may have shifted line numbers.

- [ ] **Step 1: Identify exact extraction boundaries**

Read `customer-sidebar.tsx` and locate:
1. The stats bar section (3-column KPI display: total spent, order count, refund %)
2. The orders tab content (everything inside the orders tab, from the order list down)

Note the exact line ranges and all variables/props these sections reference.

- [ ] **Step 2: Create `customer-stats.tsx`**

Create a new file with the stats bar extracted as its own component. Define a props interface with the data the stats section needs (e.g., `totalSpent`, `orderCount`, `refundRate` or whatever the parent passes). Add `'use client'` directive.

```tsx
'use client'

interface CustomerStatsProps {
  // Define based on actual data used
}

export function CustomerStats({ ... }: CustomerStatsProps) {
  return (
    // Move the stats JSX here
  )
}
```

- [ ] **Step 3: Create `orders-section.tsx`**

Extract the orders tab content. Define props for the order data, handlers, and any UI state it needs.

```tsx
'use client'

interface OrdersSectionProps {
  // Define based on actual data used
}

export function OrdersSection({ ... }: OrdersSectionProps) {
  return (
    // Move the orders tab JSX here
  )
}
```

- [ ] **Step 4: Update `customer-sidebar.tsx`**

Replace the extracted sections with component imports:
```tsx
import { CustomerStats } from './customer-stats'
import { OrdersSection } from './orders-section'
```

Pass required data as props to each component.

- [ ] **Step 5: Verify build**

Run: `npx next build 2>&1 | head -50`

---

### Task 9: Extract components from customer-panel

**Files:**
- Modify: `components/features/inbox/customer-panel.tsx`
- Create: `components/features/inbox/customer-card.tsx`
- Create: `components/features/inbox/customer-stats-grid.tsx`

**Context:**
- `customer-panel.tsx` is 636 lines. Extract the customer info card (~70 lines) and stats grid (~35 lines).
- Types (`CamelAddress`, `CamelLineItem`, etc.) defined at the top of the file should stay in the parent or be moved to `types/inbox.ts` if not already there.

- [ ] **Step 1: Identify exact extraction boundaries**

Read `customer-panel.tsx` and locate:
1. The customer card section (avatar, name, email, contact details, tags, note)
2. The stats grid section (3-column stats display)

- [ ] **Step 2: Create `customer-card.tsx`**

```tsx
'use client'

interface CustomerCardProps {
  // Define based on actual data
}

export function CustomerCard({ ... }: CustomerCardProps) {
  return (
    // Move customer card JSX here
  )
}
```

- [ ] **Step 3: Create `customer-stats-grid.tsx`**

```tsx
'use client'

interface CustomerStatsGridProps {
  // Define based on actual data
}

export function CustomerStatsGrid({ ... }: CustomerStatsGridProps) {
  return (
    // Move stats grid JSX here
  )
}
```

- [ ] **Step 4: Update `customer-panel.tsx`**

Import and use the new components, passing data as props.

- [ ] **Step 5: Verify build**

Run: `npx next build 2>&1 | head -50`

---

### Task 10: Extract view components from final-exam

**Files:**
- Modify: `components/features/academy/final-exam.tsx`
- Create: `components/features/academy/exam-locked-view.tsx`
- Create: `components/features/academy/exam-intro-view.tsx`
- Create: `components/features/academy/exam-results-view.tsx`

**Context:**
- `final-exam.tsx` is 633 lines with distinct view states: loading, locked, intro, exam, results.
- Extract locked (~lines 115-189), intro (~lines 191-288), and results (~lines 290-441) as separate components.
- Loading view is tiny (~12 lines) — leave inline.
- Exam view is the active question display — leave inline (it's tightly coupled to state).
- Main file becomes a thin state switcher.

- [ ] **Step 1: Identify exact extraction boundaries and shared state**

Read `final-exam.tsx` and identify:
1. Which state variables each view accesses
2. Which callbacks each view needs (e.g., `setView`, `startExam`, etc.)
3. The exact JSX for locked, intro, and results views

- [ ] **Step 2: Create `exam-locked-view.tsx`**

```tsx
'use client'

interface ExamLockedViewProps {
  // e.g., modules progress data, onReturn callback
}

export function ExamLockedView({ ... }: ExamLockedViewProps) {
  return (
    // Lock icon, module progress checklist, return button
  )
}
```

- [ ] **Step 3: Create `exam-intro-view.tsx`**

```tsx
'use client'

interface ExamIntroViewProps {
  // e.g., onStart callback, section info
}

export function ExamIntroView({ ... }: ExamIntroViewProps) {
  return (
    // Award icon, exam info, section list, Start button
  )
}
```

- [ ] **Step 4: Create `exam-results-view.tsx`**

```tsx
'use client'

interface ExamResultsViewProps {
  // e.g., score, sectionScores, passed, onRetake, onReturn
}

export function ExamResultsView({ ... }: ExamResultsViewProps) {
  return (
    // Score ring, summary, section table, action buttons, confetti
  )
}
```

- [ ] **Step 5: Update `final-exam.tsx`**

Import the three new components and replace inline JSX with component calls:
```tsx
if (view === 'locked') return <ExamLockedView ... />
if (view === 'intro') return <ExamIntroView ... />
if (view === 'results') return <ExamResultsView ... />
```

- [ ] **Step 6: Verify build**

Run: `npx next build 2>&1 | head -50`

---

## Pass 4: Small Fixes

### Task 11: Extract inline constants

**Files:**
- Modify: `components/features/academy/final-exam.tsx`
- Modify: `lib/academy-constants.ts`
- Modify: `app/onboarding/page.tsx`
- Modify: `lib/onboarding-constants.ts`

- [ ] **Step 1: Move confetti constants to `lib/academy-constants.ts`**

Cut from `final-exam.tsx` (~lines 19-26):
```tsx
const CONFETTI_COLORS = ['#8B5CF6', '#6366F1', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#EC4899']
const CONFETTI = Array.from({ length: 30 }, (_, i) => ({
  left: `${(i * 37 + 11) % 100}%`,
  delay: `${((i * 7) % 30) * 0.1}s`,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  size: 6 + (i % 5),
  duration: `${2.5 + (i % 8) * 0.2}s`,
}))
```

Add to `lib/academy-constants.ts` (after existing exports). Export both:
```tsx
export const CONFETTI_COLORS = [...]
export const CONFETTI = [...]
```

Update import in `final-exam.tsx` (or in `exam-results-view.tsx` if already extracted):
```tsx
import { CONFETTI_COLORS, CONFETTI } from '@/lib/academy-constants'
```

- [ ] **Step 2: Move brandSchema to `lib/onboarding-constants.ts`**

Cut from `onboarding/page.tsx` (~lines 28-32):
```tsx
const brandSchema = z.object({
  brandName: z.string().min(1, 'Brand name is required'),
  language: z.enum(['English', 'Dutch', 'French', 'German', 'Spanish']),
  tone: z.enum(['friendly', 'professional', 'luxury']),
})
```

Add to `lib/onboarding-constants.ts` (file already exists with `Tone`, `Language` types and `STEPS`, `TONE_OPTIONS`, `LANGUAGE_OPTIONS`). Add `import { z } from 'zod'` at the top of the constants file.

```tsx
export const brandSchema = z.object({
  brandName: z.string().min(1, 'Brand name is required'),
  language: z.enum(['English', 'Dutch', 'French', 'German', 'Spanish']),
  tone: z.enum(['friendly', 'professional', 'luxury']),
})

export type BrandFormData = z.infer<typeof brandSchema>
```

Update import in `onboarding/page.tsx`:
```tsx
import { brandSchema } from '@/lib/onboarding-constants'
```

- [ ] **Step 3: Verify build**

Run: `npx next build 2>&1 | head -50`

---

### Task 12: Convert handleConnectShopify to TanStack mutation

**Files:**
- Modify: `hooks/onboarding/use-onboarding-mutations.ts`
- Modify: `app/onboarding/page.tsx`

**Context:**
- `hooks/onboarding/use-onboarding-mutations.ts` already exists with 3 mutations (`useSaveBrand`, `useConnectParcelPanel`, `useCompleteOnboarding`). It already uses a `useToken()` helper for auth.
- Add `useConnectShopify` mutation to this file.

- [ ] **Step 1: Read the existing mutations file**

Read `hooks/onboarding/use-onboarding-mutations.ts` to understand the existing patterns (how `useToken` works, how mutations are structured).

- [ ] **Step 2: Add `useConnectShopify` mutation**

Add to `hooks/onboarding/use-onboarding-mutations.ts`. Follow the existing pattern — `useToken()` returns a string (the token value), not a function:

```tsx
export function useConnectShopify() {
  const token = useToken()

  return useMutation({
    mutationFn: async (shop: string) => {
      const res = await fetch('/api/auth/shopify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ shop }),
      })
      if (!res.ok) throw new Error('Failed to connect Shopify')
      return res.json() as Promise<{ url?: string }>
    },
  })
}
```

- [ ] **Step 3: Update barrel export in `hooks/onboarding/index.ts`**

The barrel uses named exports. Add `useConnectShopify` to the existing export line:

```tsx
// Before
export { useSaveBrand, useConnectParcelPanel, useCompleteOnboarding } from './use-onboarding-mutations'

// After
export { useSaveBrand, useConnectParcelPanel, useCompleteOnboarding, useConnectShopify } from './use-onboarding-mutations'
```

- [ ] **Step 4: Use the mutation in `onboarding/page.tsx`**

Replace the inline `handleConnectShopify` function:

```tsx
// Before
async function handleConnectShopify() {
  if (!shopifyStore) return
  const session = useAuthStore.getState().session
  if (!session) return
  const res = await fetch('/api/auth/shopify', { ... })
  const data = await res.json() as { url?: string }
  if (data.url) window.location.href = data.url
}

// After
const connectShopify = useConnectShopify()

function handleConnectShopify() {
  if (!shopifyStore) return
  connectShopify.mutate(shopifyStore, {
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url
    },
  })
}
```

Add import: `import { useConnectShopify } from '@/hooks/onboarding'`

- [ ] **Step 5: Verify build**

Run: `npx next build 2>&1 | head -50`

---

### Task 13: Split settings mutations hook

**Files:**
- Modify: `hooks/settings/use-settings-mutations.ts`
- Create: `hooks/settings/use-workspace-mutations.ts`
- Create: `hooks/settings/use-member-mutations.ts`
- Create: `hooks/settings/use-profile-mutations.ts`
- Create: `hooks/settings/use-macro-mutations.ts`
- Create: `hooks/settings/use-tag-mutations.ts`
- Create: `hooks/settings/use-integration-mutations.ts`
- Modify: `hooks/settings/index.ts`

**Context:**
- `use-settings-mutations.ts` is 771 lines with 28+ mutations across 6 domains.
- Split into domain-specific files. Each file gets the mutations from its domain.
- If after reading the file the groupings are not clean (shared helpers, interleaved logic), leave as-is and skip this task.

- [ ] **Step 1: Read and analyze `use-settings-mutations.ts`**

Read the full file. Identify:
1. Shared helpers/utilities used across multiple mutations (e.g., token helpers)
2. The natural groupings:
   - Workspace: `useUpdateWorkspace`, `useUploadLogo`, `useDeleteLogo`
   - Members: `useInviteMember`, `useUpdateMemberRole`, `useRemoveMember`, `useResendInvite`, `useRevokeInvite`
   - Profile: `useUpdateProfile`, `useUploadAvatar`, `useDeleteAvatar`, `useChangePassword`, `useSignOutOthers`, `useEnrollMfa`, `useVerifyMfa`, `useUnenrollMfa`
   - Macros: `useDuplicateMacro`, `useArchiveMacro`, `useRestoreMacro`, `useDeleteMacro`, `useSaveMacroOnboarding`, `useGenerateMacros`
   - Tags: `useCreateTag`, `useUpdateTag`, `useDeleteTag`, `useMergeTags`
   - Integrations: `useConnectCustomEmail`, `useDisconnectEmail`, `useConnectShopify`, `useDisconnectShopify`
3. Whether the split is clean or would require duplicating significant shared code

If groupings are messy → skip this task entirely.

- [ ] **Step 2: Create domain-specific files**

For each domain, create a new file:
- `hooks/settings/use-workspace-mutations.ts`
- `hooks/settings/use-member-mutations.ts`
- `hooks/settings/use-profile-mutations.ts`
- `hooks/settings/use-macro-mutations.ts`
- `hooks/settings/use-tag-mutations.ts`
- `hooks/settings/use-integration-mutations.ts`

Each file gets `'use client'` directive, necessary imports, and its mutation hooks. If there are shared helpers, either:
- Keep them in `use-settings-mutations.ts` and import from there, or
- Move them to a `hooks/settings/utils.ts` file

- [ ] **Step 3: Delete `use-settings-mutations.ts` and update barrel**

Delete `use-settings-mutations.ts` after all mutations have been moved to domain files.

Update `hooks/settings/index.ts` to re-export from the new domain files (replacing the old `export * from './use-settings-mutations'` line):

```tsx
export * from './use-settings-data'
export * from './use-workspace-mutations'
export * from './use-member-mutations'
export * from './use-profile-mutations'
export * from './use-macro-mutations'
export * from './use-tag-mutations'
export * from './use-integration-mutations'
```

This preserves backward compatibility — any existing `import { useUpdateWorkspace } from '@/hooks/settings'` still resolves.

- [ ] **Step 5: Verify build**

Run: `npx next build 2>&1 | head -50`
Expected: Build succeeds. All existing imports still resolve.

---

## Final Verification

### Task 14: Full build and review

- [ ] **Step 1: Run full build**

```bash
npx next build
```

Expected: Clean build with no errors.

- [ ] **Step 2: Run linter if configured**

```bash
npx next lint 2>&1 | head -50
```

Fix any lint issues introduced by the cleanup.

- [ ] **Step 3: Quick manual review**

Verify no `supabase.auth.getSession()` calls remain in the migrated files:
```bash
grep -r "getSession" --include="*.tsx" --include="*.ts" app/ components/ | grep -v node_modules | grep -v reset-password | grep -v blocked-state
```

Expected: Only `reset-password/page.tsx` and `blocked-state-guard.tsx` (excluded by design).

- [ ] **Step 4: Fix any lint/build issues found**
