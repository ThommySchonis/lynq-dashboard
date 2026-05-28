'use client'

import { Search } from 'lucide-react'

export type BillingFilter = 'all' | 'trial' | 'active' | 'past_due' | 'canceled' | 'paused'
export type IntegrationFilter = 'all' | 'fully_connected' | 'partially_connected' | 'disconnected'
export type ActivityFilter = 'all' | 'active' | 'inactive'
export type SortField = 'name' | 'billing' | 'lastLogin' | 'created'
export type SortDir = 'asc' | 'desc'

export interface FilterState {
  search: string
  billing: BillingFilter
  integration: IntegrationFilter
  activity: ActivityFilter
  sortField: SortField
  sortDir: SortDir
}

interface ClientFiltersProps {
  filters: FilterState
  onChange: (filters: FilterState) => void
}

export function ClientFilters({ filters, onChange }: ClientFiltersProps) {
  function set<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    onChange({ ...filters, [key]: value })
  }

  const selectClass =
    'rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none'

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Search */}
      <div className="relative flex-1 min-w-[180px]">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={filters.search}
          onChange={(e) => set('search', e.target.value)}
          placeholder="Search clients..."
          className="w-full rounded-md border border-border bg-background py-1.5 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
        />
      </div>

      {/* Billing status */}
      <select
        value={filters.billing}
        onChange={(e) => set('billing', e.target.value as BillingFilter)}
        className={selectClass}
      >
        <option value="all">All Billing</option>
        <option value="trial">Trial</option>
        <option value="active">Active</option>
        <option value="past_due">Past Due</option>
        <option value="canceled">Canceled</option>
        <option value="paused">Paused</option>
      </select>

      {/* Integration status */}
      <select
        value={filters.integration}
        onChange={(e) => set('integration', e.target.value as IntegrationFilter)}
        className={selectClass}
      >
        <option value="all">All Integrations</option>
        <option value="fully_connected">Fully Connected</option>
        <option value="partially_connected">Partially Connected</option>
        <option value="disconnected">Disconnected</option>
      </select>

      {/* Activity */}
      <select
        value={filters.activity}
        onChange={(e) => set('activity', e.target.value as ActivityFilter)}
        className={selectClass}
      >
        <option value="all">All Activity</option>
        <option value="active">Active (7d)</option>
        <option value="inactive">Inactive (7d+)</option>
      </select>

      {/* Sort */}
      <select
        value={`${filters.sortField}-${filters.sortDir}`}
        onChange={(e) => {
          const [field, dir] = e.target.value.split('-') as [SortField, SortDir]
          onChange({ ...filters, sortField: field, sortDir: dir })
        }}
        className={selectClass}
      >
        <option value="created-desc">Newest First</option>
        <option value="created-asc">Oldest First</option>
        <option value="name-asc">Name A-Z</option>
        <option value="name-desc">Name Z-A</option>
        <option value="lastLogin-desc">Last Login (Recent)</option>
        <option value="lastLogin-asc">Last Login (Oldest)</option>
        <option value="billing-asc">Billing Status</option>
      </select>
    </div>
  )
}
