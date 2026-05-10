# UI Refactor Foundation — Design Spec

**Date:** 2026-05-09
**Scope:** Foundation layer only — shadcn setup, component library, Zustand stores, layout/sidebar refactor, TypeScript conversion
**Out of scope:** API routes, individual page refactors (separate specs), business logic changes

## Context

The Lynq & Flow dashboard has grown to ~35 pages with monolithic page files (admin: 3,758 lines, inbox: 2,927 lines). Styling is a mix of Tailwind v4, CSS-in-JS via `<style dangerouslySetInnerHTML>`, and inline `style={}` props. State management relies entirely on `useState` (8+ hooks per page). There is no component library — all UI is hand-built with sub-components living inline in page files. The codebase mixes TypeScript and JavaScript.

This spec covers the foundation layer that all subsequent page refactors will build on.

## Decisions

- **Component library:** shadcn/ui (new-york style)
- **State management:** Zustand
- **Styling:** Tailwind utility classes only (no CSS-in-JS, no inline styles)
- **Language:** Full TypeScript conversion
- **Theme:** Dual light/dark mode using shadcn's built-in dark mode support
- **Approach:** Component-first — build the shared library before touching any pages
- **Page refactor order (after foundation):** Complexity-first — inbox, admin, settings, auth, home, dashboards, content pages

## 1. Project Structure

```
app/
  (auth)/                      # Auth route group
    login/page.tsx
    signup/page.tsx
    forgot-password/page.tsx
    reset-password/page.tsx
  (dashboard)/                 # Main app route group (requires auth)
    home/page.tsx
    inbox/page.tsx
    admin/page.tsx
    analytics/page.tsx
    settings/
      [category]/[page]/page.tsx
    ...
  api/                         # Unchanged — out of scope
  layout.tsx                   # Root layout (providers, fonts)
  globals.css                  # Tailwind + shadcn theme tokens

components/
  ui/                          # shadcn primitives (installed via CLI)
  layout/                      # Structural: AppShell, Sidebar, AuthShell, PageHeader, PageShell
  shared/                      # Reusable composites: DataTable, EmptyState, StatusBadge, etc.
  features/                    # Domain-specific (built during page refactors, not in this spec)

stores/
  auth.ts                      # User session, workspace, role
  theme.ts                     # Light/dark mode
  ui.ts                        # Sidebar, modals, toasts
  inbox.ts                     # Conversations, filters (built during inbox refactor)
  admin.ts                     # Clients, broadcasts (built during admin refactor)

lib/
  utils.ts                     # cn() helper (clsx + tailwind-merge)
  supabase.ts                  # Renamed from .js
  supabaseAdmin.ts             # Renamed from .js
  ...                          # Other lib files renamed to .ts

hooks/
  use-auth.ts                  # Convenience hook wrapping auth store
  use-toast.ts                 # Refactored to use Zustand ui store
  use-media-query.ts           # Responsive breakpoint hook
```

### Key structural changes
- Components move from `app/components/` to top-level `components/`
- Four-tier component hierarchy: `ui/` (atoms) → `layout/` (structural) → `shared/` (composites) → `features/` (domain-specific)
- Stores get their own top-level directory
- All files converted from `.js` to `.ts`/`.tsx`

## 2. shadcn + Tailwind Theme

### Installation
- shadcn/ui with `new-york` style
- Tailwind CSS v4 (already installed) — theme configured via `globals.css` CSS variables

### Theme token mapping

| Current variable | shadcn variable | Light | Dark |
|-----------------|----------------|-------|------|
| `--bg-page` | `--background` | `#ffffff` | `#1C0F36` |
| `--bg-card` | `--card` | `#ffffff` | `#241352` |
| `--accent` | `--primary` | `#8B5CF6` | `#A175FC` |
| `--text-1` | `--foreground` | `#18181b` | `#f4f4f5` |
| `--text-2` | `--muted-foreground` | `#71717a` | `#a1a1aa` |
| `--border` | `--border` | `rgba(0,0,0,0.07)` | `rgba(255,255,255,0.07)` |
| `--bg-input` | `--input` | `#f4f4f5` | `#2a1a5e` |
| `--success` | `--success` (custom) | `#22c55e` | `#22c55e` |
| `--error` | `--destructive` | `#ef4444` | `#ef4444` |

### What gets removed
- All `<style dangerouslySetInnerHTML>` blocks
- `lib/styles.js` (tokens move to `globals.css`)
- Inline `style={}` props (replaced with Tailwind classes)
- Custom CSS classes like `.glass-card`, `.premium-input` (replaced by shadcn components)

### What stays
- Framer Motion for animations (page transitions, toasts)
- `clsx` + `tailwind-merge` via `cn()` utility in `lib/utils.ts`
- Lucide icons (shadcn uses Lucide by default — already installed)

## 3. Zustand Store Architecture

### `stores/auth.ts`
```typescript
interface AuthState {
  user: User | null
  session: Session | null
  workspace: Workspace | null
  workspaceId: string | null
  role: Role | null
  memberId: string | null
  isLoading: boolean
  setSession: (session: Session | null) => void
  clearSession: () => void
  switchWorkspace: (workspaceId: string) => Promise<void>
}
```
**Replaces:** Repeated `supabase.auth.getSession()` + workspace fetch on every page.
**Hydration:** `<AuthHydrator />` component in root layout runs `onAuthStateChange` once.

### `stores/theme.ts`
```typescript
interface ThemeState {
  theme: 'light' | 'dark'
  toggle: () => void
  setTheme: (theme: 'light' | 'dark') => void
}
```
**Persistence:** Zustand `persist` middleware with localStorage.
**Replaces:** Current `ThemeProvider` React Context.

### `stores/ui.ts`
```typescript
interface UIState {
  sidebarCollapsed: boolean
  activeModal: string | null
  toasts: Toast[]
  toggleSidebar: () => void
  openModal: (id: string) => void
  closeModal: () => void
  addToast: (toast: Omit<Toast, 'id'>) => string
  dismissToast: (id: string) => void
}
```
**Replaces:** Per-page `useState` for modals, sidebar state, custom `useToast` hook.

### `stores/inbox.ts` (stub — built during inbox refactor)
```typescript
interface InboxState {
  conversations: Conversation[]
  selectedConversationId: string | null
  filters: InboxFilters
  searchQuery: string
  unreadCount: number
  // actions...
}
```

### `stores/admin.ts` (stub — built during admin refactor)
```typescript
interface AdminState {
  clients: Client[]
  broadcasts: Broadcast[]
  notifications: Notification[]
  activeTab: string
  // actions...
}
```

### Pattern
- Each store is a single Zustand `create()` call
- No providers or context wrappers needed
- Components import directly: `import { useAuthStore } from '@/stores/auth'`
- Use selectors to prevent unnecessary re-renders: `const user = useAuthStore(s => s.user)`

## 4. Component Library

### Tier 1: shadcn primitives (`components/ui/`)

Installed via `npx shadcn@latest add`:

`Button`, `Input`, `Textarea`, `Select`, `Checkbox`, `Switch`, `Label`, `Badge`, `Avatar`, `Tooltip`, `Dialog`, `Sheet`, `DropdownMenu`, `Tabs`, `Table`, `Skeleton`, `Separator`, `ScrollArea`, `Popover`, `Command`

### Tier 2: Layout components (`components/layout/`)

**`AppShell`** — Wraps all authenticated pages.
```
┌──────────┬─────────────────────────────┐
│          │  PageHeader (title + actions)│
│ Sidebar  ├─────────────────────────────┤
│ (fixed)  │                             │
│          │  Page content (scrollable)  │
│          │                             │
└──────────┴─────────────────────────────┘
```
- Reads `sidebarCollapsed` from Zustand `ui` store
- Main content gets `ml-[208px]` or `ml-[60px]` with CSS transition
- On mobile (< 768px): sidebar hidden, accessible via shadcn `Sheet`

**`Sidebar`** — Refactored from current 420-line `Sidebar.js`.
- Split into `Sidebar`, `SidebarItem`, `SidebarUser` sub-components
- ~80 lines total (down from 420)
- Tailwind classes instead of CSS-in-JS string
- Lucide icons instead of emoji
- Collapse state from Zustand `ui` store
- Badge counts from domain stores (e.g., inbox unread)
- Mobile: renders inside shadcn `Sheet`

**`AuthShell`** — Refactored from current `AuthShell.js` (460 lines).
- Split-screen layout for auth pages (login, signup, reset)
- Left: branding panel. Right: form content
- Shared by all auth pages via slot pattern

**`PageHeader`** — Consistent page title row.
- Props: `title`, `description?`, `actions?` (ReactNode for buttons)
- Used by every dashboard page

**`PageShell`** — Standard page wrapper.
- Combines `PageHeader` + scrollable content area + optional filters bar

### Tier 3: Shared composites (`components/shared/`)

**`DataTable`** — Built on shadcn `Table`.
- Column definitions, sorting, pagination, empty state
- Replaces hand-built tables in inbox, admin, orders

**`EmptyState`** — Icon + title + description + optional CTA.

**`StatusBadge`** — Colored badge variant for statuses (active, pending, error, etc.).

**`ConfirmDialog`** — "Are you sure?" modal using shadcn `Dialog`.

**`SearchInput`** — Debounced search with Lucide search icon.

**`StatCard`** — KPI display: value + label + trend indicator.

**`LoadingState`** — Skeleton-based loading using shadcn `Skeleton`.

**`Toast`** — Refactored to shadcn toast + Zustand `ui.toasts`.

## 5. Layout & Sidebar Detail

### Sidebar visual identity (preserved)
- Dark background (`#0D0F14`)
- Same navigation items and order
- Logo + workspace name at top
- User avatar + email at bottom
- Active item highlighted with accent color (`#8B5CF6` / `#A175FC`)

### Sidebar improvements
- Collapse button (toggle between 208px and 60px)
- Smooth width transition animation
- Lucide icons (consistent, scalable) replace emoji
- Unread badge counts from Zustand stores
- Mobile: shadcn `Sheet` slide-over panel
- Reduced from 420 lines to ~80 lines across 3 sub-components

### AppShell responsive behavior
- Desktop (≥ 1024px): sidebar visible, collapsible
- Tablet (768–1023px): sidebar collapsed by default
- Mobile (< 768px): sidebar hidden, hamburger button triggers `Sheet`

## 6. TypeScript Conversion

### Strategy
- All files renamed from `.js` to `.ts`/`.tsx`
- Strict mode enabled in `tsconfig.json`
- Shared types in `types/` directory:
  - `types/database.ts` — Supabase table types (generated or manual)
  - `types/stores.ts` — Zustand store interfaces
  - `types/components.ts` — Shared component prop types
- Existing JS files in `lib/` converted to TS with proper typing
- API routes remain `.ts` (already mostly typed via Next.js conventions)

## 7. Migration Strategy

### What this foundation spec delivers
1. shadcn installed and configured with Lynq theme tokens
2. `cn()` utility in `lib/utils.ts`
3. All shadcn primitives installed (Tier 1 components)
4. Zustand installed with `auth`, `theme`, and `ui` stores
5. `AuthHydrator` component wired into root layout
6. `AppShell`, `Sidebar`, `AuthShell`, `PageHeader`, `PageShell` (Tier 2)
7. All shared composites (Tier 3)
8. Root layout refactored to use new providers/stores
9. `ThemeProvider` replaced by Zustand theme store
10. All `lib/` files converted to TypeScript
11. `types/` directory with shared type definitions

### What it does NOT change
- Individual page content (pages still reference old patterns until their refactor spec)
- API routes (out of scope entirely)
- Business logic
- Database schema
- Supabase queries

### Coexistence during migration
After the foundation is in place, old pages will still work — they'll just use the old patterns inside the new `AppShell` wrapper. Each page gets its own refactor spec that converts it to the new component library + Zustand stores.

## 8. Sub-Project Roadmap

After this foundation, page refactors happen in complexity order:

1. **Foundation** (this spec)
2. **Inbox refactor** — Break 2,927-line monolith into components, inbox Zustand store
3. **Admin refactor** — Break 3,758-line monolith, admin Zustand store
4. **Settings refactor** — Members, security, integrations, general, brand pages
5. **Auth pages refactor** — Login, signup, forgot/reset password
6. **Home refactor** — AI chat interface
7. **Dashboard pages** — Analytics, performance, supply chain
8. **Content pages** — Academy, value feed, services

Each gets its own spec → plan → implementation cycle.
