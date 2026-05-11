'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { buildProductMatrix, fmtEur, CAT_COLORS } from '@/lib/analytics-constants'
import { CatBadge } from './action-board'
import type { Refund } from '@/types/analytics'

interface ProductMatrixProps {
  allRefunds: Refund[]
  loaded: boolean
}

export function ProductMatrix({ allRefunds, loaded }: ProductMatrixProps) {
  if (!loaded) {
    return (
      <div className="mb-6 rounded-xl border border-white/65 bg-white/80 p-[22px_24px] shadow-sm backdrop-blur-xl">
        <Skeleton className="mb-1.5 h-[13px] w-[35%]" />
        <Skeleton className="mb-5 h-[10px] w-[25%]" />
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} className="mb-3 flex items-center gap-3.5">
            <Skeleton className="h-7 w-7 shrink-0 rounded-lg" />
            <Skeleton className="h-[13px] flex-1" />
            <Skeleton className="h-[13px] w-[60px]" />
            <Skeleton className="h-[13px] w-[55px]" />
            <Skeleton className="h-[13px] w-[70px]" />
          </div>
        ))}
      </div>
    )
  }

  const products = buildProductMatrix(allRefunds)
  if (products.length === 0) return null
  const maxAmt = Math.max(...products.map(p => p.amount), 1)

  return (
    <div className="mb-6 animate-fade-in rounded-xl border border-white/65 bg-white/80 p-[22px_24px] shadow-sm backdrop-blur-xl transition-shadow duration-200 hover:shadow-lg">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <div className="mb-0.5 text-[13px] font-semibold text-[var(--text-1)]">Product Refund Matrix</div>
          <div className="text-[11px] text-[var(--text-3)]">All-time &middot; products with 1+ refund &middot; sorted by count</div>
        </div>
        <div className="rounded-full border border-black/[0.08] bg-gray-100 px-3 py-0.5 text-[11px] font-semibold text-gray-600">
          {products.length} products
        </div>
      </div>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-black/[0.07] bg-[#F9F8FF]">
            {['#', 'Product', 'Category', 'Refunds', 'Avg %', 'Amount Lost', 'Risk'].map((h, i) => (
              <th
                key={h}
                className={`whitespace-nowrap px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[.06em] text-gray-400 ${
                  i >= 3 ? 'text-right' : 'text-left'
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {products.map((p, i) => {
            const risk = p.count >= 3
              ? { label: 'High', color: '#DC2626', bg: '#FEF2F2', border: 'rgba(220,38,38,0.15)' }
              : p.count === 2
                ? { label: 'Medium', color: '#D97706', bg: '#FFFBEB', border: 'rgba(217,119,6,0.15)' }
                : { label: 'Low', color: '#15803D', bg: '#F0FDF4', border: 'rgba(21,128,61,0.15)' }
            const cc = CAT_COLORS[p.topCat] || CAT_COLORS.Other

            return (
              <tr key={p.name} className="border-b border-black/[0.05] transition-colors duration-150 last:border-0 hover:bg-gray-50/80">
                <td className="w-7 py-2.5 text-xs font-semibold text-gray-300">{i + 1}</td>
                <td className="px-3 py-2.5">
                  <div className="max-w-[200px] truncate text-[13px] font-medium text-gray-900" title={p.name}>{p.name}</div>
                  <div className="mt-[5px] h-[3px] max-w-[180px] overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full origin-left animate-grow-x rounded-full opacity-70"
                      style={{
                        width: `${(p.amount / maxAmt) * 100}%`,
                        background: cc.chartColor,
                        animationDelay: `${i * 0.05}s`,
                      }}
                    />
                  </div>
                </td>
                <td className="px-3 py-2.5"><CatBadge cat={p.topCat} small /></td>
                <td className="px-3 py-2.5 text-right text-[13px] font-bold tabular-nums text-gray-900">{p.count}</td>
                <td className="px-3 py-2.5 text-right text-xs font-medium tabular-nums text-gray-400">{p.avgPct}%</td>
                <td className="px-3 py-2.5 text-right text-[13px] font-semibold tabular-nums text-gray-900">{fmtEur(p.amount)}</td>
                <td className="py-2.5 pl-3 text-right">
                  <span
                    className="rounded text-[10px] font-semibold"
                    style={{
                      color: risk.color,
                      background: risk.bg,
                      border: `1px solid ${risk.border}`,
                      padding: '2px 7px',
                    }}
                  >
                    {risk.label}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
