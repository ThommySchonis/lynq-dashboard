'use client'

import { Search } from 'lucide-react'
import { ALL_FILTERS } from '@/lib/supply-chain-constants'
import { useSupplyChainUI } from '@/stores/supply-chain-ui'

interface ShipmentFiltersProps {
  attentionCount: number
  filteredCount: number
}

export function ShipmentFilters({ attentionCount, filteredCount }: ShipmentFiltersProps) {
  const { filter, search, setFilter, setSearch } = useSupplyChainUI()

  return (
    <div className="animate-[fadeUp_0.4s_ease_0.15s_both]">
      <div className="flex items-center gap-2.5 mb-3.5 flex-wrap">
        {/* Search input */}
        <div className="relative flex-[1_1_200px] min-w-[170px]">
          <Search className="absolute left-[11px] top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground w-3.5 h-3.5" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search order, customer, tracking #..."
            className="w-full py-2.5 pl-[38px] pr-3.5 bg-input border border-border rounded-[10px] text-foreground text-[13.5px] font-[inherit] outline-none transition-colors duration-150 placeholder:text-muted-foreground focus:border-(--border-hover)"
          />
        </div>

        {/* Filter pills */}
        <div className="flex gap-1 flex-wrap">
          {ALL_FILTERS.map(f => {
            const isAttn = f === 'Needs Attention'
            const isActive = filter === f
            const hasIssue = isAttn && attentionCount > 0

            let pillClasses = 'py-1.5 px-[13px] rounded-lg border text-xs font-semibold cursor-pointer transition-all duration-150 whitespace-nowrap'

            if (isActive) {
              if (hasIssue) {
                pillClasses += ' bg-[#DC2626] border-transparent text-white'
              } else {
                pillClasses += ' bg-[#111111] border-transparent text-white'
              }
            } else if (hasIssue) {
              pillClasses += ' text-[#DC2626] bg-[rgba(220,38,38,0.06)] border-[rgba(220,38,38,0.14)]'
            } else {
              pillClasses += ' bg-[#FAFAFA] border-[rgba(0,0,0,0.08)] text-[#888888] hover:text-foreground-2 hover:bg-secondary'
            }

            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={pillClasses}
              >
                {f}
                {isAttn && attentionCount > 0 && (
                  <span
                    className="ml-[5px] text-[10px] font-extrabold py-px px-[5px] rounded-full"
                    style={{
                      background: isActive ? 'rgba(255,255,255,0.2)' : 'rgba(220,38,38,0.12)',
                      color: isActive ? '#FFFFFF' : '#DC2626',
                      border: isActive ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(220,38,38,0.2)',
                    }}
                  >
                    {attentionCount}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <p className="text-xs text-muted-foreground mb-2.5">
        {filteredCount} shipment{filteredCount !== 1 ? 's' : ''}{filter !== 'All' ? ` \u00b7 ${filter}` : ''}
      </p>
    </div>
  )
}
