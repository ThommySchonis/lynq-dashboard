import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface IconBadgeProps {
  icon: LucideIcon
  className?: string
}

/** White rounded-square badge holding a single icon (confirm / connect-store screens). */
export function IconBadge({ icon: Icon, className }: IconBadgeProps) {
  return (
    <div
      className={cn(
        'flex size-8 items-center justify-center rounded-lg bg-card',
        className,
      )}
    >
      <Icon className="size-5 text-primary" />
    </div>
  )
}
