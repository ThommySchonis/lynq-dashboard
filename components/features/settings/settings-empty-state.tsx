import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

/**
 * Shared empty-state block (accent-soft icon box + title + description) used by
 * settings tables and the standalone empty cards. Callers supply the outer
 * padding / card wrapper via `className`, and an optional `action` (e.g. a
 * button) rendered below the description.
 */
export function SettingsEmptyState({
  Icon,
  title,
  description,
  action,
  className,
}: {
  Icon: LucideIcon
  title: string
  description: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={`flex flex-col items-center gap-2 text-center ${className ?? ''}`}>
      <div className="mb-2 flex size-12 items-center justify-center rounded-2xl bg-accent-soft">
        <Icon size={24} strokeWidth={1.75} className="text-primary" />
      </div>
      <p className="text-lg font-bold text-foreground">{title}</p>
      <p className="max-w-[320px] text-sm leading-relaxed text-muted-foreground">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
