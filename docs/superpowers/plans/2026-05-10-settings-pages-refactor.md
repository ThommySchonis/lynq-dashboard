# Settings Pages Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor 8 settings pages + sidebar + layout (~7,700 lines) from monolithic JS with CSS injection to modular TypeScript components with TanStack React Query, Zustand, Tailwind, and shadcn.

**Architecture:** Bottom-up approach — types/constants/hooks first, then shared components, then sidebar/layout, then pages from smallest to largest. Each page becomes a thin route file importing a view component from `components/features/settings/`. Server data flows through TanStack hooks, UI state through a minimal Zustand store, all styling via Tailwind + shadcn.

**Tech Stack:** Next.js 16 (app router), React 19, TypeScript, TanStack React Query, Zustand, Tailwind CSS, shadcn/base-ui, Lucide icons, Supabase client SDK, sonner (toasts).

**Spec:** `docs/superpowers/specs/2026-05-10-settings-pages-refactor-design.md`

**Reference implementations:**
- Admin refactor plan: `docs/superpowers/plans/2026-05-10-admin-page-refactor.md`
- Admin hooks pattern: `hooks/admin/use-admin-data.ts`, `hooks/admin/use-admin-mutations.ts`
- Admin store pattern: `stores/admin-ui.ts`
- Admin sidebar pattern: `components/features/admin/admin-sidebar.tsx`
- Admin layout pattern: `app/admin/layout.tsx`
- Existing tag constants: `lib/tags.ts` (reuse `TAG_COLORS`, `TAG_PALETTE`, `paletteFor`, `sanitizeTagName`)
- Existing macro constants: `lib/macros.ts` (reuse `MACRO_LANGS`, `relativeTime`)

---

## Task 1: Types

**Files:**
- Create: `types/settings.ts`

- [ ] **Step 1: Create types file**

Copy the full type definitions from the spec's Types section into `types/settings.ts`. This includes:
- `WorkspaceSettings`, `WorkspacePreferences`
- `MemberRole`, `Member`, `Invite`
- `Theme`, `UserProfile`
- `PasswordChangeForm`, `MfaFactor`
- `MacroFilter`, `MacroOnboarding`, `MacroWizardStep`, `BrandVoice`
- `Tag`, `TagForm`
- `EmailProvider`, `ConnectionStatus`, `EmailAccount`, `CustomEmailConfig`, `ShopifyIntegration`

See spec lines 175-316 for the complete code.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to `types/settings.ts`

---

## Task 2: Constants

**Files:**
- Create: `lib/settings-constants.ts`

- [ ] **Step 1: Create constants file**

Extract all inline constants from the settings pages. Reference the source files for exact values:

```typescript
// lib/settings-constants.ts
import type { ComponentType } from 'react'
import type {
  MemberRole, MacroFilter, MacroOnboarding, MacroWizardStep,
  BrandVoice, PasswordChangeForm, CustomEmailConfig, Theme,
} from '@/types/settings'
import { Monitor, Moon, Sun } from 'lucide-react'

// ── Navigation ──
export interface SettingsNavItem {
  label: string
  href: string
}

export interface SettingsNavGroup {
  group: string
  items: SettingsNavItem[]
}

export const SETTINGS_NAV: SettingsNavGroup[] = [
  { group: 'WORKSPACE', items: [
    { label: 'General', href: '/settings/workspace/general' },
    { label: 'Users', href: '/settings/workspace/members' },
    { label: 'Macros', href: '/settings/workspace/macros' },
    { label: 'Tags', href: '/settings/workspace/tags' },
    { label: 'Billing', href: '/settings/workspace/billing' },
  ]},
  { group: 'EMAIL', items: [
    { label: 'Email integration', href: '/settings/integrations/email' },
  ]},
  { group: 'INTEGRATIONS', items: [
    { label: 'Shopify', href: '/settings/integrations/shopify' },
  ]},
  { group: 'PERSONAL', items: [
    { label: 'Profile', href: '/settings/personal/profile' },
    { label: 'Password & 2FA', href: '/settings/personal/security' },
  ]},
]

// Flat list for search filtering
export const ALL_SETTINGS_ITEMS = SETTINGS_NAV.flatMap(g =>
  g.items.map(item => ({ ...item, group: g.group }))
)

// ── Roles ──
export const ROLE_LABELS: Record<MemberRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  agent: 'Agent',
  observer: 'Observer',
}

export const ROLE_DESCS: Record<string, string> = {
  admin: 'Manage workspace & users',
  agent: 'Handle tickets & Shopify',
  observer: 'View-only access',
}

export const ROLE_DESCS_FULL: Record<MemberRole, string> = {
  owner: 'Full access including billing',
  admin: 'Manage workspace and members',
  agent: 'Handle tickets and customers',
  observer: 'View-only access',
}

export const ROLES_FOR_OWNER: MemberRole[] = ['owner', 'admin', 'agent', 'observer']
export const ROLES_FOR_ADMIN: MemberRole[] = ['admin', 'agent', 'observer']
```

Continue with remaining constants. Extract exact values from source pages:

- `TIMEZONES` — from `app/settings/workspace/general/page.js` (search for the `TIMEZONES` array)
- `WORKSPACE_DEFAULTS` — from the `DEFAULTS` object in general/page.js
- `THEMES` — from `app/settings/personal/profile/page.js` (3 items with Lucide icons)
- `MACRO_LANGUAGES` — from `app/settings/workspace/macros/page.js` `LANGUAGES` array. Note: reuse `MACRO_LANGS` from `lib/macros.ts` for the value list, add labels here.
- `LANG_LABELS` — from `LANG_LABEL` object in macros/page.js
- `BRAND_VOICES` — from `app/settings/workspace/macros/generate/page.js`
- `RETURN_SHIPPING` — from generate/page.js
- `DAMAGE_POLICY` — from generate/page.js
- `WIZARD_STEPS` — from `STEP_TITLES` in generate/page.js
- `INITIAL_PASSWORD_FORM` — `{ current_password: '', new_password: '', confirm_password: '' }`
- `INITIAL_CUSTOM_EMAIL_FORM` — from integrations/email/page.js custom email modal defaults
- `INITIAL_MACRO_WIZARD_FORM` — from the `EMPTY` object in generate/page.js

**Important:** Read each source file to get exact values. Do not guess or invent data.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to settings files

---

## Task 3: Zustand Store

**Files:**
- Create: `stores/settings-ui.ts`

- [ ] **Step 1: Create the store**

Follow the pattern from `stores/admin-ui.ts`:

```typescript
// stores/settings-ui.ts
import { create } from 'zustand'
import type { MacroFilter } from '@/types/settings'

interface SettingsUIState {
  // Tags page: bulk selection
  selectedTagIds: Set<string>
  toggleTagSelection: (id: string) => void
  selectAllTags: (ids: string[]) => void
  clearTagSelection: () => void

  // Macros page: filter state
  macroFilter: MacroFilter
  setMacroFilter: (filter: Partial<MacroFilter>) => void
}

export const useSettingsUI = create<SettingsUIState>()((set) => ({
  selectedTagIds: new Set(),
  toggleTagSelection: (id) =>
    set((s) => {
      const next = new Set(s.selectedTagIds)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { selectedTagIds: next }
    }),
  selectAllTags: (ids) => set({ selectedTagIds: new Set(ids) }),
  clearTagSelection: () => set({ selectedTagIds: new Set() }),

  macroFilter: { search: '', language: '', tags: [], archived: false },
  setMacroFilter: (filter) =>
    set((s) => ({ macroFilter: { ...s.macroFilter, ...filter } })),
}))
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

---

## Task 4: TanStack Query Hooks

**Files:**
- Create: `hooks/settings/use-settings-data.ts`
- Create: `hooks/settings/index.ts`

- [ ] **Step 1: Create query hooks**

Follow the pattern from `hooks/admin/use-admin-data.ts`. Each hook uses `useQuery<Type>()`.

```typescript
// hooks/settings/use-settings-data.ts
'use client'

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import type {
  WorkspaceSettings, Member, UserProfile, Tag,
  EmailAccount, ShopifyIntegration, MacroOnboarding, MacroFilter,
} from '@/types/settings'
import type { Macro } from '@/types/inbox'

function useToken() {
  return useAuthStore((s) => s.session?.access_token ?? '')
}

export const settingsKeys = {
  all: ['settings'] as const,
  workspace: () => [...settingsKeys.all, 'workspace'] as const,
  members: () => [...settingsKeys.all, 'members'] as const,
  profile: () => [...settingsKeys.all, 'profile'] as const,
  macros: (filter: MacroFilter) => [...settingsKeys.all, 'macros', filter] as const,
  macroOnboarding: () => [...settingsKeys.all, 'macro-onboarding'] as const,
  tags: () => [...settingsKeys.all, 'tags'] as const,
  emailAccounts: () => [...settingsKeys.all, 'email-accounts'] as const,
  shopify: () => [...settingsKeys.all, 'shopify'] as const,
}
```

Then implement each hook. Reference the API calls from each source page:

- `useWorkspace()` — direct Supabase query on `workspaces` table. Read `app/settings/workspace/general/page.js` for the exact query pattern (fetches current workspace via session).
- `useMembers()` — GET `/api/workspaces/current/members` with Bearer token. Read `app/settings/workspace/members/page.js` for the fetch call.
- `useProfile()` — GET `/api/profile` with Bearer token. Read `app/settings/personal/profile/page.js`.
- `useMacros(filter)` — GET `/api/macros` with query params from filter. Read `app/settings/workspace/macros/page.js` for the fetch call and param construction.
- `useMacroOnboarding()` — GET `/api/macros/onboarding` with Bearer token. Read `app/settings/workspace/macros/generate/page.js`.
- `useTags()` — GET `/api/tags` with Bearer token. Read `app/settings/workspace/tags/page.js`.
- `useEmailAccounts()` — GET `/api/inbox/accounts` with Bearer token. Read `app/settings/integrations/email/page.js`.
- `useShopifyIntegration()` — GET `/api/settings/integrations/shopify` with Bearer token. Read `app/settings/integrations/shopify/page.js`.

- [ ] **Step 2: Create index file**

```typescript
// hooks/settings/index.ts
export * from './use-settings-data'
```

Note: mutations re-export will be added in Task 5.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

---

## Task 5: TanStack Mutation Hooks

**Files:**
- Create: `hooks/settings/use-settings-mutations.ts`
- Modify: `hooks/settings/index.ts`

- [ ] **Step 1: Create mutation hooks**

Follow the pattern from `hooks/admin/use-admin-mutations.ts`. Each hook uses `useMutation()` with `onSuccess` cache invalidation.

Implement all mutations from the spec (lines 401-430). For each mutation:
1. Read the corresponding source page to find the exact `fetch()` call or Supabase SDK call
2. Port it into a `mutationFn`
3. Add `onSuccess` with `queryClient.invalidateQueries()`

Key implementation notes:
- **Workspace mutations** (`useUpdateWorkspace`, `useUploadLogo`, `useDeleteLogo`): Read `app/settings/workspace/general/page.js` — uses PATCH/POST/DELETE to `/api/workspaces/current` and `/api/workspaces/current/logo`
- **Member mutations**: Read `app/settings/workspace/members/page.js` — uses `/api/workspaces/current/members`
- **Profile/Avatar mutations**: Read `app/settings/personal/profile/page.js` — uses `/api/profile` and `/api/profile/avatar`
- **Auth SDK mutations** (`useChangePassword`, `useSignOutOthers`, `useEnrollMfa`, `useVerifyMfa`, `useUnenrollMfa`): Read `app/settings/personal/security/page.js` — uses `supabase.auth.*` directly, NOT API routes
- **Macro mutations**: Read `app/settings/workspace/macros/page.js` — uses `/api/macros/[id]/duplicate`, `/archive`, `/restore`, DELETE
- **Tag mutations**: Read `app/settings/workspace/tags/page.js` — uses `/api/tags` CRUD + `/api/tags/merge`
- **Email mutations**: Read `app/settings/integrations/email/page.js` — uses `/api/auth/custom-email/connect` and DELETE `/api/inbox/accounts/[id]`
- **Shopify mutations**: Read `app/settings/integrations/shopify/page.js` — uses `/api/shopify/manual-connect`

- [ ] **Step 2: Update index.ts**

```typescript
// hooks/settings/index.ts
export * from './use-settings-data'
export * from './use-settings-mutations'
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

---

## Task 6: Shared Settings Components

**Files:**
- Create: `components/features/settings/settings-section.tsx`
- Create: `components/features/settings/settings-field.tsx`
- Create: `components/features/settings/settings-toggle.tsx`
- Create: `components/features/settings/password-input.tsx`
- Create: `components/features/settings/confirm-dialog.tsx`
- Create: `components/features/settings/status-badge.tsx`

- [ ] **Step 1: Create SettingsSection**

White card container. Port the `SettingsSection` + `SettingsCard` patterns from `app/settings/workspace/general/page.js` (search for `function SettingsSection` and `function SettingsCard`). Convert all inline styles to Tailwind.

```typescript
// components/features/settings/settings-section.tsx
'use client'

import type { ReactNode } from 'react'

interface SettingsSectionProps {
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
}

export function SettingsSection({ title, description, actions, children }: SettingsSectionProps) {
  return (
    <div className="rounded-xl border border-border bg-white p-7 mb-5">
      <div className="flex items-start justify-between mb-1">
        <div>
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          {description && (
            <p className="text-[13px] text-muted-foreground mt-1">{description}</p>
          )}
        </div>
        {actions && <div>{actions}</div>}
      </div>
      <div className="mt-5">{children}</div>
    </div>
  )
}
```

- [ ] **Step 2: Create SettingsField**

Port the `SettingsField` pattern from general/page.js. Uses shadcn `Label`.

```typescript
// components/features/settings/settings-field.tsx
'use client'

import type { ReactNode } from 'react'
import { Label } from '@/components/ui/label'

interface SettingsFieldProps {
  label: string
  hint?: string
  error?: string
  children: ReactNode
}

export function SettingsField({ label, hint, error, children }: SettingsFieldProps) {
  return (
    <div className="mb-4 last:mb-0">
      <Label className="text-[13px] font-medium text-foreground mb-1.5 block">{label}</Label>
      {children}
      {hint && !error && (
        <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>
      )}
      {error && (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create SettingsToggle**

Uses shadcn `Switch`. Port the custom `Toggle` from general/page.js.

```typescript
// components/features/settings/settings-toggle.tsx
'use client'

import { Switch } from '@/components/ui/switch'

interface SettingsToggleProps {
  label: string
  description?: string
  checked: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
}

export function SettingsToggle({ label, description, checked, onChange, disabled }: SettingsToggleProps) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <div className="text-sm font-medium text-foreground">{label}</div>
        {description && (
          <div className="text-[13px] text-muted-foreground mt-0.5">{description}</div>
        )}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  )
}
```

- [ ] **Step 4: Create PasswordInput**

Shadcn `Input` with eye toggle. Port from `app/settings/personal/security/page.js` (search for the password visibility toggle pattern). Also duplicated in integrations/email and integrations/shopify pages.

```typescript
// components/features/settings/password-input.tsx
'use client'

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui/input'

interface PasswordInputProps extends Omit<React.ComponentProps<typeof Input>, 'type'> {
  // All Input props except type
}

export function PasswordInput(props: PasswordInputProps) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <Input {...props} type={visible ? 'text' : 'password'} className={`pr-10 ${props.className ?? ''}`} />
      <button
        type="button"
        onClick={() => setVisible(!visible)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        tabIndex={-1}
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  )
}
```

- [ ] **Step 5: Create ConfirmDialog**

Uses shadcn `Dialog`. Port the `ConfirmDialog` from general/page.js, replacing inline styles with Tailwind.

```typescript
// components/features/settings/confirm-dialog.tsx
'use client'

import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel?: string
  onConfirm: () => void
  variant?: 'danger' | 'default'
  loading?: boolean
}

export function ConfirmDialog({
  open, onOpenChange, title, description,
  confirmLabel = 'Confirm', onConfirm,
  variant = 'default', loading = false,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Note: shadcn in this project uses base-ui, not Radix.
          Check existing Dialog usage in components/ui/dialog.tsx for the exact content pattern.
          The dialog should render title, description, and two buttons (Cancel + Confirm).
          Confirm button: variant="destructive" if variant='danger', otherwise default. */}
      <div className="p-6">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground mt-2">{description}</p>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant={variant === 'danger' ? 'destructive' : 'default'}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Loading...' : confirmLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
```

**Important:** Read `components/ui/dialog.tsx` to understand the exact shadcn/base-ui Dialog API before implementing. The pattern may differ from Radix — this project uses `render` prop instead of `asChild`.

- [ ] **Step 6: Create StatusBadge**

Small pill for connection status.

```typescript
// components/features/settings/status-badge.tsx
import type { ConnectionStatus } from '@/types/settings'

const STATUS_STYLES: Record<ConnectionStatus, { dot: string; text: string; bg: string }> = {
  active: { dot: 'bg-green-500', text: 'text-green-700', bg: 'bg-green-50' },
  pending: { dot: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50' },
  error: { dot: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50' },
  disconnected: { dot: 'bg-gray-400', text: 'text-gray-600', bg: 'bg-gray-50' },
}

interface StatusBadgeProps {
  status: ConnectionStatus
  label?: string
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const s = STATUS_STYLES[status]
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {label ?? status}
    </span>
  )
}
```

- [ ] **Step 7: Verify build**

Run: `npx next build 2>&1 | tail -20`
Expected: Build succeeds

---

## Task 7: Settings Sidebar

**Files:**
- Create: `components/features/settings/settings-sidebar.tsx`

- [ ] **Step 1: Create SettingsSidebar**

Port `app/components/settings/SettingsSidebar.js` to TypeScript + Tailwind. The source file is ~280 lines with CSS injection — the new version should be significantly shorter.

Key behaviors to preserve:
- "Settings" header title
- Search input with ⌘K hint
- Dropdown of filtered results when searching
- Nav groups from `SETTINGS_NAV` constant
- Active item highlighting via `usePathname()`
- Divider before "Personal" group
- Navigation via `<Link>` components
- Close dropdown on outside click
- Escape key clears search

Replace:
- `const CSS = \`...\`` (150+ lines) → Tailwind classes
- Custom `.ss-*` classes → Tailwind utilities
- `<style>{CSS}</style>` injection → remove entirely

Use shadcn `Input` for the search field. Use `Search` icon from lucide-react.

Export as both named and default:
```typescript
export function SettingsSidebar() { ... }
export default SettingsSidebar
```

Read the full source at `app/components/settings/SettingsSidebar.js` for exact behavior.

- [ ] **Step 2: Verify build**

Run: `npx next build 2>&1 | tail -20`

---

## Task 8: Settings Layout & Small Pages

**Files:**
- Rename: `app/settings/layout.js` → delete after creating `.tsx`
- Create: `app/settings/layout.tsx`
- Rename: `app/settings/page.js` → delete after creating `.tsx`
- Create: `app/settings/page.tsx`
- Rename: `app/settings/email/page.js` → delete after creating `.tsx`
- Create: `app/settings/email/page.tsx`
- Rename: `app/settings/[category]/[page]/page.js` → delete after creating `.tsx`
- Create: `app/settings/[category]/[page]/page.tsx`
- [ ] **Step 1: Create layout.tsx**

Read `app/settings/layout.js` for the current structure. It imports both `Sidebar` (main app nav) and `SettingsSidebar`.

Port to TypeScript + Tailwind. Follow the pattern from `app/admin/layout.tsx` but without the auth guard (settings layout doesn't need one — auth is handled at a higher level).

```typescript
// app/settings/layout.tsx
import Sidebar from '../components/Sidebar'
import SettingsSidebar from '@/components/features/settings/settings-sidebar'

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-[#F8F7FA] overflow-hidden">
      <Sidebar />
      <div className="w-[260px] shrink-0" /> {/* spacer for fixed sidebar */}
      <SettingsSidebar />
      <main className="flex-1 overflow-y-auto min-w-0">
        {children}
      </main>
    </div>
  )
}
```

**Important:** Read the current `app/settings/layout.js` to verify the exact import path for `Sidebar` and the layout structure. The spacer div width must match the main sidebar width. Adjust as needed.

- [ ] **Step 2: Create page.tsx (root redirect)**

```typescript
// app/settings/page.tsx
import { redirect } from 'next/navigation'

export default function SettingsPage() {
  redirect('/settings/workspace/general')
}
```

- [ ] **Step 3: Create email/page.tsx (placeholder)**

Read `app/settings/email/page.js` for the current placeholder UI. Convert inline styles to Tailwind. Use Lucide `Clock` icon.

- [ ] **Step 4: Create [category]/[page]/page.tsx (catch-all)**

Read `app/settings/[category]/[page]/page.js` for the whitelist validation logic and placeholder UI. Convert to TypeScript + Tailwind.

- [ ] **Step 5: Delete old .js files**

```bash
rm app/settings/layout.js app/settings/page.js app/settings/email/page.js "app/settings/[category]/[page]/page.js"
```

- [ ] **Step 6: Verify build**

Run: `npx next build 2>&1 | tail -20`
Expected: Build succeeds. `/settings` redirects to `/settings/workspace/general`.

---

## Task 9: Workspace General Page

**Files:**
- Create: `components/features/settings/workspace/identity-section.tsx`
- Create: `components/features/settings/workspace/regional-section.tsx`
- Create: `components/features/settings/workspace/preferences-section.tsx`
- Create: `components/features/settings/workspace/danger-zone-section.tsx`
- Create: `components/features/settings/workspace/general-settings.tsx`
- Rename: `app/settings/workspace/general/page.js` → delete after creating `.tsx`
- Create: `app/settings/workspace/general/page.tsx`

- [ ] **Step 1: Create IdentitySection**

Port the identity section (workspace name + logo upload) from `app/settings/workspace/general/page.js`. Search for the name input and logo upload logic. Uses `useWorkspace()`, `useUpdateWorkspace()`, `useUploadLogo()`, `useDeleteLogo()`. Uses `SettingsSection`, `SettingsField`, shadcn `Input`, `Button`. Logo upload: 2MB max, preview circle, upload/delete buttons.

- [ ] **Step 2: Create RegionalSection**

Port the regional settings (timezone, locale, date format, time format selects). References `TIMEZONES` from `lib/settings-constants.ts`. Uses shadcn `Select` for dropdowns. Uses `SettingsSection`, `SettingsField`.

- [ ] **Step 3: Create PreferencesSection**

Port the preferences toggles. 3 `SettingsToggle` rows: show order data, auto-translate, allow deletion. Uses `SettingsSection`.

- [ ] **Step 4: Create DangerZoneSection**

Port the danger zone (delete workspace). Red-bordered `SettingsSection` with delete button. Uses `ConfirmDialog` with type-to-confirm for workspace name.

- [ ] **Step 5: Create GeneralSettings view**

Composes all 4 sections in a vertical stack. Manages dirty state per section with save/discard sticky footer. Uses `useWorkspace()` for initial data, passes data down to sections.

```typescript
// components/features/settings/workspace/general-settings.tsx
'use client'

// Orchestrates IdentitySection, RegionalSection, PreferencesSection, DangerZoneSection
// Each section receives current values + onChange handlers
// GeneralSettings manages the form state and dirty tracking
```

Read `app/settings/workspace/general/page.js` for the complete state management pattern — it tracks `initIdentity`, `initRegional`, `initToggles` vs current values to show save/discard.

- [ ] **Step 6: Create page.tsx**

```typescript
// app/settings/workspace/general/page.tsx
'use client'

import { GeneralSettings } from '@/components/features/settings/workspace/general-settings'

export default function GeneralPage() {
  return <GeneralSettings />
}
```

- [ ] **Step 7: Delete old page.js and verify**

```bash
rm app/settings/workspace/general/page.js
```

Run: `npx next build 2>&1 | tail -20`

---

## Task 10: Workspace Members Page

**Files:**
- Create: `components/features/settings/workspace/members-table.tsx`
- Create: `components/features/settings/workspace/invite-modal.tsx`
- Create: `components/features/settings/workspace/members-view.tsx`
- Rename: `app/settings/workspace/members/page.js` → delete after creating `.tsx`
- Create: `app/settings/workspace/members/page.tsx`

- [ ] **Step 1: Create MembersTable**

Port the member table from `app/settings/workspace/members/page.js`. This is the largest component — ~600 lines of the original page. Uses shadcn `Table`, `DropdownMenu`, `Badge`. Features:
- Search filtering
- Columns: user (avatar + name + email + "you" badge), role (clickable badge with dropdown), joined date, actions
- Role dropdown: different options for owner vs admin (use `ROLES_FOR_OWNER`/`ROLES_FOR_ADMIN`)
- 3-dot menu: change role, remove member
- Permission checks via `lib/permissions.ts`
- Uses `useMembers()`, `useUpdateMemberRole()`, `useRemoveMember()`, `ConfirmDialog`

Read the source file carefully for the role badge colors, initials helper, and permission logic.

- [ ] **Step 2: Create InviteModal**

Port the invite modal from members/page.js. Uses shadcn `Dialog`, `Input`, `Button`. Features:
- Email input with validation
- Role selector buttons (cards showing role label + description)
- Uses `useInviteMember()`
- Permission-aware: which roles can be selected

- [ ] **Step 3: Create MembersView**

Composes MembersTable + InviteModal. Header with title, subtitle (member count), and "Invite" button. Seat counter bar. Uses `useMembers()` for count.

- [ ] **Step 4: Create page.tsx and delete old**

```typescript
// app/settings/workspace/members/page.tsx
'use client'

import { MembersView } from '@/components/features/settings/workspace/members-view'

export default function MembersPage() {
  return <MembersView />
}
```

```bash
rm app/settings/workspace/members/page.js
```

Run: `npx next build 2>&1 | tail -20`

---

## Task 11: Workspace Macros Page

**Files:**
- Create: `components/features/settings/macros/macros-toolbar.tsx`
- Create: `components/features/settings/macros/macro-row.tsx`
- Create: `components/features/settings/macros/macros-list.tsx`
- Rename: `app/settings/workspace/macros/page.js` → delete after creating `.tsx`
- Create: `app/settings/workspace/macros/page.tsx`
- Rename: `app/settings/workspace/macros/new/page.js` → delete after creating `.tsx`
- Create: `app/settings/workspace/macros/new/page.tsx`
- Rename: `app/settings/workspace/macros/[id]/page.js` → delete after creating `.tsx`
- Create: `app/settings/workspace/macros/[id]/page.tsx`

- [ ] **Step 1: Create MacrosToolbar**

Port the toolbar from `app/settings/workspace/macros/page.js`. Search input + language filter (shadcn `Select`) + tag filter. Reads/writes `macroFilter` from `useSettingsUI` store. References `MACRO_LANGUAGES`, `LANG_LABELS` from constants.

- [ ] **Step 2: Create MacroRow**

Port the macro row from macros/page.js. Table row showing: name, tag pills (colored via `TAG_PALETTE`), language badge (via `LANG_LABELS`), usage count, relative time (via `relativeTime()` from `lib/macros.ts`), 3-dot menu with Edit/Duplicate/Archive|Restore/Delete actions. Uses shadcn `DropdownMenu`. Uses `ConfirmDialog` for delete.

- [ ] **Step 3: Create MacrosList**

Composes MacrosToolbar + tabs (Active/Archived using shadcn `Tabs`) + macro table. Uses `useMacros(filter)` with filter from `useSettingsUI`, `useDuplicateMacro()`, `useArchiveMacro()`, `useRestoreMacro()`, `useDeleteMacro()`. Loading skeleton state.

- [ ] **Step 4: Create page files**

```typescript
// app/settings/workspace/macros/page.tsx
'use client'
import { MacrosList } from '@/components/features/settings/macros/macros-list'
export default function MacrosPage() { return <MacrosList /> }
```

```typescript
// app/settings/workspace/macros/new/page.tsx
'use client'
import { MacroEditor } from '@/components/features/inbox/macro-editor'
export default function NewMacroPage() { return <MacroEditor mode="new" /> }
```

For `macros/[id]/page.tsx`: Read the current `page.js` for how it extracts `macroId` from params (uses React 19 `use()` hook). Port the same pattern to TypeScript.

- [ ] **Step 5: Delete old files and verify**

```bash
rm app/settings/workspace/macros/page.js app/settings/workspace/macros/new/page.js "app/settings/workspace/macros/[id]/page.js"
```

Run: `npx next build 2>&1 | tail -20`

---

## Task 12: Macro Generate Wizard

**Files:**
- Create: `components/features/settings/macros/wizard-progress.tsx`
- Create: `components/features/settings/macros/wizard-step-brand.tsx`
- Create: `components/features/settings/macros/wizard-step-contact.tsx`
- Create: `components/features/settings/macros/wizard-step-policies.tsx`
- Create: `components/features/settings/macros/wizard-step-final.tsx`
- Create: `components/features/settings/macros/macro-wizard.tsx`
- Rename: `app/settings/workspace/macros/generate/page.js` → delete after creating `.tsx`
- Create: `app/settings/workspace/macros/generate/page.tsx`

- [ ] **Step 1: Create WizardProgress**

Step indicator bar with numbered circles and connecting lines. Port from `app/settings/workspace/macros/generate/page.js` (search for the progress/step indicator rendering).

Props: `steps: MacroWizardStep[]`, `currentStep: number`.

- [ ] **Step 2: Create WizardStepBrand**

Step 1 form: brand name input, brand email input, brand voice selector (card grid from `BRAND_VOICES` constant). Port from generate/page.js step 1 section.

Props: `form: MacroOnboarding`, `onChange: (field, value) => void`, `errors: Record<string, string>`.

- [ ] **Step 3: Create WizardStepContact**

Step 2 form: contact info, shipping details. Port from generate/page.js step 2 section. Same props pattern.

- [ ] **Step 4: Create WizardStepPolicies**

Step 3 form: return window input, return shipping radio group (`RETURN_SHIPPING`), damage policy radio group (`DAMAGE_POLICY`). Port from generate/page.js step 3 section. Same props pattern.

- [ ] **Step 5: Create WizardStepFinal**

Step 4 form: extra notes textarea. Simple final step. Same props pattern.

- [ ] **Step 6: Create MacroWizard**

Orchestrates all steps. Local form state with `useState`, current step tracking, field validation per step. Uses `useMacroOnboarding()` to prefill, `useSaveMacroOnboarding()` to persist per step, `useGenerateMacros()` on final submit. Shows generating overlay with spinner. On success, navigates to `/settings/workspace/macros`.

Read `app/settings/workspace/macros/generate/page.js` for the complete validation logic and step navigation.

- [ ] **Step 7: Create page.tsx and delete old**

```typescript
// app/settings/workspace/macros/generate/page.tsx
'use client'
import { MacroWizard } from '@/components/features/settings/macros/macro-wizard'
export default function GenerateMacrosPage() { return <MacroWizard /> }
```

```bash
rm app/settings/workspace/macros/generate/page.js
```

Run: `npx next build 2>&1 | tail -20`

---

## Task 13: Workspace Tags Page

**Files:**
- Create: `components/features/settings/tags/tags-table.tsx`
- Create: `components/features/settings/tags/tag-edit-modal.tsx`
- Create: `components/features/settings/tags/tag-merge-modal.tsx`
- Create: `components/features/settings/tags/tags-bulk-bar.tsx`
- Create: `components/features/settings/tags/tags-view.tsx`
- Rename: `app/settings/workspace/tags/page.js` → delete after creating `.tsx`
- Create: `app/settings/workspace/tags/page.tsx`

- [ ] **Step 1: Create TagsTable**

Port the tag table from `app/settings/workspace/tags/page.js`. Searchable table with checkboxes. Columns: checkbox, color dot + name, usage count, 3-dot menu (Edit, Delete). Uses shadcn `Table`, `Checkbox`, `DropdownMenu`. Tag selection via `useSettingsUI` store (`selectedTagIds`, `toggleTagSelection`, `selectAllTags`). Color dots use `paletteFor()` from `lib/tags.ts`.

- [ ] **Step 2: Create TagEditModal**

Port `TagEditModal` from tags/page.js. shadcn `Dialog` with name input + color swatch picker. Color swatches use `TAG_COLORS` from `lib/tags.ts` with `TAG_PALETTE` for rendering. Uses `useCreateTag()` or `useUpdateTag()` depending on mode (create/edit).

- [ ] **Step 3: Create TagMergeModal**

Port `MergeModal` from tags/page.js. shadcn `Dialog` showing list of selected tags, user picks the "winner" tag that absorbs the others. Uses `useMergeTags()`.

- [ ] **Step 4: Create TagsBulkBar**

Fixed bottom bar visible when `selectedTagIds.size > 0`. Shows count + "Merge" button + "Delete" button. Merge opens TagMergeModal. Delete uses `ConfirmDialog` for bulk delete.

- [ ] **Step 5: Create TagsView**

Composes: header (title + "Create tag" button) + search + TagsTable + TagsBulkBar + TagEditModal. Uses `useTags()`.

- [ ] **Step 6: Create page.tsx and delete old**

```typescript
// app/settings/workspace/tags/page.tsx
'use client'
import { TagsView } from '@/components/features/settings/tags/tags-view'
export default function TagsPage() { return <TagsView /> }
```

```bash
rm app/settings/workspace/tags/page.js
```

Run: `npx next build 2>&1 | tail -20`

---

## Task 14: Integrations Email Page

**Files:**
- Create: `components/features/settings/integrations/email-account-row.tsx`
- Create: `components/features/settings/integrations/custom-email-modal.tsx`
- Create: `components/features/settings/integrations/email-settings.tsx`
- Create: `public/icons/gmail.svg`
- Create: `public/icons/outlook.svg`
- Rename: `app/settings/integrations/email/page.js` → delete after creating `.tsx`
- Create: `app/settings/integrations/email/page.tsx`

- [ ] **Step 1: Extract provider logo SVGs**

Create the icons directory and extract logo SVGs:

```bash
mkdir -p public/icons
```

Read `app/settings/integrations/email/page.js` and find the `GmailLogo` and `OutlookLogo` inline SVG components. Extract the SVG markup to separate files:
- `public/icons/gmail.svg`
- `public/icons/outlook.svg`

**Important:** When extracting, convert React JSX attributes to standard SVG attributes (e.g. `className` → `class`, remove any JSX expressions).

- [ ] **Step 2: Create EmailAccountRow**

Port the account row from email/page.js. Shows: provider icon (Gmail SVG, Outlook SVG, or Lucide `Mail`), email address, `StatusBadge`, disconnect button. Uses `useDisconnectEmail()`, `ConfirmDialog`.

- [ ] **Step 3: Create CustomEmailModal**

Port `CustomEmailModal` from email/page.js. shadcn `Dialog` with IMAP/SMTP configuration form: email, IMAP host/port, SMTP host/port, username, password (via `PasswordInput`), SSL toggle. Uses `useConnectCustomEmail()`.

- [ ] **Step 4: Create EmailSettings**

Composes: provider connection cards (Gmail, Outlook, Custom) at top + connected accounts list below. Gmail/Outlook connect via OAuth redirect (`window.location.href = '/api/auth/gmail'`). Custom opens `CustomEmailModal`. Account list maps `EmailAccountRow` components. Uses `useEmailAccounts()`.

- [ ] **Step 5: Create page.tsx and delete old**

```typescript
// app/settings/integrations/email/page.tsx
'use client'
import { EmailSettings } from '@/components/features/settings/integrations/email-settings'
export default function EmailIntegrationPage() { return <EmailSettings /> }
```

```bash
rm app/settings/integrations/email/page.js
```

Run: `npx next build 2>&1 | tail -20`

---

## Task 15: Integrations Shopify Page

**Files:**
- Create: `components/features/settings/integrations/shopify-connect-modal.tsx`
- Create: `components/features/settings/integrations/shopify-settings.tsx`
- Rename: `app/settings/integrations/shopify/page.js` → delete after creating `.tsx`
- Create: `app/settings/integrations/shopify/page.tsx`

- [ ] **Step 1: Create ShopifyConnectModal**

Port the connect modal from `app/settings/integrations/shopify/page.js`. shadcn `Dialog` with: store domain input (validates `.myshopify.com`), access token via `PasswordInput`. Uses `useConnectShopify()`.

- [ ] **Step 2: Create ShopifySettings**

Port the main view. Shows: connection status card with `StatusBadge`, store domain display, connect/disconnect buttons. Uses `useShopifyIntegration()`, `useDisconnectShopify()`, `ConfirmDialog` for disconnect.

- [ ] **Step 3: Create page.tsx and delete old**

```typescript
// app/settings/integrations/shopify/page.tsx
'use client'
import { ShopifySettings } from '@/components/features/settings/integrations/shopify-settings'
export default function ShopifyIntegrationPage() { return <ShopifySettings /> }
```

```bash
rm app/settings/integrations/shopify/page.js
```

Run: `npx next build 2>&1 | tail -20`

---

## Task 16: Personal Profile Page

**Files:**
- Create: `components/features/settings/personal/avatar-upload.tsx`
- Create: `components/features/settings/personal/theme-selector.tsx`
- Create: `components/features/settings/personal/profile-settings.tsx`
- Rename: `app/settings/personal/profile/page.js` → delete after creating `.tsx`
- Create: `app/settings/personal/profile/page.tsx`

- [ ] **Step 1: Create AvatarUpload**

Port avatar upload from `app/settings/personal/profile/page.js`. Avatar circle (96px) with initials fallback, upload button, delete button. Accepts PNG/JPG, 500KB max. Hover overlay. Uses `useUploadAvatar()`, `useDeleteAvatar()`.

- [ ] **Step 2: Create ThemeSelector**

Port theme card grid from profile/page.js. 3-column grid of theme cards (System/Dark/Light). Each card: Lucide icon, label, description. Selected state: purple border + checkmark. References `THEMES` from `lib/settings-constants.ts`.

- [ ] **Step 3: Create ProfileSettings**

Composes two `SettingsSection`s:
1. Personal Info: grid with form fields (display name, email [readonly], bio textarea) + `AvatarUpload` on the right
2. Appearance: `ThemeSelector`

Uses `useProfile()` + `useUpdateProfile()`. Dirty state tracking with save/discard footer. Uses `SettingsSection`, `SettingsField`.

- [ ] **Step 4: Create page.tsx and delete old**

```typescript
// app/settings/personal/profile/page.tsx
'use client'
import { ProfileSettings } from '@/components/features/settings/personal/profile-settings'
export default function ProfilePage() { return <ProfileSettings /> }
```

```bash
rm app/settings/personal/profile/page.js
```

Run: `npx next build 2>&1 | tail -20`

---

## Task 17: Personal Security Page

**Files:**
- Create: `components/features/settings/personal/change-password-section.tsx`
- Create: `components/features/settings/personal/mfa-section.tsx`
- Create: `components/features/settings/personal/sessions-section.tsx`
- Create: `components/features/settings/personal/security-settings.tsx`
- Rename: `app/settings/personal/security/page.js` → delete after creating `.tsx`
- Create: `app/settings/personal/security/page.tsx`

- [ ] **Step 1: Create ChangePasswordSection**

Port password change from `app/settings/personal/security/page.js`. Three `PasswordInput` fields (current, new, confirm). Password strength indicator bar (color + width computed from password complexity). Validation: min 8 chars, new must match confirm. Uses `useChangePassword()` (wraps `supabase.auth.updateUser()`). Uses `SettingsSection`.

Read the source file for the exact password strength calculation logic.

- [ ] **Step 2: Create MfaSection**

Port the 2FA section from security/page.js. This is a multi-step flow:
1. **Prompt state:** "Enable 2FA" button
2. **Scan state:** QR code display (from `supabase.auth.mfa.enroll()`), setup code (copyable)
3. **Verify state:** 6-digit code input, verify button
4. **Complete state:** Success message + recovery codes display/download
5. **Enabled state:** "Disable 2FA" button with `ConfirmDialog`

Uses `useEnrollMfa()`, `useVerifyMfa()`, `useUnenrollMfa()`. Uses `SettingsSection`.

Read the source file carefully for the exact MFA flow — the state machine has multiple transitions.

- [ ] **Step 3: Create SessionsSection**

Port sessions from security/page.js. Shows current device info via `navigator.userAgent`. "Sign out all other devices" button with `ConfirmDialog`. Uses `useSignOutOthers()`. Uses `SettingsSection`.

- [ ] **Step 4: Create SecuritySettings**

Composes all 3 sections in a vertical stack.

```typescript
// components/features/settings/personal/security-settings.tsx
'use client'

import { ChangePasswordSection } from './change-password-section'
import { MfaSection } from './mfa-section'
import { SessionsSection } from './sessions-section'

export function SecuritySettings() {
  return (
    <div className="max-w-3xl mx-auto py-12 px-10">
      <h1 className="text-[22px] font-semibold text-foreground mb-1">Password & Security</h1>
      <p className="text-sm text-muted-foreground mb-8">Manage your password, two-factor authentication, and active sessions</p>
      <ChangePasswordSection />
      <MfaSection />
      <SessionsSection />
    </div>
  )
}
```

- [ ] **Step 5: Create page.tsx and delete old**

```typescript
// app/settings/personal/security/page.tsx
'use client'
import { SecuritySettings } from '@/components/features/settings/personal/security-settings'
export default function SecurityPage() { return <SecuritySettings /> }
```

```bash
rm app/settings/personal/security/page.js
```

Run: `npx next build 2>&1 | tail -20`

---

## Task 18: Cleanup & Verification

**Files:**
- Delete: `app/components/settings/SettingsSidebar.js`

- [ ] **Step 1: Delete old sidebar**

```bash
rm app/components/settings/SettingsSidebar.js
```

Check if the `app/components/settings/` directory is now empty. If so, remove it:
```bash
rmdir app/components/settings/ 2>/dev/null
```

- [ ] **Step 2: Search for stale imports**

Search for any remaining references to deleted files:

```bash
grep -r "components/settings/SettingsSidebar" --include="*.js" --include="*.ts" --include="*.tsx" app/ components/ -l
grep -r "createClient.*supabase" --include="*.tsx" app/settings/ components/features/settings/ -l
```

The first grep should return no results. The second should return no results (all components should use `import { supabase } from '@/lib/supabase'`).

- [ ] **Step 3: Verify no .js files remain in settings routes**

```bash
find app/settings -name "*.js" -type f
```

Expected: No results (all converted to .tsx).

- [ ] **Step 4: Full build verification**

Run: `npx next build 2>&1 | tail -30`
Expected: Build succeeds with no errors.

- [ ] **Step 5: Manual smoke test checklist**

Navigate through all settings pages in the browser and verify:
- `/settings` → redirects to `/settings/workspace/general`
- `/settings/workspace/general` → identity, regional, preferences, danger zone sections render
- `/settings/workspace/members` → member table with roles, invite button works
- `/settings/workspace/macros` → macro list with search, filters, tabs, context menu
- `/settings/workspace/macros/new` → macro editor renders
- `/settings/workspace/macros/generate` → 4-step wizard with progress bar
- `/settings/workspace/tags` → tag table with checkboxes, create/edit/merge/delete work
- `/settings/integrations/email` → provider cards, connected accounts list
- `/settings/integrations/shopify` → connection status, connect/disconnect
- `/settings/personal/profile` → avatar, name, bio, theme selector
- `/settings/personal/security` → password change, 2FA flow, sessions
- Sidebar search works across all pages
- Active sidebar item highlights correctly on each page
