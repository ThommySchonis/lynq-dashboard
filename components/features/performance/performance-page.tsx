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
import { KpiRow } from './kpi-row'
import { TicketVolumeChart } from './ticket-volume-chart'
import { RefundReasonsChart } from './refund-reasons-chart'
import { AgentTable } from './agent-table'

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

  const dateRange = useMemo(
    () => computeDateRange(rangePreset, customFrom, customTo),
    [rangePreset, customFrom, customTo],
  )

  const responseTime = useResponseTime(dateRange, selectedAgentId)
  const resolutionTime = useResolutionTime(dateRange, selectedAgentId)
  const ticketVolume = useTicketVolume(dateRange, selectedAgentId)
  const agentProductivity = useAgentProductivity(dateRange, selectedAgentId)
  const refundReasons = useRefundReasons(dateRange, selectedAgentId)
  const membersQuery = useMembers()

  const members = useMemo(
    () => (membersQuery.data ?? []).map(toWorkspaceMember),
    [membersQuery.data],
  )

  const kpiLoading = responseTime.isPending || resolutionTime.isPending || agentProductivity.isPending

  function handleAgentChange(value: string | null) {
    setSelectedAgentId(!value || value === 'all' ? undefined : value)
  }

  return (
    <main className="min-h-screen overflow-y-auto bg-background p-6" style={{ scrollbarWidth: 'thin' }}>
      <div className="mx-auto max-w-[1200px]">

        {/* Header */}
        <div className="mb-6">
          <h1 className="mb-1 text-xl font-bold tracking-tight text-foreground">Performance</h1>
          <p className="text-sm text-muted-foreground">Support team analytics &middot; {dateRange.from} &rarr; {dateRange.to}</p>
        </div>

        {/* Top bar */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          {/* Date range buttons */}
          <div className="flex items-center gap-1.5">
            {(['7d', '30d', 'custom'] as RangePreset[]).map((preset) => (
              <button
                key={preset}
                onClick={() => setRangePreset(preset)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition-all duration-150 ${
                  rangePreset === preset
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-transparent text-muted-foreground hover:bg-muted'
                }`}
              >
                {preset === '7d' ? 'Last 7 days' : preset === '30d' ? 'Last 30 days' : 'Custom'}
              </button>
            ))}
          </div>

          {/* Agent filter */}
          <Select
            value={selectedAgentId ?? 'all'}
            onValueChange={handleAgentChange}
          >
            <SelectTrigger className="w-44" size="sm">
              <SelectValue placeholder="All agents" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All agents</SelectItem>
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
          <div className="mb-6 flex items-center gap-2">
            <input
              type="date"
              className="rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm text-foreground focus:border-ring focus:outline-none"
              value={customFrom}
              max={customTo || undefined}
              onChange={(e) => setCustomFrom(e.target.value)}
            />
            <span className="text-sm text-muted-foreground">&rarr;</span>
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

        {/* KPI row */}
        <KpiRow
          responseTime={responseTime.data}
          resolutionTime={resolutionTime.data}
          agentProductivity={agentProductivity.data}
          isLoading={kpiLoading}
        />

        {/* Charts */}
        <div className="mb-6 grid grid-cols-2 gap-4">
          <TicketVolumeChart
            data={ticketVolume.data}
            isLoading={ticketVolume.isPending}
          />
          <RefundReasonsChart
            data={refundReasons.data}
            isLoading={refundReasons.isPending}
          />
        </div>

        {/* Agent table */}
        <AgentTable
          data={agentProductivity.data}
          members={members}
          isLoading={agentProductivity.isPending}
        />

      </div>
    </main>
  )
}
