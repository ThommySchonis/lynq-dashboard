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

const BOX = 'flex h-[34px] w-[34px] items-center justify-center rounded-lg text-[14px]'

export function TablePagination({ page, pageSize, total, onPageChange }: TablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  return (
    <div className="flex items-center justify-between pt-2">
      <span className="text-[12px] font-medium text-foreground-4">
        Showing {from}&ndash;{to} of {total}
      </span>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
          className={`${BOX} border border-border bg-card text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-40 disabled:hover:bg-card`}
        >
          <ChevronLeft size={16} />
        </button>
        {pageList(page, totalPages).map((p, i) =>
          p === 'ellipsis' ? (
            <span key={`e${i}`} className={`${BOX} text-foreground-4`}>&hellip;</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              aria-current={p === page}
              className={`${BOX} transition-colors ${
                p === page
                  ? 'bg-accent-soft font-semibold text-primary'
                  : 'font-medium text-muted-foreground hover:bg-secondary'
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
          className={`${BOX} border border-border bg-card text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-40 disabled:hover:bg-card`}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}
