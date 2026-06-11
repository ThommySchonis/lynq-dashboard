'use client'

import { Button } from '@/components/ui/button'
import { Progress as ProgressBar } from '@/components/ui/progress'
import { useMigration, useRetryMigration } from '@/hooks/useMigrations'

interface Props {
  migrationId: string
  onClose: () => void
}

function pct(p: { done: number; total: number } | undefined): number {
  if (!p || p.total === 0) return 0
  return Math.min(100, Math.round((p.done / p.total) * 100))
}

export function Progress({ migrationId, onClose }: Props) {
  const { data, isLoading } = useMigration(migrationId, { pollMs: 5000 })
  const retry = useRetryMigration()

  if (isLoading || !data) return <p>Loading…</p>
  const m = data.migration

  const isDone = m.status === 'completed'
  const isFailed = m.status === 'failed'

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">
          {isDone ? 'Migration complete' : isFailed ? 'Migration failed' : 'Importing your data'}
        </h2>
        <p className="text-sm text-foreground-3">
          {isDone ? 'You can now browse imported conversations in the inbox.'
          : isFailed ? m.error ?? 'Unknown error'
          : `Phase: ${m.phase ?? 'starting'} · This will continue in the background if you close the wizard.`}
        </p>
      </div>

      <div className="space-y-3">
        <ProgressRow label="Tags"          progress={m.progress.tags} />
        <ProgressRow label="Macros"        progress={m.progress.macros} />
        <ProgressRow label="Conversations" progress={m.progress.conversations} />
      </div>

      {isFailed && (
        <div className="space-y-2">
          <Button onClick={() => retry.mutate(migrationId)} disabled={retry.isPending} className="w-full">
            {retry.isPending ? 'Retrying…' : 'Retry'}
          </Button>
          <a href="mailto:info@lynqagency.com?subject=Migration%20failed" className="block text-center text-sm text-primary underline">
            Contact support
          </a>
        </div>
      )}

      {isDone && (
        <Button onClick={onClose} className="w-full">View imported conversations</Button>
      )}

      {!isDone && !isFailed && (
        <Button variant="outline" onClick={onClose} className="w-full">Run in background</Button>
      )}
    </div>
  )
}

function ProgressRow({ label, progress }: { label: string; progress?: { done: number; total: number } }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="text-foreground-4">{progress?.done ?? 0}{progress?.total ? ` / ${progress.total}` : ''}</span>
      </div>
      <ProgressBar value={pct(progress)} />
    </div>
  )
}
