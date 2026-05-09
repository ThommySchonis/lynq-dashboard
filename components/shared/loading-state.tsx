import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface LoadingStateProps {
  variant?: 'page' | 'cards' | 'table' | 'inline'
  count?: number
  className?: string
}

export function LoadingState({ variant = 'page', count = 3, className }: LoadingStateProps) {
  if (variant === 'cards') {
    return (
      <div className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-4', className)}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="rounded-xl border border-[var(--border)] p-5">
            <Skeleton className="mb-3 h-3 w-20" />
            <Skeleton className="h-8 w-24" />
          </div>
        ))}
      </div>
    )
  }

  if (variant === 'table') {
    return (
      <div className={cn('space-y-3', className)}>
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: count }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  if (variant === 'inline') {
    return <Skeleton className={cn('h-4 w-32', className)} />
  }

  return (
    <div className={cn('space-y-6 p-6', className)}>
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  )
}
