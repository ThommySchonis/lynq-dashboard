'use client'
import { UsagePlansTab } from './usage-plans-tab'

interface Props { open: boolean; onClose: () => void }

export function PlanSelectorModal({ open, onClose }: Props) {
  if (!open) return null
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-lg border border-border bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-medium">Compare plans</h3>
          <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground">Close</button>
        </header>
        <UsagePlansTab />
      </div>
    </div>
  )
}
