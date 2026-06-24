'use client'

import { cn } from '@/lib/utils'

export type StatusTone = 'success' | 'info' | 'warning' | 'destructive' | 'neutral'

const TONE_CLASSES: Record<StatusTone, { pill: string; dot: string }> = {
  success:     { pill: 'bg-success-soft text-success-strong', dot: 'bg-success-strong' },
  info:        { pill: 'bg-info-soft text-info',              dot: 'bg-info' },
  warning:     { pill: 'bg-warning-soft text-warning',        dot: 'bg-warning' },
  destructive: { pill: 'bg-destructive-soft text-destructive', dot: 'bg-destructive' },
  neutral:     { pill: 'bg-foreground/[0.06] text-foreground-3', dot: 'bg-foreground-4' },
}

/** Rounded status pill with a leading dot (Figma "Active" / "Paid" badge). */
export function StatusPill({ label, tone = 'neutral' }: { label: string; tone?: StatusTone }) {
  const c = TONE_CLASSES[tone]
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full py-1 pl-[9px] pr-2.5 text-xs font-semibold', c.pill)}>
      <span className={cn('size-1.5 rounded-full', c.dot)} />
      {label}
    </span>
  )
}
