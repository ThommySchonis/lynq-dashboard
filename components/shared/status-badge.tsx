import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const VARIANT_STYLES: Record<string, string> = {
  active:    'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  open:      'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
  pending:   'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  closed:    'bg-zinc-100 text-zinc-600 dark:bg-zinc-500/10 dark:text-zinc-400',
  delivered: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  failed:    'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  urgent:    'bg-red-50 text-red-700 border border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20',
  new:       'bg-zinc-100 text-zinc-600 dark:bg-zinc-500/10 dark:text-zinc-400',
  trial:     'bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400',
}

interface StatusBadgeProps {
  status: string
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const styles = VARIANT_STYLES[status.toLowerCase()] || VARIANT_STYLES.new
  return (
    <Badge
      variant="secondary"
      className={cn('text-[10px] font-semibold uppercase tracking-wide', styles, className)}
    >
      {status}
    </Badge>
  )
}
