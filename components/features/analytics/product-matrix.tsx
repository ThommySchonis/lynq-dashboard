'use client'

import { useState } from 'react'
import { LayoutGrid } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { buildProductMatrix, fmtEur, CAT_COLORS } from '@/lib/analytics-constants'
import { CardEmptyState } from './card-empty-state'
import { TablePagination } from './table-pagination'
import type { Refund } from '@/types/analytics'

interface ProductMatrixProps {
  allRefunds: Refund[]
  loaded: boolean
}

const PAGE_SIZE = 10
const CARD = 'mb-6 rounded-[16px] border border-border bg-card p-[22px_24px]'

// Figma 916-25834 category chip palette (bg tint + brand text).
const CAT_CHIP: Record<string, { bg: string; color: string }> = {
  Quality: { bg: 'rgba(139,92,246,0.08)', color: '#8B5CF6' },
  Sizing: { bg: 'rgba(245,158,11,0.12)', color: '#B45309' },
  Damaged: { bg: 'rgba(239,68,68,0.08)', color: '#DC2626' },
  'Not as described': { bg: 'rgba(16,185,129,0.08)', color: '#047857' },
  'Changed mind': { bg: 'rgba(156,163,175,0.15)', color: '#475569' },
  Other: { bg: 'rgba(156,163,175,0.15)', color: '#475569' },
}
const RISK_CHIP: Record<string, { bg: string; color: string }> = {
  High: { bg: 'rgba(239,68,68,0.08)', color: '#DC2626' },
  Medium: { bg: 'rgba(245,158,11,0.12)', color: '#B45309' },
  Low: { bg: 'rgba(16,185,129,0.08)', color: '#047857' },
}

// Column widths (Figma)
const COL = {
  idx: 'w-[34px] shrink-0',
  cat: 'w-[190px] shrink-0',
  refunds: 'w-[90px] shrink-0 text-center',
  avg: 'w-[100px] shrink-0 text-right',
  amount: 'w-[140px] shrink-0 text-right',
  risk: 'w-[80px] shrink-0 flex justify-end',
}

function Chip({ label, palette, upper }: { label: string; palette: { bg: string; color: string }; upper?: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-[9px] py-[3px] text-[12px] font-bold ${upper ? 'uppercase' : ''}`}
      style={{ background: palette.bg, color: palette.color }}
    >
      {label}
    </span>
  )
}

function Header() {
  return (
    <div className="flex flex-col gap-[3px]">
      <div className="text-[16px] font-semibold leading-[22px] text-foreground">Product Refund Matrix</div>
      <div className="text-[12px] font-medium leading-4 text-muted-foreground">All-time &middot; products with 1+ refund &middot; sorted by count</div>
    </div>
  )
}

export function ProductMatrix({ allRefunds, loaded }: ProductMatrixProps) {
  const [page, setPage] = useState(1)

  if (!loaded) {
    return (
      <div className={CARD}>
        <Skeleton className="mb-1.5 h-[16px] w-[35%]" />
        <Skeleton className="mb-5 h-[12px] w-[25%]" />
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} className="mb-3 flex items-center gap-4">
            <Skeleton className="h-7 w-7 shrink-0 rounded-lg" />
            <Skeleton className="h-[14px] flex-1" />
            <Skeleton className="h-[14px] w-[60px]" />
            <Skeleton className="h-[14px] w-[55px]" />
            <Skeleton className="h-[14px] w-[70px]" />
          </div>
        ))}
      </div>
    )
  }

  const products = buildProductMatrix(allRefunds)

  if (products.length === 0) {
    return (
      <div className={`${CARD} flex flex-col gap-4`}>
        <Header />
        <CardEmptyState
          icon={LayoutGrid}
          title="No product refunds yet"
          description="Products with refunds will appear here once you have refunds."
          size="lg"
        />
      </div>
    )
  }

  const maxAmt = Math.max(...products.map(p => p.amount), 1)
  const pageItems = products.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className={`${CARD} flex flex-col gap-4`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <Header />
        <div className="rounded-full bg-gray-100 px-3 py-[5px] text-[12px] font-medium text-foreground-2">
          {products.length} products
        </div>
      </div>

      {/* Table */}
      <div className="flex flex-col">
        {/* Column heads */}
        <div className="flex items-center gap-4 px-2 py-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-foreground-4">
          <span className={COL.idx}>#</span>
          <span className="flex-1">Product</span>
          <span className={COL.cat}>Category</span>
          <span className={COL.refunds}>Refunds</span>
          <span className={COL.avg}>Avg %</span>
          <span className={COL.amount}>Amount Lost</span>
          <span className={COL.risk}>Risk</span>
        </div>
        <div className="h-px bg-foreground-4/[0.18]" />

        {/* Rows */}
        {pageItems.map((p, i) => {
          const risk = p.count >= 3 ? 'High' : p.count === 2 ? 'Medium' : 'Low'
          const barColor = (CAT_COLORS[p.topCat] || CAT_COLORS.Other).chartColor
          const catPalette = CAT_CHIP[p.topCat] || CAT_CHIP.Other
          return (
            <div key={p.name} className="flex items-center gap-4 border-b border-[#F1F1F5] px-2 py-[13px] last:border-0">
              <span className={`${COL.idx} text-[14px] font-medium text-foreground-4`}>{(page - 1) * PAGE_SIZE + i + 1}</span>
              <div className="flex flex-1 flex-col gap-2">
                <div className="truncate text-[14px] font-semibold text-foreground" title={p.name}>{p.name}</div>
                <div className="h-1 w-full max-w-[280px] overflow-hidden rounded-[2px] bg-[#EEF0F3]">
                  <div
                    className="h-full origin-left animate-grow-x rounded-[2px]"
                    style={{ width: `${(p.amount / maxAmt) * 100}%`, background: barColor }}
                  />
                </div>
              </div>
              <span className={COL.cat}><Chip label={p.topCat} palette={catPalette} upper /></span>
              <span className={`${COL.refunds} text-[14px] font-bold text-foreground tabular-nums`}>{p.count}</span>
              <span className={`${COL.avg} text-[14px] text-muted-foreground tabular-nums`}>{p.avgPct}%</span>
              <span className={`${COL.amount} text-[14px] font-bold text-foreground tabular-nums`}>{fmtEur(p.amount)}</span>
              <span className={COL.risk}><Chip label={risk} palette={RISK_CHIP[risk]} /></span>
            </div>
          )
        })}
      </div>

      {/* Pagination */}
      {products.length > PAGE_SIZE && (
        <TablePagination page={page} pageSize={PAGE_SIZE} total={products.length} onPageChange={setPage} />
      )}
    </div>
  )
}
