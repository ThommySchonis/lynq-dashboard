import type { ReactNode } from 'react'

interface WidgetShellProps {
  title: string
  action?: string
  onAction?: () => void
  children: ReactNode
}

/**
 * Shared card shell for sidebar widgets (Figma nodes 396:8090 / 8118 / 8160).
 * White card, border, soft shadow, radius 20, padding 22, header + optional
 * action link.
 */
export function WidgetShell({ title, action, onAction, children }: WidgetShellProps) {
  return (
    <section className="flex flex-col gap-4 rounded-[20px] border border-border bg-card p-[22px] shadow-[0_12px_32px_rgba(28,15,54,0.07)]">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold leading-5 text-foreground">{title}</h2>
        {action && (
          <button
            type="button"
            onClick={onAction}
            className="cursor-pointer text-xs font-medium leading-4 text-primary transition-colors hover:text-primary-hover"
          >
            {action}
          </button>
        )}
      </div>
      {children}
    </section>
  )
}
