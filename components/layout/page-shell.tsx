import { PageHeader } from './page-header'
import { ScrollArea } from '@/components/ui/scroll-area'

interface PageShellProps {
  title: string
  description?: string
  actions?: React.ReactNode
  filters?: React.ReactNode
  children: React.ReactNode
}

export function PageShell({ title, description, actions, filters, children }: PageShellProps) {
  return (
    <div className="flex h-screen flex-col">
      <PageHeader title={title} description={description} actions={actions} />
      {filters && (
        <div className="border-b border-[var(--border)] px-6 py-2">
          {filters}
        </div>
      )}
      <ScrollArea className="flex-1">
        <div className="p-6">{children}</div>
      </ScrollArea>
    </div>
  )
}
