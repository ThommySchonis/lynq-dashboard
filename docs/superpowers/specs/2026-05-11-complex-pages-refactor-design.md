# Complex Pages Refactor Design

**Date:** 2026-05-11
**Scope:** Structural refactor of Academy (3 pages, ~2,290 lines), Analytics (1 page, ~1,087 lines), Supply Chain (1 page, ~931 lines), and Time Tracking (1 page, ~742 lines) from monolithic JS with CSS injection to modular TypeScript components.

**Pattern:** Identical to the admin/settings/inbox refactors — types → constants → hooks → stores → components → thin page routes.

**Tech Stack:** Next.js 16 (app router), React 19, TypeScript, TanStack React Query, Zustand, Tailwind CSS, shadcn/base-ui, Lucide icons, framer-motion (Academy only), Supabase client SDK.

---

## Source Files

| Feature | Source | Lines |
|---------|--------|-------|
| Academy | `app/academy/page.js` | 1,459 |
| Academy Final Exam | `app/academy/final-exam/page.js` | 604 |
| Academy Certificate | `app/academy/certificate/page.js` | 228 |
| Analytics | `app/analytics/page.js` | 1,087 |
| Supply Chain | `app/supply-chain/page.js` | 931 |
| Time Tracking | `app/time-tracking/page.js` | 742 |

---

## File Structure

### Academy

```
types/academy.ts
lib/academy-constants.ts
hooks/academy/use-academy-data.ts
hooks/academy/use-academy-mutations.ts
hooks/academy/index.ts
stores/academy-ui.ts
components/features/academy/academy-sidebar.tsx
components/features/academy/academy-topbar.tsx
components/features/academy/welcome-view.tsx
components/features/academy/module-view.tsx
components/features/academy/lesson-view.tsx
components/features/academy/quiz-view.tsx
components/features/academy/certificate-view.tsx
components/features/academy/academy-page.tsx
components/features/academy/final-exam.tsx
components/features/academy/certificate-page.tsx
app/academy/page.tsx
app/academy/final-exam/page.tsx
app/academy/certificate/page.tsx
```

### Analytics

```
types/analytics.ts
lib/analytics-constants.ts
hooks/analytics/use-analytics-data.ts
hooks/analytics/use-analytics-mutations.ts
hooks/analytics/index.ts
components/features/analytics/alert-banner.tsx
components/features/analytics/kpi-row.tsx
components/features/analytics/revenue-trend-chart.tsx
components/features/analytics/donut-reason-chart.tsx
components/features/analytics/monthly-trend-chart.tsx
components/features/analytics/action-board.tsx
components/features/analytics/refund-table.tsx
components/features/analytics/product-matrix.tsx
components/features/analytics/refund-reasons.tsx
components/features/analytics/weekly-report.tsx
components/features/analytics/analytics-page.tsx
app/analytics/page.tsx
```

### Supply Chain

```
types/supply-chain.ts
lib/supply-chain-constants.ts
hooks/supply-chain/use-supply-chain-data.ts
hooks/supply-chain/use-supply-chain-mutations.ts
hooks/supply-chain/index.ts
stores/supply-chain-ui.ts
components/features/supply-chain/shipment-kpi-cards.tsx
components/features/supply-chain/shipment-filters.tsx
components/features/supply-chain/shipment-row.tsx
components/features/supply-chain/attention-card.tsx
components/features/supply-chain/checkpoint-timeline.tsx
components/features/supply-chain/setup-wizard.tsx
components/features/supply-chain/supply-chain-page.tsx
app/supply-chain/page.tsx
```

### Time Tracking

```
types/time-tracking.ts
lib/time-tracking-constants.ts
hooks/time-tracking/use-time-tracking-data.ts
hooks/time-tracking/use-time-tracking-mutations.ts
hooks/time-tracking/index.ts
components/features/time-tracking/clock-card.tsx
components/features/time-tracking/kpi-cards.tsx
components/features/time-tracking/filter-tabs.tsx
components/features/time-tracking/clock-out-modal.tsx
components/features/time-tracking/work-log.tsx
components/features/time-tracking/member-row.tsx
components/features/time-tracking/admin-log-row.tsx
components/features/time-tracking/team-view.tsx
components/features/time-tracking/personal-view.tsx
components/features/time-tracking/time-tracking-page.tsx
app/time-tracking/page.tsx
```

---

## Types

### `types/academy.ts`

```typescript
export interface QuizQuestion {
  q: string
  opts: string[]
  correct: number
}

export interface Section {
  title: string
  mins: number
  body?: string
  takeaways?: string[]
  tips?: string[]
  example?: string
  type?: 'quiz'
}

export interface Module {
  id: string
  examType: string
  num: string
  color: string
  label: string
  description: string
  sections: Section[]
  quiz: QuizQuestion[]
}

export type AcademyView = 'welcome' | 'module' | 'lesson' | 'quiz' | 'certificate'

export interface ExamQuestion {
  q: string
  opts: string[]
  correct: number
}

export interface SectionMeta {
  label: string
  color: string
}

export interface ExamResult {
  id: string
  user_id: string
  score: number
  total: number
  passed: boolean
  created_at: string
}

export interface Certificate {
  id: string
  user_id: string
  user_name: string
  score: number
  issued_at: string
}
```

### `types/analytics.ts`

```typescript
export type DateRangeId = 'month' | '7d' | '30d' | 'lastMonth' | 'custom'

export interface DateRange {
  from: string
  to: string
}

export interface Refund {
  id: string
  orderId: string
  orderNumber: string
  customer: string
  customerEmail: string
  reason: string
  refundAmount: string | number
  refundPct: string | number
  refundedAt: string
  products: string[]
}

export interface KpiData {
  totalRevenue: number
  totalOrders: number
  refundRate: number
  refundAmount: number
  totalRefunds: number
  avgOrderValue: number
}

export interface PrevKpiData {
  totalRevenue?: number
  totalOrders?: number
  refundRate?: number
  refundAmount?: number
  totalRefunds?: number
}

export interface RevenueTrendPoint {
  date: string
  revenue: number
}

export interface PatternAction {
  id: string
  type: 'pattern'
  priority: 'high' | 'medium' | 'low'
  category: string
  product?: string
  refundCount: number
  totalAmount: string | number
  title: string
  action: string
}

export interface AiInsight {
  id: string
  title: string
  body: string
  category: string
}

export interface WeeklyReportRow {
  label: string
  refundCount: number
  totalAmount: number
  topReason: string | null
  topProduct: string | null
  isCurrentWeek: boolean
}

export interface ProductMatrixRow {
  name: string
  count: number
  amount: number
  avgPct: string
  topCat: string
}

export interface RepeatRefunder {
  customer: string
  email: string
  count: number
  totalAmount: number
  lastRefund: string
}

export interface Delta {
  pct: number
  label: string
}

export type RefundCategory = 'All' | 'Sizing' | 'Damaged' | 'Quality' | 'Not as described' | 'Changed mind' | 'Other'

export interface CategoryColorConfig {
  color: string
  bg: string
  border: string
  chartColor: string
}

// Note: no AnalyticsLoadedState type needed — TanStack handles loading states
// via isPending/isLoading on each query hook. Components check individual
// hook loading states (e.g. kpisQuery.isPending) instead of a unified object.
```

### `types/supply-chain.ts`

```typescript
export type ShipmentStatusKey =
  | 'PENDING' | 'INFO_RECEIVED' | 'IN_TRANSIT' | 'OUT_FOR_DELIVERY'
  | 'DELIVERED' | 'EXCEPTION' | 'FAILED_ATTEMPT' | 'EXPIRED'

export interface StatusConfig {
  label: string
  color: string
  bg: string
  border: string
}

export type AttentionType =
  | 'FAILED_ATTEMPT' | 'PICKUP_REQUIRED' | 'EXCEPTION' | 'OVERDUE' | 'EXPIRED'

export interface AttentionConfig {
  label: string
  desc: string
  color: string
  bg: string
  border: string
  priority: number
  message: (name: string, num: string) => string
}

export interface Checkpoint {
  status: string
  detail: string
  location?: string
  checkpoint_time: string
}

export interface Shipment {
  status: string
  carrier_name?: string
  carrier_logo?: string
  tracking_number?: string
  checkpoints?: Checkpoint[]
}

export interface Order {
  id: string
  order_number: string
  customer?: {
    name?: string
    email?: string
  }
  products?: string[]
  created_at: string
  shipments?: Shipment[]
}

export interface AttentionItem {
  key: string
  order: Order
  shipment: Shipment
  type: AttentionType
  daysSince: number | null
  lastDetail: string
  cfg: AttentionConfig
}

export type SupplyChainFilter = 'All' | 'Needs Attention' | 'In Transit' | 'Delivered' | 'Exception' | 'Pending'

export interface ParcelPanelSetup {
  connected: boolean
  apiKey?: string
}
```

### `types/time-tracking.ts`

```typescript
export type TimeFilter = 'today' | 'week' | 'month'

export type ClockState = 'idle' | 'active' | 'paused'

export interface Session {
  id: string
  user_id: string
  member_name?: string
  clocked_in_at: string
  clocked_out_at: string | null
  active_seconds: number
  idle_seconds: number
  is_paused: boolean
  status: 'active' | 'paused' | 'ended'
  paused_at: string | null
  paused_seconds: number
  eod_report: string | null
}

export interface TeamMember {
  id: string
  name: string
  role: string
  is_active: boolean
  is_paused: boolean
  worked_seconds: number
  sessions_count: number
}

export interface TeamData {
  members: TeamMember[]
  sessions: Session[]
  active_count: number
  paused_count: number
  client?: {
    company_name: string
  }
}

export interface TeamKpiDef {
  key: string
  label: string | null
}
```

---

## Constants

### `lib/academy-constants.ts`

Contains:
- `PASS_THRESHOLD = 75`
- `EASE = [0.16, 1, 0.3, 1]` (framer-motion easing)
- `readKey(moduleId: string, idx: number): string` — localStorage key helper
- `QUIZ_QUESTIONS: Record<string, QuizQuestion[]>` — all quiz data per module ID
- `MODULES: Module[]` — the full 6-module content array. Each module has `id`, `examType`, `num`, `color`, `label`, `description`, `sections[]`. The quiz section is appended at init.
- `ALL_MODULE_IDS: string[]`
- `MODULE_LABELS: Record<string, string>`
- `SECTION_META: SectionMeta[]` (for final exam)
- `ALL_EXAM_QUESTIONS: ExamQuestion[]` (50 questions for final exam, from `final-exam/page.js`)

**Source:** Extract exact values from `app/academy/page.js` lines 8–229 and `app/academy/final-exam/page.js` lines 10–26 + 29–180.

### `lib/analytics-constants.ts`

Contains:
- `RANGES: { id: DateRangeId; label: string }[]`
- `CATEGORIES: RefundCategory[]`
- `CAT_COLORS: Record<string, CategoryColorConfig>`
- `BADGE_COLORS: Record<string, { bg: string; color: string; border: string }>`
- `getDateRange(id: DateRangeId): DateRange`
- `getPrevDateRange(id: DateRangeId): DateRange`
- `categorizeReason(raw: string): string`
- `computeDelta(cur: number, prev: number): Delta | null`
- `fmtEur(n: number): string`
- `fmtDate(str: string): string`
- `fmtDateShort(d: string): string`
- `generatePatternActions(allRefunds: Refund[]): PatternAction[]`
- `generateRepeatRefunderActions(allRefunds: Refund[]): PatternAction[]`
- `buildWeeklyReport(allRefunds: Refund[]): WeeklyReportRow[]`
- `buildMonthlyTrend(allRefunds: Refund[]): { label: string; count: number; amount: number; isCurrentMonth: boolean }[]`
- `buildProductMatrix(allRefunds: Refund[]): ProductMatrixRow[]`
- `buildRepeatRefunders(allRefunds: Refund[]): RepeatRefunder[]`

**Source:** Extract exact values from `app/analytics/page.js` lines 11–178.

### `lib/supply-chain-constants.ts`

Contains:
- `STATUS: Record<ShipmentStatusKey, StatusConfig>`
- `getStatus(key: string): StatusConfig`
- `ATTENTION: Record<AttentionType, AttentionConfig>`
- `PICKUP_PATTERN: RegExp`
- `ALL_FILTERS: SupplyChainFilter[]`
- `getAttentionItems(orders: Order[], dismissed: Set<string>): AttentionItem[]`

**Source:** Extract exact values from `app/supply-chain/page.js` lines 8–96.

### `lib/time-tracking-constants.ts`

Contains:
- `FILTERS: { id: TimeFilter; label: string }[]`
- `TEAM_KPI: TeamKpiDef[]`
- `EMP_KPI: TeamKpiDef[]` (personal view KPI cards: week, today, avg)
- `fmtElapsed(sec: number): string`
- `fmtDur(sec: number): string`
- `durSec(s: Session): number`
- `fmtTime(iso: string): string`
- `fmtDate(iso: string): string`

**Source:** Extract exact values from `app/time-tracking/page.js` lines 9–117.

---

## Hooks

### `hooks/academy/use-academy-data.ts`

```typescript
'use client'

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import type { ExamResult, Certificate } from '@/types/academy'

function useToken() {
  return useAuthStore((s) => s.session?.access_token ?? '')
}

export const academyKeys = {
  all: ['academy'] as const,
  passedExams: () => [...academyKeys.all, 'passed-exams'] as const,
  certificate: () => [...academyKeys.all, 'certificate'] as const,
  examQuestions: () => [...academyKeys.all, 'exam-questions'] as const,
}

// Supabase direct: SELECT module_id, passed FROM exam_submissions WHERE user_id = {userId} AND passed = true
// Returns passed exam types (module IDs) for progress tracking
export function usePassedExams() { ... }

// Supabase direct: SELECT * FROM certificates WHERE user_id = {userId}
export function useCertificate() { ... }
```

**Source:** Read `app/academy/page.js` for the Supabase query that fetches passed exam types. Read `app/academy/final-exam/page.js` for the exam questions fetch. Read `app/academy/certificate/page.js` for the certificate fetch.

### `hooks/academy/use-academy-mutations.ts`

```typescript
'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { academyKeys } from './use-academy-data'

function useToken() {
  return useAuthStore((s) => s.session?.access_token ?? '')
}

// Supabase direct: UPSERT exam_submissions { user_id, module_id, score, passed, completed_at }
// On success with all modules passed: also UPSERT certificates { user_id, issued_at, exam_score, modules_completed }
// Invalidates academyKeys.passedExams()
export function useSubmitQuiz() { ... }

// Supabase direct: UPSERT exam_submissions with module_id='final', then UPSERT certificates if passed
// Invalidates academyKeys.passedExams() and academyKeys.certificate()
export function useSubmitExam() { ... }
```

**Source:** Read `app/academy/page.js` `handleQuizComplete` function for quiz submission. Read `app/academy/final-exam/page.js` for exam submission logic.

### `hooks/analytics/use-analytics-data.ts`

```typescript
'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'
import type { KpiData, PrevKpiData, Refund, RevenueTrendPoint, AiInsight, DateRange } from '@/types/analytics'

function useToken() {
  return useAuthStore((s) => s.session?.access_token ?? '')
}

export const analyticsKeys = {
  all: ['analytics'] as const,
  kpis: (range: DateRange) => [...analyticsKeys.all, 'kpis', range] as const,
  prevKpis: (range: DateRange) => [...analyticsKeys.all, 'prev-kpis', range] as const,
  refunds: (range: DateRange) => [...analyticsKeys.all, 'refunds', range] as const,
  allRefunds: () => [...analyticsKeys.all, 'all-refunds'] as const,
  trend: (range: DateRange) => [...analyticsKeys.all, 'trend', range] as const,
  insights: () => [...analyticsKeys.all, 'insights'] as const,
  shopifyConnected: () => [...analyticsKeys.all, 'shopify-connected'] as const,
}

// GET /api/shopify/kpis with date range params
export function useKpis(range: DateRange) { ... }

// GET /api/shopify/kpis with previous period date range
export function usePrevKpis(range: DateRange) { ... }

// GET /api/shopify/refunds?from=...&to=... with date range
export function useRefunds(range: DateRange) { ... }

// GET /api/shopify/refunds?from=...&to=... with 365-day lookback (full history for pattern analysis)
export function useAllRefunds() { ... }

// GET /api/shopify/revenue-trend with date range
export function useRevenueTrend(range: DateRange) { ... }

// POST /api/analytics/refund-insights — sends refund data, receives AI insights
// Note: this is a POST that depends on refund data being loaded first.
// Use useQuery with `enabled: !!refunds.length` and pass refunds in the body.
export function useAiInsights(refunds: Refund[]) { ... }

// GET /api/analytics/actions — fetches saved action statuses (done/undone)
export function useActionStatuses() { ... }

// GET /api/settings/integrations to check Shopify connection
export function useShopifyConnected() { ... }
```

**Source:** Read `app/analytics/page.js` `AnalyticsContent` component for all fetch calls and their exact URL paths, headers, and query parameters.

### `hooks/analytics/use-analytics-mutations.ts`

```typescript
'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'
import { analyticsKeys } from './use-analytics-data'

function useToken() {
  return useAuthStore((s) => s.session?.access_token ?? '')
}

// PATCH /api/analytics/actions — saves action done/undone status with { id, status, pickedUpBy, resultNote }
export function useUpdateActionStatus() { ... }
```

**Source:** Read `app/analytics/page.js` `handleStatusChange` function.

### `hooks/supply-chain/use-supply-chain-data.ts`

```typescript
'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'
import type { Order } from '@/types/supply-chain'

function useToken() {
  return useAuthStore((s) => s.session?.access_token ?? '')
}

export const supplyChainKeys = {
  all: ['supply-chain'] as const,
  shipments: () => [...supplyChainKeys.all, 'shipments'] as const,
  setup: () => [...supplyChainKeys.all, 'setup'] as const,
}

// GET /api/parcel-panel/tracking — fetches shipment orders
// Note: returns { orders: [...] } on success, or 400/404 if Parcel Panel is not configured.
// The connection status is inferred from this response (no separate setup endpoint needed).
export function useShipments() { ... }

// Derives Parcel Panel connection status from useShipments() response.
// If useShipments() returns 400/404 error → not connected → show SetupWizard.
// No separate API call needed.
```

**Source:** Read `app/supply-chain/page.js` for the fetch calls.

### `hooks/supply-chain/use-supply-chain-mutations.ts`

```typescript
'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'
import { supplyChainKeys } from './use-supply-chain-data'

function useToken() {
  return useAuthStore((s) => s.session?.access_token ?? '')
}

// POST /api/parcel-panel/connect — connects Parcel Panel with API key
export function useConnectParcelPanel() { ... }
```

**Source:** Read `app/supply-chain/page.js` for the Parcel Panel setup/connect logic.

### `hooks/time-tracking/use-time-tracking-data.ts`

```typescript
'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'
import type { Session, TeamData, TimeFilter } from '@/types/time-tracking'

function useToken() {
  return useAuthStore((s) => s.session?.access_token ?? '')
}

export const timeTrackingKeys = {
  all: ['time-tracking'] as const,
  mySessions: (filter: TimeFilter) => [...timeTrackingKeys.all, 'my-sessions', filter] as const,
  activeSession: () => [...timeTrackingKeys.all, 'active-session'] as const,
  teamData: (filter: TimeFilter) => [...timeTrackingKeys.all, 'team', filter] as const,
}

// GET /api/time?filter=... — single endpoint, backend branches on user role.
// Returns { is_admin?, is_client_admin?, member, sessions[], today_seconds?, active_session? }
// For admin/client_admin: also returns { members[], active_count, paused_count, client? }
// The hook returns the raw response; components pick the fields they need.
export function useTimeData(filter: TimeFilter) { ... }

// Derived from useTimeData — extracts the active session from the response
// Polls every 30 seconds (refetchInterval) to keep session state fresh
export function useActiveSession(filter: TimeFilter) { ... }
```

**Source:** Read `app/time-tracking/page.js` for the fetch calls to `/api/time`.

### `hooks/time-tracking/use-time-tracking-mutations.ts`

```typescript
'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'
import { timeTrackingKeys } from './use-time-tracking-data'

function useToken() {
  return useAuthStore((s) => s.session?.access_token ?? '')
}

// POST /api/time { action: 'clock-in' }
export function useClockIn() { ... }

// POST /api/time { action: 'clock-out', session_id, eod_report }
export function useClockOut() { ... }

// POST /api/time { action: 'pause', session_id }
export function usePauseSession() { ... }

// POST /api/time { action: 'resume', session_id } — returns { paused_seconds }
export function useResumeSession() { ... }

// POST /api/time { action: 'heartbeat', session_id } — called every 30 seconds
// Not a TanStack mutation — use a plain setInterval + fetch in the clock-card component.
// Keeps the session alive on the backend.
export function sendHeartbeat(token: string, sessionId: string): Promise<void> { ... }
```

**Source:** Read `app/time-tracking/page.js` for the clock in/out/pause/resume fetch calls.

### Index files

Each `hooks/<feature>/index.ts` re-exports both data and mutation hooks:

```typescript
export * from './use-<feature>-data'
export * from './use-<feature>-mutations'
```

---

## Zustand Stores

### `stores/academy-ui.ts`

```typescript
import { create } from 'zustand'
import type { AcademyView } from '@/types/academy'

interface AcademyUIState {
  view: AcademyView
  selectedModuleId: string | null
  selectedLesson: number
  setView: (view: AcademyView) => void
  selectModule: (moduleId: string) => void
  selectLesson: (index: number) => void
  reset: () => void
}

export const useAcademyUI = create<AcademyUIState>()((set) => ({
  view: 'welcome',
  selectedModuleId: null,
  selectedLesson: 0,
  setView: (view) => set({ view }),
  selectModule: (moduleId) => set({ selectedModuleId: moduleId, selectedLesson: 0, view: 'module' }),
  selectLesson: (index) => set({ selectedLesson: index, view: 'lesson' }),
  reset: () => set({ view: 'welcome', selectedModuleId: null, selectedLesson: 0 }),
}))
```

### `stores/supply-chain-ui.ts`

```typescript
import { create } from 'zustand'
import type { SupplyChainFilter } from '@/types/supply-chain'

interface SupplyChainUIState {
  filter: SupplyChainFilter
  search: string
  expandedOrderId: string | null
  dismissedKeys: Set<string>
  setFilter: (filter: SupplyChainFilter) => void
  setSearch: (search: string) => void
  toggleExpanded: (orderId: string) => void
  dismiss: (key: string) => void
}

export const useSupplyChainUI = create<SupplyChainUIState>()((set) => ({
  filter: 'All',
  search: '',
  expandedOrderId: null,
  dismissedKeys: new Set(),
  setFilter: (filter) => set({ filter }),
  setSearch: (search) => set({ search }),
  toggleExpanded: (orderId) =>
    set((s) => ({ expandedOrderId: s.expandedOrderId === orderId ? null : orderId })),
  dismiss: (key) =>
    set((s) => {
      const next = new Set(s.dismissedKeys)
      next.add(key)
      return { dismissedKeys: next }
    }),
}))
```

Analytics and Time Tracking do not need Zustand stores — their filter state is simple enough for `useState` in the orchestrator component.

---

## Components

### Academy Components

#### `components/features/academy/academy-sidebar.tsx`

Module navigation sidebar (240px wide). Shows:
- Module list with numbered items, color-coded dots, completion checkmarks
- Section sub-items per expanded module (read/unread state)
- Progress bar at bottom

Uses `useAcademyUI` store for selection state, `usePassedExams()` for completion.

**Source:** Port from `app/academy/page.js` — the left panel rendering within the main component (search for the sidebar nav section with `.ac-nav-item` classes).

#### `components/features/academy/academy-topbar.tsx`

Top bar (52px height) with:
- Breadcrumb navigation (Academy > Module > Lesson/Quiz)
- Completion percentage badge
- User avatar initial

Props: receives view state and module/lesson info from `useAcademyUI` store.

**Source:** Port from `app/academy/page.js` `Topbar` function (lines 417–475).

#### `components/features/academy/welcome-view.tsx`

Hero landing view with:
- Animated gradient orbs (framer-motion)
- "Lynq Academy" badge, title with gradient text, subtitle
- Stats pills (6 Modules, ~4 Hours, Certificate)
- CTA button ("Start Learning" / "Continue Learning")
- Module pill grid showing completion status

**Source:** Port from `app/academy/page.js` `WelcomeView` function (lines 479–560+).

#### `components/features/academy/module-view.tsx`

Module detail view:
- Module header with icon, title, description
- Lesson rows (clickable cards with read/unread state, time estimate)
- "Start Quiz" button (enabled when all sections read)
- Back button

**Source:** Port from `app/academy/page.js` `ModuleView` function.

#### `components/features/academy/lesson-view.tsx`

Lesson content view:
- Lesson title, time estimate
- Body text (multi-paragraph)
- Takeaways list (bullet points)
- Tips section (if present)
- Example section (if present, with Good/Bad formatting)
- Navigation: Back, Previous, Next buttons
- Auto mark-as-read on view

**Source:** Port from `app/academy/page.js` `LessonView` function.

#### `components/features/academy/quiz-view.tsx`

Module quiz (5 questions):
- Question display with progress counter
- Radio option cards with selected/correct/incorrect states
- Submit button, results screen with score and pass/fail
- Retry / Back to module buttons

**Source:** Port from `app/academy/page.js` `QuizView` function.

#### `components/features/academy/certificate-view.tsx`

Inline certificate display (within academy page):
- Certificate card with user name, completion date
- Action buttons (view full certificate page link)

**Source:** Port from `app/academy/page.js` `CertificateView` function.

#### `components/features/academy/academy-page.tsx`

Orchestrator component:
- Layout: `<Sidebar />` + academy-sidebar + content area
- View state machine via `useAcademyUI` store
- `AnimatePresence` for view transitions (framer-motion)
- Data loading: `usePassedExams()`, localStorage read progress
- Certificate completion banner when all modules done

**Source:** Port from `app/academy/page.js` default export function (lines ~1350–1459).

#### `components/features/academy/final-exam.tsx`

50-question timed final exam:
- Section grouping (5 sections × 10 questions)
- Section progress indicators with color coding
- Question navigation, answer selection
- Timer display
- Submit with score calculation
- Results screen with section breakdown, pass/fail, certificate link

**Source:** Port from `app/academy/final-exam/page.js` (full file, 604 lines).

#### `components/features/academy/certificate-page.tsx`

Standalone certificate page:
- Fetch certificate from Supabase
- Certificate card with gradient border, user name, date, score
- Share button, print button, download as image
- Back to academy link

**Source:** Port from `app/academy/certificate/page.js` (full file, 228 lines).

### Analytics Components

#### `components/features/analytics/alert-banner.tsx`

Conditional banner shown when refund rate > 5%:
- Warning (5–20%) or Critical (≥20%) variant
- Alert icon + severity label + message

Props: `rate: number`, `loaded: boolean`

**Source:** Port from `app/analytics/page.js` `AlertBanner` function (lines 308–321).

#### `components/features/analytics/kpi-row.tsx`

4-column KPI grid:
- Refunds This Period (€ amount)
- Total Refunds (count)
- Refund Rate (%)
- Avg Refund (€)
- Each card: animated count-up, delta badge vs previous period, category icon
- Skeleton loading state

Includes local `useCountUp` hook and `DeltaBadge`, `CatBadge` sub-components.

Props: `kpis`, `prevKpis`, `refunds`, `loaded`

**Source:** Port from `app/analytics/page.js` `KpiRow`, `KpiCardInner`, `DeltaBadge`, `CatBadge`, `AnimatedNumber`, `useCountUp` (lines 182–418).

#### `components/features/analytics/revenue-trend-chart.tsx`

SVG line chart:
- Polyline with gradient fill
- X-axis date labels, Y-axis currency labels
- Grid lines
- Total revenue display

Props: `trend: RevenueTrendPoint[]`, `loaded: boolean`, `rangeLabel: string`

**Source:** Port from `app/analytics/page.js` `RevenueTrendChart` function (lines 422–451).

#### `components/features/analytics/donut-reason-chart.tsx`

SVG donut chart:
- Segmented ring by refund category
- Center label (total count)
- Color legend with percentages

Props: `refunds: Refund[]`, `loaded: boolean`

**Source:** Port from `app/analytics/page.js` `DonutReasonChart` function (lines 455–495+).

#### `components/features/analytics/monthly-trend-chart.tsx`

SVG bar chart:
- Monthly refund counts as vertical bars
- Current month highlighted
- Amount labels

Props: `allRefunds: Refund[]`, `loaded: boolean`

**Source:** Port from `app/analytics/page.js` `MonthlyTrendChart` function.

#### `components/features/analytics/action-board.tsx`

Action cards panel:
- Tabs: Pattern Actions / AI Insights
- Cards with priority badge, category, title, action description
- Done/undo toggle per card
- Repeat refunder actions

Props: `patternActions`, `aiInsights`, `loaded`, `onStatusChange`, `statuses`

**Source:** Port from `app/analytics/page.js` `ActionBoard` function.

#### `components/features/analytics/refund-table.tsx`

Refund list table:
- Columns: order number, customer, reason (category badge), amount, date, products
- Skeleton loading state

Props: `refunds: Refund[]`, `loaded: boolean`

**Source:** Port from `app/analytics/page.js` `RefundTable` function.

#### `components/features/analytics/product-matrix.tsx`

Product-level aggregation table:
- Columns: product name, refund count, total amount, avg %, top category
- Sorted by refund count descending

Props: `allRefunds: Refund[]`, `loaded: boolean`

**Source:** Port from `app/analytics/page.js` `ProductMatrix` function.

#### `components/features/analytics/refund-reasons.tsx`

Category breakdown panel:
- Filter pills by category
- Reason list with counts

Props: `refunds: Refund[]`, `loaded: boolean`

**Source:** Port from `app/analytics/page.js` `RefundReasons` function.

#### `components/features/analytics/weekly-report.tsx`

4-week comparison:
- Card per week: refund count, amount, top reason, top product
- Current week highlighted
- Week-over-week delta

Props: `allRefunds: Refund[]`, `loaded: boolean`

**Source:** Port from `app/analytics/page.js` `WeeklyReport` function.

#### `components/features/analytics/analytics-page.tsx`

Orchestrator:
- Shopify connection gate (shows `EmptyState` if not connected)
- Date range selector (pills + custom date inputs)
- Local state via `useState`: `rangeId: DateRangeId`, `customFrom: string`, `customTo: string`
- When `rangeId === 'custom'`, two date `<input type="date">` appear; computed `DateRange` is derived from either preset or custom values
- Data fetching via all analytics hooks, passing computed date range
- Demo data fallback (checks `DEMO_REFUNDS` etc. from `lib/demoData`)
- Action statuses loaded via `useActionStatuses()`, toggled via `useUpdateActionStatus()`
- Passes data to all sub-components; components receive TanStack query `isPending` for loading states
- Layout: `<Sidebar />` + scrollable main content

**Source:** Port from `app/analytics/page.js` `AnalyticsContent` and `AnalyticsPage` functions.

### Supply Chain Components

#### `components/features/supply-chain/shipment-kpi-cards.tsx`

4-5 metric cards:
- Total Shipments, In Transit, Delivered, Exceptions, Avg Delivery Days
- Animated count-up
- Skeleton loading state

Props: `orders: Order[]`, `loaded: boolean`

**Source:** Port from `app/supply-chain/page.js` KPI card section.

#### `components/features/supply-chain/shipment-filters.tsx`

Filter bar:
- Status filter pills (All, Needs Attention, In Transit, Delivered, Exception, Pending)
- Attention count badge on "Needs Attention" pill
- Search input
- Result count label

Uses `useSupplyChainUI` store for filter/search state.

**Source:** Port from `app/supply-chain/page.js` filter pill bar (lines 860–885).

#### `components/features/supply-chain/shipment-row.tsx`

Expandable shipment card:
- Grid: order/customer info, products, carrier badge, date, expand toggle
- Expanded: checkpoint timeline, attention card (if applicable), action buttons
- Status badge

Props: `order: Order`, `isAttention: boolean`

**Source:** Port from `app/supply-chain/page.js` `ShipmentRow` function.

#### `components/features/supply-chain/attention-card.tsx`

Alert card for shipments needing attention:
- Priority-colored border and background
- Type label, description
- Pre-written customer message (template filled with name/order number)
- Copy message button
- Dismiss button

Props: `item: AttentionItem`, `onDismiss: (key: string) => void`

**Source:** Port from `app/supply-chain/page.js` `AttentionCard` function (lines 326+).

#### `components/features/supply-chain/checkpoint-timeline.tsx`

Vertical tracking timeline:
- Colored dots per checkpoint status
- Connecting lines between checkpoints
- Detail text, location, timestamp
- First checkpoint highlighted

Props: `checkpoints: Checkpoint[]`

**Source:** Port from `app/supply-chain/page.js` `CheckpointTimeline` function (lines 302–324).

#### `components/features/supply-chain/setup-wizard.tsx`

Parcel Panel connection form (shown when not connected):
- API key input with password visibility toggle
- Connect button
- Instructions text
- Loading/error states

Uses `useConnectParcelPanel()` mutation.

**Source:** Port from `app/supply-chain/page.js` setup/connect section.

#### `components/features/supply-chain/supply-chain-page.tsx`

Orchestrator:
- Parcel Panel connection status derived from `useShipments()` response (400/404 = not connected)
- If not connected: render `SetupWizard`
- If connected: KPI cards + filter bar + attention section + shipment list
- Attention items computed via `getAttentionItems()` from constants
- Layout: `<Sidebar />` + scrollable main

**Source:** Port from `app/supply-chain/page.js` default export function.

### Time Tracking Components

#### `components/features/time-tracking/clock-card.tsx`

Live clock display:
- Elapsed time counter (updates every second via `setInterval`)
- Clock state indicator (idle/active/paused)
- Action buttons: Clock In, Pause, Resume, Clock Out
- Green pulse dot when active, amber dot when paused

Uses `useActiveSession()`, `useClockIn()`, `usePauseSession()`, `useResumeSession()`.

**Source:** Port from `app/time-tracking/page.js` clock card section.

#### `components/features/time-tracking/kpi-cards.tsx`

Personal or team KPI cards (4-column grid):
- Personal: Today's Hours, This Week, Sessions, Avg Duration
- Team: Active Now, On Break, Total Hours, Team Size
- Animated count-up, icon per card

Props: `variant: 'personal' | 'team'`, plus relevant data

**Source:** Port from `app/time-tracking/page.js` KPI sections (personal view lines 670–690, team view lines 282–298).

#### `components/features/time-tracking/filter-tabs.tsx`

Today / This week / This month toggle:
- Pill-style tab buttons
- Active state styling

Props: `filter: TimeFilter`, `onChange: (filter: TimeFilter) => void`

**Source:** Port from `app/time-tracking/page.js` `FilterTabs` function (lines 125–134).

#### `components/features/time-tracking/clock-out-modal.tsx`

Clock-out dialog:
- Session summary (clock-in time, active duration, paused duration)
- Required EOD report textarea
- Cancel / Clock Out buttons
- Loading state during submission

Uses shadcn `Dialog` instead of custom modal overlay.

Props: `session: Session`, `elapsedSec: number`, `pausedSeconds: number`, `onConfirm: (report: string) => void`, `onCancel: () => void`, `submitting: boolean`

**Source:** Port from `app/time-tracking/page.js` `ClockOutModal` function (lines 139–172).

#### `components/features/time-tracking/work-log.tsx`

User's session table:
- Columns: Date, Time (in–out), Hours, Report
- Empty state when no sessions
- Active session highlighted

Props: `sessions: Session[]`

**Source:** Port from `app/time-tracking/page.js` work log section (lines 691–725).

#### `components/features/time-tracking/member-row.tsx`

Team member row:
- Avatar initial, name, role
- Worked hours, session count
- Status badge (Online/Paused/Offline) with animated dot

Props: `member: TeamMember`

**Source:** Port from `app/time-tracking/page.js` `MemberRow` function (lines 177–204).

#### `components/features/time-tracking/admin-log-row.tsx`

Team session row:
- Columns: Member name, Date, In, Out, Hours, Report
- Active indicator for ongoing sessions

Props: `session: Session`

**Source:** Port from `app/time-tracking/page.js` `AdminLogRow` function (lines 207–220).

#### `components/features/time-tracking/team-view.tsx`

Team/admin view:
- Team KPI cards
- Team Members card with member rows
- Sessions card with admin log rows
- Filter tabs

Props: `data: TeamData`, `filter: TimeFilter`, `onFilterChange: (f: TimeFilter) => void`

**Source:** Port from `app/time-tracking/page.js` `TeamView` function (lines 249–330).

#### `components/features/time-tracking/personal-view.tsx`

Personal view:
- Clock card (live timer + action buttons)
- Personal KPI cards
- Work log table
- Filter tabs
- Clock-out modal

Manages local state: elapsed counter, modal open state. Uses time tracking hooks.

**Source:** Port from `app/time-tracking/page.js` personal view section (the main default export minus the TeamView branch).

#### `components/features/time-tracking/time-tracking-page.tsx`

Orchestrator:
- Checks user role via session/workspace context
- Admin/owner → renders `TeamView`
- Agent/observer → renders `PersonalView`
- Layout: `<Sidebar />` + main content

**Source:** Port from `app/time-tracking/page.js` default export routing logic.

---

## Page Routes

Each page file is a thin `'use client'` wrapper:

```typescript
// app/academy/page.tsx
'use client'
import { AcademyPage } from '@/components/features/academy/academy-page'
export default function Page() { return <AcademyPage /> }
```

```typescript
// app/academy/final-exam/page.tsx
'use client'
import { FinalExam } from '@/components/features/academy/final-exam'
export default function Page() { return <FinalExam /> }
```

```typescript
// app/academy/certificate/page.tsx
'use client'
import { CertificatePage } from '@/components/features/academy/certificate-page'
export default function Page() { return <CertificatePage /> }
```

```typescript
// app/analytics/page.tsx
'use client'
import { AnalyticsPage } from '@/components/features/analytics/analytics-page'
export default function Page() { return <AnalyticsPage /> }
```

```typescript
// app/supply-chain/page.tsx
'use client'
import { SupplyChainPage } from '@/components/features/supply-chain/supply-chain-page'
export default function Page() { return <SupplyChainPage /> }
```

```typescript
// app/time-tracking/page.tsx
'use client'
import { TimeTrackingPage } from '@/components/features/time-tracking/time-tracking-page'
export default function Page() { return <TimeTrackingPage /> }
```

---

## CSS Migration

### Removal targets

Each source file has a `const CSS = \`...\`` block injected via `<style>{CSS}</style>`. These are fully replaced by Tailwind classes.

| Source | CSS block size | Replacement |
|--------|---------------|-------------|
| `academy/page.js` | ~150 lines | Tailwind classes on elements |
| `analytics/page.js` | ~70 lines | Tailwind classes on elements |
| `supply-chain/page.js` | ~115 lines | Tailwind classes on elements |
| `time-tracking/page.js` | ~85 lines | Tailwind classes on elements |
| `academy/certificate/page.js` | ~38 lines | Tailwind classes on elements |

### Keyframe animations

Animations used across features → add to `globals.css` if not already present:
- `fadeIn` / `fadeUp` — fade + translate entry
- `spin` — rotation (likely already exists)
- `pulse` — green dot pulse
- `shimmer` / `skWave` — skeleton loading

Feature-specific animations:
- Academy: `ac-spin`, `ac-pulse`, `ac-float`, `ac-shimmer` → prefix with feature name in globals.css or use Tailwind `animate-` custom config
- Time tracking: `pauseBlink` → globals.css

### Inline SVGs → Lucide icons

Replace inline `<svg>` with Lucide equivalents:

| Inline SVG | Lucide replacement |
|------------|-------------------|
| Check polyline | `Check` |
| Lock rect+path | `Lock` |
| Clock circle+polyline | `Clock` |
| Bar chart lines | `BarChart3` |
| Shopping bag | `ShoppingBag` |
| Mail envelope | `Mail` |
| Shield path | `Shield` |
| Alert triangle | `AlertTriangle` |
| Chevron right | `ChevronRight` |
| Copy rect+path | `Copy` |
| Download | `Download` |
| Printer | `Printer` |
| Users path | `Users` |
| Pause lines | `Pause` |
| Play | `Play` |
| Calendar | `Calendar` |
| Search | `Search` |
| X close | `X` |
| GraduationCap | `GraduationCap` |
| Award/Medal | `Award` |

Module-specific icons in Academy (`ModuleIcon` function) — create a small lookup using Lucide icons: `Users` (CS), `RotateCcw` (Refunds), `ShoppingBag` (Shopify), `Mail` (Email), `Shield` (Disputes), `BarChart3` (KPIs).

---

## Cleanup

After all features are migrated:

1. Delete old `.js` files:
   - `app/academy/page.js`
   - `app/academy/final-exam/page.js`
   - `app/academy/certificate/page.js`
   - `app/analytics/page.js`
   - `app/supply-chain/page.js`
   - `app/time-tracking/page.js`

2. Verify no remaining imports to deleted files

3. Full build verification: `npx next build`

---

## Reference Implementations

Follow the exact patterns established in:
- **Types:** `types/admin.ts`, `types/inbox.ts`, `types/settings.ts`
- **Constants:** `lib/settings-constants.ts`, `lib/tags.ts`, `lib/macros.ts`
- **Hooks:** `hooks/admin/use-admin-data.ts`, `hooks/admin/use-admin-mutations.ts`
- **Stores:** `stores/admin-ui.ts`, `stores/settings-ui.ts`
- **Components:** `components/features/admin/`, `components/features/settings/`
- **Page routes:** `app/admin/page.tsx`, `app/settings/workspace/general/page.tsx`
