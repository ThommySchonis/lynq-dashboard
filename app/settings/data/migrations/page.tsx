'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { MigrationWizard } from '@/components/features/migrations/MigrationWizard'
import { useMigrations, useCancelMigration, useRetryMigration } from '@/hooks/useMigrations'
import { useEmailAccounts } from '@/hooks/settings/use-settings-data'

export default function MigrationsPage() {
  const [wizardOpen, setWizardOpen] = useState(false)
  const { data: list } = useMigrations()
  const { data: emailAccountsData } = useEmailAccounts()
  const emailAccounts = (emailAccountsData ?? []).map((a) => ({ id: a.id, email: a.email }))
  const cancel = useCancelMigration()
  const retry = useRetryMigration()

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Import from another platform</h1>
          <p className="text-sm text-foreground-3">Migrate conversations, tags, and macros from your old support tool.</p>
        </div>
        <Button onClick={() => setWizardOpen(true)}>+ New migration</Button>
      </header>

      <Card className="divide-y divide-border">
        {(list?.migrations ?? []).map((m) => (
          <div key={m.id} className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm font-medium capitalize">{m.source_platform}</p>
              <p className="text-xs text-foreground-4">
                Started {m.started_at ? new Date(m.started_at).toLocaleString() : '—'}
                {m.completed_at && ` · Completed ${new Date(m.completed_at).toLocaleString()}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={m.status === 'completed' ? 'default' : m.status === 'failed' ? 'destructive' : 'secondary'}>
                {m.status}
              </Badge>
              {m.status === 'failed' && (
                <Button size="sm" variant="outline" onClick={() => retry.mutate(m.id)}>Retry</Button>
              )}
              {(m.status === 'ready' || m.status === 'running' || m.status === 'draft') && (
                <Button size="sm" variant="outline" onClick={() => cancel.mutate(m.id)}>Cancel</Button>
              )}
            </div>
          </div>
        ))}
        {(list?.migrations?.length ?? 0) === 0 && (
          <div className="p-8 text-center text-sm text-foreground-3">No migrations yet.</div>
        )}
      </Card>

      <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
        <DialogContent className="max-w-2xl">
          <MigrationWizard
            emailAccounts={emailAccounts}
            onClose={() => setWizardOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
