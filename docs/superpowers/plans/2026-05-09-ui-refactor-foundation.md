# UI Refactor Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up shadcn/ui, Zustand stores, shared component library, and refactored layout/sidebar as the foundation for a full UI refactor.

**Architecture:** Component-first approach — install shadcn with Lynq theme tokens, create Zustand stores for auth/theme/UI state, build a shared component library (primitives → layout → composites), then refactor the root layout and sidebar to use the new system. All files converted to TypeScript.

**Tech Stack:** Next.js 16.2.3, React 19, shadcn/ui (new-york), Zustand, Tailwind CSS v4, Framer Motion, Lucide React, TypeScript

**Spec:** `docs/superpowers/specs/2026-05-09-ui-refactor-foundation-design.md`

---

## File Map

### New files to create

```
lib/utils.ts                          — cn() helper (clsx + tailwind-merge)
stores/auth.ts                        — Auth/session/workspace store
stores/theme.ts                       — Light/dark theme store with persist
stores/ui.ts                          — Sidebar, modals, toasts store
components/ui/                        — shadcn primitives (via CLI)
components/layout/app-shell.tsx       — Main layout wrapper (sidebar + content)
components/layout/sidebar.tsx         — Refactored sidebar
components/layout/sidebar-item.tsx    — Single nav item
components/layout/sidebar-user.tsx    — User profile section at bottom
components/layout/page-header.tsx     — Page title + actions row
components/layout/page-shell.tsx      — PageHeader + scrollable content
hooks/use-media-query.ts              — Responsive breakpoint hook
components/layout/auth-shell.tsx      — Auth page layout (login/signup/etc.)
components/shared/data-table.tsx      — Sortable, paginated table
components/shared/empty-state.tsx     — Empty state with icon + CTA
components/shared/status-badge.tsx    — Colored status badges
components/shared/confirm-dialog.tsx  — Confirmation modal
components/shared/search-input.tsx    — Debounced search
components/shared/stat-card.tsx       — KPI display card
components/shared/loading-state.tsx   — Skeleton loader
components/providers/auth-hydrator.tsx — Supabase auth → Zustand sync
components/providers/theme-sync.tsx   — Zustand theme → DOM sync
types/database.ts                     — Supabase table types
types/index.ts                        — Shared types barrel
components.json                       — shadcn configuration
```

### Files to modify

```
app/layout.tsx                        — Replace ThemeProvider with new providers
app/globals.css                       — Add shadcn CSS variables alongside existing
package.json                          — Add zustand dependency
```

### Files to rename (.js → .ts)

```
lib/*.js → lib/*.ts                   — All 19 lib files converted to TypeScript
lib/providers/*.js → lib/providers/*.ts — All 5 provider files converted
```

### Files to delete (after migration)

```
app/components/ThemeProvider.js        — Replaced by stores/theme.ts + theme-sync.tsx
lib/styles.js                         — Tokens moved to globals.css / Tailwind theme
```

---

## Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install Zustand**

```bash
cd /Users/dendy/Documents/Work/lynq-dashboard && npm install zustand
```

- [ ] **Step 2: Initialize shadcn**

```bash
cd /Users/dendy/Documents/Work/lynq-dashboard && npx shadcn@latest init
```

When prompted:
- Style: **New York**
- Base color: **Zinc** (we'll override with Lynq tokens)
- CSS variables: **Yes**
- CSS file: `app/globals.css`
- Tailwind config: (leave default for v4)
- Components alias: `@/components`
- Utils alias: `@/lib/utils`
- React Server Components: **Yes**

This will create `components.json` and `lib/utils.ts` with the `cn()` helper.

- [ ] **Step 3: Verify installation**

```bash
cd /Users/dendy/Documents/Work/lynq-dashboard && cat components.json && cat lib/utils.ts
```

Expected: `components.json` exists with shadcn config. `lib/utils.ts` exports `cn()` using `clsx` + `tailwind-merge`.

---

## Task 2: Configure Lynq Theme in globals.css

**Files:**
- Modify: `app/globals.css`

The shadcn init will have added its own CSS variables to `globals.css`. We need to map Lynq's existing design tokens to shadcn's variable naming convention while keeping the existing tokens for backward compatibility during migration.

- [ ] **Step 1: Add shadcn theme variables to `:root`**

After shadcn init, `globals.css` will have shadcn's default variables. Replace the shadcn defaults with Lynq's colors. Add these shadcn variables inside the existing `:root` block (after the current Lynq tokens):

```css
/* ── shadcn theme tokens (mapped from Lynq design system) ──────────────── */
--background: 249 248 255;      /* #F9F8FF - same as --bg-page */
--foreground: 15 15 16;         /* #0F0F10 - same as --text-1 */
--card: 255 255 255;            /* #FFFFFF - same as --bg-surface */
--card-foreground: 15 15 16;
--popover: 255 255 255;
--popover-foreground: 15 15 16;
--primary: 139 92 246;          /* #8B5CF6 - same as --accent */
--primary-foreground: 255 255 255;
--secondary: 245 244 255;       /* #F5F4FF - same as --bg-surface-2 */
--secondary-foreground: 15 15 16;
--muted: 245 244 255;
--muted-foreground: 107 114 128; /* #6B7280 - same as --text-3 */
--accent: 245 244 255;
--accent-foreground: 15 15 16;
--destructive: 239 68 68;       /* #EF4444 - same as --error */
--destructive-foreground: 255 255 255;
--border: 0 0 0 / 0.07;        /* same as --border */
--input: 0 0 0 / 0.03;         /* same as --bg-input */
--ring: 139 92 246;             /* #8B5CF6 - focus ring */
--radius: 0.5rem;
```

Note: Check the exact format shadcn v4 uses for CSS variables (it may use `oklch` or `hsl` instead of RGB). Match whatever format shadcn init generates.

- [ ] **Step 2: Add dark mode shadcn variables**

Add inside the existing `[data-theme="dark"]` block. Also add `.dark` selector so shadcn components work with both:

```css
[data-theme="dark"], .dark {
  /* ... existing dark tokens stay ... */

  /* shadcn dark overrides */
  --background: 28 15 54;        /* #1C0F36 */
  --foreground: 248 250 252;     /* #F8FAFC */
  --card: 36 19 82;              /* #241352 */
  --card-foreground: 248 250 252;
  --popover: 36 19 82;
  --popover-foreground: 248 250 252;
  --primary: 161 117 252;        /* #A175FC */
  --primary-foreground: 255 255 255;
  --secondary: 30 16 66;         /* #1e1042 */
  --secondary-foreground: 248 250 252;
  --muted: 30 16 66;
  --muted-foreground: 161 161 170; /* #a1a1aa */
  --accent: 30 16 66;
  --accent-foreground: 248 250 252;
  --destructive: 239 68 68;
  --destructive-foreground: 255 255 255;
  --border: 255 255 255 / 0.07;
  --input: 255 255 255 / 0.04;
  --ring: 161 117 252;
}
```

- [ ] **Step 3: Add custom semantic color variables for shadcn**

Add after the shadcn variables in `:root`:

```css
/* ── Custom semantic tokens (extend shadcn) ────────────────────────────── */
--success: 16 185 129;          /* #10B981 */
--success-foreground: 255 255 255;
--warning: 245 158 11;          /* #F59E0B */
--warning-foreground: 255 255 255;
--info: 59 130 246;             /* #3B82F6 */
--info-foreground: 255 255 255;
```

- [ ] **Step 4: Verify build compiles**

```bash
cd /Users/dendy/Documents/Work/lynq-dashboard && npm run build 2>&1 | tail -20
```

Expected: Build succeeds. Existing pages still work (they still use old `var(--bg-page)` etc).

---

## Task 3: Install shadcn Primitives

**Files:**
- Create: `components/ui/*.tsx` (via shadcn CLI)

- [ ] **Step 1: Install core shadcn components**

```bash
cd /Users/dendy/Documents/Work/lynq-dashboard && npx shadcn@latest add button input textarea label badge avatar tooltip separator skeleton scroll-area card
```

- [ ] **Step 2: Install interactive shadcn components**

```bash
cd /Users/dendy/Documents/Work/lynq-dashboard && npx shadcn@latest add dialog sheet dropdown-menu select checkbox switch tabs table popover command
```

- [ ] **Step 3: Install shadcn sonner (toast)**

```bash
cd /Users/dendy/Documents/Work/lynq-dashboard && npx shadcn@latest add sonner
```

- [ ] **Step 4: Verify components installed**

```bash
ls /Users/dendy/Documents/Work/lynq-dashboard/components/ui/
```

Expected: All component files exist (button.tsx, input.tsx, dialog.tsx, sheet.tsx, table.tsx, etc.).

---

## Task 4: Create Types Directory

**Files:**
- Create: `types/database.ts`
- Create: `types/index.ts`

- [ ] **Step 1: Create database types**

Create `types/database.ts` with types matching the Supabase tables used by the UI:

```typescript
// types/database.ts

export interface Client {
  id: string
  company_name: string
  email: string
  shopify_domain: string | null
  shopify_api_key: string | null
  gorgias_domain: string | null
  gorgias_api_key: string | null
  parcel_panel_api_key: string | null
  status: 'active' | 'inactive' | 'trial'
  created_at: string
}

export interface Broadcast {
  id: string
  title: string
  body: string
  type: 'update' | 'tip' | 'video' | 'industry'
  created_at: string
  workspace_id: string
}

export interface Notification {
  id: string
  title: string
  body: string
  type: 'info' | 'warn' | 'danger'
  created_at: string
  workspace_id: string
}

export interface Workspace {
  id: string
  name: string
  slug: string
  logo_url: string | null
  plan: string
  trial_ends_at: string | null
  created_at: string
}

export interface WorkspaceMember {
  id: string
  workspace_id: string
  user_id: string
  role: Role
  display_name: string | null
  avatar_url: string | null
  created_at: string
}

export type Role = 'owner' | 'admin' | 'agent' | 'observer'
```

- [ ] **Step 2: Create barrel export**

Create `types/index.ts`:

```typescript
// types/index.ts
export * from './database'
```

---

## Task 5: Create Zustand Stores

**Files:**
- Create: `stores/auth.ts`
- Create: `stores/theme.ts`
- Create: `stores/ui.ts`

- [ ] **Step 1: Create auth store**

Create `stores/auth.ts`:

```typescript
import { create } from 'zustand'
import type { Workspace, Role } from '@/types'
import type { User, Session } from '@supabase/supabase-js'

interface AuthState {
  user: User | null
  session: Session | null
  workspace: Workspace | null
  workspaceId: string | null
  role: Role | null
  memberId: string | null
  isLoading: boolean

  setSession: (session: Session | null) => void
  setWorkspace: (workspace: Workspace | null, role: Role | null, memberId: string | null) => void
  clearSession: () => void
  setLoading: (loading: boolean) => void
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  session: null,
  workspace: null,
  workspaceId: null,
  role: null,
  memberId: null,
  isLoading: true,

  setSession: (session) =>
    set({
      session,
      user: session?.user ?? null,
    }),

  setWorkspace: (workspace, role, memberId) =>
    set({
      workspace,
      workspaceId: workspace?.id ?? null,
      role,
      memberId,
    }),

  clearSession: () =>
    set({
      user: null,
      session: null,
      workspace: null,
      workspaceId: null,
      role: null,
      memberId: null,
      isLoading: false,
    }),

  setLoading: (isLoading) => set({ isLoading }),
}))
```

- [ ] **Step 2: Create theme store**

Create `stores/theme.ts`:

```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Theme = 'light' | 'dark'

interface ThemeState {
  theme: Theme
  toggle: () => void
  setTheme: (theme: Theme) => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'light',

      toggle: () =>
        set((state) => {
          const next = state.theme === 'light' ? 'dark' : 'light'
          return { theme: next }
        }),

      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'lynq-theme-store',
      partialize: (state) => ({ theme: state.theme }),
    },
  ),
)

// Note: The persist middleware stores JSON like {"state":{"theme":"dark"},"version":0}
// under the key 'lynq-theme-store'. The anti-flash script in layout.tsx reads
// this key and parses the JSON to extract the theme value.
// The legacy key 'lynq-theme' (plain string) is also checked for backward compat.
```

- [ ] **Step 3: Create UI store**

Create `stores/ui.ts`:

```typescript
import { create } from 'zustand'

export interface Toast {
  id: string
  title: string
  description?: string
  variant?: 'default' | 'destructive' | 'success'
}

interface UIState {
  sidebarCollapsed: boolean
  activeModal: string | null

  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  openModal: (id: string) => void
  closeModal: () => void
}

export const useUIStore = create<UIState>()((set) => ({
  sidebarCollapsed: false,
  activeModal: null,

  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  setSidebarCollapsed: (collapsed) =>
    set({ sidebarCollapsed: collapsed }),

  openModal: (id) => set({ activeModal: id }),

  closeModal: () => set({ activeModal: null }),
}))
```

---

## Task 6: Create Provider Components

**Files:**
- Create: `components/providers/auth-hydrator.tsx`
- Create: `components/providers/theme-sync.tsx`

- [ ] **Step 1: Create AuthHydrator**

This component lives in the root layout and syncs Supabase auth state to the Zustand store.

Create `components/providers/auth-hydrator.tsx`:

```typescript
'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'

export function AuthHydrator() {
  const setSession = useAuthStore((s) => s.setSession)
  const setWorkspace = useAuthStore((s) => s.setWorkspace)
  const setLoading = useAuthStore((s) => s.setLoading)
  const clearSession = useAuthStore((s) => s.clearSession)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSession(session)
        loadWorkspace(session.user.id)
      } else {
        setLoading(false)
      }
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session) {
          setSession(session)
          loadWorkspace(session.user.id)
        } else {
          clearSession()
        }
      },
    )

    return () => subscription.unsubscribe()
  }, [setSession, setWorkspace, setLoading, clearSession])

  async function loadWorkspace(userId: string) {
    const { data: member } = await supabase
      .from('workspace_members')
      .select('id, role, workspace_id, workspaces(*)')
      .eq('user_id', userId)
      .limit(1)
      .single()

    if (member) {
      const workspace = Array.isArray(member.workspaces)
        ? member.workspaces[0]
        : member.workspaces
      setWorkspace(workspace, member.role, member.id)
    }
    setLoading(false)
  }

  return null
}
```

- [ ] **Step 2: Create ThemeSync**

This component subscribes to the Zustand theme store and applies the `data-theme` attribute + `dark` class to `<html>`.

Create `components/providers/theme-sync.tsx`:

```typescript
'use client'

import { useEffect } from 'react'
import { useThemeStore } from '@/stores/theme'

export function ThemeSync() {
  const theme = useThemeStore((s) => s.theme)

  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-theme', theme)
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [theme])

  // Sync initial value from what the anti-flash script already set
  useEffect(() => {
    const saved = document.documentElement.getAttribute('data-theme')
    if (saved && (saved === 'light' || saved === 'dark')) {
      useThemeStore.getState().setTheme(saved)
    }
  }, [])

  return null
}
```

---

## Task 7: Create Hooks and Layout Components

**Files:**
- Create: `hooks/use-media-query.ts`
- Create: `components/layout/sidebar-item.tsx`
- Create: `components/layout/sidebar-user.tsx`
- Create: `components/layout/sidebar.tsx`
- Create: `components/layout/app-shell.tsx`
- Create: `components/layout/page-header.tsx`
- Create: `components/layout/page-shell.tsx`

- [ ] **Step 0: Create use-media-query hook**

Create `hooks/use-media-query.ts`:

```typescript
'use client'

import { useEffect, useState } from 'react'

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const media = window.matchMedia(query)
    setMatches(media.matches)

    const listener = (e: MediaQueryListEvent) => setMatches(e.matches)
    media.addEventListener('change', listener)
    return () => media.removeEventListener('change', listener)
  }, [query])

  return matches
}
```

- [ ] **Step 1: Create SidebarItem**

Create `components/layout/sidebar-item.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

interface SidebarItemProps {
  href: string
  icon: LucideIcon
  label: string
  badge?: number
  collapsed?: boolean
}

export function SidebarItem({ href, icon: Icon, label, badge, collapsed }: SidebarItemProps) {
  const pathname = usePathname()
  const isActive = pathname === href || pathname.startsWith(href + '/')

  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
        isActive
          ? 'bg-[var(--sidebar-active-bg)] text-[var(--sidebar-label-active)]'
          : 'text-[var(--sidebar-label-inactive)] hover:bg-[var(--sidebar-hover)]',
        collapsed && 'justify-center px-2',
      )}
    >
      <Icon
        size={18}
        className={cn(
          isActive
            ? 'text-[var(--sidebar-icon-active)]'
            : 'text-[var(--sidebar-icon-inactive)]',
        )}
      />
      {!collapsed && (
        <>
          <span className="truncate">{label}</span>
          {badge !== undefined && badge > 0 && (
            <Badge
              variant="secondary"
              className="ml-auto bg-primary/10 text-primary text-xs px-1.5 py-0"
            >
              {badge}
            </Badge>
          )}
        </>
      )}
    </Link>
  )
}
```

- [ ] **Step 2: Create SidebarUser**

Create `components/layout/sidebar-user.tsx`:

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { LogOut, Moon, Sun } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

interface SidebarUserProps {
  collapsed?: boolean
}

export function SidebarUser({ collapsed }: SidebarUserProps) {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const workspace = useAuthStore((s) => s.workspace)
  const { theme, toggle } = useThemeStore()

  const displayName = workspace?.name || user?.email?.split('@')[0] || 'User'
  const initials = displayName.slice(0, 2).toUpperCase()
  const email = user?.email || ''

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors hover:bg-[var(--sidebar-hover)]',
            collapsed && 'justify-center px-2',
          )}
        >
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-gradient-to-br from-primary to-purple-700 text-white text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium text-[var(--sidebar-label-active)]">
                {displayName}
              </p>
              <p className="truncate text-xs text-[var(--sidebar-label-inactive)]">
                {email}
              </p>
            </div>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="w-56">
        <DropdownMenuItem onClick={toggle}>
          {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          <span>{theme === 'light' ? 'Dark mode' : 'Light mode'}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>
          <LogOut size={16} />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

- [ ] **Step 3: Create Sidebar**

Create `components/layout/sidebar.tsx`:

```tsx
'use client'

import Image from 'next/image'
import {
  Home, Inbox, BarChart3, Zap, Package, GraduationCap,
  Rss, Settings, PanelLeftClose, PanelLeft, Shield,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { SidebarItem } from './sidebar-item'
import { SidebarUser } from './sidebar-user'

const NAV_ITEMS = [
  { href: '/home', icon: Home, label: 'Home' },
  { href: '/inbox', icon: Inbox, label: 'Inbox' },
  { href: '/analytics', icon: BarChart3, label: 'Analytics' },
  { href: '/performance', icon: Zap, label: 'Performance' },
  { href: '/supply-chain', icon: Package, label: 'Supply Chain' },
  { href: '/academy', icon: GraduationCap, label: 'Academy' },
  { href: '/value-feed', icon: Rss, label: 'Value Feed' },
] as const

const BOTTOM_ITEMS = [
  { href: '/settings', icon: Settings, label: 'Settings' },
  { href: '/admin', icon: Shield, label: 'Admin' },
] as const

export function Sidebar() {
  const collapsed = useUIStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  const role = useAuthStore((s) => s.role)

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-50 flex flex-col border-r border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] transition-[width] duration-200',
        collapsed ? 'w-[60px]' : 'w-[208px]',
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          'flex h-14 items-center border-b border-[var(--sidebar-border)]',
          collapsed ? 'justify-center px-2' : 'gap-2.5 px-4',
        )}
      >
        <Image src="/logo.png" alt="Lynq" width={28} height={28} className="shrink-0" />
        {!collapsed && (
          <span className="text-sm font-semibold text-[var(--sidebar-label-active)]">
            Lynq & Flow
          </span>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className={cn('ml-auto h-7 w-7 shrink-0', collapsed && 'ml-0')}
        >
          {collapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
        </Button>
      </div>

      {/* Main nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
        {NAV_ITEMS.map((item) => (
          <SidebarItem key={item.href} {...item} collapsed={collapsed} />
        ))}
      </nav>

      {/* Bottom section */}
      <div className="space-y-0.5 px-2 pb-2">
        <Separator className="mb-2" />
        {BOTTOM_ITEMS.map((item) => {
          // Only show Admin for owner/admin roles
          if (item.href === '/admin' && role !== 'owner' && role !== 'admin') return null
          return <SidebarItem key={item.href} {...item} collapsed={collapsed} />
        })}
        <Separator className="my-2" />
        <SidebarUser collapsed={collapsed} />
      </div>
    </aside>
  )
}
```

- [ ] **Step 4: Create AppShell**

Create `components/layout/app-shell.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useUIStore } from '@/stores/ui'
import { useMediaQuery } from '@/hooks/use-media-query'
import { cn } from '@/lib/utils'
import { Sidebar } from './sidebar'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Menu } from 'lucide-react'

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const collapsed = useUIStore((s) => s.sidebarCollapsed)
  const setSidebarCollapsed = useUIStore((s) => s.setSidebarCollapsed)
  const [mobileOpen, setMobileOpen] = useState(false)
  const isTablet = useMediaQuery('(min-width: 768px) and (max-width: 1023px)')
  const isMobile = useMediaQuery('(max-width: 767px)')

  // Auto-collapse on tablet
  useEffect(() => {
    if (isTablet) setSidebarCollapsed(true)
  }, [isTablet, setSidebarCollapsed])

  if (isMobile) {
    return (
      <div className="min-h-screen bg-[var(--bg-page)]">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="fixed left-3 top-3 z-40"
            >
              <Menu size={20} />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[208px] p-0">
            <Sidebar />
          </SheetContent>
        </Sheet>
        <main className="min-h-screen">{children}</main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--bg-page)]">
      <Sidebar />
      <main
        className={cn(
          'min-h-screen transition-[margin-left] duration-200',
          collapsed ? 'ml-[60px]' : 'ml-[208px]',
        )}
      >
        {children}
      </main>
    </div>
  )
}
```

- [ ] **Step 5: Create PageHeader**

Create `components/layout/page-header.tsx`:

```tsx
interface PageHeaderProps {
  title: string
  description?: string
  actions?: React.ReactNode
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-[var(--text-1)]">
          {title}
        </h1>
        {description && (
          <p className="mt-0.5 text-sm text-[var(--text-3)]">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
```

- [ ] **Step 6: Create PageShell**

Create `components/layout/page-shell.tsx`:

```tsx
import { PageHeader } from './page-header'
import { ScrollArea } from '@/components/ui/scroll-area'

interface PageShellProps {
  title: string
  description?: string
  actions?: React.ReactNode
  filters?: React.ReactNode
  children: React.ReactNode
}

export function PageShell({ title, description, actions, filters, children }: PageShellProps) {
  return (
    <div className="flex h-screen flex-col">
      <PageHeader title={title} description={description} actions={actions} />
      {filters && (
        <div className="border-b border-[var(--border)] px-6 py-2">
          {filters}
        </div>
      )}
      <ScrollArea className="flex-1">
        <div className="p-6">{children}</div>
      </ScrollArea>
    </div>
  )
}
```

---

## Task 8: Create Shared Composite Components

**Files:**
- Create: `components/shared/empty-state.tsx`
- Create: `components/shared/status-badge.tsx`
- Create: `components/shared/confirm-dialog.tsx`
- Create: `components/shared/search-input.tsx`
- Create: `components/shared/stat-card.tsx`
- Create: `components/shared/loading-state.tsx`
- Create: `components/shared/data-table.tsx`

- [ ] **Step 1: Create EmptyState**

Create `components/shared/empty-state.tsx`:

```tsx
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
}

export function EmptyState({ icon: Icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 rounded-xl bg-[var(--accent-soft)] p-3">
        <Icon size={24} className="text-primary" />
      </div>
      <h3 className="text-sm font-semibold text-[var(--text-1)]">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-[var(--text-3)]">{description}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction} className="mt-4" size="sm">
          {actionLabel}
        </Button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create StatusBadge**

Create `components/shared/status-badge.tsx`:

```tsx
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const VARIANT_STYLES: Record<string, string> = {
  active:    'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  open:      'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
  pending:   'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  closed:    'bg-zinc-100 text-zinc-600 dark:bg-zinc-500/10 dark:text-zinc-400',
  delivered: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  failed:    'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  urgent:    'bg-red-50 text-red-700 border border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20',
  new:       'bg-zinc-100 text-zinc-600 dark:bg-zinc-500/10 dark:text-zinc-400',
  trial:     'bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400',
}

interface StatusBadgeProps {
  status: string
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const styles = VARIANT_STYLES[status.toLowerCase()] || VARIANT_STYLES.new

  return (
    <Badge
      variant="secondary"
      className={cn('text-[10px] font-semibold uppercase tracking-wide', styles, className)}
    >
      {status}
    </Badge>
  )
}
```

- [ ] **Step 3: Create ConfirmDialog**

Create `components/shared/confirm-dialog.tsx`:

```tsx
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'default' | 'destructive'
  onConfirm: () => void
  loading?: boolean
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  loading,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={variant} onClick={onConfirm} disabled={loading}>
            {loading ? 'Loading...' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 4: Create SearchInput**

Create `components/shared/search-input.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface SearchInputProps {
  placeholder?: string
  value?: string
  onChange: (value: string) => void
  debounceMs?: number
  className?: string
}

export function SearchInput({
  placeholder = 'Search...',
  value: controlledValue,
  onChange,
  debounceMs = 300,
  className,
}: SearchInputProps) {
  const [internal, setInternal] = useState(controlledValue ?? '')

  useEffect(() => {
    if (controlledValue !== undefined) setInternal(controlledValue)
  }, [controlledValue])

  useEffect(() => {
    const timer = setTimeout(() => onChange(internal), debounceMs)
    return () => clearTimeout(timer)
  }, [internal, debounceMs, onChange])

  return (
    <div className={cn('relative', className)}>
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-4)]" />
      <Input
        value={internal}
        onChange={(e) => setInternal(e.target.value)}
        placeholder={placeholder}
        className="pl-9 pr-8"
      />
      {internal && (
        <button
          onClick={() => { setInternal(''); onChange('') }}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-4)] hover:text-[var(--text-2)]"
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Create StatCard**

Create `components/shared/stat-card.tsx`:

```tsx
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  label: string
  value: string | number
  icon?: LucideIcon
  trend?: { value: number; label: string }
  className?: string
}

export function StatCard({ label, value, icon: Icon, trend, className }: StatCardProps) {
  return (
    <Card className={cn('relative overflow-hidden', className)}>
      <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-primary to-purple-400" />
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-3)]">
            {label}
          </p>
          {Icon && <Icon size={16} className="text-[var(--text-4)]" />}
        </div>
        <p className="mt-2 text-2xl font-bold tracking-tight text-[var(--text-1)]">
          {value}
        </p>
        {trend && (
          <p
            className={cn(
              'mt-1 text-xs font-medium',
              trend.value >= 0 ? 'text-emerald-600' : 'text-red-600',
            )}
          >
            {trend.value >= 0 ? '+' : ''}{trend.value}% {trend.label}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 6: Create LoadingState**

Create `components/shared/loading-state.tsx`:

```tsx
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface LoadingStateProps {
  variant?: 'page' | 'cards' | 'table' | 'inline'
  count?: number
  className?: string
}

export function LoadingState({ variant = 'page', count = 3, className }: LoadingStateProps) {
  if (variant === 'cards') {
    return (
      <div className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-4', className)}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="rounded-xl border border-[var(--border)] p-5">
            <Skeleton className="mb-3 h-3 w-20" />
            <Skeleton className="h-8 w-24" />
          </div>
        ))}
      </div>
    )
  }

  if (variant === 'table') {
    return (
      <div className={cn('space-y-3', className)}>
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: count }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  if (variant === 'inline') {
    return <Skeleton className={cn('h-4 w-32', className)} />
  }

  // page variant
  return (
    <div className={cn('space-y-6 p-6', className)}>
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  )
}
```

- [ ] **Step 7: Create DataTable**

Create `components/shared/data-table.tsx`:

```tsx
'use client'

import { useState } from 'react'
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, ArrowUpDown } from 'lucide-react'
import { EmptyState } from './empty-state'
import { Inbox } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface Column<T> {
  key: string
  header: string
  sortable?: boolean
  className?: string
  render: (row: T) => React.ReactNode
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  pageSize?: number
  emptyTitle?: string
  emptyDescription?: string
  onRowClick?: (row: T) => void
  className?: string
}

export function DataTable<T extends { id?: string }>({
  columns,
  data,
  pageSize = 10,
  emptyTitle = 'No data',
  emptyDescription = 'Nothing to show yet.',
  onRowClick,
  className,
}: DataTableProps<T>) {
  const [page, setPage] = useState(0)
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const sorted = sortKey
    ? [...data].sort((a, b) => {
        const aVal = (a as Record<string, unknown>)[sortKey]
        const bVal = (b as Record<string, unknown>)[sortKey]
        const cmp = String(aVal).localeCompare(String(bVal))
        return sortDir === 'asc' ? cmp : -cmp
      })
    : data

  const totalPages = Math.ceil(sorted.length / pageSize)
  const paged = sorted.slice(page * pageSize, (page + 1) * pageSize)

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  if (data.length === 0) {
    return <EmptyState icon={Inbox} title={emptyTitle} description={emptyDescription} />
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="rounded-lg border border-[var(--border)]">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.key} className={col.className}>
                  {col.sortable ? (
                    <button
                      onClick={() => toggleSort(col.key)}
                      className="flex items-center gap-1 font-medium"
                    >
                      {col.header}
                      <ArrowUpDown size={14} className="text-[var(--text-4)]" />
                    </button>
                  ) : (
                    col.header
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.map((row, i) => (
              <TableRow
                key={row.id ?? i}
                onClick={() => onRowClick?.(row)}
                className={cn(onRowClick && 'cursor-pointer')}
              >
                {columns.map((col) => (
                  <TableCell key={col.key} className={col.className}>
                    {col.render(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-[var(--text-3)]">
            {page * pageSize + 1}–{Math.min((page + 1) * pageSize, data.length)} of {data.length}
          </p>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft size={16} />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
```

---

## Task 9: Create Auth Shell Layout

**Files:**
- Create: `components/layout/auth-shell.tsx`

- [ ] **Step 1: Create AuthShell**

This replaces the current 460-line `app/components/AuthShell.js`. The new version uses shadcn components and Tailwind instead of CSS-in-JS.

Create `components/layout/auth-shell.tsx`:

```tsx
'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import { cn } from '@/lib/utils'

interface AuthShellProps {
  title: string
  subtitle?: string
  children: React.ReactNode
  className?: string
}

export function AuthShell({ title, subtitle, children, className }: AuthShellProps) {
  return (
    <div className="flex min-h-screen">
      {/* Left branding panel */}
      <div className="relative hidden w-1/2 items-center justify-center overflow-hidden bg-gradient-to-br from-[#1C0F36] to-[#0D0F14] lg:flex">
        {/* Floating orbs */}
        <div className="absolute left-1/4 top-1/4 h-64 w-64 animate-[orbFloat1_20s_ease-in-out_infinite] rounded-full bg-purple-600/20 blur-3xl" />
        <div className="absolute bottom-1/3 right-1/4 h-48 w-48 animate-[orbFloat2_25s_ease-in-out_infinite] rounded-full bg-indigo-600/15 blur-3xl" />
        <div className="relative z-10 text-center">
          <Image src="/logo.png" alt="Lynq & Flow" width={64} height={64} className="mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-white">Lynq & Flow</h2>
          <p className="mt-2 text-sm text-white/50">Customer support, simplified.</p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex w-full items-center justify-center px-6 lg:w-1/2">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className={cn('w-full max-w-md', className)}
        >
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-1)]">{title}</h1>
          {subtitle && (
            <p className="mt-2 text-sm text-[var(--text-3)]">{subtitle}</p>
          )}
          <div className="mt-8">{children}</div>
        </motion.div>
      </div>
    </div>
  )
}
```

---

## Task 10: Refactor Root Layout

**Files:**
- Modify: `app/layout.tsx`
- Delete: `app/components/ThemeProvider.js` (after verification)
- Delete: `lib/styles.js` (after verification)

- [ ] **Step 1: Check which files import ThemeProvider and lib/styles.js**

```bash
cd /Users/dendy/Documents/Work/lynq-dashboard && grep -rl "ThemeProvider\|useTheme" app/ --include="*.js" --include="*.tsx" --include="*.ts" | head -20
```

```bash
cd /Users/dendy/Documents/Work/lynq-dashboard && grep -rl "lib/styles" app/ lib/ --include="*.js" --include="*.tsx" --include="*.ts" | head -20
```

Record all files that import these — they will need updates during their respective page refactors. Do NOT update them now. We only remove the old files if nothing imports them. If files still import them, keep the old files for now and add a `@deprecated` comment.

- [ ] **Step 2: Update root layout**

Replace `app/layout.tsx` with:

```tsx
import type { Metadata } from 'next'
import './globals.css'
import { AuthHydrator } from '@/components/providers/auth-hydrator'
import { ThemeSync } from '@/components/providers/theme-sync'
import PageTransition from './components/PageTransition'
import BlockedStateGuard from './components/BlockedStateGuard'
import SentryUserSync from './components/SentryUserSync'

export const metadata: Metadata = {
  title: 'Lynq — Customer Support Dashboard',
  description: 'Premium customer support dashboard for e-commerce brands',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t='light';try{var z=localStorage.getItem('lynq-theme-store');if(z){t=JSON.parse(z).state.theme||'light'}}catch(e){}if(t!=='dark'&&t!=='light'){var l=localStorage.getItem('lynq-theme');if(l==='dark'||l==='light')t=l}document.documentElement.setAttribute('data-theme',t);if(t==='dark')document.documentElement.classList.add('dark');})();`,
          }}
        />
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=switzer@400,500,600,700,800&display=swap"
        />
      </head>
      <body>
        <SentryUserSync />
        <AuthHydrator />
        <ThemeSync />
        <BlockedStateGuard>
          <PageTransition>{children}</PageTransition>
        </BlockedStateGuard>
      </body>
    </html>
  )
}
```

Key changes:
- `ThemeProvider` wrapper removed — replaced by `ThemeSync` component + Zustand store
- `AuthHydrator` added — syncs Supabase auth to Zustand
- Anti-flash script also adds `dark` class for shadcn compatibility
- `suppressHydrationWarning` added to `<html>` for theme script

- [ ] **Step 3: Add deprecation comments to old files**

If `ThemeProvider.js` or `lib/styles.js` are still imported by other files, add a deprecation comment at the top of each:

```javascript
// @deprecated — Use stores/theme.ts + useThemeStore() instead. Will be removed during page refactors.
```

```javascript
// @deprecated — Design tokens moved to globals.css. Use Tailwind classes instead. Will be removed during page refactors.
```

If they are NOT imported by anything else, delete them.

- [ ] **Step 4: Verify the app loads**

```bash
cd /Users/dendy/Documents/Work/lynq-dashboard && npm run dev
```

Open the app in a browser. Verify:
- Pages still render (existing pages use old patterns — that's fine)
- Theme toggle still works
- No console errors from the new stores/providers
- Light/dark mode persists across refreshes

---

## Task 11: Convert lib/ Files to TypeScript

**Files:**
- Rename: all `lib/*.js` → `lib/*.ts`
- Rename: all `lib/providers/*.js` → `lib/providers/*.ts`

- [ ] **Step 1: Rename lib files from .js to .ts**

```bash
cd /Users/dendy/Documents/Work/lynq-dashboard/lib
for f in *.js; do [ -f "$f" ] && git mv "$f" "${f%.js}.ts"; done
```

```bash
cd /Users/dendy/Documents/Work/lynq-dashboard/lib/providers
for f in *.js; do [ -f "$f" ] && git mv "$f" "${f%.js}.ts"; done
```

- [ ] **Step 2: Fix TypeScript errors**

Run the build to see what breaks:

```bash
cd /Users/dendy/Documents/Work/lynq-dashboard && npx tsc --noEmit 2>&1 | head -50
```

For each file, add minimal type annotations to resolve errors. Common fixes:
- Add `any` types for Supabase query results where full typing isn't worth it yet
- Add parameter types to exported functions
- Fix implicit-any errors on function parameters
- Add `as` assertions where needed for Supabase `.single()` return types

Focus on making the build pass — full type safety refinement happens during page refactors.

- [ ] **Step 3: Update imports across the codebase**

If any files import with explicit `.js` extensions (e.g., `from '../../lib/supabase.js'`), remove the extension since TypeScript resolution handles it:

```bash
cd /Users/dendy/Documents/Work/lynq-dashboard && grep -rl "from.*lib/.*\.js" app/ --include="*.js" --include="*.tsx" --include="*.ts" | head -20
```

Update any found imports to drop the `.js` extension.

- [ ] **Step 4: Verify build passes**

```bash
cd /Users/dendy/Documents/Work/lynq-dashboard && npm run build 2>&1 | tail -20
```

Expected: Build succeeds.

---

## Task 12: Verify Full Build

**Files:** None (verification only)

- [ ] **Step 1: Run the build**

```bash
cd /Users/dendy/Documents/Work/lynq-dashboard && npm run build 2>&1 | tail -30
```

Expected: Build succeeds with no errors. Warnings about unused imports are acceptable (they'll be cleaned up during page refactors).

- [ ] **Step 2: Run lint**

```bash
cd /Users/dendy/Documents/Work/lynq-dashboard && npm run lint 2>&1 | tail -20
```

Fix any lint errors in the new files.

- [ ] **Step 3: Spot-check the component imports**

Verify all new components can be imported without errors:

```bash
cd /Users/dendy/Documents/Work/lynq-dashboard && cat <<'EOF' > /tmp/import-check.ts
import { AppShell } from '@/components/layout/app-shell'
import { Sidebar } from '@/components/layout/sidebar'
import { PageHeader } from '@/components/layout/page-header'
import { PageShell } from '@/components/layout/page-shell'
import { AuthShell } from '@/components/layout/auth-shell'
import { DataTable } from '@/components/shared/data-table'
import { EmptyState } from '@/components/shared/empty-state'
import { StatusBadge } from '@/components/shared/status-badge'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { SearchInput } from '@/components/shared/search-input'
import { StatCard } from '@/components/shared/stat-card'
import { LoadingState } from '@/components/shared/loading-state'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'
import { useUIStore } from '@/stores/ui'
console.log('All imports OK')
EOF
npx tsc --noEmit /tmp/import-check.ts --baseUrl . --paths '{"@/*":["./*"]}' 2>&1 | head -20
```

If this produces errors, fix them before proceeding.

---

## Summary

After completing all 12 tasks, the foundation is in place:

- **shadcn/ui** installed with Lynq theme tokens
- **Zustand** stores for auth, theme, and UI state
- **20+ shadcn primitives** ready to use
- **Layout components:** AppShell, Sidebar (3 sub-components), PageHeader, PageShell, AuthShell
- **Shared composites:** DataTable, EmptyState, StatusBadge, ConfirmDialog, SearchInput, StatCard, LoadingState
- **Provider components:** AuthHydrator, ThemeSync
- **Types directory** with database types
- **All lib/ files** converted to TypeScript
- **Hooks:** use-media-query for responsive behavior
- **Root layout** updated to use new system

Existing pages continue to work unchanged. The next spec (inbox refactor) will be the first page to fully migrate to the new system.
