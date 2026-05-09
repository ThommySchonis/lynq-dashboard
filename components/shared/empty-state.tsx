import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
}

export function EmptyState({ icon: Icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 rounded-xl bg-[var(--accent-soft)] p-3">
        <Icon size={24} className="text-primary" />
      </div>
      <h3 className="text-sm font-semibold text-[var(--text-1)]">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-[var(--text-3)]">{description}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction} className="mt-4" size="sm">
          {actionLabel}
        </Button>
      )}
    </div>
  )
}
