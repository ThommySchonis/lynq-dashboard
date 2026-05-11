'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Minus, CheckCircle } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { CATEGORIES, categorizeReason, fmtDate, fmtEur } from '@/lib/analytics-constants'
import { CatBadge } from './action-board'
import type { Refund, RefundCategory } from '@/types/analytics'

interface RefundTableProps {
  refunds: Refund[]
  loaded: boolean
}

interface EnrichedRefund extends Refund {
  category: string
}

type SortColumn = 'refundedAt' | 'orderId' | 'customer' | 'category' | 'refundPct' | 'refundAmount'

export function RefundTable({ refunds, loaded }: RefundTableProps) {
  const [showAll, setShowAll] = useState(false)
  const [catFilter, setCatFilter] = useState<RefundCategory>('All')
  const [sortCol, setSortCol] = useState<SortColumn>('refundedAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const enriched: EnrichedRefund[] = (loaded ? refunds : []).map(r => ({ ...r, category: categorizeReason(r.reason) }))
  const filtered = catFilter === 'All' ? enriched : enriched.filter(r => r.category === catFilter)
  const sorted = [...filtered].sort((a, b) => {
    let av: string | number | Date, bv: string | number | Date
    if (sortCol === 'refundedAt') { av = new Date(a.refundedAt); bv = new Date(b.refundedAt) }
    else if (sortCol === 'refundAmount') { av = parseFloat(String(a.refundAmount)); bv = parseFloat(String(b.refundAmount)) }
    else if (sortCol === 'refundPct') { av = parseFloat(String(a.refundPct)); bv = parseFloat(String(b.refundPct)) }
    else { av = (a as unknown as Record<string, unknown>)[sortCol] as string || ''; bv = (b as unknown as Record<string, unknown>)[sortCol] as string || '' }
    return sortDir === 'desc' ? (av < bv ? 1 : -1) : (av > bv ? 1 : -1)
  })
  const display = showAll ? sorted : sorted.slice(0, 20)

  function toggleSort(col: SortColumn) {
    if (sortCol === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortCol(col); setSortDir('desc') }
  }

  function SortIcon({ col }: { col: SortColumn }) {
    if (sortCol !== col) return <Minus size={9} className="text-black/20" />
    return sortDir === 'desc'
      ? <ChevronDown size={9} className="text-gray-600" />
      : <ChevronUp size={9} className="text-gray-600" />
  }

  const headers: { label: string; col: SortColumn | null; align: 'left' | 'right' }[] = [
    { label: 'Date', col: 'refundedAt', align: 'left' },
    { label: 'Order', col: 'orderId', align: 'left' },
    { label: 'Customer', col: 'customer', align: 'left' },
    { label: 'Product(s)', col: null, align: 'left' },
    { label: 'Category', col: 'category', align: 'left' },
    { label: '% of Order', col: 'refundPct', align: 'right' },
    { label: 'Amount', col: 'refundAmount', align: 'right' },
  ]

  return (
    <div className="mb-6 animate-fade-in rounded-xl border border-white/65 bg-white/80 p-[22px_24px] shadow-sm backdrop-blur-xl transition-shadow duration-200 hover:shadow-lg">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2.5">
        <div>
          <div className="mb-0.5 text-[13px] font-semibold text-[var(--text-1)]">Refund History</div>
          <div className="text-[11px] text-[var(--text-3)]">
            {loaded
              ? `${filtered.length} of ${enriched.length} refund${enriched.length !== 1 ? 's' : ''} \u00B7 ${catFilter === 'All' ? 'all categories' : catFilter}`
              : 'Loading\u2026'}
          </div>
        </div>
        {loaded && enriched.length > 0 && (
          <div className="rounded-full border border-black/[0.08] bg-gray-100 px-3 py-0.5 text-[11px] font-semibold text-gray-600">
            {enriched.length} refunds
          </div>
        )}
      </div>

      {/* Category filter pills */}
      {loaded && enriched.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {CATEGORIES.map(cat => {
            const cnt = cat === 'All' ? enriched.length : enriched.filter(r => r.category === cat).length
            if (cnt === 0 && cat !== 'All') return null
            const isAct = catFilter === cat
            return (
              <button
                key={cat}
                onClick={() => { setCatFilter(cat); setShowAll(false) }}
                className={`whitespace-nowrap rounded-full border px-3 py-1 text-[11px] font-semibold transition-all duration-150 ${
                  isAct
                    ? 'border-gray-900 bg-gray-900 text-white'
                    : 'border-transparent bg-transparent text-gray-400 hover:bg-gray-50'
                }`}
              >
                {cat} <span className="text-[10px] opacity-70">{cnt}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Skeleton loading */}
      {!loaded && (
        <div className="flex flex-col gap-3">
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} className="flex gap-4">
              <Skeleton className="h-[13px] w-[60px]" />
              <Skeleton className="h-[13px] flex-1" />
              <Skeleton className="h-[13px] flex-[2]" />
              <Skeleton className="h-[13px] w-[90px]" />
              <Skeleton className="h-[13px] w-[70px]" />
            </div>
          ))}
        </div>
      )}

      {/* Empty states */}
      {loaded && enriched.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-12">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100">
            <CheckCircle size={22} className="text-gray-300" />
          </div>
          <div className="text-center">
            <div className="mb-1 text-sm font-semibold text-gray-900">No refunds this period</div>
            <div className="text-[13px] text-gray-400">Keep it up — no refunded orders found</div>
          </div>
        </div>
      )}

      {loaded && filtered.length === 0 && enriched.length > 0 && (
        <div className="py-8 text-center text-xs text-[var(--text-3)]">No refunds in category &ldquo;{catFilter}&rdquo;</div>
      )}

      {/* Table */}
      {loaded && display.length > 0 && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] border-collapse">
              <thead>
                <tr className="border-b border-black/[0.07] bg-[#F9F8FF]">
                  {headers.map(h => (
                    <th
                      key={h.label}
                      onClick={() => h.col && toggleSort(h.col)}
                      className={`whitespace-nowrap px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[.06em] text-gray-400 ${
                        h.align === 'right' ? 'text-right' : 'text-left'
                      } ${h.col ? 'cursor-pointer select-none' : ''}`}
                    >
                      <span className="inline-flex items-center gap-1">
                        {h.label}
                        {h.col && <SortIcon col={h.col} />}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {display.map((r, ri) => (
                  <tr key={`${r.orderId}-${ri}`} className="border-b border-black/[0.05] transition-colors duration-150 last:border-0 hover:bg-gray-50/80">
                    <td className="whitespace-nowrap py-2.5 pr-3 text-[13px] text-gray-400">{fmtDate(r.refundedAt)}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-[13px] font-semibold text-gray-600">{r.orderId}</td>
                    <td className="max-w-[130px] px-3 py-2.5">
                      <div className="truncate text-[13px] font-medium text-gray-900" title={r.customer}>{r.customer}</div>
                      {r.customerEmail && <div className="mt-px truncate text-[11px] text-gray-400">{r.customerEmail}</div>}
                    </td>
                    <td className="max-w-[160px] px-3 py-2.5 text-[13px] text-gray-600">
                      <div className="truncate" title={(r.products || []).join(', ')}>{(r.products || []).join(', ') || '\u2014'}</div>
                    </td>
                    <td className="px-3 py-2.5"><CatBadge cat={r.category} small /></td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right">
                      <span className="text-xs font-medium tabular-nums text-gray-400">{r.refundPct}%</span>
                    </td>
                    <td className="whitespace-nowrap py-2.5 pl-3 text-right text-[13px] font-semibold tabular-nums text-red-600">
                      {fmtEur(Number(r.refundAmount))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sorted.length > 20 && !showAll && (
            <div className="mt-4 text-center">
              <button
                onClick={() => setShowAll(true)}
                className="rounded-full border border-[var(--border)] bg-[var(--bg-surface-2)] px-5 py-[7px] text-xs font-semibold text-[var(--text-2)] transition-all duration-150 hover:bg-[var(--bg-input)] hover:text-[var(--text-1)]"
              >
                Show all {sorted.length} refunds
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
