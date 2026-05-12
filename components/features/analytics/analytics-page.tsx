'use client'

import { useState, useMemo } from 'react'
import { BarChart3, Info, Loader2, RefreshCw } from 'lucide-react'
import { EmptyState } from '@/components/shared/empty-state'
import { DEMO_REFUNDS, DEMO_KPIS, DEMO_TREND, DEMO_INSIGHTS } from '@/lib/demoData'
import {
  RANGES,
  getDateRange,
  getPrevDateRange,
  generatePatternActions,
  generateRepeatRefunderActions,
} from '@/lib/analytics-constants'
import {
  useKpis,
  usePrevKpis,
  useRefunds,
  useAllRefunds,
  useRevenueTrend,
  useAiInsights,
  useActionStatuses,
  useShopifyConnected,
} from '@/hooks/analytics/use-analytics-data'
import { useUpdateActionStatus } from '@/hooks/analytics/use-analytics-mutations'
import type {
  DateRangeId,
  DateRange,
  KpiData,
  PrevKpiData,
  Refund,
  RevenueTrendPoint,
  AiInsight,
} from '@/types/analytics'

import { AlertBanner } from './alert-banner'
import { KpiRow } from './kpi-row'
import { RevenueTrendChart } from './revenue-trend-chart'
import { DonutReasonChart } from './donut-reason-chart'
import { MonthlyTrendChart } from './monthly-trend-chart'
import { ActionBoard } from './action-board'
import { RefundTable } from './refund-table'
import { ProductMatrix } from './product-matrix'
import { RefundReasons } from './refund-reasons'
import { WeeklyReport } from './weekly-report'

// ── Demo data, pre-cast ─────────────────────────────────────────────────────

const DEMO_KPI_DATA = DEMO_KPIS as unknown as KpiData
const DEMO_PREV_KPIS: PrevKpiData = { totalOrders: 24, totalRefunds: 6, refundRate: 25.0, refundAmount: 489 }
const DEMO_REFUND_DATA = DEMO_REFUNDS as unknown as Refund[]
const DEMO_CURRENT_REFUNDS = DEMO_REFUND_DATA.filter(r => new Date(r.refundedAt) >= new Date('2026-04-01'))
const DEMO_TREND_DATA = DEMO_TREND as unknown as RevenueTrendPoint[]
const DEMO_INSIGHT_DATA = DEMO_INSIGHTS as unknown as AiInsight[]

// ── AnalyticsContent ────────────────────────────────────────────────────────

function AnalyticsContent() {
  // UI state
  const [dateRange, setDateRange] = useState<DateRangeId>('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [demoMode, setDemoMode] = useState(false)

  // Compute date ranges from UI state
  const range: DateRange = useMemo(() => {
    if (dateRange === 'custom' && customFrom && customTo) {
      return { from: customFrom, to: customTo }
    }
    return getDateRange(dateRange)
  }, [dateRange, customFrom, customTo])

  const prevRange: DateRange = useMemo(() => getPrevDateRange(dateRange), [dateRange])

  // TanStack queries — disabled when in demo mode
  const kpisQuery = useKpis(range)
  const prevKpisQuery = usePrevKpis(prevRange)
  const refundsQuery = useRefunds(range)
  const allRefundsQuery = useAllRefunds()
  const trendQuery = useRevenueTrend(range)
  const refundData = demoMode ? DEMO_CURRENT_REFUNDS : (refundsQuery.data ?? [])
  const allRefundData = demoMode ? DEMO_REFUND_DATA : (allRefundsQuery.data ?? [])
  const aiInsightsQuery = useAiInsights(refundData)
  const actionStatusesQuery = useActionStatuses()
  const updateActionStatus = useUpdateActionStatus()

  // Resolve data: demo overrides live
  const kpis: KpiData = demoMode ? DEMO_KPI_DATA : (kpisQuery.data ?? {} as KpiData)
  const prevKpis: PrevKpiData = demoMode ? DEMO_PREV_KPIS : (prevKpisQuery.data ?? {})
  const refunds = refundData
  const allRefunds = allRefundData
  const trend: RevenueTrendPoint[] = demoMode ? DEMO_TREND_DATA : (trendQuery.data ?? [])
  const insights: AiInsight[] = demoMode ? DEMO_INSIGHT_DATA : (aiInsightsQuery.data ?? [])
  const actionStatuses = (actionStatusesQuery.data ?? {}) as Record<string, { status: string; pickedUpBy?: string | null; pickedUpAt?: string | null; resultNote?: string | null }>

  // Loading states: in demo mode everything is "loaded"
  const loaded = {
    kpis: demoMode || !kpisQuery.isPending,
    prevKpis: demoMode || !prevKpisQuery.isPending,
    refunds: demoMode || !refundsQuery.isPending,
    allRefunds: demoMode || !allRefundsQuery.isPending,
    trend: demoMode || !trendQuery.isPending,
    insights: demoMode || !aiInsightsQuery.isPending,
  }

  // Derived state
  const allLoaded = loaded.kpis && loaded.refunds && loaded.trend
  const rangeLabel = dateRange === 'custom' && customFrom && customTo
    ? `${customFrom} \u2192 ${customTo}`
    : RANGES.find(r => r.id === dateRange)?.label || 'This month'
  const noRefunds = loaded.refunds && refunds.length === 0
  const patternActions = loaded.allRefunds
    ? [...generatePatternActions(allRefunds), ...generateRepeatRefunderActions(allRefunds)]
    : []
  const actionLoaded = loaded.insights && loaded.allRefunds

  // Fallback detection for action statuses
  const usingFallback = actionStatusesQuery.isError

  // Range selection handlers
  function selectRange(id: DateRangeId) {
    setDateRange(id)
  }

  function applyCustomRange(from: string, to: string) {
    if (from && to && from <= to) {
      setCustomFrom(from)
      setCustomTo(to)
    }
  }

  // Action status change handler
  function handleStatusChange(id: string, status: string, pickedUpBy: string, resultNote: string) {
    if (usingFallback) {
      // Fallback to localStorage
      const current = { ...actionStatuses }
      current[id] = {
        status,
        pickedUpBy: pickedUpBy || null,
        pickedUpAt: status === 'picked_up' ? new Date().toISOString() : null,
        resultNote: resultNote || null,
      }
      try { localStorage.setItem('lynq-action-statuses', JSON.stringify(current)) } catch { /* ignore */ }
      return
    }
    updateActionStatus.mutate({ id, status, pickedUpBy, resultNote })
  }

  return (
      <main className="min-h-screen overflow-y-auto bg-background p-6 relative" style={{ scrollbarWidth: 'thin' }}>
        <div className="relative z-[1] mx-auto max-w-[1200px]">

          {/* Header */}
          <div className="mb-6 animate-fade-up">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="mb-1 text-xl font-bold tracking-tight text-gray-900">Refund Intelligence</h1>
                <p className="text-[13px] text-gray-500">Where money is lost &middot; {rangeLabel}</p>
              </div>
              <div className="flex items-center gap-2">
                {demoMode ? (
                  <span className="rounded border border-black/[0.08] bg-gray-100 px-[7px] py-0.5 text-[10px] font-bold uppercase tracking-[.05em] text-gray-600">
                    DEMO
                  </span>
                ) : null}
                {demoMode ? (
                  <button
                    onClick={() => setDemoMode(false)}
                    className="rounded-[7px] border border-black/[0.09] bg-gray-100 px-3 py-[5px] text-xs font-semibold text-gray-600 hover:bg-gray-200"
                  >
                    Exit Demo
                  </button>
                ) : (
                  <button
                    onClick={() => setDemoMode(true)}
                    className="rounded-[7px] border border-black/[0.09] bg-gray-100 px-3 py-[5px] text-xs font-semibold text-gray-600 hover:bg-gray-200"
                  >
                    Preview Demo
                  </button>
                )}
                <div
                  className={`flex items-center gap-1.5 rounded-[7px] border px-3 py-[5px] ${
                    allLoaded && !demoMode
                      ? 'border-green-600/15 bg-green-50'
                      : 'border-black/[0.08] bg-gray-100'
                  }`}
                >
                  {!allLoaded ? (
                    <Loader2 size={12} className="animate-spin text-gray-500" />
                  ) : (
                    <div className={`h-1.5 w-1.5 shrink-0 rounded-full ${demoMode ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                  )}
                  <span className={`text-[11px] font-semibold ${allLoaded && !demoMode ? 'text-green-700' : 'text-gray-600'}`}>
                    {!allLoaded ? 'Loading\u2026' : demoMode ? 'Demo' : 'Live'}
                  </span>
                </div>
              </div>
            </div>
            <div className="my-3 h-px bg-black/[0.06]" />
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap gap-1.5">
                {RANGES.map(r => (
                  <button
                    key={r.id}
                    onClick={() => selectRange(r.id)}
                    className={`whitespace-nowrap rounded-full border px-3 py-1 text-[11px] font-semibold transition-all duration-150 ${
                      dateRange === r.id
                        ? 'border-gray-900 bg-gray-900 text-white'
                        : 'border-transparent bg-transparent text-gray-400 hover:bg-gray-50'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              {dateRange === 'custom' ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="date"
                    className="rounded-[7px] border border-black/[0.08] bg-gray-100 px-2.5 py-1 text-[11.5px] text-gray-900 focus:border-black/[0.18] focus:outline-none"
                    value={customFrom}
                    max={customTo || undefined}
                    onChange={e => { const v = e.target.value; applyCustomRange(v, customTo) }}
                  />
                  <span className="text-[11px] text-muted-foreground">&rarr;</span>
                  <input
                    type="date"
                    className="rounded-[7px] border border-black/[0.08] bg-gray-100 px-2.5 py-1 text-[11.5px] text-gray-900 focus:border-black/[0.18] focus:outline-none"
                    value={customTo}
                    min={customFrom || undefined}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={e => { const v = e.target.value; applyCustomRange(customFrom, v) }}
                  />
                </div>
              ) : null}
            </div>
          </div>

          {demoMode ? (
            <div className="mb-4 flex animate-fade-up items-center gap-2.5 rounded-md border border-black/[0.07] bg-gray-50 px-3.5 py-2">
              <Info size={13} className="shrink-0 text-gray-400" />
              <div className="flex-1">
                <span className="text-xs text-gray-400">Demo mode — connect your Shopify store in Settings to see real insights.</span>
              </div>
              <button
                onClick={() => setDemoMode(false)}
                className="whitespace-nowrap text-xs font-semibold text-gray-600 hover:text-gray-900"
              >
                Exit &rarr;
              </button>
            </div>
          ) : null}

          {/* Sync needed banner */}
          {!demoMode && loaded.kpis && (kpis as unknown as Record<string, unknown>).needsSync ? (
            <div className="mb-4 flex animate-fade-up items-center gap-2.5 rounded-md border border-black/[0.07] bg-gray-50 px-3.5 py-2">
              <RefreshCw size={13} className="shrink-0 text-gray-400" />
              <div className="flex-1">
                <span className="text-xs text-gray-400">No order data found. Go to Settings &rarr; Shopify to sync your orders.</span>
              </div>
              <button
                onClick={() => setDemoMode(true)}
                className="whitespace-nowrap rounded-md border border-black/[0.08] bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-200"
              >
                Preview demo
              </button>
            </div>
          ) : null}

          <AlertBanner rate={kpis.refundRate} loaded={loaded.kpis} />
          <KpiRow kpis={kpis} prevKpis={prevKpis} refunds={refunds} loaded={loaded} />
          <RevenueTrendChart trend={trend} loaded={loaded.trend} rangeLabel={rangeLabel} />

          {/* Donut + Monthly side by side */}
          <div className="mb-6 grid animate-fade-up grid-cols-2 gap-4">
            <DonutReasonChart refunds={refunds} loaded={loaded.refunds} />
            <MonthlyTrendChart allRefunds={allRefunds} loaded={loaded.allRefunds} />
          </div>

          <ActionBoard
            patternActions={patternActions}
            aiInsights={insights}
            noRefunds={noRefunds}
            loaded={actionLoaded}
            onStatusChange={handleStatusChange}
            statuses={actionStatuses}
            usingFallback={usingFallback}
          />
          <RefundTable refunds={refunds} loaded={loaded.refunds} />
          <ProductMatrix allRefunds={allRefunds} loaded={loaded.allRefunds} />

          {!noRefunds ? (
            <div className="mb-6 animate-fade-up">
              <RefundReasons refunds={refunds} loaded={loaded.refunds} />
            </div>
          ) : null}

          <WeeklyReport allRefunds={allRefunds} loaded={loaded.allRefunds} />

          <div className="mt-4 text-center text-[10.5px] tracking-[.04em] text-muted-foreground">
            Lynq Analytics &middot; Shopify data &middot; AI by Claude &middot; Refreshed on load
          </div>
        </div>
      </main>
    )
}

// ── Wrapper: gate Analytics behind Shopify-connected check ──────────────────

export function AnalyticsPage() {
  const { data: shopifyConnected, isPending } = useShopifyConnected()

  if (isPending) return null

  if (!shopifyConnected) {
    return (
      <EmptyState
        icon={BarChart3}
        title="No analytics data yet"
        description="Connect your Shopify store to see revenue, order metrics, and customer insights."
        actionLabel="Connect Shopify"
        onAction={() => { window.location.href = '/settings/integrations/shopify' }}
      />
    )
  }

  return <AnalyticsContent />
}
