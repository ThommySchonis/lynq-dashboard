'use client'

import { useState } from 'react'
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, ArrowUpDown, Inbox } from 'lucide-react'
import { EmptyState } from './empty-state'
import { cn } from '@/lib/utils'

export interface Column<T> {
  key: string
  header: string
  sortable?: boolean
  className?: string
  render: (row: T) => React.ReactNode
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  pageSize?: number
  emptyTitle?: string
  emptyDescription?: string
  onRowClick?: (row: T) => void
  className?: string
}

export function DataTable<T extends { id?: string }>({
  columns,
  data,
  pageSize = 10,
  emptyTitle = 'No data',
  emptyDescription = 'Nothing to show yet.',
  onRowClick,
  className,
}: DataTableProps<T>) {
  const [page, setPage] = useState(0)
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const sorted = sortKey
    ? [...data].sort((a, b) => {
        const aVal = (a as Record<string, unknown>)[sortKey]
        const bVal = (b as Record<string, unknown>)[sortKey]
        const cmp = String(aVal).localeCompare(String(bVal))
        return sortDir === 'asc' ? cmp : -cmp
      })
    : data

  const totalPages = Math.ceil(sorted.length / pageSize)
  const paged = sorted.slice(page * pageSize, (page + 1) * pageSize)

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  if (data.length === 0) {
    return <EmptyState icon={Inbox} title={emptyTitle} description={emptyDescription} />
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.key} className={col.className}>
                  {col.sortable ? (
                    <button
                      onClick={() => toggleSort(col.key)}
                      className="flex items-center gap-1 font-medium"
                    >
                      {col.header}
                      <ArrowUpDown size={14} className="text-foreground-4" />
                    </button>
                  ) : (
                    col.header
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.map((row, i) => (
              <TableRow
                key={row.id ?? i}
                onClick={() => onRowClick?.(row)}
                className={cn(onRowClick && 'cursor-pointer')}
              >
                {columns.map((col) => (
                  <TableCell key={col.key} className={col.className}>
                    {col.render(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {page * pageSize + 1}–{Math.min((page + 1) * pageSize, data.length)} of {data.length}
          </p>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft size={16} />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
