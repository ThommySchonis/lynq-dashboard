'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { BarChart3, Info, Loader2, Sparkles } from 'lucide-react'
import { EmptyState } from '@/components/shared/empty-state'
import { DEMO_REFUNDS, DEMO_KPIS, DEMO_TREND } from '@/lib/demoData'
import {
  RANGES,
  getDateRange,
  getPrevDateRange,
} from '@/lib/analytics-constants'
import {
  useKpis,
  usePrevKpis,
  useRefunds,
  useAllRefunds,
  useRevenueTrend,
  useShopifyConnected,
} from '@/hooks/analytics/use-analytics-data'
import { useGeneratePatternTasks } from '@/hooks/tasks'
import { useEmmaStats, useEmmaOnboarded, EMPTY_EMMA_STATS } from '@/hooks/ai/use-emma-stats'
import { EmmaPerformance } from './emma-performance'
import { EmmaActivityFeed } from './emma-activity-feed'
import type {
  DateRangeId,
  DateRange,
  KpiData,
  PrevKpiData,
  Refund,
  RevenueTrendPoint,
} from '@/types/analytics'

import { ExportButton } from '@/components/shared/export-button'
import { downloadExport } from '@/lib/export-download'
import { useAuthStore } from '@/stores/auth'
import { useStoreStore } from '@/stores/store'

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

// ── AnalyticsContent ────────────────────────────────────────────────────────

function AnalyticsContent() {
  // UI state
  const [dateRange, setDateRange] = useState<DateRangeId>('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [demoMode, setDemoMode] = useState(false)
  const [activeTab, setActiveTab] = useState<'refunds' | 'emma'>('refunds')

  const token = useAuthStore(s => s.session?.access_token ?? '')
  const activeStoreId = useStoreStore(s => s.activeStoreId)
  const emmaOnboardedQuery = useEmmaOnboarded()
  const emmaOnboarded = emmaOnboardedQuery.data === true

  // Compute date ranges from UI state
  const range: DateRange = useMemo(() => {
    if (dateRange === 'custom' && customFrom && customTo) {
      return { from: customFrom, to: customTo }
    }
    return getDateRange(dateRange)
  }, [dateRange, customFrom, customTo])

  const prevRange: DateRange = useMemo(() => {
    // For a custom window, compare against the equal-length period immediately before it.
    if (dateRange === 'custom' && customFrom && customTo) {
      const fromMs = new Date(customFrom).getTime()
      const toMs = new Date(customTo).getTime()
      const days = Math.max(1, Math.round((toMs - fromMs) / 86400000) + 1)
      const prevTo = new Date(fromMs - 86400000)
      const prevFrom = new Date(prevTo.getTime() - (days - 1) * 86400000)
      return { from: prevFrom.toISOString().slice(0, 10), to: prevTo.toISOString().slice(0, 10) }
    }
    return getPrevDateRange(dateRange)
  }, [dateRange, customFrom, customTo])

  // TanStack queries — disabled when in demo mode
  const kpisQuery = useKpis(range)
  const prevKpisQuery = usePrevKpis(prevRange)
  const refundsQuery = useRefunds(range)
  const allRefundsQuery = useAllRefunds()
  const trendQuery = useRevenueTrend(range)
  const refundData = demoMode ? DEMO_CURRENT_REFUNDS : (refundsQuery.data ?? [])
  const allRefundData = demoMode ? DEMO_REFUND_DATA : (allRefundsQuery.data ?? [])
  const emmaStatsQuery = useEmmaStats(range)
  const generateTasks = useGeneratePatternTasks()

  // Generate pattern tasks from refund data on load
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (!demoMode) generateTasks.mutate() }, [demoMode])

  // Resolve data: demo overrides live
  const kpis: KpiData = demoMode ? DEMO_KPI_DATA : (kpisQuery.data ?? {} as KpiData)
  const prevKpis: PrevKpiData = demoMode ? DEMO_PREV_KPIS : (prevKpisQuery.data ?? {})
  const refunds = refundData
  const allRefunds = allRefundData
  const trend: RevenueTrendPoint[] = demoMode ? DEMO_TREND_DATA : (trendQuery.data ?? [])
  // Loading states: in demo mode everything is "loaded"
  const loaded = {
    kpis: demoMode || !kpisQuery.isPending,
    prevKpis: demoMode || !prevKpisQuery.isPending,
    refunds: demoMode || !refundsQuery.isPending,
    allRefunds: demoMode || !allRefundsQuery.isPending,
    trend: demoMode || !trendQuery.isPending,
  }

  // Derived state
  const allLoaded = loaded.kpis && loaded.refunds && loaded.trend
  const rangeLabel = dateRange === 'custom' && customFrom && customTo
    ? `${customFrom} \u2192 ${customTo}`
    : RANGES.find(r => r.id === dateRange)?.label || 'This month'

  // Range selection handlers
  function selectRange(id: DateRangeId) {
    setDateRange(id)
  }

  // Set each bound independently; the `range` memo only applies a custom window
  // once BOTH dates are present, and the inputs' min/max enforce from <= to.
  function applyCustomRange(from: string, to: string) {
    setCustomFrom(from)
    setCustomTo(to)
  }

  return (
    <main className="min-h-screen overflow-y-auto bg-background p-6 relative" style={{ scrollbarWidth: "thin" }}>
      <div className="relative z-[1] mx-auto max-w-[1200px]">
        {/* Header */}
        <div className="mb-6 animate-fade-up">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="mb-1 text-[28px] font-bold leading-[32px] tracking-[-0.02em] text-foreground">
                {activeTab === "refunds" ? "Refund Intelligence" : "Emma Performance"}
              </h1>
              <p className="text-[14px] font-medium text-muted-foreground">
                {activeTab === "refunds" ? "Where money is lost" : "AI assistant metrics"} &middot; {rangeLabel}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {activeTab === "refunds" && (
                <>
                  <ExportButton
                    formats={[
                      { label: "Orders CSV", value: "orders:csv" },
                      { label: "Orders PDF Report", value: "orders:pdf" },
                      { label: "Analytics CSV", value: "analytics:csv" },
                      { label: "Analytics PDF Report", value: "analytics:pdf" },
                    ]}
                    onExport={async (value) => {
                      const [source, format] = value.split(":");
                      const endpoint = source === "orders" ? "/api/orders/export" : "/api/analytics/export";
                      await downloadExport(
                        endpoint,
                        { format, storeId: activeStoreId ?? undefined },
                        token,
                        `${source}-export-${new Date().toISOString().slice(0, 10)}.${format === "csv" ? "csv" : "pdf"}`,
                      );
                    }}
                  />
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
                </>
              )}
              <div
                className={`flex items-center gap-1.5 rounded-[7px] border px-3 py-[5px] ${
                  allLoaded && !demoMode ? "border-green-600/15 bg-green-50" : "border-black/[0.08] bg-gray-100"
                }`}
              >
                {!allLoaded ? (
                  <Loader2 size={12} className="animate-spin text-gray-500" />
                ) : (
                  <div className={`h-1.5 w-1.5 shrink-0 rounded-full ${demoMode ? "bg-amber-500" : "bg-emerald-500"}`} />
                )}
                <span className={`text-[11px] font-semibold ${allLoaded && !demoMode ? "text-green-700" : "text-gray-600"}`}>
                  {!allLoaded ? "Loading\u2026" : demoMode ? "Demo" : "Live"}
                </span>
              </div>
            </div>
          </div>
          <div className="my-3 h-px bg-black/[0.06]" />
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-2">
              {RANGES.map((r) => (
                <button
                  key={r.id}
                  onClick={() => selectRange(r.id)}
                  className={`whitespace-nowrap rounded-full border px-3.5 py-2 text-[14px] transition-all duration-150 ${
                    dateRange === r.id
                      ? "border-transparent bg-accent-soft font-semibold text-primary"
                      : "border-border bg-card font-medium text-muted-foreground hover:border-border-hover"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            {dateRange === "custom" ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  className="rounded-[7px] border border-black/[0.08] bg-gray-100 px-2.5 py-1 text-[11.5px] text-gray-900 focus:border-black/[0.18] focus:outline-none"
                  value={customFrom}
                  max={customTo || undefined}
                  onChange={(e) => {
                    const v = e.target.value;
                    applyCustomRange(v, customTo);
                  }}
                />
                <span className="text-[11px] text-muted-foreground">&rarr;</span>
                <input
                  type="date"
                  className="rounded-[7px] border border-black/[0.08] bg-gray-100 px-2.5 py-1 text-[11.5px] text-gray-900 focus:border-black/[0.18] focus:outline-none"
                  value={customTo}
                  min={customFrom || undefined}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => {
                    const v = e.target.value;
                    applyCustomRange(customFrom, v);
                  }}
                />
              </div>
            ) : null}
          </div>
          <div className="mt-3 flex gap-1" role="tablist">
            <button
              role="tab"
              aria-selected={activeTab === "refunds"}
              onClick={() => setActiveTab("refunds")}
              className={`rounded-lg px-3.5 py-1.5 text-[12px] font-semibold transition-all duration-150 ${
                activeTab === "refunds" ? "bg-gray-900 text-white" : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
              }`}
            >
              Refund Intelligence
            </button>
            <button
              role="tab"
              aria-selected={activeTab === "emma"}
              onClick={() => setActiveTab("emma")}
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[12px] font-semibold transition-all duration-150 ${
                activeTab === "emma" ? "bg-gray-900 text-white" : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
              }`}
            >
              <Sparkles size={12} />
              Emma Performance
            </button>
          </div>
        </div>

        {activeTab === "refunds" ? (
          <>
            {demoMode ? (
              <div className="mb-4 flex animate-fade-up items-center gap-2.5 rounded-md border border-black/[0.07] bg-gray-50 px-3.5 py-2">
                <Info size={13} className="shrink-0 text-gray-400" />
                <div className="flex-1">
                  <span className="text-xs text-gray-400">Demo mode — connect your Shopify store in Settings to see real insights.</span>
                </div>
                <button onClick={() => setDemoMode(false)} className="whitespace-nowrap text-xs font-semibold text-gray-600 hover:text-gray-900">
                  Exit &rarr;
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

            <ActionBoard demoMode={demoMode} />
            <RefundTable refunds={refunds} loaded={loaded.refunds} />
            <ProductMatrix allRefunds={allRefunds} loaded={loaded.allRefunds} />

            <div className="mb-6 animate-fade-up">
              <RefundReasons refunds={refunds} loaded={loaded.refunds} />
            </div>

            <WeeklyReport allRefunds={allRefunds} loaded={loaded.allRefunds} />

            <div className="mt-4 text-center text-[10.5px] tracking-[.04em] text-muted-foreground">
              Lynq Analytics &middot; Shopify data &middot; AI by Claude &middot; Refreshed on load
            </div>
          </>
        ) : (
          <>
            {!emmaOnboarded && !emmaOnboardedQuery.isPending && (
              <Link
                href="/settings/ai-agent/onboarding"
                className="mb-4 flex items-start gap-2 rounded-lg border border-purple-500/20 bg-purple-500/5 p-3 text-sm text-purple-700 transition-colors hover:bg-purple-500/10"
              >
                <Sparkles size={16} className="mt-0.5 shrink-0" />
                <span>Emma isn&apos;t set up for this store yet. Complete onboarding to start seeing AI suggestions and activity.</span>
              </Link>
            )}
            <EmmaPerformance stats={emmaStatsQuery.data ?? EMPTY_EMMA_STATS} loaded={!emmaStatsQuery.isPending} />
            <EmmaActivityFeed range={range} />
            <div className="mt-4 text-center text-[10.5px] tracking-[.04em] text-muted-foreground">
              Lynq Analytics &middot; Emma AI &middot; Refreshed on load
            </div>
          </>
        )}
      </div>
    </main>
  );
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
