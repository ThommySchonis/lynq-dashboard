'use client'

import { Button } from '@/components/ui/button'
import { useConnectedApps, useRevokeConnectedApp, type ConnectedApp } from '@/hooks/settings/use-connected-apps'

function AppRow({ app }: { app: ConnectedApp }) {
  const revoke = useRevokeConnectedApp()

  const connectedDate = new Date(app.connectedAt).toLocaleDateString()
  const lastUsedDate = app.lastUsedAt ? new Date(app.lastUsedAt).toLocaleDateString() : '—'

  return (
    <div className="flex items-center justify-between gap-4 px-6 py-4">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-foreground">{app.clientName}</span>
        <span className="text-xs text-foreground-3">
          Connected {connectedDate} · Last used {lastUsedDate}
        </span>
      </div>
      <Button
        variant="outline"
        size="sm"
        disabled={revoke.isPending}
        onClick={() => revoke.mutate(app.clientId)}
      >
        Disconnect
      </Button>
    </div>
  )
}

export function ConnectedAppsCard() {
  const { data: apps, isLoading, isError } = useConnectedApps()

  return (
    <section className="flex flex-col gap-3.5">
      <h2 className="text-lg font-semibold text-foreground">Connected apps</h2>

      <div className="overflow-hidden rounded-2xl border border-settings-border bg-card">
        {isLoading && (
          <p className="px-6 py-5 text-sm text-foreground-3">Loading…</p>
        )}

        {isError && (
          <p className="px-6 py-5 text-sm text-foreground-3">
            Failed to load connected apps.
          </p>
        )}

        {!isLoading && !isError && (!apps || apps.length === 0) && (
          <p className="px-6 py-5 text-sm text-foreground-3">
            No assistants connected yet. Connect one above to get started.
          </p>
        )}

        {!isLoading && !isError && apps && apps.length > 0 && (
          <ul className="divide-y divide-settings-border">
            {apps.map((app) => (
              <li key={app.clientId}>
                <AppRow app={app} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
