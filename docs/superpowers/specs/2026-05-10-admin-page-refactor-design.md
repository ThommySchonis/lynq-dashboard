# Admin Page Refactor — Design Spec

## Summary

Refactor the monolithic `app/admin/page.js` (3,417 lines) into a modular, maintainable architecture following the same patterns established in the inbox refactoring. The current file violates nearly every frontend rule in CLAUDE.md: inline CSS template strings, inline `style={{}}` objects, inline SVGs, `useState`+`fetch` for server data, all logic in one component, and plain JavaScript.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Architecture | Mirror inbox patterns exactly | Proven, consistent across codebase |
| Data fetching | Direct Supabase calls wrapped in TanStack hooks | Matches current behavior, faster to refactor |
| Routing | Next.js sub-routes per tab | Code splitting, cleaner URLs, idiomatic Next.js |
| Scope | All 10 tabs at once, split by sub-task | Tabs share the same refactoring pattern |
| AdminSidebar | Include in refactoring | Tightly coupled, same violations |

## File Structure

```
app/admin/
  layout.tsx                    -- Shared layout: auth guard + sidebar + topbar
  page.tsx                      -- Redirect to /admin/dashboard
  dashboard/page.tsx
  clients/page.tsx
  create-client/page.tsx
  broadcasts/page.tsx
  notifications/page.tsx
  inquiries/page.tsx
  team/page.tsx
  time/page.tsx
  finance/page.tsx
  events/page.tsx

components/features/admin/
  admin-sidebar.tsx             -- Refactored sidebar (Tailwind + TS)
  admin-topbar.tsx              -- Extracted topbar (title/subtitle + logout)
  dashboard/
    dashboard-view.tsx
    metric-card.tsx
    recent-clients-list.tsx
  clients/
    clients-list.tsx
    client-row.tsx
  create-client/
    create-client-form.tsx
  broadcasts/
    broadcast-form.tsx
    broadcast-list.tsx
    broadcast-row.tsx
  notifications/
    notification-form.tsx
    notification-list.tsx
  inquiries/
    inquiries-view.tsx
    inquiry-card.tsx
  team/
    team-form.tsx
    team-list.tsx
  time/
    time-view.tsx
  finance/
    finance-view.tsx
  events/
    event-form.tsx
    event-list.tsx

hooks/admin/
  use-admin-data.ts             -- TanStack useQuery hooks (all reads)
  use-admin-mutations.ts        -- TanStack useMutation hooks (all writes)
  index.ts                      -- Re-exports

stores/
  admin-ui.ts                   -- Zustand: shared UI state

types/
  admin.ts                      -- All admin-related types

lib/
  admin-constants.ts            -- Tab meta, type configs, nav config, topics
  admin-utils.ts                -- Time formatting helpers (fmtSec, fmtT, fmtD, workedSec), CSV export
```

## Shared Layout & Auth

`app/admin/layout.tsx` handles:

1. **Auth guard** — checks `supabase.auth.getUser()`, redirects to `/admin/login` if email is not in `ADMIN_EMAILS` array. Uses `useAuthStore` session to avoid repeated `getUser()` calls on every tab navigation. All sub-routes inherit this.
2. **Layout** — renders sidebar (left) + main area (topbar + scrollable `{children}`).
3. **Topbar** — derives title/subtitle from `usePathname()` via `TAB_META` constant.

`app/admin/page.tsx` uses `redirect('/admin/dashboard')` from `next/navigation` (server-side redirect).

### AdminSidebar (`components/features/admin/admin-sidebar.tsx`)

- Converted to TypeScript + Tailwind (no CSS template string).
- Uses `usePathname()` to highlight current route.
- Links via Next.js `<Link>` to `/admin/dashboard`, `/admin/clients`, etc.
- Badge counts (client count, new inquiries, feedback count) fetched via TanStack hooks within the sidebar using `adminKeys.clients()`, `adminKeys.inquiries()`, and a dedicated `useFeedbackCount()` hook.
- Navigation config moved to `lib/admin-constants.ts`.
- Retains support for the Feedback link (`/lynq-admin/feedback`) and "Back to Dashboard" footer link.
- The `app/lynq-admin/layout.js` must be updated to import from the new sidebar path (`components/features/admin/admin-sidebar.tsx`) instead of `app/components/AdminSidebar.js`.

### AdminTopbar (`components/features/admin/admin-topbar.tsx`)

- Derives title/subtitle from `usePathname()` + `TAB_META` constant from `lib/admin-constants.ts`.
- Contains logout button.
- Pure presentational.

## State Management

### Zustand Store — `stores/admin-ui.ts`

Minimal — only cross-component UI state:

```typescript
interface AdminUIState {
  editingZoomId: string | null
  setEditingZoomId: (id: string | null) => void
}
```

Form inputs stay local in components via `useState`. Success/error feedback uses `toast.success()` / `toast.error()` from sonner — the old `useState` success/error string pattern is not carried over. Loading states come from TanStack's `isPending` on mutations. Only state shared across component boundaries goes into Zustand.

### TanStack React Query — `hooks/admin/use-admin-data.ts`

Query keys:

```typescript
export const adminKeys = {
  all: ['admin'] as const,
  clients: () => [...adminKeys.all, 'clients'],
  broadcasts: () => [...adminKeys.all, 'broadcasts'],
  notifications: () => [...adminKeys.all, 'notifications'],
  inquiries: () => [...adminKeys.all, 'inquiries'],
  team: () => [...adminKeys.all, 'team'],
  time: (filter: string) => [...adminKeys.all, 'time', filter],
  finance: () => [...adminKeys.all, 'finance'],
  masterclasses: () => [...adminKeys.all, 'masterclasses'],
  broadcastReactions: () => [...adminKeys.all, 'broadcast-reactions'],
}
```

One hook per data source. Each wraps a direct Supabase client call:

```typescript
export function useClients() {
  return useQuery({
    queryKey: adminKeys.clients(),
    queryFn: async () => {
      const { data } = await supabase
        .from('clients').select('*')
        .order('created_at', { ascending: false })
      return data ?? []
    },
  })
}
```

Same pattern for: `useBroadcasts`, `useNotifications`, `useInquiries`, `useTeamMembers`, `useTimeData(filter)`, `useFinance`, `useMasterclasses`, `useBroadcastReactions`.

Note: `useTimeData` and `useFinance` call API routes (`/api/time`, `/api/admin/finance`) via `fetch` with auth header, since those already have backend routes.

### TanStack Mutations — `hooks/admin/use-admin-mutations.ts`

One mutation hook per write. Each invalidates related queries on success:

- `useCreateClient()` — two-step: `supabase.auth.signUp()` then `supabase.from('clients').insert()`. Note: if insert fails, the auth account is orphaned — this is a pre-existing issue, not introduced by the refactor. Invalidates `adminKeys.clients()`
- `useCreateBroadcast()` — insert into broadcasts, invalidates `adminKeys.broadcasts()`
- `useDeleteBroadcast()`
- `useTogglePin()` — unpins existing + toggles target, invalidates `adminKeys.broadcasts()`
- `useCreateNotification()` — invalidates `adminKeys.notifications()`
- `useDeleteNotification()`
- `useMarkInquiryRead()` — invalidates `adminKeys.inquiries()`
- `useCreateTeamMember()` — calls `/api/admin/create-user`, invalidates `adminKeys.team()`
- `useDeleteTeamMember()` — calls `/api/admin/delete-user`, invalidates `adminKeys.team()`
- `useCreateMasterclass()` — invalidates `adminKeys.masterclasses()`
- `useDeleteMasterclass()`
- `useUpdateZoomUrl()` — invalidates `adminKeys.masterclasses()`

## Types — `types/admin.ts`

```typescript
export interface Client {
  id: string
  company_name: string
  email: string
  shopify_domain: string | null
  shopify_api_key: string | null
  parcel_panel_api_key: string | null
  status: 'active' | 'inactive'
  created_at: string
}

export interface Broadcast {
  id: string
  title: string
  body: string | null
  type: 'update' | 'tip' | 'video' | 'industry'
  youtube_url: string | null
  topic: string | null
  is_pinned: boolean
  created_at: string
}

export interface Notification {
  id: string
  title: string
  body: string
  type: 'info' | 'warning' | 'alert'
  created_at: string
}

export interface Inquiry {
  id: string
  service: string
  client_email: string | null
  phone_number: string | null
  message: string | null
  status: 'new' | 'read'
  created_at: string
}

export interface TeamMember {
  id: string
  name: string
  email: string
  role: 'developer' | 'manager'
  created_at: string
}

export interface Masterclass {
  id: string
  title: string
  speaker: string | null
  description: string | null
  scheduled_at: string
  zoom_url: string | null
}

export interface BroadcastReaction {
  broadcast_id: string
  emoji: string
}

export interface FinanceData {
  finance: {
    mrr: number
    costs: number
    netMargin: number
  }
  ai: {
    costsToday: number
    last7Days: number
    thisMonth: number
    lastMonth: number
    byRoute: Array<{ route: string; cost: number; count: number }>
  }
  subscriptions: Array<{ name: string; cost: number; interval: string }>
}

export interface TimeEntry {
  id: string
  user_email: string
  start: string
  end: string | null
  duration_seconds: number
}

export interface CreateClientForm {
  company_name: string
  email: string
  password: string
  shopify_domain: string
  shopify_api_key: string
  parcel_panel_api_key: string
}

export interface BroadcastForm {
  title: string
  body: string
  type: 'update' | 'tip' | 'video' | 'industry'
  youtube_url: string
  topic: string
}

export interface NotificationForm {
  title: string
  body: string
  type: 'info' | 'warning' | 'alert'
}

export interface TeamForm {
  name: string
  email: string
  password: string
  role: 'developer' | 'manager'
}

export interface MasterclassForm {
  title: string
  speaker: string
  description: string
  scheduled_at: string
  zoom_url: string
}
```

## Constants — `lib/admin-constants.ts`

Contains:

- `ADMIN_EMAILS` — `['info@lynqagency.com', 'denver9523@gmail.com']` (array, not single string)
- `TAB_META` — title/subtitle per route segment, used by AdminTopbar
- `ADMIN_NAV` — sidebar navigation groups and items (moved from AdminSidebar.js)
- `BROADCAST_TYPES` — label, description, Lucide icon component, Tailwind color classes per type
- `BROADCAST_TOPICS` — array of topic strings
- `NOTIFICATION_TYPES` — label and Tailwind classes per type
- `SERVICE_COLORS` — inquiry service name to Tailwind color class mapping
- `INITIAL_*_FORM` — default form state objects for each form type

## Component Patterns

### Page files (thin wrappers)

Each `app/admin/*/page.tsx` is a thin composition of feature components:

```typescript
// app/admin/broadcasts/page.tsx
import { BroadcastForm } from '@/components/features/admin/broadcasts/broadcast-form'
import { BroadcastList } from '@/components/features/admin/broadcasts/broadcast-list'

export default function BroadcastsPage() {
  return (
    <div className="grid grid-cols-[42%_58%] gap-4 items-start">
      <BroadcastForm />
      <BroadcastList />
    </div>
  )
}
```

### Form components

- Local form state via `useState` (not Zustand)
- TanStack mutation for submission
- `toast.success()` / `toast.error()` for feedback (replaces inline success/error divs)
- shadcn `<Input>`, `<Button>`, `<Textarea>`, `<Label>` components
- Tailwind classes, no `style={{}}`

### List components

- TanStack query for data
- TanStack mutations for actions (delete, pin, mark read)
- Maps over data rendering row/card sub-components

### Row/card components

- Receive data + callbacks via props
- Pure presentational
- Lucide icons, Tailwind classes

### Tab layout patterns

| Layout | Tabs using it |
|--------|---------------|
| Single column | Dashboard, Clients, Inquiries |
| 42/58 grid | Create Client, Broadcasts, Notifications, Team, Events |
| Custom | Time, Finance |

## Styling Migration

### CSS template string removal

The entire `const CSS = \`...\`` block (100+ lines) is deleted. All classes map to shadcn components or Tailwind utilities:

| Old class | Replacement |
|-----------|-------------|
| `.ap-input` | shadcn `<Input>` |
| `.ap-textarea` | shadcn `<Textarea>` |
| `.ap-btn-primary` | shadcn `<Button>` |
| `.ap-card` | shadcn `<Card>` |
| `.ap-label` | shadcn `<Label>` + utility classes |
| `.ap-success` | Tailwind composition or `toast.success()` |
| `.ap-error` | Tailwind composition or `toast.error()` |
| `.ap-client-row` | Tailwind flex utilities |
| `.ap-metric-card` | Tailwind composition with Card |
| `.ap-type-pill` | Tailwind button with conditional classes |
| `.ap-topic-pill` | Tailwind button with conditional classes |

### Inline SVGs to Lucide

| Inline SVG | Lucide component |
|------------|------------------|
| Trend line (update) | `TrendingUp` |
| Info circle (tip) | `Info` |
| Play triangle (video) | `Play` |
| Building (industry) | `Building2` |
| Pin | `Pin` |
| Trash | `Trash2` |
| Close (X) | `X` |

### Color system

Raw hex/rgba values map to:
- Tailwind color utilities: `text-violet-600`, `bg-violet-50`, `border-violet-200`
- CSS variables: `text-foreground`, `bg-muted`, `border-border`
- Opacity modifiers: `bg-emerald-500/10`, `border-emerald-500/20`

## Migration Notes

### URL pattern change

Tab URLs change from `/admin?tab=broadcasts` to `/admin/broadcasts`. The `app/lynq-admin/layout.js` sidebar links must be updated from `?tab=<id>` format to direct sub-route paths.

### Data fetching pattern deviation

Admin hooks use direct Supabase client calls (not `authFetch` with bearer tokens like inbox). This matches the current admin page behavior and is a known deviation. Time/finance/team-create/team-delete still go through API routes via `fetch` since those routes already exist.

### Finance tab lazy loading

With sub-routes, TanStack auto-fetches when the user navigates to `/admin/finance`. This naturally replaces the old "load on demand" behavior — data only loads when the tab is visited.

## Files to Delete After Refactor

- `app/admin/page.js` — replaced by layout + sub-route pages
- `app/components/AdminSidebar.js` — replaced by `components/features/admin/admin-sidebar.tsx`

## Files to Update

- `app/lynq-admin/layout.js` — update AdminSidebar import path to `components/features/admin/admin-sidebar.tsx`

## Out of Scope

- API route refactoring (existing routes for finance, team, time stay as-is)
- Database schema changes
- New features or functionality changes
- Other pages (inbox, settings, etc.)
