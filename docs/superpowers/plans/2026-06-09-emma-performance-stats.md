# Emma Performance Statistics — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "Emma Performance" tab to the analytics page showing AI suggestion metrics (total suggestions, approval rate, decline rate, conversation coverage).

**Architecture:** A single Supabase RPC (`api_get_emma_stats`) returns all counts from `ai_drafts` + `email_conversations`. A new TanStack Query hook fetches the data. A new component renders 4 KPI cards matching existing style. The analytics page gains tab navigation to switch between refund intelligence and Emma metrics.

**Tech Stack:** PostgreSQL (RPC function), React 19, TanStack Query, Tailwind CSS, Supabase client

**Spec:** `docs/superpowers/specs/2026-06-09-emma-performance-stats-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `supabase/migrations/<timestamp>_emma_stats_rpc.sql` | RPC function + index |
| Modify | `types/ai-drafts.ts` | Add `EmmaStats` interface |
| Create | `hooks/ai/use-emma-stats.ts` | `useEmmaStats` + `useEmmaOnboarded` hooks |
| Create | `components/features/analytics/emma-performance.tsx` | 4 KPI cards for Emma metrics |
| Modify | `components/features/analytics/analytics-page.tsx` | Tab navigation + conditional rendering |

---

### Task 1: Database migration — `api_get_emma_stats` RPC

**Files:**
- Create: `supabase/migrations/<timestamp>_emma_stats_rpc.sql`

- [ ] **Step 1: Generate the migration file**

Run: `cd /Users/dendy/Documents/Work/Lynq/lynq-dashboard && npx supabase migration new emma_stats_rpc`

This creates a timestamped file in `supabase/migrations/`. Note the generated filename for the next step.

- [ ] **Step 2: Write the RPC function and index**

Write the following SQL to the generated migration file:

```sql
-- ============================================================
-- api_get_emma_stats — aggregated Emma AI performance metrics
-- Returns draft status counts + conversation coverage for a
-- store within a date range. Called from the analytics page.
-- ============================================================

-- ── Index for the stats query ────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_ai_drafts_workspace_store_generated
  ON public.ai_drafts (workspace_id, store_id, generated_at);


-- ── RPC: api_get_emma_stats ──────────────────────────────────

CREATE OR REPLACE FUNCTION api_get_emma_stats(
  p_store_id uuid,
  p_from     text,
  p_to       text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws     uuid := get_user_workspace_id();
  v_result jsonb;
BEGIN
  PERFORM check_store_access(p_store_id, v_ws);

  WITH draft_counts AS (
    SELECT
      count(*)                                                              AS total_suggestions,
      count(*) FILTER (WHERE status = 'pending')                            AS pending,
      count(*) FILTER (WHERE status = 'approved')                           AS approved,
      count(*) FILTER (WHERE status = 'declined')                           AS declined,
      count(*) FILTER (WHERE status = 'edited')                             AS edited,
      count(*) FILTER (WHERE status = 'auto_sent')                          AS auto_sent,
      count(*) FILTER (WHERE status = 'regenerated')                        AS regenerated,
      count(*) FILTER (WHERE status IN ('approved','declined','edited','auto_sent')) AS total_resolved,
      count(DISTINCT conversation_id)                                       AS conversations_with_draft
    FROM ai_drafts
    WHERE workspace_id = v_ws
      AND store_id     = p_store_id
      AND generated_at >= p_from::timestamptz
      AND generated_at <  (p_to::date + 1)::timestamptz
  ),
  conv_count AS (
    SELECT count(*) AS total_conversations
    FROM email_conversations
    WHERE workspace_id = v_ws
      AND store_id     = p_store_id
      AND created_at  >= p_from::timestamptz
      AND created_at  <  (p_to::date + 1)::timestamptz
  )
  SELECT jsonb_build_object(
    'total_suggestions',        dc.total_suggestions,
    'pending',                  dc.pending,
    'approved',                 dc.approved,
    'declined',                 dc.declined,
    'edited',                   dc.edited,
    'auto_sent',                dc.auto_sent,
    'regenerated',              dc.regenerated,
    'total_resolved',           dc.total_resolved,
    'conversations_with_draft', dc.conversations_with_draft,
    'total_conversations',      cc.total_conversations
  )
  INTO v_result
  FROM draft_counts dc, conv_count cc;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION api_get_emma_stats(uuid, text, text) TO authenticated;


-- ── Verification ─────────────────────────────────────────────

DO $$
BEGIN
  ASSERT (
    SELECT count(*) FROM pg_proc
    WHERE proname = 'api_get_emma_stats'
  ) = 1, 'api_get_emma_stats function not found';

  RAISE NOTICE 'emma_stats_rpc migration OK';
END;
$$;
```

- [ ] **Step 3: Apply the migration**

Run: `cd /Users/dendy/Documents/Work/Lynq/lynq-dashboard && npx supabase db push`

Expected: Migration applies successfully with "emma_stats_rpc migration OK" notice.

---

### Task 2: Add `EmmaStats` type

**Files:**
- Modify: `types/ai-drafts.ts:66` (append after `PromoteToDraftInput`)

- [ ] **Step 1: Add the EmmaStats interface**

Append to the end of `types/ai-drafts.ts`:

```typescript
export interface EmmaStats {
  total_suggestions: number
  pending: number
  approved: number
  declined: number
  edited: number
  auto_sent: number
  regenerated: number
  total_resolved: number
  conversations_with_draft: number
  total_conversations: number
}
```

- [ ] **Step 2: Verify lint passes**

Run: `cd /Users/dendy/Documents/Work/Lynq/lynq-dashboard && npx next lint --file types/ai-drafts.ts`

Expected: No errors.

---

### Task 3: Create `useEmmaStats` and `useEmmaOnboarded` hooks

**Files:**
- Create: `hooks/ai/use-emma-stats.ts`

- [ ] **Step 1: Write the hooks file**

Create `hooks/ai/use-emma-stats.ts`:

```typescript
'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'
import { useStoreStore } from '@/stores/store'
import { rpc } from '@/lib/rpc'
import { supabase } from '@/lib/supabase'
import type { EmmaStats } from '@/types/ai-drafts'
import type { DateRange } from '@/types/analytics'

function useToken() {
  return useAuthStore((s) => s.session?.access_token ?? '')
}

const EMPTY_STATS: EmmaStats = {
  total_suggestions: 0,
  pending: 0,
  approved: 0,
  declined: 0,
  edited: 0,
  auto_sent: 0,
  regenerated: 0,
  total_resolved: 0,
  conversations_with_draft: 0,
  total_conversations: 0,
}

export const emmaStatsKeys = {
  all: ['emma-stats'] as const,
  stats: (storeId: string | null, from: string, to: string) =>
    [...emmaStatsKeys.all, storeId, from, to] as const,
  onboarded: (storeId: string | null) =>
    [...emmaStatsKeys.all, 'onboarded', storeId] as const,
}

export function useEmmaStats(range: DateRange) {
  const token = useToken()
  const activeStoreId = useStoreStore((s) => s.activeStoreId)
  return useQuery<EmmaStats>({
    queryKey: emmaStatsKeys.stats(activeStoreId, range.from, range.to),
    queryFn: async () => {
      const data = await rpc<EmmaStats>('api_get_emma_stats', {
        p_store_id: activeStoreId,
        p_from: range.from,
        p_to: range.to,
      })
      return data ?? EMPTY_STATS
    },
    enabled: !!token && !!activeStoreId,
    staleTime: 5 * 60_000,
  })
}

export function useEmmaOnboarded() {
  const token = useToken()
  const activeStoreId = useStoreStore((s) => s.activeStoreId)
  return useQuery<boolean>({
    queryKey: emmaStatsKeys.onboarded(activeStoreId),
    queryFn: async () => {
      const { data } = await supabase
        .from('ai_policies')
        .select('id')
        .eq('store_id', activeStoreId!)
        .limit(1)
        .maybeSingle()
      return !!data
    },
    enabled: !!token && !!activeStoreId,
    staleTime: 5 * 60_000,
  })
}
```

**Notes for implementer:**
- `useEmmaOnboarded` queries `ai_policies` directly — if RLS blocks the select, switch to a lightweight RPC. Test by navigating to the analytics page with a store that has Emma onboarded and verifying the tab appears.
- `EMPTY_STATS` provides a safe fallback so consumers never deal with `null`.

- [ ] **Step 2: Verify lint passes**

Run: `cd /Users/dendy/Documents/Work/Lynq/lynq-dashboard && npx next lint --file hooks/ai/use-emma-stats.ts`

Expected: No errors.

---

### Task 4: Create `emma-performance` component

**Files:**
- Create: `components/features/analytics/emma-performance.tsx`

- [ ] **Step 1: Write the component**

Create `components/features/analytics/emma-performance.tsx`:

```typescript
'use client'

import { Sparkles, ThumbsUp, ThumbsDown, MessageSquareText } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useCountUp } from '@/hooks/use-count-up'
import type { EmmaStats } from '@/types/ai-drafts'

function computeValues(stats: EmmaStats) {
  const approvalRate = stats.total_resolved > 0
    ? ((stats.approved + stats.edited + stats.auto_sent) / stats.total_resolved) * 100
    : 0
  const declineRate = stats.total_resolved > 0
    ? (stats.declined / stats.total_resolved) * 100
    : 0
  const coverageRate = stats.total_conversations > 0
    ? (stats.conversations_with_draft / stats.total_conversations) * 100
    : 0

  return { approvalRate, declineRate, coverageRate }
}

interface KpiCardProps {
  label: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  rawValue: number
  isPercentage: boolean
  fallback?: string
  sub: string
}

function KpiCard({ label, icon: Icon, rawValue, isPercentage, fallback, sub }: KpiCardProps) {
  const animTarget = isPercentage ? Math.round(rawValue * 10) : rawValue
  const animCount = useCountUp(animTarget)

  let display: string
  if (fallback && rawValue === 0) {
    display = fallback
  } else if (isPercentage) {
    display = `${(animCount / 10).toFixed(1)}%`
  } else {
    display = animCount.toLocaleString()
  }

  return (
    <div className="animate-fade-up rounded-[10px] border border-black/[0.07] bg-white p-[18px_20px] relative overflow-hidden transition-all duration-200 hover:border-black/[0.12] hover:shadow-md hover:-translate-y-px">
      <div className="mb-3.5 flex items-start justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-[.06em] text-gray-400">
          {label}
        </div>
        <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[7px] bg-purple-500/[0.08]">
          <Icon size={14} className="text-foreground-4" />
        </div>
      </div>
      <div className="mb-2 text-2xl font-bold leading-none text-gray-900 tabular-nums">
        {display}
      </div>
      <div className="text-[11px] text-gray-400">{sub}</div>
    </div>
  )
}

interface EmmaPerformanceProps {
  stats: EmmaStats
  loaded: boolean
}

export function EmmaPerformance({ stats, loaded }: EmmaPerformanceProps) {
  if (!loaded) {
    return (
      <div className="mb-6 grid grid-cols-4 gap-4">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="animate-fade-up rounded-[10px] border border-white/65 bg-white/80 p-[18px_20px] shadow-sm backdrop-blur-xl">
            <Skeleton className="mb-3.5 h-[11px] w-[55%]" />
            <Skeleton className="mb-2 h-[30px] w-[70%]" />
            <Skeleton className="h-[9px] w-[85%]" />
          </div>
        ))}
      </div>
    )
  }

  const { approvalRate, declineRate, coverageRate } = computeValues(stats)
  const noData = stats.total_suggestions === 0

  const coverageSub = stats.total_conversations > 0
    ? `${stats.conversations_with_draft} of ${stats.total_conversations} conversations`
    : 'No conversations'

  const resolvedSub = stats.total_resolved > 0
    ? 'of resolved suggestions'
    : 'No resolved suggestions'

  return (
    <>
      <div className="mb-6 grid grid-cols-4 gap-4">
        <KpiCard
          label="TOTAL SUGGESTIONS"
          icon={Sparkles}
          rawValue={stats.total_suggestions}
          isPercentage={false}
          sub="AI replies generated"
        />
        <KpiCard
          label="APPROVAL RATE"
          icon={ThumbsUp}
          rawValue={approvalRate}
          isPercentage
          fallback={stats.total_resolved === 0 ? '—' : undefined}
          sub={resolvedSub}
        />
        <KpiCard
          label="DECLINE RATE"
          icon={ThumbsDown}
          rawValue={declineRate}
          isPercentage
          fallback={stats.total_resolved === 0 ? '—' : undefined}
          sub={resolvedSub}
        />
        <KpiCard
          label="EMMA COVERAGE"
          icon={MessageSquareText}
          rawValue={coverageRate}
          isPercentage
          fallback={stats.total_conversations === 0 ? '—' : undefined}
          sub={coverageSub}
        />
      </div>

      {noData && (
        <div className="animate-fade-up rounded-[10px] border border-black/[0.07] bg-white p-6 text-center">
          <Sparkles size={20} className="mx-auto mb-2 text-gray-300" />
          <p className="text-[13px] font-medium text-gray-500">No Emma suggestions in this period</p>
          <p className="mt-1 text-[11px] text-gray-400">Emma generates suggestions when new inbound messages arrive in the inbox</p>
        </div>
      )}
    </>
  )
}
```

**Notes for implementer:**
- `KpiCard` uses `useCountUp` for animated number transitions, matching the refund KPI cards.
- For the "Total Suggestions" card, `isPercentage=false` so `useCountUp` receives the raw integer and displays it directly.
- For percentage cards, `isPercentage=true` means `rawValue * 10` is passed to `useCountUp` and divided back by 10 for one decimal place display.
- The `fallback` prop handles the "—" display when denominators are zero (e.g., no resolved suggestions or no conversations).
- The empty state at the bottom only shows when `total_suggestions === 0`.

- [ ] **Step 2: Verify lint passes**

Run: `cd /Users/dendy/Documents/Work/Lynq/lynq-dashboard && npx next lint --file components/features/analytics/emma-performance.tsx`

Expected: No errors.

---

### Task 5: Add tab navigation to `analytics-page.tsx`

**Files:**
- Modify: `components/features/analytics/analytics-page.tsx`

This is the largest change. The modifications are:
1. Add imports for the new hook, component, and Sparkles icon
2. Add `activeTab` state and the `useEmmaStats` / `useEmmaOnboarded` hooks
3. Make the header title/subtitle dynamic per tab
4. Only show export buttons and demo toggle on the refund tab
5. Add tab bar after the date range controls
6. Wrap existing refund content and Emma content in conditional blocks

- [ ] **Step 1: Add imports**

At the top of `analytics-page.tsx`, add these imports alongside the existing ones:

```typescript
import { Sparkles } from 'lucide-react'
import { useEmmaStats, useEmmaOnboarded } from '@/hooks/ai/use-emma-stats'
import { EmmaPerformance } from './emma-performance'
```

- [ ] **Step 2: Add state and hooks inside `AnalyticsContent`**

After the existing `const [demoMode, setDemoMode] = useState(false)` line (~line 64), add:

```typescript
const [activeTab, setActiveTab] = useState<'refunds' | 'emma'>('refunds')
```

After the existing `const activeStoreId = useStoreStore(...)` line (~line 66), add:

```typescript
const emmaOnboardedQuery = useEmmaOnboarded()
const emmaOnboarded = emmaOnboardedQuery.data === true
```

After the existing `const aiInsightsQuery = useAiInsights(refundData)` line (~line 87), add:

```typescript
const emmaStatsQuery = useEmmaStats(range)
```

- [ ] **Step 3: Make the header title dynamic**

Replace the static title and subtitle (~lines 138-140):

```typescript
<h1 className="mb-1 text-xl font-bold tracking-tight text-gray-900">Refund Intelligence</h1>
<p className="text-[13px] text-gray-500">Where money is lost &middot; {rangeLabel}</p>
```

With:

```typescript
<h1 className="mb-1 text-xl font-bold tracking-tight text-gray-900">
  {activeTab === 'refunds' ? 'Refund Intelligence' : 'Emma Performance'}
</h1>
<p className="text-[13px] text-gray-500">
  {activeTab === 'refunds' ? 'Where money is lost' : 'AI assistant metrics'} &middot; {rangeLabel}
</p>
```

- [ ] **Step 4: Wrap export buttons and demo toggle in refund-tab conditional**

The export buttons and demo toggle in the header right section (~lines 142-205) should only appear on the refund tab. Wrap them:

After the opening `<div className="flex items-center gap-2">` and before the first `<ExportButton`, add:

```typescript
{activeTab === 'refunds' && (
  <>
```

After the demo toggle button closing `)}` and before the live/loading status indicator `<div className={...}>`, close the fragment:

```typescript
  </>
)}
```

This means the `<ExportButton>` components and the demo toggle are only rendered on the refund tab. The Live/Loading status indicator stays visible on both tabs.

- [ ] **Step 5: Add tab bar after date range controls**

After the closing `</div>` of the date range wrapper (~after line 244, the closing div of the flex-wrap for range buttons), add the tab bar:

```typescript
{emmaOnboarded && (
  <div className="mt-3 flex gap-1">
    <button
      onClick={() => setActiveTab('refunds')}
      className={`rounded-lg px-3.5 py-1.5 text-[12px] font-semibold transition-all duration-150 ${
        activeTab === 'refunds'
          ? 'bg-gray-900 text-white'
          : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
      }`}
    >
      Refund Intelligence
    </button>
    <button
      onClick={() => setActiveTab('emma')}
      className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[12px] font-semibold transition-all duration-150 ${
        activeTab === 'emma'
          ? 'bg-gray-900 text-white'
          : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
      }`}
    >
      <Sparkles size={12} />
      Emma Performance
    </button>
  </div>
)}
```

- [ ] **Step 6: Wrap refund content in conditional**

After the header section's closing `</div>` (~line 246) and before the demo mode banner, wrap ALL remaining content (everything from the demo banner through the footer) in:

```typescript
{activeTab === 'refunds' ? (
  <>
    {/* --- existing refund content starts here (demo banner, sync banner, AlertBanner, KpiRow, etc.) --- */}
```

After the footer `<div>` (~line 303, the "Lynq Analytics · Shopify data" text), close the refund block and add the Emma block:

```typescript
    {/* --- existing refund content ends here --- */}
  </>
) : (
  <>
    <EmmaPerformance
      stats={emmaStatsQuery.data ?? {
        total_suggestions: 0, pending: 0, approved: 0, declined: 0,
        edited: 0, auto_sent: 0, regenerated: 0, total_resolved: 0,
        conversations_with_draft: 0, total_conversations: 0,
      }}
      loaded={!emmaStatsQuery.isPending}
    />
    <div className="mt-4 text-center text-[10.5px] tracking-[.04em] text-muted-foreground">
      Lynq Analytics &middot; Emma AI &middot; Refreshed on load
    </div>
  </>
)}
```

- [ ] **Step 7: Verify lint passes**

Run: `cd /Users/dendy/Documents/Work/Lynq/lynq-dashboard && npm run lint`

Expected: No errors. Fix any issues (likely unused imports if the restructure missed something).

---

### Task 6: Visual verification

- [ ] **Step 1: Start the dev server**

Run: `cd /Users/dendy/Documents/Work/Lynq/lynq-dashboard && npm run dev`

- [ ] **Step 2: Verify the refund tab (default)**

Navigate to `/analytics`. Confirm:
- The page loads with "Refund Intelligence" as before
- If Emma is onboarded for the active store, two tab buttons appear below the date range
- All existing refund content renders normally
- Export buttons and demo toggle are visible

- [ ] **Step 3: Verify the Emma tab**

Click the "Emma Performance" tab. Confirm:
- Title changes to "Emma Performance"
- Subtitle changes to "AI assistant metrics · {range}"
- Export buttons and demo toggle disappear
- 4 KPI cards render with correct data (or skeleton loaders while loading)
- If no suggestions exist in the range, the empty state message appears
- Changing the date range updates the Emma stats

- [ ] **Step 4: Verify tab visibility logic**

Switch to a store without Emma onboarding. Confirm:
- The tab bar does not appear
- The page shows only refund content (no way to navigate to Emma tab)

Switch back to an onboarded store. Confirm:
- The tab bar reappears
