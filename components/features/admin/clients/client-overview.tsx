'use client'

import { useState, useMemo } from 'react'
import { useClientOverview } from '@/hooks/admin/use-client-overview'
import { ClientSummaryCards } from './client-summary-cards'
import { ClientFilters, type FilterState, type SortField } from './client-filters'
import { ClientTable } from './client-table'
import type { ClientOverviewItem } from '@/types/admin-client-overview'
import { Card, CardContent } from '@/components/ui/card'

const DEFAULT_FILTERS: FilterState = {
  search: '',
  billing: 'all',
  integration: 'all',
  activity: 'all',
  sortField: 'created',
  sortDir: 'desc',
}

function integrationCount(c: ClientOverviewItem): number {
  return [c.hasShopify, c.hasGmail, c.hasOutlook].filter(Boolean).length
}

function applyFilters(clients: ClientOverviewItem[], filters: FilterState): ClientOverviewItem[] {
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000

  return clients.filter((c) => {
    // Search
    if (filters.search) {
      const q = filters.search.toLowerCase()
      if (
        !c.companyName.toLowerCase().includes(q) &&
        !c.email.toLowerCase().includes(q)
      ) return false
    }

    // Billing
    if (filters.billing !== 'all' && c.billingStatus !== filters.billing) return false

    // Integration
    if (filters.integration !== 'all') {
      const count = integrationCount(c)
      if (filters.integration === 'fully_connected' && count < 3) return false
      if (filters.integration === 'partially_connected' && (count === 0 || count === 3)) return false
      if (filters.integration === 'disconnected' && count > 0) return false
    }

    // Activity
    if (filters.activity !== 'all') {
      const isActive = c.lastLoginAt && new Date(c.lastLoginAt).getTime() >= sevenDaysAgo
      if (filters.activity === 'active' && !isActive) return false
      if (filters.activity === 'inactive' && isActive) return false
    }

    return true
  })
}

const BILLING_ORDER: Record<string, number> = {
  past_due: 0, trial: 1, active: 2, paused: 3, canceled: 4,
}

function applySort(clients: ClientOverviewItem[], field: SortField, dir: 'asc' | 'desc'): ClientOverviewItem[] {
  const sorted = [...clients].sort((a, b) => {
    switch (field) {
      case 'name':
        return a.companyName.localeCompare(b.companyName)
      case 'billing': {
        const aOrder = BILLING_ORDER[a.billingStatus ?? 'canceled'] ?? 5
        const bOrder = BILLING_ORDER[b.billingStatus ?? 'canceled'] ?? 5
        return aOrder - bOrder
      }
      case 'lastLogin': {
        const aTime = a.lastLoginAt ? new Date(a.lastLoginAt).getTime() : 0
        const bTime = b.lastLoginAt ? new Date(b.lastLoginAt).getTime() : 0
        return aTime - bTime
      }
      case 'created':
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      default:
        return 0
    }
  })
  return dir === 'desc' ? sorted.reverse() : sorted
}

export function ClientOverview() {
  const { data, isLoading, error, refetch } = useClientOverview()
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS)

  const filteredClients = useMemo(() => {
    const clients = data?.clients
    if (!clients) return []
    const filtered = applyFilters(clients, filters)
    return applySort(filtered, filters.sortField, filters.sortDir)
  }, [data, filters])

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 px-4 py-8 text-center text-sm text-destructive">
          <span>Failed to load client overview.</span>
          <button
            onClick={() => void refetch()}
            className="rounded-md border border-border px-3 py-1 text-xs font-medium text-foreground hover:bg-muted"
          >
            Retry
          </button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      {isLoading ? (
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[72px] animate-pulse rounded-lg border border-border bg-card" />
          ))}
        </div>
      ) : data ? (
        <ClientSummaryCards {...data.summary} />
      ) : null}

      {/* Filters + Table */}
      <Card>
        <div className="border-b border-border px-4 py-3">
          <ClientFilters filters={filters} onChange={setFilters} />
        </div>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-1 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded bg-muted/50" />
              ))}
            </div>
          ) : (
            <ClientTable clients={filteredClients} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
