'use client'

import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSearchStore } from '@/stores/search'

interface Props {
  collapsed: boolean
}

export function SearchButton({ collapsed }: Props) {
  const open = useSearchStore((s) => s.open)
  return (
    <button
      type="button"
      onClick={open}
      aria-label="Search"
      title="Search"
      className={cn(
        'flex items-center justify-center rounded-md text-foreground-3 transition-colors hover:bg-muted hover:text-foreground',
        collapsed ? 'size-8' : 'size-7',
      )}
    >
      <Search size={16} />
    </button>
  )
}
