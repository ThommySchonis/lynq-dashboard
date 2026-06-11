'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { SettingsSection, SettingsCard } from '@/components/features/settings/settings-section'
import { MigrationWizard } from '@/components/features/migrations/MigrationWizard'
import {
  useMigrations,
  useCancelMigration,
  useRetryMigration,
} from '@/hooks/useMigrations'
import { useEmailAccounts } from '@/hooks/settings/use-settings-data'
import type { Migration, MigrationStatus } from '@/types/migrations'

const PLATFORM_LABEL: Record<Migration['source_platform'], string> = {
  gorgias:    'Gorgias',
  zendesk:    'Zendesk',
  reamaze:    'Re:amaze',
  commslayer: 'CommSlayer',
}

function statusVariant(status: MigrationStatus): 'default' | 'secondary' | 'destructive' {
  if (status === 'completed') return 'default'
  if (status === 'failed') return 'destructive'
  return 'secondary'
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function MigrationsSettingsPage() {
  const [wizardOpen, setWizardOpen] = useState(false)
  const { data: list, isLoading } = useMigrations()
  const { data: emailAccountsData } = useEmailAccounts()
  const emailAccounts = (emailAccountsData ?? []).map((a) => ({ id: a.id, email: a.email }))
  const cancel = useCancelMigration()
  const retry = useRetryMigration()

  const migrations = list?.migrations ?? []

  return (
    <div className="max-w-3xl mx-auto px-10 py-12">
      <SettingsSection
        title="Data Migration"
        description="Import conversations, tags, and macros from your previous support platform."
        actions={
          <Button onClick={() => setWizardOpen(true)}>
            New migration
          </Button>
        }
      >
        <SettingsCard>
          {isLoading ? (
            <p className="text-sm text-foreground-3 py-8 text-center">
              Loading migrations…
            </p>
          ) : migrations.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-foreground-3">No migrations yet</p>
              <p className="text-xs text-foreground-4 mt-1">
                Start one from Gorgias or Zendesk to bring your data into Lynq.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border -mx-6 -my-6">
              {migrations.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-4 px-6 py-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {PLATFORM_LABEL[m.source_platform]}
                      {m.source_subdomain && (
                        <span className="text-foreground-4 font-normal ml-1.5">
                          · {m.source_subdomain}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-foreground-4 mt-0.5">
                      Started {formatDate(m.started_at)}
                      {m.completed_at && ` · Completed ${formatDate(m.completed_at)}`}
                    </p>
                    {m.status === 'failed' && m.error && (
                      <p className="text-xs text-destructive mt-1 truncate" title={m.error}>
                        {m.error}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant={statusVariant(m.status)}>{m.status}</Badge>
                    {m.status === 'failed' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => retry.mutate(m.id)}
                        disabled={retry.isPending}
                      >
                        Retry
                      </Button>
                    )}
                    {(m.status === 'ready' || m.status === 'running' || m.status === 'draft') && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => cancel.mutate(m.id)}
                        disabled={cancel.isPending}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SettingsCard>
      </SettingsSection>

      <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
        <DialogContent className="max-w-2xl p-0">
          <MigrationWizard
            emailAccounts={emailAccounts}
            onClose={() => setWizardOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
