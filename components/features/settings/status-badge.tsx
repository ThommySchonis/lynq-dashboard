import type { ConnectionStatus } from '@/types/settings'

interface StatusBadgeProps {
  status: ConnectionStatus
  label?: string
}

const statusConfig: Record<
  ConnectionStatus,
  { dotClass: string; textClass: string; bgClass: string; borderClass: string; defaultLabel: string }
> = {
  active: {
    dotClass: 'bg-green-500',
    textClass: 'text-green-700 dark:text-green-400',
    bgClass: 'bg-green-500/10',
    borderClass: 'border-green-500/25',
    defaultLabel: 'Active',
  },
  pending: {
    dotClass: 'bg-amber-500',
    textClass: 'text-amber-700 dark:text-amber-400',
    bgClass: 'bg-amber-500/10',
    borderClass: 'border-amber-500/25',
    defaultLabel: 'Pending',
  },
  error: {
    dotClass: 'bg-red-500',
    textClass: 'text-red-600 dark:text-red-400',
    bgClass: 'bg-red-500/8',
    borderClass: 'border-red-500/25',
    defaultLabel: 'Error',
  },
  disconnected: {
    dotClass: 'bg-muted-foreground',
    textClass: 'text-muted-foreground',
    bgClass: 'bg-muted',
    borderClass: 'border-border',
    defaultLabel: 'Disconnected',
  },
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const config = statusConfig[status] ?? statusConfig.disconnected
  const displayLabel = label ?? config.defaultLabel

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-semibold ${config.bgClass} ${config.borderClass} ${config.textClass}`}
    >
      <span className={`size-1.5 rounded-full flex-shrink-0 ${config.dotClass}`} />
      {displayLabel}
    </span>
  )
}
