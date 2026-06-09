# Emma Performance Statistics — Design Spec

## Purpose

Display Emma (AI assistant) performance metrics on the analytics page so customers can evaluate AI usage and quality. Surfaces total suggestion count, approval/decline rates, and Emma's coverage of workspace conversations.

## Location & Integration

The existing analytics page (`/analytics`) gains tab navigation:

- **Refund Intelligence** — all existing refund content, unchanged
- **Emma Performance** — new tab with Emma metrics

### Tab behavior

- Tab bar renders below the shared header (title, date range picker, export buttons, demo toggle)
- Date range selection is shared — changing it affects both tabs
- Default tab: Refund Intelligence (preserves current behavior)
- The Emma tab is only visible when the active store has completed Emma onboarding (reuses `getOnboardingStatus` from `lib/services/ai-onboarding.ts`)
- Tab state is local component state (`useState`)

## Metrics

Four KPI cards in a row, matching the existing `KpiRow` visual style:

| Card | Value | Computation | Subtitle |
|------|-------|-------------|----------|
| Total Suggestions | Count | `COUNT(*)` from `ai_drafts` in range | "AI replies generated" |
| Approval Rate | Percentage | `(approved + edited + auto_sent) / total_resolved * 100` | "of resolved suggestions" |
| Decline Rate | Percentage | `declined / total_resolved * 100` | "of resolved suggestions" |
| Emma Coverage | Percentage | `conversations_with_draft / total_conversations * 100` | "X of Y conversations" |

### Status definitions

- **Resolved** = any draft with status in (`approved`, `declined`, `edited`, `auto_sent`). Excludes `pending` and `regenerated`.
- **Approved (broad)** = `approved` + `edited` + `auto_sent` — all drafts that resulted in a message being sent.
- **Total conversations** = count of distinct `email_conversations` in the same workspace, store, and date range.
- **Conversations with draft** = count of distinct `conversation_id` values in `ai_drafts` for the range.

### Edge cases

- If `total_resolved` is 0, show "—" for rate percentages (avoid division by zero)
- If `total_conversations` is 0, show "No conversations" for Emma Coverage
- If no drafts exist in range, show all zeros with a subtle empty state message

## Data Layer

### Supabase RPC function

`api_get_emma_stats(p_workspace_id uuid, p_store_id uuid, p_from text, p_to text)`

Returns a single row:

```
total_suggestions       bigint
pending                 bigint
approved                bigint
declined                bigint
edited                  bigint
auto_sent               bigint
regenerated             bigint
total_resolved          bigint
conversations_with_draft bigint
total_conversations     bigint
```

The function:
1. Counts `ai_drafts` grouped by status, filtered by `workspace_id`, `store_id`, and `generated_at` within `[p_from, p_to]`
2. Counts distinct `conversation_id` from `ai_drafts` in the same filters
3. Counts distinct `id` from `email_conversations` filtered by `workspace_id`, `store_id`, and `created_at` within `[p_from, p_to]`
4. Returns all counts in one row

Rate computation happens on the frontend (avoids float precision issues in SQL, keeps the RPC a clean data provider).

### Migration

One new migration file containing:
- The `api_get_emma_stats` function (`SECURITY DEFINER`, `search_path = ''`)
- Follows the existing AI RPC pattern from `20260609103529_ai_drafts_workflow.sql`

### RLS

No new tables — the RPC uses `SECURITY DEFINER` with the admin client to bypass RLS, same pattern as `api_list_resolved_drafts`. The workspace_id parameter ensures data scoping.

## Frontend

### New hook: `useEmmaStats`

File: `hooks/ai/use-emma-stats.ts`

```typescript
useEmmaStats(range: DateRange): UseQueryResult<EmmaStats>
```

- Calls `supabase.rpc('api_get_emma_stats', { ... })` with workspace_id, store_id, from, to
- TanStack Query key: `['emma-stats', workspaceId, storeId, range.from, range.to]`
- Enabled only when workspace, store, and range are available

### New type: `EmmaStats`

File: `types/ai-drafts.ts` (extend existing file)

```typescript
interface EmmaStats {
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

### New component: `emma-performance.tsx`

File: `components/features/analytics/emma-performance.tsx`

- Receives `stats: EmmaStats` and `loaded: boolean`
- Renders 4 KPI cards in a grid matching `KpiRow` style
- Cards use the existing rounded-xl, backdrop-blur, purple accent pattern
- Shows skeleton loaders while data is loading
- Shows empty state if no drafts exist in the range

### Modified: `analytics-page.tsx`

Changes:
- Add `tab` state: `'refunds' | 'emma'`
- Add tab bar UI below the header divider, above the content
- Conditionally render refund content or Emma content based on active tab
- Check Emma onboarding status to decide whether to show the Emma tab
- Pass shared `range` to both the existing refund hooks and the new `useEmmaStats` hook

## Visual Design

The Emma tab matches the existing analytics page aesthetic:
- Same card style as `KpiRow`: `rounded-xl border border-white/65 bg-white/80 backdrop-blur-xl`
- Purple accent for icons (consistent with Emma's brand in the inbox)
- `animate-fade-up` on load
- Tab bar: pill-style buttons matching the date range picker pattern (filled dark for active, transparent for inactive)

## Out of Scope

- Per-scenario breakdown charts
- Decline reason distribution
- Token usage / cost metrics
- Trend over time charts
- Export functionality for Emma data
- Demo mode data for Emma tab

These can be added as future enhancements to the Emma tab.
