'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'

interface TablePaginationProps {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}

/** Build a compact page list with ellipses, e.g. [1, 2, 3, '…', 6]. */
function pageList(current: number, totalPages: number): (number | 'ellipsis')[] {
  if (totalPages <= 6) return Array.from({ length: totalPages }, (_, i) => i + 1)
  const pages = new Set<number>([1, totalPages, current, current - 1, current + 1])
  const sorted = [...pages].filter(p => p >= 1 && p <= totalPages).sort((a, b) => a - b)
  const out: (number | 'ellipsis')[] = []
  let prev = 0
  for (const p of sorted) {
    if (p - prev > 1) out.push('ellipsis')
    out.push(p)
    prev = p
  }
  return out
}

export function TablePagination({ page, pageSize, total, onPageChange }: TablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  return (
    <div className="flex items-center justify-between pt-2">
      <span className="text-[12px] text-muted-foreground">
        Showing {from}&ndash;{to} of {total}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground-2 transition-colors hover:bg-secondary disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <ChevronLeft size={15} />
        </button>
        {pageList(page, totalPages).map((p, i) =>
          p === 'ellipsis' ? (
            <span key={`e${i}`} className="flex h-8 w-8 items-center justify-center text-[12px] text-muted-foreground">
              &hellip;
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              aria-current={p === page}
              className={`flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-[12px] font-semibold transition-colors ${
                p === page
                  ? 'bg-accent-soft text-primary'
                  : 'text-foreground-2 hover:bg-secondary'
              }`}
            >
              {p}
            </button>
          ),
        )}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground-2 transition-colors hover:bg-secondary disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  )
}
