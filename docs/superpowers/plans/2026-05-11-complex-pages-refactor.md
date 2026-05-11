# Complex Pages Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor Academy (3 pages, ~2,290 lines), Analytics (~1,087 lines), Supply Chain (~931 lines), and Time Tracking (~742 lines) from monolithic JS with CSS injection to modular TypeScript components.

**Architecture:** Bottom-up per feature — types → constants → hooks → stores → components → thin page routes. The 4 features are fully independent and can be implemented in parallel. Each feature follows the exact same pattern as the admin/settings/inbox refactors.

**Tech Stack:** Next.js 16 (app router), React 19, TypeScript, TanStack React Query, Zustand, Tailwind CSS, shadcn/base-ui, Lucide icons, framer-motion (Academy only), Supabase client SDK.

**Spec:** `docs/superpowers/specs/2026-05-11-complex-pages-refactor-design.md`

**Reference implementations:**
- Admin hooks pattern: `hooks/admin/use-admin-data.ts`, `hooks/admin/use-admin-mutations.ts`
- Admin store pattern: `stores/admin-ui.ts`
- Settings hooks pattern: `hooks/settings/use-settings-data.ts`
- Settings store pattern: `stores/settings-ui.ts`
- Settings components pattern: `components/features/settings/`

---

## Task 1: All Types

**Files:**
- Create: `types/academy.ts`
- Create: `types/analytics.ts`
- Create: `types/supply-chain.ts`
- Create: `types/time-tracking.ts`

- [ ] **Step 1: Create `types/academy.ts`**

Copy the full type definitions from the spec's Types section (spec lines 119–175). This includes: `QuizQuestion`, `Section`, `Module`, `AcademyView`, `ExamQuestion`, `SectionMeta`, `ExamResult`, `Certificate`.

- [ ] **Step 2: Create `types/analytics.ts`**

Copy from spec lines 181–283. This includes: `DateRangeId`, `DateRange`, `Refund`, `KpiData`, `PrevKpiData`, `RevenueTrendPoint`, `PatternAction`, `AiInsight`, `WeeklyReportRow`, `ProductMatrixRow`, `RepeatRefunder`, `Delta`, `RefundCategory`, `CategoryColorConfig`.

- [ ] **Step 3: Create `types/supply-chain.ts`**

Copy from spec lines 289–355. This includes: `ShipmentStatusKey`, `StatusConfig`, `AttentionType`, `AttentionConfig`, `Checkpoint`, `Shipment`, `Order`, `AttentionItem`, `SupplyChainFilter`, `ParcelPanelSetup`.

- [ ] **Step 4: Create `types/time-tracking.ts`**

Copy from spec lines 361–403. This includes: `TimeFilter`, `ClockState`, `Session` (with `status`, `paused_at`, `paused_seconds` fields), `TeamMember`, `TeamData`, `TeamKpiDef`.

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to the new type files.

---

## Task 2: All Constants

**Files:**
- Create: `lib/academy-constants.ts`
- Create: `lib/analytics-constants.ts`
- Create: `lib/supply-chain-constants.ts`
- Create: `lib/time-tracking-constants.ts`

- [ ] **Step 1: Create `lib/academy-constants.ts`**

Read `app/academy/page.js` lines 8–229 and `app/academy/final-exam/page.js` lines 10–180. Extract exact values into the constants file:

- `PASS_THRESHOLD = 75`
- `EASE: number[] = [0.16, 1, 0.3, 1]`
- `readKey(moduleId: string, idx: number): string` — returns `\`ac_read_${moduleId}_${idx}\``
- `QUIZ_QUESTIONS: Record<string, QuizQuestion[]>` — all quiz data (copy verbatim from source lines 17–60)
- `MODULES: Module[]` — the full 6-module content array (copy verbatim from source lines 63–223). After the array definition, run the forEach that attaches quiz data and the Knowledge Check section.
- `ALL_MODULE_IDS: string[]` — from `final-exam/page.js` line 10
- `MODULE_LABELS: Record<string, string>` — from `final-exam/page.js` lines 11–18
- `SECTION_META: SectionMeta[]` — from `final-exam/page.js` lines 20–26
- `ALL_EXAM_QUESTIONS: ExamQuestion[]` — the 50-question array from `final-exam/page.js` lines 29–169 (named `ALL_Q` in source — rename to `ALL_EXAM_QUESTIONS`). **Stop before line 170** which begins the CSS block.

**Important:** These constants are large (~400 lines). Copy exact values from the source — do not abbreviate or invent data.

- [ ] **Step 2: Create `lib/analytics-constants.ts`**

Read `app/analytics/page.js` lines 11–178. Extract:

- `RANGES` — from source lines 11–17
- `CATEGORIES` — from source line 49
- `CAT_COLORS` — from source lines 50–62
- `BADGE_COLORS` — from source lines 325–337
- `getDateRange(id: DateRangeId): DateRange` — from source lines 19–24
- `getPrevDateRange(id: DateRangeId): DateRange` — from source lines 27–34
- `categorizeReason(raw: string): string` — from source lines 64–73
- `computeDelta(cur: number, prev: number): Delta | null` — from source lines 40–44
- `fmtEur(n: number): string` — from source line 36
- `fmtDate(str: string): string` — from source line 37
- `fmtDateShort(d: string): string` — from source line 38
- `generatePatternActions(allRefunds: Refund[]): PatternAction[]` — from source lines 106–134
- `generateRepeatRefunderActions(allRefunds: Refund[]): PatternAction[]` — from source lines 77–103
- `buildWeeklyReport(allRefunds: Refund[]): WeeklyReportRow[]` — from source lines 136–148
- `buildMonthlyTrend(allRefunds: Refund[])` — from source lines 150–158
- `buildProductMatrix(allRefunds: Refund[]): ProductMatrixRow[]` — from source lines 160–168
- `buildRepeatRefunders(allRefunds: Refund[]): RepeatRefunder[]` — from source lines 170–178

Add proper TypeScript annotations to all functions. Import types from `@/types/analytics`.

- [ ] **Step 3: Create `lib/supply-chain-constants.ts`**

Read `app/supply-chain/page.js` lines 8–96. Extract:

- `STATUS: Record<ShipmentStatusKey, StatusConfig>` — from source lines 8–17
- `getStatus(key: string): StatusConfig` — from source line 18
- `ATTENTION: Record<AttentionType, AttentionConfig>` — from source lines 21–62
- `PICKUP_PATTERN: RegExp` — from source line 64
- `ALL_FILTERS: SupplyChainFilter[]` — derive from the filter buttons in the source (search for the filter pill rendering)
- `getAttentionItems(orders: Order[], dismissed: Set<string>): AttentionItem[]` — from source lines 66–96

Import types from `@/types/supply-chain`.

- [ ] **Step 4: Create `lib/time-tracking-constants.ts`**

Read `app/time-tracking/page.js` lines 9–117 and lines 222–237. Extract:

- `FILTERS: { id: TimeFilter; label: string }[]` — from source lines 9–13
- `TEAM_KPI: TeamKpiDef[]` — from source lines 222–227
- `EMP_KPI` — from source lines 337–341. **Note:** source uses `{ id: string; label: string | null }` while `TEAM_KPI` uses `{ key: string; label: string }`. Normalize both to use `key` field, and make `label` optional (`string | null`) in `TeamKpiDef`. Rename `EMP_KPI` entries from `id` to `key`.
- `fmtElapsed(sec: number): string` — from source lines 89–94
- `fmtDur(sec: number): string` — from source lines 96–102
- `durSec(s: Session): number` — from source lines 104–107
- `fmtTime(iso: string): string` — from source lines 109–112
- `fmtDate(iso: string): string` — from source lines 114–117

Import `Session` and `TimeFilter` types from `@/types/time-tracking`.

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to constants files.

---

## Task 3: All Hooks

**Files:**
- Create: `hooks/academy/use-academy-data.ts`
- Create: `hooks/academy/use-academy-mutations.ts`
- Create: `hooks/academy/index.ts`
- Create: `hooks/analytics/use-analytics-data.ts`
- Create: `hooks/analytics/use-analytics-mutations.ts`
- Create: `hooks/analytics/index.ts`
- Create: `hooks/supply-chain/use-supply-chain-data.ts`
- Create: `hooks/supply-chain/use-supply-chain-mutations.ts`
- Create: `hooks/supply-chain/index.ts`
- Create: `hooks/time-tracking/use-time-tracking-data.ts`
- Create: `hooks/time-tracking/use-time-tracking-mutations.ts`
- Create: `hooks/time-tracking/index.ts`

Follow the exact pattern from `hooks/admin/use-admin-data.ts` for structure: `'use client'` directive, `useQuery` from `@tanstack/react-query`, `useAuthStore` from `@/stores/auth`, query keys factory object, `useToken()` helper.

- [ ] **Step 1: Create academy data hooks**

Create `hooks/academy/use-academy-data.ts`. Implement:

- `academyKeys` object with `all`, `passedExams`, `certificate` keys
- `usePassedExams()` — uses `useQuery` wrapping a Supabase query: `supabase.from('exam_submissions').select('module_id, passed').eq('user_id', userId).eq('passed', true)`. Read `app/academy/page.js` (search for `exam_submissions`) for the exact query.
- `useCertificate()` — uses `useQuery` wrapping: `supabase.from('certificates').select('*').eq('user_id', userId).single()`. Read `app/academy/certificate/page.js` for the exact query.

- [ ] **Step 2: Create academy mutation hooks**

Create `hooks/academy/use-academy-mutations.ts`. Implement:

- `useSubmitQuiz()` — `useMutation` wrapping Supabase upsert to `exam_submissions` with `onConflict: 'user_id,module_id'`. On success with all modules passed, also upsert to `certificates`. Invalidates `academyKeys.passedExams()`. Read `app/academy/page.js` `handleQuizComplete` for exact logic.
- `useSubmitExam()` — `useMutation` wrapping Supabase upsert to `exam_submissions` with `module_id: 'final'`, then upsert to `certificates` if passed. Invalidates `academyKeys.passedExams()` and `academyKeys.certificate()`. Read `app/academy/final-exam/page.js` for exact logic.

- [ ] **Step 3: Create analytics data hooks**

Create `hooks/analytics/use-analytics-data.ts`. Implement:

- `analyticsKeys` object (see spec lines 548–557)
- `useKpis(range)` — GET `/api/shopify/kpis?from=${range.from}&to=${range.to}` with Bearer token
- `usePrevKpis(range)` — same endpoint with previous period range
- `useRefunds(range)` — GET `/api/shopify/refunds?from=${range.from}&to=${range.to}` with Bearer token
- `useAllRefunds()` — GET `/api/shopify/refunds` with 365-day lookback
- `useRevenueTrend(range)` — GET `/api/shopify/revenue-trend?from=${range.from}&to=${range.to}`
- `useAiInsights(refunds)` — `useQuery` with `enabled: !!refunds.length`, POST body `{ refunds }` to `/api/analytics/refund-insights`
- `useActionStatuses()` — GET `/api/analytics/actions`
- `useShopifyConnected()` — GET `/api/settings/integrations`, returns `Boolean(data?.shopify)`

Read `app/analytics/page.js` for the exact fetch calls (lines 897, 909, 914, 920, 932–935, 1057).

- [ ] **Step 4: Create analytics mutation hooks**

Create `hooks/analytics/use-analytics-mutations.ts`. Implement:

- `useUpdateActionStatus()` — `useMutation` wrapping PATCH `/api/analytics/actions` with body `{ id, status, pickedUpBy, resultNote }`. Invalidates `analyticsKeys.all`. Read `app/analytics/page.js` `handleStatusChange`.

- [ ] **Step 5: Create supply chain data hooks**

Create `hooks/supply-chain/use-supply-chain-data.ts`. Implement:

- `supplyChainKeys` object
- `useShipments()` — GET `/api/parcel-panel/tracking` with Bearer token. Returns `{ orders: Order[] }` on success. On 400/404 error, the query enters error state — the page component checks `isError` to show the setup wizard. Read `app/supply-chain/page.js` line 638 for the exact fetch.

- [ ] **Step 6: Create supply chain mutation hooks**

Create `hooks/supply-chain/use-supply-chain-mutations.ts`. Implement:

- `useConnectParcelPanel()` — `useMutation` wrapping POST `/api/parcel-panel/connect` with body `{ apiKey }`. Invalidates `supplyChainKeys.shipments()`. Read `app/supply-chain/page.js` line 504.

- [ ] **Step 7: Create time tracking data hooks**

Create `hooks/time-tracking/use-time-tracking-data.ts`. Implement:

- `timeTrackingKeys` object
- `useTimeData(filter)` — GET `/api/time?filter=${filter}` with Bearer token. Single endpoint — backend branches on user role. Returns `{ is_admin?, is_client_admin?, member, sessions[], today_seconds?, active_session?, members?, active_count?, paused_count?, client? }`. Read `app/time-tracking/page.js` line 388 for the exact fetch.
- `useActiveSession(filter)` — derived from `useTimeData`, extracts `active_session` from the response. Uses `refetchInterval: 30000` to poll.

- [ ] **Step 8: Create time tracking mutation hooks**

Create `hooks/time-tracking/use-time-tracking-mutations.ts`. Implement:

- `useClockIn()` — POST `/api/time` with `{ action: 'clock-in' }`. Invalidates `timeTrackingKeys.all`.
- `useClockOut()` — POST `/api/time` with `{ action: 'clock-out', session_id, eod_report }`. Invalidates `timeTrackingKeys.all`.
- `usePauseSession()` — POST `/api/time` with `{ action: 'pause', session_id }`. Invalidates `timeTrackingKeys.all`.
- `useResumeSession()` — POST `/api/time` with `{ action: 'resume', session_id }`. Returns `{ paused_seconds }`. Invalidates `timeTrackingKeys.all`.
- `sendHeartbeat(token, sessionId)` — plain async function (not a TanStack mutation). POST `/api/time` with `{ action: 'heartbeat', session_id }`. Called via `setInterval` in clock-card component.

Read `app/time-tracking/page.js` lines 439–497 for all the fetch calls.

- [ ] **Step 9: Create all index files**

Create `hooks/academy/index.ts`, `hooks/analytics/index.ts`, `hooks/supply-chain/index.ts`, `hooks/time-tracking/index.ts`. Each re-exports both data and mutation hooks.

- [ ] **Step 10: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to hooks files.

---

## Task 4: Zustand Stores

**Files:**
- Create: `stores/academy-ui.ts`
- Create: `stores/supply-chain-ui.ts`

- [ ] **Step 1: Create `stores/academy-ui.ts`**

Copy the exact store definition from spec lines 738–760. Follow the pattern from `stores/admin-ui.ts`.

- [ ] **Step 2: Create `stores/supply-chain-ui.ts`**

Copy the exact store definition from spec lines 766–795. Follow the pattern from `stores/settings-ui.ts`.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

---

## Task 5: Academy Components & Pages

**Files:**
- Create: `components/features/academy/academy-sidebar.tsx`
- Create: `components/features/academy/academy-topbar.tsx`
- Create: `components/features/academy/welcome-view.tsx`
- Create: `components/features/academy/module-view.tsx`
- Create: `components/features/academy/lesson-view.tsx`
- Create: `components/features/academy/quiz-view.tsx`
- Create: `components/features/academy/certificate-view.tsx`
- Create: `components/features/academy/academy-page.tsx`
- Create: `components/features/academy/final-exam.tsx`
- Create: `components/features/academy/certificate-page.tsx`
- Create: `app/academy/page.tsx`
- Create: `app/academy/final-exam/page.tsx`
- Create: `app/academy/certificate/page.tsx`
- Delete: `app/academy/page.js`
- Delete: `app/academy/final-exam/page.js`
- Delete: `app/academy/certificate/page.js`

This is the largest task. The academy has an internal sidebar, multiple views with animated transitions, and 3 page routes.

- [ ] **Step 1: Create AcademySidebar**

Port from `app/academy/page.js` — search for the sidebar nav rendering with `.ac-nav-item` classes. Convert inline styles + CSS classes to Tailwind. Replace inline SVGs with Lucide icons (`Users`, `RotateCcw`, `ShoppingBag`, `Mail`, `Shield`, `BarChart3` for module icons; `Check`, `Lock` for status). Uses `useAcademyUI` store and `usePassedExams()` hook. See spec lines 806–815.

- [ ] **Step 2: Create AcademyTopbar**

Port `Topbar` function from `app/academy/page.js` lines 417–475. Breadcrumb nav + completion badge + avatar. Convert all inline styles to Tailwind. Uses `useAcademyUI` store. See spec lines 817–826.

- [ ] **Step 3: Create WelcomeView**

Port `WelcomeView` from `app/academy/page.js` lines 479–560+. Keep framer-motion for animated orbs and entrance animations. Convert inline styles to Tailwind. Replace inline SVGs with Lucide icons (`BarChart3`, `Clock`, `Check`). Use `MODULES` from `lib/academy-constants.ts`. See spec lines 828–837.

- [ ] **Step 4: Create ModuleView**

Port `ModuleView` from `app/academy/page.js`. Module header, lesson row cards, quiz start button. Convert inline styles to Tailwind. Replace inline SVGs with Lucide icons. See spec lines 839–847.

- [ ] **Step 5: Create LessonView**

Port `LessonView` from `app/academy/page.js`. Lesson content rendering (body, takeaways, tips, examples). Navigation buttons. Auto mark-as-read. Convert inline styles to Tailwind. See spec lines 849–860.

- [ ] **Step 6: Create QuizView**

Port `QuizView` from `app/academy/page.js`. 5-question quiz with radio options, submit, results. Convert `.ac-option` classes to Tailwind. Uses `useSubmitQuiz()` mutation. See spec lines 862–870.

- [ ] **Step 7: Create CertificateView**

Port `CertificateView` from `app/academy/page.js`. Inline certificate display within the academy page. Convert inline styles to Tailwind. See spec lines 872–878.

- [ ] **Step 8: Create AcademyPage orchestrator**

Port the default export from `app/academy/page.js` lines ~1350–1459. Layout: `<Sidebar />` + `<AcademySidebar />` + content area. View state machine via `useAcademyUI` store. `AnimatePresence` for view transitions. Data loading: `usePassedExams()`. Certificate completion banner. See spec lines 880–889.

- [ ] **Step 9: Create FinalExam component**

Port from `app/academy/final-exam/page.js` (604 lines). 50-question timed exam with section grouping. Uses `ALL_EXAM_QUESTIONS`, `SECTION_META` from constants. Uses `useSubmitExam()` mutation. Convert all inline styles to Tailwind, replace `const CSS` block. Replace inline SVGs with Lucide icons. See spec lines 891–901.

- [ ] **Step 10: Create CertificatePage component**

Port from `app/academy/certificate/page.js` (228 lines). Fetches certificate via `useCertificate()` hook. Certificate card with gradient border. Share/print/download buttons. Convert `const CSS` block to Tailwind. Replace inline SVGs with Lucide icons (`Download`, `Printer`, `Share2`). See spec lines 903–911.

- [ ] **Step 11: Create page routes**

Create thin page route files:

```typescript
// app/academy/page.tsx
'use client'
import { AcademyPage } from '@/components/features/academy/academy-page'
export default function Page() { return <AcademyPage /> }
```

Same pattern for `app/academy/final-exam/page.tsx` (imports `FinalExam`) and `app/academy/certificate/page.tsx` (imports `CertificatePage`).

- [ ] **Step 12: Delete old files and verify**

```bash
rm app/academy/page.js app/academy/final-exam/page.js app/academy/certificate/page.js
```

Run: `npx next build 2>&1 | tail -30`
Expected: Build succeeds.

---

## Task 6: Analytics Components & Page

**Files:**
- Create: `components/features/analytics/alert-banner.tsx`
- Create: `components/features/analytics/kpi-row.tsx`
- Create: `components/features/analytics/revenue-trend-chart.tsx`
- Create: `components/features/analytics/donut-reason-chart.tsx`
- Create: `components/features/analytics/monthly-trend-chart.tsx`
- Create: `components/features/analytics/action-board.tsx`
- Create: `components/features/analytics/refund-table.tsx`
- Create: `components/features/analytics/product-matrix.tsx`
- Create: `components/features/analytics/refund-reasons.tsx`
- Create: `components/features/analytics/weekly-report.tsx`
- Create: `components/features/analytics/analytics-page.tsx`
- Create: `app/analytics/page.tsx`
- Delete: `app/analytics/page.js`

- [ ] **Step 1: Create AlertBanner**

Port `AlertBanner` from `app/analytics/page.js` lines 308–321. Convert inline styles to Tailwind. Replace inline `<svg>` with Lucide `AlertTriangle`. See spec lines 915–923.

- [ ] **Step 2: Create KpiRow**

Port `KpiRow`, `KpiCardInner`, `DeltaBadge`, `CatBadge`, `useCountUp` from `app/analytics/page.js` lines 182–418. This is the largest analytics component. Convert inline styles to Tailwind. Replace inline SVGs with Lucide icons. Include skeleton loading state. The `useCountUp` hook stays local to this file. See spec lines 925–939.

- [ ] **Step 3: Create RevenueTrendChart**

Port `RevenueTrendChart` from `app/analytics/page.js` lines 422–451. SVG line chart — keep the SVG rendering logic, convert wrapper styles to Tailwind. Import `fmtEur` from `lib/analytics-constants.ts`. See spec lines 941–951.

- [ ] **Step 4: Create DonutReasonChart**

Port `DonutReasonChart` from `app/analytics/page.js` lines 455–495+. SVG donut + legend. Import `CAT_COLORS`, `categorizeReason` from constants. See spec lines 953–962.

- [ ] **Step 5: Create MonthlyTrendChart**

Port `MonthlyTrendChart` from `app/analytics/page.js`. SVG bar chart. Import `buildMonthlyTrend` from constants. See spec lines 964–973.

- [ ] **Step 6: Create ActionBoard**

Port `ActionBoard` from `app/analytics/page.js`. Action cards with tabs (Pattern Actions / AI Insights). Done/undo toggle. Import `BADGE_COLORS` from constants. Use shadcn `Tabs` if available, otherwise Tailwind tab buttons. See spec lines 975–985.

- [ ] **Step 7: Create RefundTable**

Port `RefundTable` from `app/analytics/page.js`. Table with category badges. Import `categorizeReason`, `fmtEur`, `fmtDate` from constants. Use shadcn `Table` if available. See spec lines 987–995.

- [ ] **Step 8: Create ProductMatrix**

Port `ProductMatrix` from `app/analytics/page.js`. Import `buildProductMatrix` from constants. See spec lines 997–1005.

- [ ] **Step 9: Create RefundReasons**

Port `RefundReasons` from `app/analytics/page.js`. Category filter pills + breakdown. Import `CATEGORIES`, `CAT_COLORS` from constants. See spec lines 1007–1015.

- [ ] **Step 10: Create WeeklyReport**

Port `WeeklyReport` from `app/analytics/page.js`. Import `buildWeeklyReport`, `fmtEur` from constants. See spec lines 1017–1026.

- [ ] **Step 11: Create AnalyticsPage orchestrator**

Port `AnalyticsContent` and `AnalyticsPage` wrapper from `app/analytics/page.js`. Key behaviors:
- `useShopifyConnected()` gate — shows `EmptyState` if not connected
- Date range selector with `useState` for `rangeId`, `customFrom`, `customTo`
- All analytics hooks called with computed date range
- Demo data fallback via `DEMO_REFUNDS` etc. from `lib/demoData`
- Action statuses via `useActionStatuses()` + `useUpdateActionStatus()`
- Layout: `<Sidebar />` + scrollable main
- Replace `const CSS` block (~70 lines) with Tailwind classes

See spec lines 1028–1041.

- [ ] **Step 12: Create page route, delete old, verify**

```typescript
// app/analytics/page.tsx
'use client'
import { AnalyticsPage } from '@/components/features/analytics/analytics-page'
export default function Page() { return <AnalyticsPage /> }
```

```bash
rm app/analytics/page.js
```

Run: `npx next build 2>&1 | tail -30`
Expected: Build succeeds.

---

## Task 7: Supply Chain Components & Page

**Files:**
- Create: `components/features/supply-chain/shipment-kpi-cards.tsx`
- Create: `components/features/supply-chain/shipment-filters.tsx`
- Create: `components/features/supply-chain/shipment-row.tsx`
- Create: `components/features/supply-chain/attention-card.tsx`
- Create: `components/features/supply-chain/checkpoint-timeline.tsx`
- Create: `components/features/supply-chain/setup-wizard.tsx`
- Create: `components/features/supply-chain/supply-chain-page.tsx`
- Create: `app/supply-chain/page.tsx`
- Delete: `app/supply-chain/page.js`

- [ ] **Step 1: Create CheckpointTimeline**

Port `CheckpointTimeline` from `app/supply-chain/page.js` lines 302–324. Vertical timeline with colored dots and connector lines. Import `getStatus` from constants. Convert inline styles to Tailwind. See spec lines 1092–1102.

- [ ] **Step 2: Create AttentionCard**

Port `AttentionCard` from `app/supply-chain/page.js` lines 326+. Alert card with priority styling, pre-written message, copy button, dismiss button. Replace inline SVGs with Lucide icons (`Copy`, `Check`, `X`). Convert inline styles to Tailwind. See spec lines 1079–1090.

- [ ] **Step 3: Create ShipmentKpiCards**

Port KPI card section from `app/supply-chain/page.js`. 4-5 metric cards. Include `useCountUp` hook (same pattern as analytics). Replace inline SVGs with Lucide icons (`Package`, `Truck`, `CheckCircle`, `AlertTriangle`, `Clock`). See spec lines 1045–1054.

- [ ] **Step 4: Create ShipmentFilters**

Port filter bar from `app/supply-chain/page.js` lines 860–885. Status filter pills + search input. Uses `useSupplyChainUI` store. Convert `.filter-pill` classes to Tailwind. See spec lines 1056–1066.

- [ ] **Step 5: Create ShipmentRow**

Port `ShipmentRow` from `app/supply-chain/page.js`. Expandable card with order info, carrier badge, status badge. Expanded state shows `CheckpointTimeline`. Uses `useSupplyChainUI` store for `expandedOrderId`. Convert `.sc-row` classes to Tailwind. Import `getStatus` and `StatusBadge`/`CarrierBadge` sub-components. See spec lines 1068–1077.

- [ ] **Step 6: Create SetupWizard**

Port the Parcel Panel connection form from `app/supply-chain/page.js`. API key input (use `PasswordInput` from settings if available, or shadcn `Input` with eye toggle). Connect button. Uses `useConnectParcelPanel()` mutation. See spec lines 1104–1114.

- [ ] **Step 7: Create SupplyChainPage orchestrator**

Port the default export from `app/supply-chain/page.js`. Key behaviors:
- `useShipments()` — if `isError` (400/404), render `SetupWizard`
- If connected: KPI cards + attention section (from `getAttentionItems()`) + filter bar + shipment list
- Layout: `<Sidebar />` + scrollable main
- Replace `const CSS` block (~115 lines) with Tailwind classes
- Replace inline SVGs with Lucide icons

See spec lines 1116–1125.

- [ ] **Step 8: Create page route, delete old, verify**

```typescript
// app/supply-chain/page.tsx
'use client'
import { SupplyChainPage } from '@/components/features/supply-chain/supply-chain-page'
export default function Page() { return <SupplyChainPage /> }
```

```bash
rm app/supply-chain/page.js
```

Run: `npx next build 2>&1 | tail -30`
Expected: Build succeeds.

---

## Task 8: Time Tracking Components & Page

**Files:**
- Create: `components/features/time-tracking/filter-tabs.tsx`
- Create: `components/features/time-tracking/clock-out-modal.tsx`
- Create: `components/features/time-tracking/clock-card.tsx`
- Create: `components/features/time-tracking/kpi-cards.tsx`
- Create: `components/features/time-tracking/work-log.tsx`
- Create: `components/features/time-tracking/member-row.tsx`
- Create: `components/features/time-tracking/admin-log-row.tsx`
- Create: `components/features/time-tracking/team-view.tsx`
- Create: `components/features/time-tracking/personal-view.tsx`
- Create: `components/features/time-tracking/time-tracking-page.tsx`
- Create: `app/time-tracking/page.tsx`
- Delete: `app/time-tracking/page.js`

- [ ] **Step 1: Create FilterTabs**

Port `FilterTabs` from `app/time-tracking/page.js` lines 125–134. Import `FILTERS` from constants. Convert `.filter-tab` classes to Tailwind. See spec lines 1152–1160.

- [ ] **Step 2: Create ClockOutModal**

Port `ClockOutModal` from `app/time-tracking/page.js` lines 139–172. Use shadcn `Dialog` instead of custom `.modal-overlay`. Use shadcn `Button` for Cancel/Clock Out. Import `fmtTime`, `fmtDur` from constants. See spec lines 1162–1174.

- [ ] **Step 3: Create ClockCard**

Port clock card section from `app/time-tracking/page.js`. Live elapsed counter via `setInterval` (every second). Clock in/out/pause/resume buttons. Green pulse dot when active. Uses `useActiveSession()`, `useClockIn()`, `usePauseSession()`, `useResumeSession()`. Also starts `sendHeartbeat` interval when active. Import `fmtElapsed` from constants. Convert `.clock-card` classes to Tailwind. Replace inline SVGs with Lucide icons (`Play`, `Pause`, `Square`, `Clock`). See spec lines 1129–1139.

- [ ] **Step 4: Create KpiCards**

Port KPI card sections for both personal and team views. Import `TEAM_KPI`, `EMP_KPI` from constants. Replace `KpiIcon` inline SVGs with Lucide icons. Convert `.kpi-card` classes to Tailwind. See spec lines 1141–1150.

- [ ] **Step 5: Create WorkLog**

Port work log table from `app/time-tracking/page.js` lines 691–725. Import `fmtDate`, `fmtTime`, `fmtDur`, `durSec` from constants. Convert `.emp-row` classes to Tailwind. See spec lines 1176–1185.

- [ ] **Step 6: Create MemberRow**

Port `MemberRow` from `app/time-tracking/page.js` lines 177–204. Avatar initial, name, role, worked hours, status badge. Convert `.member-row` classes to Tailwind. Import `fmtDur` from constants. See spec lines 1187–1196.

- [ ] **Step 7: Create AdminLogRow**

Port `AdminLogRow` from `app/time-tracking/page.js` lines 207–220. Convert `.session-row` classes to Tailwind. Import formatters from constants. See spec lines 1198–1206.

- [ ] **Step 8: Create TeamView**

Port `TeamView` from `app/time-tracking/page.js` lines 249–330. Composes KpiCards (team variant) + Member list + Sessions table + FilterTabs. Convert inline styles to Tailwind. See spec lines 1208–1218.

- [ ] **Step 9: Create PersonalView**

Port the personal view from `app/time-tracking/page.js`. Composes ClockCard + KpiCards (personal variant) + WorkLog + FilterTabs + ClockOutModal. Manages local state: `elapsed` counter, `showModal`. Uses `useTimeData()`, `useClockOut()`. See spec lines 1220–1231.

- [ ] **Step 10: Create TimeTrackingPage orchestrator**

Port the default export routing logic from `app/time-tracking/page.js`. Checks `is_admin` or `is_client_admin` from `useTimeData()` response → renders `TeamView` or `PersonalView`. Layout: `<Sidebar />` + main content. Replace `const CSS` block (~85 lines) with Tailwind. See spec lines 1233–1241.

- [ ] **Step 11: Create page route, delete old, verify**

```typescript
// app/time-tracking/page.tsx
'use client'
import { TimeTrackingPage } from '@/components/features/time-tracking/time-tracking-page'
export default function Page() { return <TimeTrackingPage /> }
```

```bash
rm app/time-tracking/page.js
```

Run: `npx next build 2>&1 | tail -30`
Expected: Build succeeds.

---

## Task 9: Cleanup & Keyframe Animations

**Files:**
- Modify: `app/globals.css` (if needed)

- [ ] **Step 1: Add shared keyframe animations to globals.css**

Check which keyframes are already in `globals.css`. Add any missing ones that are used across multiple features:
- `fadeIn` / `fadeUp` — fade + translate entry
- `spin` — rotation (likely already exists)
- `pulse` — green dot pulse for active indicators
- `shimmer` — skeleton loading animation

Only add if not already present. Use `@keyframes` in globals.css.

- [ ] **Step 2: Verify no .js files remain in refactored routes**

```bash
find app/academy app/analytics app/supply-chain app/time-tracking -name "*.js" -type f
```

Expected: No results.

- [ ] **Step 3: Search for stale imports**

Search for any remaining references to the old component paths or deleted imports:

```bash
grep -r "app/academy/page" --include="*.ts" --include="*.tsx" -l
grep -r "app/analytics/page" --include="*.ts" --include="*.tsx" -l
grep -r "app/supply-chain/page" --include="*.ts" --include="*.tsx" -l
grep -r "app/time-tracking/page" --include="*.ts" --include="*.tsx" -l
```

Expected: No results (page routes import from `components/features/`, not from themselves).

- [ ] **Step 4: Full build verification**

Run: `npx next build 2>&1 | tail -30`
Expected: Build succeeds with no errors.

- [ ] **Step 5: Manual smoke test**

Navigate through all pages in the browser:
- `/academy` → welcome view with module grid
- `/academy` → click module → lesson view → quiz → back
- `/academy/final-exam` → exam interface renders
- `/academy/certificate` → certificate page renders
- `/analytics` → KPI cards, charts, action board (or empty state if no Shopify)
- `/supply-chain` → shipment list or setup wizard
- `/time-tracking` → clock card + work log (or team view for admin)
