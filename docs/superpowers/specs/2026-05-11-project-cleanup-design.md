# Project Cleanup & Refactoring Design

**Date:** 2026-05-11
**Scope:** Codebase-wide cleanup organized by concern, not by file.
**Excluded:** Hardcoded hex color migration (in progress separately).

---

## Approach

Four sequential passes, each producing focused commits:

1. shadcn component migration
2. Auth store migration
3. Component extraction (lighter touch)
4. Small fixes (constants, mutations, hook splitting)

---

## Pass 1: shadcn Component Migration

Replace custom `<button>`, `<input>`, and `<select>` elements with existing shadcn components from `components/ui/`.

### Files & Changes

**`app/inbox/create/page.tsx`**
- ~8 primary/action `<button>` → `<Button>` with `variant` (default/outline/ghost) and `size`. Toolbar formatting buttons (B, I, U) and tiny inline controls (tag remove X, macro clear X) stay as raw `<button>` — shadcn Button's padding/focus rings conflict with toolbar layouts.
- ~7 custom `<input>` (subject, search, tag, to, cc, bcc, macroSearch) → `<Input>` with layout `className`. Preserve `onMouseDown={(e) => e.preventDefault()}` on any button near the contenteditable editor to prevent focus loss.
- 1 custom `<select>` (priority) → `<Select>` + `<SelectTrigger>` + `<SelectContent>` + `<SelectItem>`, wrapped in `<Controller>` for react-hook-form

**`app/onboarding/page.tsx`**
- ~8 custom `<button>` (Get Started, Connect Gmail, Connect Shopify, Connect ParcelPanel, Complete, Skip, etc.) → `<Button>` with appropriate variants
- Inputs already use shadcn Input — no changes needed

**`app/home/page.tsx`**
- ~3 custom `<button>` (send, suggestion chips) → `<Button>`
- ~2 custom `<input>`/`<textarea>` (hero search, bottom input) → `<Input>` / `<Textarea>`

### Rules
- Use existing shadcn variants — don't create new ones
- Layout-specific tweaks go in `className`, not `style={{}}`
- Select uses base-ui render prop pattern (not asChild)

---

## Pass 2: Auth Store Migration

Replace direct `supabase.auth.getSession()` calls with `useAuthStore` selectors. The `AuthHydrator` in root layout already populates the store.

### Pattern A: Redirect-on-no-session

**Before:**
```tsx
supabase.auth.getSession().then(({ data: { session } }) => {
  if (!session) { router.replace('/login'); return }
  setUser(session.user)
})
```

**After:**
```tsx
const session = useAuthStore((s) => s.session)
const isLoading = useAuthStore((s) => s.isLoading)

useEffect(() => {
  if (!isLoading && !session) router.replace('/login')
}, [isLoading, session, router])
```

### Pattern B: Access token for API calls

Several files use `getSession()` primarily to get `session.access_token` for `Authorization` headers.

**Before:**
```tsx
const { data: { session } } = await supabase.auth.getSession()
if (!session) return
await fetch('/api/...', { headers: { Authorization: `Bearer ${session.access_token}` } })
```

**After:**
```tsx
const session = useAuthStore.getState().session
if (!session) return
await fetch('/api/...', { headers: { Authorization: `Bearer ${session.access_token}` } })
```

For components that use both patterns (redirect + API calls), combine: use the reactive selector for redirect, and `useAuthStore.getState()` inside event handlers/callbacks for tokens.

### Files (11 total)

**Pages:**
- `app/home/page.tsx` — already uses `useAuthStore`, just remove redundant `getSession()` call and `supabase` import
- `app/onboarding/page.tsx` — Pattern A + B (redirect + Shopify connect token)
- `app/performance/page.tsx` — Pattern A
- `app/pricing-required/page.tsx` — Pattern A

**Feature components:**
- `components/features/academy/academy-page.tsx` — Pattern A + B (redirect + API token)
- `components/features/academy/final-exam.tsx` — Pattern A + B
- `components/features/academy/certificate-page.tsx` — Pattern A + B

**Shared/layout (Pattern B — access token for API calls):**
- `components/layout/setup-checklist.tsx`
- `components/shared/feedback-modal.tsx`
- `components/shared/welcome-banner.tsx`
- `components/providers/sentry-user-sync.tsx`

### Excluded from this pass

- **`app/reset-password/page.tsx`** — has two `getSession()` calls inside a timing-sensitive hash-fragment parsing flow for PASSWORD_RECOVERY. Replacing with the store risks a race condition where the store hydrates before Supabase parses the URL hash. Leave as-is.
- **`components/shared/blocked-state-guard.tsx`** — gate component that checks subscription status via API call on mount. Since `AuthHydrator` is async, there's a timing window where `session` is `null` while hydrating. The direct `getSession()` call is more reliable here. Leave as-is.

### Rules
- Remove local `user` state that duplicates what the store provides
- Remove `supabase` import if no longer needed after migration
- `onAuthStateChange()` for event listening is acceptable — don't replace those
- Use reactive selectors (`useAuthStore((s) => s.session)`) for render-dependent reads; use `useAuthStore.getState()` inside callbacks/handlers for token access

---

## Pass 3: Component Extraction

Lighter touch — only extract the most obvious standalone sections to bring files under size thresholds.

### `customer-sidebar.tsx` (778 lines) → extract 2 components

| New component | What it contains | Approx lines |
|---|---|---|
| `CustomerStats` | 3-column KPI bar (spent, orders, refund %) | ~30 |
| `OrdersSection` | Entire orders tab content | ~300 |

Remaining sidebar: ~400 lines. New files go in `components/features/inbox/`.

### `customer-panel.tsx` (636 lines) → extract 2 components

| New component | What it contains | Approx lines |
|---|---|---|
| `CustomerCard` | Avatar, contact details, tags, note block | ~70 |
| `CustomerStatsGrid` | 3-column stats grid | ~35 |

Remaining panel: ~400 lines. New files go in `components/features/inbox/`.

### `final-exam.tsx` (633 lines) → extract 3 view components

| New component | What it contains | Approx lines |
|---|---|---|
| `ExamLockedView` | Lock icon, module progress checklist, return button | ~75 |
| `ExamIntroView` | Exam introduction/start screen | ~80 |
| `ExamResultsView` | Score display with confetti | ~100 |

Main `final-exam.tsx` becomes a thin state switcher (~100 lines). New files go in `components/features/academy/`.

### Rules
- Extracted components receive data via props — no new stores or context
- Keep imports minimal — extract component + its direct dependencies only
- Don't refactor the internal logic of extracted sections, just move them

---

## Pass 4: Small Fixes

### 4a. Constants extraction

| Source | What to extract | Destination |
|---|---|---|
| `final-exam.tsx` | `CONFETTI_COLORS`, `CONFETTI` arrays | `lib/academy-constants.ts` |
| `onboarding/page.tsx` | `brandSchema` zod schema | `lib/onboarding-constants.ts` (file already exists — add to it) |

### 4b. Direct fetch → TanStack mutation

- `onboarding/page.tsx`: `handleConnectShopify()` raw `fetch('/api/auth/shopify')` → extract to `hooks/onboarding/use-onboarding-mutations.ts` as a `useMutation`
- The mutation uses `session.access_token` from auth store (not from `getSession()`)

### 4c. Hook file splitting

- `hooks/settings/use-settings-mutations.ts` (771 lines): split into domain-specific files if clear groupings exist (e.g., workspace vs. personal mutations)
- If groupings aren't obvious after inspection, leave as-is

---

## Out of Scope

- Hardcoded hex color → CSS variable migration (in progress separately)
- Deep restructuring of folder hierarchy
- Adding new features or changing behavior
- Modifying API routes or backend logic
