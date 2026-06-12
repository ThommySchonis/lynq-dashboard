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
        'flex items-center justify-center rounded-md text-zinc-300 hover:bg-zinc-800/60 hover:text-white',
        collapsed ? 'h-8 w-8' : 'h-7 w-7 ml-auto',
      )}
    >
      <Search size={16} />
    </button>
  )
}
