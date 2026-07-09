'use client'

import { useState, useMemo } from 'react'
import {
  useResponseTime,
  useResolutionTime,
  useTicketVolume,
  useAgentProductivity,
  useRefundReasons,
} from '@/hooks/analytics'
import { useMembers } from '@/hooks/settings/use-settings-data'
import type { SupportAnalyticsDateRange } from '@/types/support-analytics'
import type { Member } from '@/types/settings'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { formatDateRangeLabel, computePrevRange } from '@/lib/performance-utils'
import { KpiRow } from './kpi-row'
import { TicketVolumeChart } from './ticket-volume-chart'
import { RefundReasonsChart } from './refund-reasons-chart'
import { AgentTable } from './agent-table'
import { ExportButton } from '@/components/shared/export-button'
import { downloadExport } from '@/lib/export-download'
import { useAuthStore } from '@/stores/auth'

// ── Date range helpers ────────────────────────────────────────────────────────

type RangePreset = '7d' | '30d' | 'custom'

function computeDateRange(preset: RangePreset, customFrom: string, customTo: string): SupportAnalyticsDateRange {
  if (preset === 'custom' && customFrom && customTo) {
    return { from: customFrom, to: customTo }
  }
  const to = new Date()
  const from = new Date()
  from.setDate(to.getDate() - (preset === '30d' ? 30 : 7))
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  }
}

function toWorkspaceMember(m: Member): { id: string; name: string; email: string } {
  return {
    id: m.id,
    name: m.display_name ?? m.email,
    email: m.email,
  }
}

// ── PerformancePage ──────────────────────────────────────────────────────────

export function PerformancePage() {
  const [rangePreset, setRangePreset] = useState<RangePreset>('7d')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [selectedAgentId, setSelectedAgentId] = useState<string | undefined>(undefined)
  const token = useAuthStore((s) => s.session?.access_token ?? '')

  const dateRange = useMemo(
    () => computeDateRange(rangePreset, customFrom, customTo),
    [rangePreset, customFrom, customTo],
  )

  const prevRange = useMemo(() => computePrevRange(dateRange), [dateRange])

  const responseTime = useResponseTime(dateRange, selectedAgentId)
  const resolutionTime = useResolutionTime(dateRange, selectedAgentId)
  const ticketVolume = useTicketVolume(dateRange, selectedAgentId)
  const agentProductivity = useAgentProductivity(dateRange, selectedAgentId)
  const refundReasons = useRefundReasons(dateRange, selectedAgentId)

  const prevResponseTime = useResponseTime(prevRange, selectedAgentId)
  const prevResolutionTime = useResolutionTime(prevRange, selectedAgentId)
  const prevAgentProductivity = useAgentProductivity(prevRange, selectedAgentId)

  const membersQuery = useMembers()

  const members = useMemo(
    () => (membersQuery.data ?? []).map(toWorkspaceMember),
    [membersQuery.data],
  )

  const kpiLoading = responseTime.isPending || resolutionTime.isPending || agentProductivity.isPending
  const hasPrev = !prevResponseTime.isPending && !prevResolutionTime.isPending && !prevAgentProductivity.isPending

  function handleAgentChange(value: string | null) {
    setSelectedAgentId(!value || value === 'all' ? undefined : value)
  }

  return (
    <main className="thin-scrollbar min-h-screen overflow-y-auto bg-background">
      <div className="mx-auto flex max-w-[1250px] flex-col gap-6 px-10 pt-9 pb-12">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-[22px] font-bold leading-[30px] tracking-[-0.01em] text-foreground">Performance</h1>
            <p className="text-sm leading-5 text-foreground-3">
              Support team analytics &middot; {formatDateRangeLabel(dateRange.from, dateRange.to)}
            </p>
          </div>
          <ExportButton
            formats={[
              { label: 'Performance CSV', value: 'csv' },
              { label: 'Performance PDF Report', value: 'pdf' },
            ]}
            onExport={async (format) => {
              await downloadExport(
                '/api/performance/export',
                { format, from: dateRange.from, to: dateRange.to, agentId: selectedAgentId ?? null },
                token,
                `performance-export-${new Date().toISOString().slice(0, 10)}.${format === 'csv' ? 'csv' : 'pdf'}`,
              )
            }}
          />
        </div>

        {/* Filters */}
        <div className="flex items-center justify-between gap-4">
          {/* Date range switcher */}
          <div className="flex items-center gap-2">
            {(['7d', '30d', 'custom'] as RangePreset[]).map((preset) => (
              <button
                key={preset}
                onClick={() => setRangePreset(preset)}
                className={cn(
                  'rounded-full px-3.5 py-2 text-sm leading-5 transition-colors',
                  rangePreset === preset
                    ? 'bg-accent-soft font-semibold text-primary'
                    : 'border border-border bg-card font-medium text-foreground-3 hover:bg-muted',
                )}
              >
                {preset === '7d' ? 'Last 7 days' : preset === '30d' ? 'Last 30 days' : 'Custom'}
              </button>
            ))}
          </div>

          {/* Agent filter */}
          <Select value={selectedAgentId ?? 'all'} onValueChange={handleAgentChange}>
            <SelectTrigger className="h-auto gap-2 rounded-[9px] border-border bg-card py-[9px] pr-3 pl-3.5 text-foreground">
              <SelectValue placeholder="All">
                {(value: string | null) => {
                  if (!value || value === 'all') return 'All'
                  return members.find((m) => m.id === value)?.name ?? value
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Custom date inputs */}
        {rangePreset === 'custom' && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              className="rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm text-foreground focus:border-ring focus:outline-none"
              value={customFrom}
              max={customTo || undefined}
              onChange={(e) => setCustomFrom(e.target.value)}
            />
            <span className="text-sm text-foreground-3">&rarr;</span>
            <input
              type="date"
              className="rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm text-foreground focus:border-ring focus:outline-none"
              value={customTo}
              min={customFrom || undefined}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setCustomTo(e.target.value)}
            />
          </div>
        )}

        {/* WORKLOAD */}
        <span className="text-xs font-medium leading-4 text-foreground-3">WORKLOAD</span>

        <KpiRow
          responseTime={responseTime.data}
          resolutionTime={resolutionTime.data}
          agentProductivity={agentProductivity.data}
          prevResponseTime={prevResponseTime.data}
          prevResolutionTime={prevResolutionTime.data}
          prevAgentProductivity={prevAgentProductivity.data}
          isLoading={kpiLoading}
          hasPrev={hasPrev}
        />

        {/* Charts */}
        <div className="grid grid-cols-2 gap-4">
          <TicketVolumeChart
            data={ticketVolume.data}
            isLoading={ticketVolume.isPending}
          />
          <RefundReasonsChart
            data={refundReasons.data}
            isLoading={refundReasons.isPending}
          />
        </div>

        {/* AI AGENT */}
        <span className="text-xs font-semibold uppercase leading-[14px] tracking-[0.08em] text-foreground-3">AI AGENT</span>

        <AgentTable
          data={agentProductivity.data}
          members={members}
          isLoading={agentProductivity.isPending}
        />

      </div>
    </main>
  )
}
