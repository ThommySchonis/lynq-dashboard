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
        'flex size-12 items-center justify-center rounded-xl border border-border bg-card shadow-card',
        className,
      )}
    >
      <Icon className="size-6 text-primary" />
    </div>
  )
}
