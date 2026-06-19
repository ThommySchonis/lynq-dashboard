import { cn } from '@/lib/utils'

interface CountBadgeProps {
  count: number
  className?: string
}

/** Small pill showing a count (inbox/notification/folder badges). Renders nothing at 0. */
export function CountBadge({ count, className }: CountBadgeProps) {
  if (count <= 0) return null
  return (
    <span
      className={cn(
        'ml-auto rounded-full bg-border px-2 py-0.5 text-xs font-medium text-foreground-3',
        className,
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}
