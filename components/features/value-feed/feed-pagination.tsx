'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'

interface FeedPaginationProps {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}

/** Builds a windowed page list with ellipses (Figma "1 2 3 … 6"). */
function buildPages(current: number, count: number): (number | 'ellipsis')[] {
  if (count <= 6) return Array.from({ length: count }, (_, i) => i + 1)
  const wanted = new Set<number>([1, 2, 3, count, current - 1, current, current + 1])
  const sorted = [...wanted].filter((n) => n >= 1 && n <= count).sort((a, b) => a - b)
  const result: (number | 'ellipsis')[] = []
  let prev = 0
  for (const n of sorted) {
    if (n - prev > 1) result.push('ellipsis')
    result.push(n)
    prev = n
  }
  return result
}

function ArrowButton({
  dir,
  disabled,
  onClick,
}: {
  dir: 'prev' | 'next'
  disabled: boolean
  onClick: () => void
}) {
  const Icon = dir === 'prev' ? ChevronLeft : ChevronRight
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === 'prev' ? 'Previous page' : 'Next page'}
      className="flex size-[34px] items-center justify-center rounded-md border border-border bg-card text-foreground-3 transition-colors hover:text-foreground disabled:opacity-40 disabled:hover:text-foreground-3"
    >
      <Icon className="size-4" strokeWidth={2} />
    </button>
  )
}

/**
 * Feed pagination bar (Figma node 396:8274): "Showing X–Y of N articles" + nav.
 */
export function FeedPagination({ page, pageSize, total, onPageChange }: FeedPaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)

  return (
    <div className="flex items-center justify-between pt-2">
      <span className="text-xs leading-4 text-foreground-4">
        Showing {start}–{end} of {total} article{total === 1 ? '' : 's'}
      </span>

      {pageCount > 1 && (
        <div className="flex items-center gap-1.5">
          <ArrowButton dir="prev" disabled={page <= 1} onClick={() => onPageChange(page - 1)} />
          {buildPages(page, pageCount).map((p, i) =>
            p === 'ellipsis' ? (
              <span
                key={`ellipsis-${i}`}
                className="flex size-[34px] items-center justify-center text-sm text-foreground-4"
              >
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                className={`flex size-[34px] items-center justify-center rounded-md text-sm transition-colors ${
                  p === page
                    ? 'bg-accent-soft font-semibold text-primary'
                    : 'font-medium text-foreground-3 hover:bg-accent-soft/60'
                }`}
              >
                {p}
              </button>
            ),
          )}
          <ArrowButton dir="next" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)} />
        </div>
      )}
    </div>
  )
}
