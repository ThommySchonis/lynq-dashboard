# Settings Pages Refactor — Design Spec

**Date:** 2026-05-10
**Scope:** Refactor all 8 settings pages + sidebar + layout from monolithic JS with CSS injection to modular TypeScript components following established project patterns (TanStack React Query, Zustand, Tailwind, shadcn).

**Prior art:** This refactoring follows the same patterns established in the admin page refactor (`docs/superpowers/specs/2026-05-10-admin-page-refactor-design.md`) and inbox refactor (`docs/superpowers/specs/2026-05-09-inbox-refactor-design.md`).

---

## Scope

### Pages included (8 settings pages + sidebar + layout + 3 small pages)

| Route | Current file | Lines | Key features |
|-------|-------------|-------|--------------|
| Settings sidebar | `app/components/settings/SettingsSidebar.js` | ~280 | Nav groups, search dropdown, CSS injection |
| Settings layout | `app/settings/layout.js` | 16 | Flexbox wrapper with inline styles |
| `/settings` | `app/settings/page.js` | 5 | Redirect |
| `/settings/email` | `app/settings/email/page.js` | 38 | Placeholder |
| `/settings/[category]/[page]` | `app/settings/[category]/[page]/page.js` | 61 | Catch-all placeholder |
| `/settings/workspace/general` | `app/settings/workspace/general/page.js` | 871 | Identity, regional, preferences, danger zone |
| `/settings/workspace/members` | `app/settings/workspace/members/page.js` | 1401 | Member table, invite modal, role management |
| `/settings/workspace/macros` | `app/settings/workspace/macros/page.js` | 832 | Macro list, search/filter/tabs, context menu |
| `/settings/workspace/macros/new` | `app/settings/workspace/macros/new/page.js` | 5 | Thin wrapper → MacroEditor |
| `/settings/workspace/macros/[id]` | `app/settings/workspace/macros/[id]/page.js` | 10 | Thin wrapper → MacroEditor |
| `/settings/workspace/macros/generate` | `app/settings/workspace/macros/generate/page.js` | 587 | 4-step AI wizard |
| `/settings/workspace/tags` | `app/settings/workspace/tags/page.js` | 809 | Tag table, bulk actions, color picker, merge |
| `/settings/integrations/email` | `app/settings/integrations/email/page.js` | 779 | Gmail/Outlook/Custom IMAP, account list |
| `/settings/integrations/shopify` | `app/settings/integrations/shopify/page.js` | 498 | Manual connect, status display |
| `/settings/personal/profile` | `app/settings/personal/profile/page.js` | 518 | Avatar, display name, bio, theme selector |
| `/settings/personal/security` | `app/settings/personal/security/page.js` | 1018 | Password change, sessions, 2FA |

**Total:** ~7,700 lines to refactor.

### What changes

- All `.js` files → `.tsx`
- All CSS injection (`const CSS = ...` + `<style>`) → Tailwind utility classes
- All inline `style={{}}` → Tailwind classes
- All `useState` + `useEffect` + `fetch` → TanStack React Query hooks
- All inline constants → `lib/settings-constants.ts`
- All inline sub-components → extracted to `components/features/settings/`
- Custom modals/dropdowns → shadcn `Dialog`/`DropdownMenu`
- Custom buttons/inputs → shadcn `Button`/`Input`
- Inline SVGs for provider logos → SVG files in `public/icons/`
- Direct `createClient()` calls → import from `lib/supabase`
- Toast via sonner (already available)

### What stays the same

- All API routes remain unchanged
- URL structure is identical
- Feature behavior and UX are preserved 1:1
- Existing `MacroEditor` component (`components/features/inbox/macro-editor.tsx`) is kept as-is
- Existing constants in `lib/tags.ts` and `lib/macros.ts` are reused

---

## Architecture

### Approach: Bottom-up (foundation first)

1. Types + constants + utils
2. Shared settings components
3. Settings sidebar + layout
4. Pages one by one, smallest to largest

### File structure

```
types/
  settings.ts                          — All settings type definitions

lib/
  settings-constants.ts                — Extracted constants (nav, roles, timezones, etc.)

stores/
  settings-ui.ts                       — Zustand store (tag selection, macro filters)

hooks/settings/
  use-settings-data.ts                 — TanStack query hooks
  use-settings-mutations.ts            — TanStack mutation hooks
  index.ts                             — Re-exports

components/features/settings/
  settings-sidebar.tsx                 — Navigation sidebar
  settings-section.tsx                 — Reusable section card
  settings-field.tsx                   — Label + input wrapper
  settings-toggle.tsx                  — Label + Switch row
  password-input.tsx                   — Input with eye toggle
  confirm-dialog.tsx                   — Destructive action confirmation
  status-badge.tsx                     — Connection status indicator

  workspace/
    general-settings.tsx               — General settings view
    identity-section.tsx               — Name + logo upload
    regional-section.tsx               — Timezone, locale, formats
    preferences-section.tsx            — Toggle switches
    danger-zone-section.tsx            — Delete workspace

    members-view.tsx                   — Members page view
    members-table.tsx                  — Table with roles and actions
    invite-modal.tsx                   — Invite member dialog

  macros/
    macros-list.tsx                    — Macro list view
    macro-row.tsx                      — Table row
    macros-toolbar.tsx                 — Search, filters, tabs

    macro-wizard.tsx                   — 4-step generate wizard
    wizard-progress.tsx                — Step indicator
    wizard-step-brand.tsx              — Step 1: brand basics
    wizard-step-contact.tsx            — Step 2: contact & shipping
    wizard-step-policies.tsx           — Step 3: returns & refunds
    wizard-step-final.tsx              — Step 4: final touch

  tags/
    tags-view.tsx                      — Tags page view
    tags-table.tsx                     — Searchable table with checkboxes
    tag-edit-modal.tsx                 — Create/edit with color picker
    tag-merge-modal.tsx                — Merge tags dialog
    tags-bulk-bar.tsx                  — Bulk actions bar

  integrations/
    email-settings.tsx                 — Email integration view
    email-account-row.tsx              — Account row with status
    custom-email-modal.tsx             — IMAP/SMTP config form

    shopify-settings.tsx               — Shopify integration view
    shopify-connect-modal.tsx          — Manual connect form

  personal/
    profile-settings.tsx               — Profile page view
    avatar-upload.tsx                  — Avatar with upload/delete
    theme-selector.tsx                 — Theme card grid

    security-settings.tsx              — Security page view
    change-password-section.tsx        — Password form with strength bar
    sessions-section.tsx               — Active sessions list
    mfa-section.tsx                    — 2FA enrollment, QR code, recovery codes, disable flow

app/settings/
  layout.tsx                           — Sidebar + main content area
  page.tsx                             — Redirect to workspace/general
  email/page.tsx                       — Placeholder (converted to .tsx)
  [category]/[page]/page.tsx           — Catch-all placeholder

  workspace/
    general/page.tsx                   — Thin wrapper → GeneralSettings
    members/page.tsx                   — Thin wrapper → MembersView
    macros/page.tsx                    — Thin wrapper → MacrosList
    macros/new/page.tsx                — Thin wrapper → MacroEditor (convert to .tsx)
    macros/[id]/page.tsx               — Thin wrapper → MacroEditor (convert to .tsx)
    macros/generate/page.tsx           — Thin wrapper → MacroWizard
    tags/page.tsx                      — Thin wrapper → TagsView

  integrations/
    email/page.tsx                     — Thin wrapper → EmailSettings
    shopify/page.tsx                   — Thin wrapper → ShopifySettings

  personal/
    profile/page.tsx                   — Thin wrapper → ProfileSettings
    security/page.tsx                  — Thin wrapper → SecuritySettings
```

### Files to delete after refactoring

- `app/components/settings/SettingsSidebar.js`
- All original `.js` page files (replaced by `.tsx`)

---

## Types (`types/settings.ts`)

```typescript
// ── Workspace ──
export interface WorkspaceSettings {
  id: string
  name: string
  logo_url: string | null
  timezone: string
  locale: string
  date_format: string
  time_format: string
  preferences: WorkspacePreferences
}

export interface WorkspacePreferences {
  show_order_data: boolean
  auto_translate: boolean
  allow_deletion: boolean
}

// ── Members ──
export type MemberRole = 'owner' | 'admin' | 'agent' | 'observer'

export interface Member {
  id: string
  user_id: string
  display_name: string | null
  email: string
  role: MemberRole
  avatar_url: string | null
  joined_at: string
  status: 'active' | 'pending'
}

export interface Invite {
  id: string
  email: string
  role: MemberRole
  created_at: string
  expires_at: string | null
}

// ── Profile ──
export type Theme = 'system' | 'dark' | 'light'

export interface UserProfile {
  display_name: string
  bio: string
  email: string
  avatar_url: string | null
  theme: Theme
}

// ── Security ──
// Note: Password change and sign-out use Supabase Auth SDK directly
// (supabase.auth.updateUser, supabase.auth.signOut), NOT custom API routes.
// The current page shows device info via navigator.userAgent, not a sessions API.

export interface PasswordChangeForm {
  current_password: string
  new_password: string
  confirm_password: string
}

export interface MfaFactor {
  id: string
  type: 'totp'
  friendly_name: string | null
  created_at: string
  status: 'verified' | 'unverified'
}

// ── Macros ──
export interface MacroFilter {
  search: string
  language: string
  tags: string[]
  archived: boolean
}

export interface MacroOnboarding {
  brand_name: string
  brand_email: string
  brand_voice: string
  return_window: string
  return_shipping: string
  damage_policy: string
  extra_notes: string
}

export interface MacroWizardStep {
  title: string
  description: string
}

export interface BrandVoice {
  value: string
  label: string
  description: string
}

// ── Tags ──
export interface Tag {
  id: string
  name: string
  color: string
  usage_count: number
}

export interface TagForm {
  name: string
  color: string
}

// ── Integrations ──
export type EmailProvider = 'gmail' | 'outlook' | 'custom'
export type ConnectionStatus = 'active' | 'pending' | 'error' | 'disconnected'

export interface EmailAccount {
  id: string
  provider: EmailProvider
  email: string
  status: ConnectionStatus
  connected_at: string | null
}

export interface CustomEmailConfig {
  email: string
  imap_host: string
  imap_port: number
  smtp_host: string
  smtp_port: number
  username: string
  password: string
  use_ssl: boolean
}

export interface ShopifyIntegration {
  domain: string | null
  status: ConnectionStatus
  connected_at: string | null
}
```

---

## Constants (`lib/settings-constants.ts`)

Extracted from inline definitions across all settings pages:

- `SETTINGS_NAV` — Navigation groups (Workspace, Email, Integrations, Personal) with items and hrefs
- `ROLE_LABELS`, `ROLE_DESCS`, `ROLE_DESCS_FULL` — Role display metadata
- `ROLES_FOR_OWNER`, `ROLES_FOR_ADMIN` — Selectable roles by viewer role
- `TIMEZONES` — Array of timezone options
- `WORKSPACE_DEFAULTS` — Default workspace settings values
- `THEMES` — Theme options with icons (Monitor, Moon, Sun from Lucide)
- `MACRO_LANGUAGES` — Language options (reuses `MACRO_LANGS` from `lib/macros.ts` where possible)
- `LANG_LABELS` — Maps language codes to display names
- `BRAND_VOICES` — 5 brand voice options with descriptions
- `RETURN_SHIPPING` — 3 return shipping policy options
- `DAMAGE_POLICY` — 3 damage policy options
- `WIZARD_STEPS` — 4-step wizard definitions
- `INITIAL_PASSWORD_FORM` — Empty password change form
- `INITIAL_CUSTOM_EMAIL_FORM` — Empty IMAP/SMTP config
- `INITIAL_MACRO_WIZARD_FORM` — Empty wizard form state

---

## Zustand Store (`stores/settings-ui.ts`)

Minimal UI state shared across settings components:

```typescript
interface SettingsUIState {
  // Tags page: bulk selection
  selectedTagIds: Set<string>
  toggleTagSelection: (id: string) => void
  selectAllTags: (ids: string[]) => void
  clearTagSelection: () => void

  // Macros page: filter state (shared between toolbar and list)
  macroFilter: MacroFilter
  setMacroFilter: (filter: Partial<MacroFilter>) => void
}
```

This keeps bulk tag selection and macro filters in sync between `tags-table.tsx` / `tags-bulk-bar.tsx` and `macros-toolbar.tsx` / `macros-list.tsx` without prop-drilling.

---

## TanStack Hooks (`hooks/settings/`)

### Query hooks (`use-settings-data.ts`)

Query key factory:
```typescript
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

| Hook | Endpoint | Returns |
|------|----------|---------|
| `useWorkspace()` | Supabase `workspaces` table | `WorkspaceSettings` |
| `useMembers()` | GET `/api/workspaces/current/members` | `Member[]` |
| `useProfile()` | GET `/api/profile` | `UserProfile` |
| `useMacros(filter)` | GET `/api/macros?...` | `Macro[]` |
| `useMacroOnboarding()` | GET `/api/macros/onboarding` | `MacroOnboarding` |
| `useTags()` | GET `/api/tags` | `Tag[]` |
| `useEmailAccounts()` | GET `/api/inbox/accounts` | `EmailAccount[]` |
| `useShopifyIntegration()` | GET `/api/settings/integrations/shopify` | `ShopifyIntegration` |

**Data source notes:**
- Most hooks use `useAuthStore((s) => s.session?.access_token)` for Bearer token, enabled only when token is present.
- `useWorkspace()` queries the Supabase `workspaces` table directly (no API route).
- Security page uses Supabase Auth SDK directly: `supabase.auth.updateUser()` for password changes, `supabase.auth.signOut()` for session management, `supabase.auth.mfa.*` for 2FA. These are wrapped in TanStack mutation hooks but do NOT hit custom API routes.

### Mutation hooks (`use-settings-mutations.ts`)

| Hook | Endpoint | Invalidates |
|------|----------|-------------|
| `useUpdateWorkspace()` | PATCH `/api/workspaces/current` | `workspace` |
| `useUploadLogo()` | POST `/api/workspaces/current/logo` | `workspace` |
| `useDeleteLogo()` | DELETE `/api/workspaces/current/logo` | `workspace` |
| `useInviteMember()` | POST `/api/workspaces/current/members` | `members` |
| `useUpdateMemberRole()` | PATCH `/api/workspaces/current/members/[id]` | `members` |
| `useRemoveMember()` | DELETE `/api/workspaces/current/members/[id]` | `members` |
| `useUpdateProfile()` | PATCH `/api/profile` | `profile` |
| `useUploadAvatar()` | POST `/api/profile/avatar` | `profile` |
| `useDeleteAvatar()` | DELETE `/api/profile/avatar` | `profile` |
| `useChangePassword()` | `supabase.auth.updateUser({ password })` | — |
| `useSignOutOthers()` | `supabase.auth.signOut({ scope: 'others' })` | — |
| `useEnrollMfa()` | `supabase.auth.mfa.enroll()` | — |
| `useVerifyMfa()` | `supabase.auth.mfa.challengeAndVerify()` | — |
| `useUnenrollMfa()` | `supabase.auth.mfa.unenroll()` | — |
| `useDuplicateMacro()` | POST `/api/macros/[id]/duplicate` | `macros` |
| `useArchiveMacro()` | POST `/api/macros/[id]/archive` | `macros` |
| `useRestoreMacro()` | POST `/api/macros/[id]/restore` | `macros` |
| `useDeleteMacro()` | DELETE `/api/macros/[id]` | `macros` |
| `useSaveMacroOnboarding()` | POST `/api/macros/onboarding` | `macroOnboarding` |
| `useGenerateMacros()` | POST `/api/macros/generate` | `macros` |
| `useCreateTag()` | POST `/api/tags` | `tags` |
| `useUpdateTag()` | PATCH `/api/tags/[id]` | `tags` |
| `useDeleteTag()` | DELETE `/api/tags/[id]` | `tags` |
| `useMergeTags()` | POST `/api/tags/merge` | `tags` |
| `useConnectCustomEmail()` | POST `/api/auth/custom-email/connect` | `emailAccounts` |
| `useDisconnectEmail()` | DELETE `/api/inbox/accounts/[id]` | `emailAccounts` |
| `useConnectShopify()` | POST `/api/shopify/manual-connect` | `shopify` |
| `useDisconnectShopify()` | DELETE `/api/shopify/manual-connect` | `shopify` |

All mutations use `toast.success()`/`toast.error()` from sonner.

---

## Shared Settings Components

### `settings-section.tsx`
White card container used across general, profile, and security pages.
```
Props: title: string, description?: string, actions?: ReactNode, children: ReactNode
```
Renders: rounded card with title, optional subtitle, optional top-right action slot, children content area.

### `settings-field.tsx`
Label + input wrapper with optional hint and error message.
```
Props: label: string, hint?: string, error?: string, children: ReactNode
```
Uses shadcn `Label`. Error displayed in red below input.

### `settings-toggle.tsx`
Horizontal row with label, description text, and a shadcn `Switch`.
```
Props: label: string, description?: string, checked: boolean, onChange: (v: boolean) => void, disabled?: boolean
```

### `password-input.tsx`
Shadcn `Input` with eye/eye-off toggle button for password visibility. Currently duplicated in security (2x), email integration, and shopify pages.
```
Props: extends InputProps, adds toggleable visibility
```

### `confirm-dialog.tsx`
Destructive action confirmation using shadcn `Dialog`.
```
Props: open: boolean, onOpenChange, title: string, description: string, confirmLabel?: string, onConfirm: () => void, variant?: 'danger' | 'default', loading?: boolean
```
Used for: delete workspace, remove member, delete macro, delete tag, disconnect account.

### `status-badge.tsx`
Small pill showing connection status with colored dot.
```
Props: status: ConnectionStatus, label?: string
```
Colors: active=green, pending=amber, error=red, disconnected=gray.

---

## Page Components

### Workspace General
**View:** `general-settings.tsx` — Orchestrates 4 sections in a vertical stack.

**Sub-components:**
- `identity-section.tsx` — Workspace name input + logo upload/delete. Logo: 2MB max, preview circle. Uses `useWorkspace()`, `useUpdateWorkspace()`, `useUploadLogo()`, `useDeleteLogo()`.
- `regional-section.tsx` — Timezone, locale, date format, time format selects. Uses shadcn `Select`. References `TIMEZONES` from constants.
- `preferences-section.tsx` — 3 `SettingsToggle` rows (show order data, auto-translate, allow deletion).
- `danger-zone-section.tsx` — Red-bordered section with delete workspace button. Uses `ConfirmDialog`.

Each section tracks dirty state independently with save/discard buttons shown via sticky footer.

### Workspace Members
**View:** `members-view.tsx` — Header with invite button + seat counter + members table.

**Sub-components:**
- `members-table.tsx` — shadcn `Table` with columns: user (avatar + name + email), role (clickable badge dropdown), joined date, actions (3-dot menu). Role dropdown shows different options based on viewer role using `ROLES_FOR_OWNER`/`ROLES_FOR_ADMIN`. Uses `useMembers()`, `useUpdateMemberRole()`, `useRemoveMember()`.
- `invite-modal.tsx` — shadcn `Dialog` with email input + role selector buttons. Uses `useInviteMember()`.

Permission checks via `lib/permissions.ts` (`can.inviteMembers`, `can.removeMembers`, `can.changeRole`).

### Workspace Macros
**View:** `macros-list.tsx` — Toolbar + tabs (Active/Archived) + macro table.

**Sub-components:**
- `macros-toolbar.tsx` — Search input, language filter (shadcn `Select`), tag filter. References `MACRO_LANGUAGES` from constants.
- `macro-row.tsx` — Table row: name, tag pills, language badge, usage count, relative time, 3-dot menu (Edit, Duplicate, Archive/Restore, Delete). Uses shadcn `DropdownMenu`.

Uses `useMacros(filter)` with local filter state, `useDuplicateMacro()`, `useArchiveMacro()`, `useRestoreMacro()`, `useDeleteMacro()`, `ConfirmDialog` for delete.

### Workspace Macros Generate
**View:** `macro-wizard.tsx` — Progress bar + current step form + navigation buttons.

**Sub-components:**
- `wizard-progress.tsx` — Step indicator bar with numbered circles and connecting lines. Props: `steps: MacroWizardStep[]`, `currentStep: number`.
- `wizard-step-brand.tsx` — Step 1: brand name, email, brand voice selector (card grid from `BRAND_VOICES`).
- `wizard-step-contact.tsx` — Step 2: contact info, shipping details.
- `wizard-step-policies.tsx` — Step 3: return window, return shipping (`RETURN_SHIPPING`), damage policy (`DAMAGE_POLICY`).
- `wizard-step-final.tsx` — Step 4: extra notes textarea.

Local form state with field validation. Uses `useMacroOnboarding()` to prefill, `useSaveMacroOnboarding()` to persist answers per step, `useGenerateMacros()` on final submit. Generating overlay with spinner.

### Workspace Tags
**View:** `tags-view.tsx` — Header with create button + search + tags table + bulk action bar.

**Sub-components:**
- `tags-table.tsx` — Searchable table with checkboxes. Columns: checkbox, color dot + name, usage count, actions. Uses shadcn `Table`, `Checkbox`.
- `tag-edit-modal.tsx` — shadcn `Dialog` for create/edit. Name input + color swatch picker (uses `TAG_COLORS` from `lib/tags.ts`). Uses `useCreateTag()`/`useUpdateTag()`.
- `tag-merge-modal.tsx` — shadcn `Dialog` showing selected tags, pick winner. Uses `useMergeTags()`.
- `tags-bulk-bar.tsx` — Fixed bottom bar when checkboxes selected. Actions: merge, delete. Uses `ConfirmDialog` for bulk delete.

### Integrations Email
**View:** `email-settings.tsx` — Provider cards (Gmail, Outlook, Custom) + connected accounts list.

**Sub-components:**
- `email-account-row.tsx` — Provider icon + email + `StatusBadge` + disconnect button. Uses `useDisconnectEmail()`, `ConfirmDialog`.
- `custom-email-modal.tsx` — shadcn `Dialog` with IMAP/SMTP config form. Uses `PasswordInput` for password field. Uses `useConnectCustomEmail()`.

Gmail/Outlook connect via OAuth redirect (window.location to `/api/auth/gmail` or `/api/auth/outlook`). Provider logos: SVG files in `public/icons/gmail.svg` and `public/icons/outlook.svg`.

### Integrations Shopify
**View:** `shopify-settings.tsx` — Connection status card + connect/disconnect actions.

**Sub-components:**
- `shopify-connect-modal.tsx` — shadcn `Dialog` with store domain input + access token `PasswordInput`. Domain validation (must end in `.myshopify.com`). Uses `useConnectShopify()`.

Uses `useShopifyIntegration()`, `useDisconnectShopify()`, `StatusBadge`, `ConfirmDialog`.

### Personal Profile
**View:** `profile-settings.tsx` — Two sections: Personal Info + Theme.

**Sub-components:**
- `avatar-upload.tsx` — Avatar circle with upload button and delete. Accepts PNG/JPG, 500KB max. Shows initials fallback. Uses `useUploadAvatar()`/`useDeleteAvatar()`.
- `theme-selector.tsx` — 3-card grid (System/Dark/Light). Each card shows icon, label, description. Selected state with purple border + checkmark. References `THEMES` from constants.

Uses `useProfile()` + `useUpdateProfile()`. Form with dirty tracking and save/discard footer.

### Personal Security
**View:** `security-settings.tsx` — Three sections: Change Password + Two-Factor Authentication + Sessions.

**Sub-components:**
- `change-password-section.tsx` — 3 `PasswordInput` fields (current, new, confirm). Password strength indicator bar (color + width based on complexity). Validation: min 8 chars, must match confirmation. Uses `useChangePassword()` (wraps `supabase.auth.updateUser()`).
- `mfa-section.tsx` — 2FA management: enroll TOTP (QR code display via `supabase.auth.mfa.enroll()`), verify code input, recovery codes display/download, disable 2FA flow. Uses `useEnrollMfa()`, `useVerifyMfa()`, `useUnenrollMfa()`, `ConfirmDialog` for disable.
- `sessions-section.tsx` — Shows current device info via `navigator.userAgent`. "Sign out other devices" button using `useSignOutOthers()` (wraps `supabase.auth.signOut({ scope: 'others' })`). Uses `ConfirmDialog`.

---

## Settings Sidebar (`components/features/settings/settings-sidebar.tsx`)

Rewrite of `app/components/settings/SettingsSidebar.js`:

- Replace ~150 lines of CSS injection with Tailwind classes
- Use `usePathname()` for active state highlighting
- Use `<Link>` for navigation items
- Search functionality: shadcn `Input` with search icon, dropdown of filtered results
- Reference `SETTINGS_NAV` from `lib/settings-constants.ts`
- Divider before "Personal" group
- Fixed position, 260px width
- Export as both named and default export

## Settings Layout (`app/settings/layout.tsx`)

- Convert from `.js` to `.tsx`
- Replace inline styles with Tailwind: `flex h-screen bg-[#F8F7FA]`
- Import `SettingsSidebar` from `components/features/settings/settings-sidebar`
- **Important:** The layout also renders the main app `Sidebar` (from `components/layout/sidebar.tsx`). Both sidebars must be preserved: app sidebar (fixed left) + settings sidebar (next to it) + main content area.
- Structure: app Sidebar + settings sidebar (fixed 260px) + spacer div + main scrollable area

## Small Pages

- `app/settings/page.tsx` — `redirect('/settings/workspace/general')` (server component)
- `app/settings/email/page.tsx` — Placeholder with Clock icon, converted to Tailwind
- `app/settings/[category]/[page]/page.tsx` — Catch-all with whitelist validation, converted to Tailwind

---

## Cleanup

### Files to delete

- `app/components/settings/SettingsSidebar.js`
- All original `.js` page files replaced by `.tsx` equivalents

### Stale import verification

After all pages are converted, search for any remaining references to:
- `app/components/settings/SettingsSidebar`
- Any old `.js` settings page paths
- Direct `createClient()` calls (should use `lib/supabase`)

---

## Out of scope

- API route changes (all existing endpoints remain as-is)
- New features or behavior changes
- Other page groups (academy, auth, core app pages)
- MacroEditor component refactoring (already in good shape at 219 lines of TypeScript)
