import type { ReactNode } from 'react'

interface SettingsSectionProps {
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
}

export function SettingsSection({ title, description, actions, children }: SettingsSectionProps) {
  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="text-lg font-medium text-foreground leading-snug">
            {title}
          </h3>
          {description && (
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex-shrink-0">{actions}</div>}
      </div>
      {children}
    </div>
  )
}

interface SettingsCardProps {
  children: ReactNode
  footer?: ReactNode
  className?: string
}

export function SettingsCard({ children, footer, className }: SettingsCardProps) {
  return (
    <div className={`bg-card border border-border rounded-xl overflow-hidden ${className ?? ''}`}>
      <div className="p-6">{children}</div>
      {footer && (
        <div className="border-t border-border px-6 py-4 flex justify-end gap-2.5">
          {footer}
        </div>
      )}
    </div>
  )
}
