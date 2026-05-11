interface PageHeaderProps {
  title: string
  description?: string
  actions?: React.ReactNode
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-[var(--text-1)]">
          {title}
        </h1>
        {description && (
          <p className="mt-0.5 text-sm text-[var(--text-3)]">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
